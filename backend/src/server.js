import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import db from './optimizedDatabase.js'; // Use optimized DB
import { cacheMiddleware, getCacheStats, clearCache } from './middleware/cacheMiddleware.js';
import { etagMiddleware } from './middleware/etagMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..', '..');

const app = express();
const PORT = process.env.PORT || 3003;

// CORS Configuration
// FRONTEND_ORIGIN environment variable can be set to allow specific origins
// For production deployment on Render, set this to your frontend domain
// Example: FRONTEND_ORIGIN=https://your-frontend.onrender.com
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
  'http://localhost:5173', // Vite default dev server
  'http://localhost:3002', // Vite alternate port
  'http://localhost:3003', // Same origin (backend serving frontend)
  'https://cea-viz.onrender.com', // Production domain
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, or same-origin)
    if (!origin) {
      return callback(null, true);
    }

    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS: Blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true, // Allow cookies and authentication headers
  optionsSuccessStatus: 200
};

// PERFORMANCE MIDDLEWARE (order matters!)
// 1. Compression first - compress all responses
app.use(compression({
  level: 6, // Balance between speed and compression ratio
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    // Don't compress if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Use compression filter
    return compression.filter(req, res);
  }
}));

// 2. CORS
app.use(cors(corsOptions));

// 3. JSON parsing
app.use(express.json());

// 4. ETag middleware - enable conditional requests (304 Not Modified)
app.use(etagMiddleware);

// 5. Cache middleware - cache GET requests
app.use(cacheMiddleware);

// Helper functions for filter parsing and application
/**
 * Parse filters from query string
 * @param {string} filtersString - JSON string of filters from req.query.filters
 * @returns {Object|null} - Parsed filters object, or null if invalid/missing
 */
function parseFilters(filtersString) {
  if (!filtersString) {
    return null;
  }

  try {
    return JSON.parse(filtersString);
  } catch (error) {
    // Return a special error object to indicate parsing failure
    return { __parseError: true };
  }
}


// Serve frontend static files in production
const frontendDistPath = join(ROOT_DIR, 'frontend', 'dist');
if (existsSync(frontendDistPath)) {
  console.log('Serving frontend from:', frontendDistPath);
  app.use(express.static(frontendDistPath, { index: 'index.html' }));
}

// SQLite helper functions
function getMetadata() {
  const metaRows = db.prepare('SELECT key, value FROM metadata').all();
  const meta = {};
  for (const row of metaRows) {
    try {
      meta[row.key] = JSON.parse(row.value);
    } catch {
      meta[row.key] = row.value;
    }
  }
  return {
    id: meta.id,
    name: meta.name,
    description: meta.description,
    metadata: meta.metadata,
    schema: meta.schema,
    visualizationRecommendations: meta.visualizationRecommendations
  };
}


// Routes

// Get datasets list
app.get('/api/datasets', (req, res) => {
  try {
    const datasetsPath = join(ROOT_DIR, 'data', 'processed', 'datasets.json');
    const datasets = JSON.parse(readFileSync(datasetsPath, 'utf-8'));
    res.json(datasets);
  } catch (error) {
    console.error('Error loading datasets:', error);
    res.status(500).json({ error: 'Failed to load datasets' });
  }
});

// Get dataset metadata
app.get('/api/datasets/:id', (req, res) => {
  try {
    const metadata = getMetadata();

    if (metadata.id !== req.params.id) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    // Ensure schema is always well-formed with defensive defaults
    const safeMetadata = {
      ...metadata,
      schema: {
        columns: metadata.schema?.columns || [],
        temporalColumn: metadata.schema?.temporalColumn || null
      }
    };

    res.json(safeMetadata);
  } catch (error) {
    console.error('Error loading dataset metadata:', error);
    res.status(500).json({ error: 'Failed to load dataset metadata' });
  }
});

// Get dataset data with pagination and filtering
app.get('/api/datasets/:id/data', (req, res) => {
  try {
    // Parse query parameters
    const page = parseInt(req.query.page) || 1;
    // OPTIMIZATION: Reduce default limit from 100 to 50 for faster initial loads
    const limit = Math.min(parseInt(req.query.limit) || 50, 500); // Max 500 per request (reduced from 1000)
    const offset = (page - 1) * limit;

    // Build SQL query with filters
    let sql = 'SELECT * FROM transactions';
    let countSql = 'SELECT COUNT(*) as total FROM transactions';
    const params = [];

    // Apply filters if provided
    const parsedFilters = parseFilters(req.query.filters);
    if (parsedFilters && parsedFilters.__parseError) {
      return res.status(400).json({ error: 'Invalid filters format' });
    }

    if (parsedFilters && Object.keys(parsedFilters).length > 0) {
      const whereClauses = [];
      for (const [key, value] of Object.entries(parsedFilters)) {
        if (Array.isArray(value)) {
          whereClauses.push(`${key} IN (${value.map(() => '?').join(',')})`);
          params.push(...value);
        } else {
          whereClauses.push(`${key} = ?`);
          params.push(value);
        }
      }
      const whereClause = ' WHERE ' + whereClauses.join(' AND ');
      sql += whereClause;
      countSql += whereClause;
    }

    // Get total count
    const { total } = db.prepare(countSql).get(...params);

    // Add pagination
    sql += ' LIMIT ? OFFSET ?';
    const paginatedData = db.prepare(sql).all(...params, limit, offset);

    res.json({
      data: paginatedData,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error loading dataset data:', error);
    res.status(500).json({ error: 'Failed to load dataset data' });
  }
});

// Get aggregated statistics
app.get('/api/datasets/:id/stats', (req, res) => {
  try {
    const field = req.query.field;

    if (!field) {
      return res.status(400).json({ error: 'Field parameter is required' });
    }

    // Get total count
    const { total } = db.prepare('SELECT COUNT(*) as total FROM transactions').get();

    // OPTIMIZATION: Add LIMIT to SQL query instead of slicing in JS
    const limit = req.query.limit ? parseInt(req.query.limit) : 100; // Default 100 instead of all

    const sql = `
      SELECT
        COALESCE(${field}, '(null)') as value,
        COUNT(*) as count
      FROM transactions
      GROUP BY ${field}
      ORDER BY count DESC
      LIMIT ${limit}
    `;

    const stats = db.prepare(sql).all();

    // Get unique values count
    const uniqueValues = stats.length;

    res.json({
      field,
      total,
      uniqueValues,
      stats
    });
  } catch (error) {
    console.error('Error calculating stats:', error);
    res.status(500).json({ error: 'Failed to calculate stats' });
  }
});

// Multi-dimensional analytics endpoint
app.get('/api/datasets/:id/analytics', (req, res) => {
  try {
    const { dimension1, dimension2, filters } = req.query;

    if (!dimension1) {
      return res.status(400).json({ error: 'dimension1 parameter is required' });
    }

    // Build SQL query
    const params = [];
    let sql, countSql;

    if (dimension2) {
      sql = `
        SELECT
          COALESCE(${dimension1}, 'Unknown') as ${dimension1},
          COALESCE(${dimension2}, 'Unknown') as ${dimension2},
          COUNT(*) as count
        FROM transactions
      `;
      countSql = 'SELECT COUNT(*) as total FROM transactions';
    } else {
      sql = `
        SELECT
          COALESCE(${dimension1}, 'Unknown') as ${dimension1},
          COUNT(*) as count
        FROM transactions
      `;
      countSql = 'SELECT COUNT(*) as total FROM transactions';
    }

    // Apply filters if provided
    const parsedFilters = parseFilters(filters);
    if (parsedFilters && parsedFilters.__parseError) {
      return res.status(400).json({ error: 'Invalid filters format' });
    }

    if (parsedFilters && Object.keys(parsedFilters).length > 0) {
      const whereClauses = [];
      for (const [key, value] of Object.entries(parsedFilters)) {
        if (Array.isArray(value)) {
          whereClauses.push(`${key} IN (${value.map(() => '?').join(',')})`);
          params.push(...value);
        } else {
          whereClauses.push(`${key} = ?`);
          params.push(value);
        }
      }
      const whereClause = ' WHERE ' + whereClauses.join(' AND ');
      sql += whereClause;
      countSql += whereClause;
    }

    // Add GROUP BY and ORDER BY
    if (dimension2) {
      sql += ` GROUP BY ${dimension1}, ${dimension2} ORDER BY count DESC`;
    } else {
      sql += ` GROUP BY ${dimension1} ORDER BY count DESC`;
    }

    // Execute queries
    const results = db.prepare(sql).all(...params);
    const { total } = db.prepare(countSql).get(...params);

    // Format chart data
    let chartData;
    if (dimension2) {
      chartData = results; // For 2D data, return as-is
    } else {
      // Create chart-ready format with 'name' and 'value' keys for pie charts
      chartData = results.map(item => ({
        name: item[dimension1],
        value: item.count
      }));
    }

    res.json({
      dimensions: dimension2 ? [dimension1, dimension2] : [dimension1],
      data: results,
      chartData: chartData,
      total
    });
  } catch (error) {
    console.error('Error calculating analytics:', error);
    res.status(500).json({ error: 'Failed to calculate analytics' });
  }
});

// Time-series analytics endpoint
app.get('/api/datasets/:id/timeseries', (req, res) => {
  try {
    const { period = 'month', groupBy, filters } = req.query;

    // Build SQL query with date parsing
    // Convert "MMM-YYYY" format to "YYYY-MM" or "YYYY"
    const monthConversion = `
      CASE substr(transaction_date, 1, 3)
        WHEN 'JAN' THEN '01' WHEN 'FEB' THEN '02' WHEN 'MAR' THEN '03'
        WHEN 'APR' THEN '04' WHEN 'MAY' THEN '05' WHEN 'JUN' THEN '06'
        WHEN 'JUL' THEN '07' WHEN 'AUG' THEN '08' WHEN 'SEP' THEN '09'
        WHEN 'OCT' THEN '10' WHEN 'NOV' THEN '11' WHEN 'DEC' THEN '12'
      END
    `;

    const periodExpression = period === 'year'
      ? `substr(transaction_date, -4)` // Extract "YYYY" from "MMM-YYYY"
      : `substr(transaction_date, -4) || '-' || ${monthConversion}`; // "YYYY-MM"

    const params = [];
    let sql, countSql;

    if (groupBy) {
      sql = `
        SELECT
          ${periodExpression} as period,
          COALESCE(${groupBy}, 'Unknown') as groupByValue,
          COUNT(*) as count
        FROM transactions
        WHERE transaction_date IS NOT NULL AND transaction_date != '-'
      `;
      countSql = `SELECT COUNT(*) as total FROM transactions WHERE transaction_date IS NOT NULL AND transaction_date != '-'`;
    } else {
      sql = `
        SELECT
          ${periodExpression} as period,
          COUNT(*) as count
        FROM transactions
        WHERE transaction_date IS NOT NULL AND transaction_date != '-'
      `;
      countSql = `SELECT COUNT(*) as total FROM transactions WHERE transaction_date IS NOT NULL AND transaction_date != '-'`;
    }

    // Apply filters if provided
    const parsedFilters = parseFilters(filters);
    if (parsedFilters && parsedFilters.__parseError) {
      return res.status(400).json({ error: 'Invalid filters format' });
    }

    if (parsedFilters && Object.keys(parsedFilters).length > 0) {
      const whereClauses = [];
      for (const [key, value] of Object.entries(parsedFilters)) {
        if (Array.isArray(value)) {
          whereClauses.push(`${key} IN (${value.map(() => '?').join(',')})`);
          params.push(...value);
        } else {
          whereClauses.push(`${key} = ?`);
          params.push(value);
        }
      }
      const whereClause = ' AND ' + whereClauses.join(' AND ');
      sql += whereClause;
      countSql += whereClause;
    }

    // Add GROUP BY and ORDER BY
    if (groupBy) {
      sql += ` GROUP BY period, groupByValue ORDER BY period`;
    } else {
      sql += ` GROUP BY period ORDER BY period`;
    }

    // Execute queries
    const results = db.prepare(sql).all(...params);
    const { total } = db.prepare(countSql).get(...params);

    // Transform results into the expected format
    let series;
    if (groupBy) {
      // Group by period and nest groupBy values
      const grouped = {};
      results.forEach(row => {
        if (!grouped[row.period]) {
          grouped[row.period] = {};
        }
        grouped[row.period][row.groupByValue] = row.count;
      });

      series = Object.keys(grouped).sort().map(periodKey => ({
        period: periodKey,
        ...grouped[periodKey]
      }));
    } else {
      series = results;
    }

    // OPTIMIZATION: Limit to last 36 periods for better visualization (reduced from all data)
    const chartData = series.slice(-36);

    res.json({
      period,
      groupBy: groupBy || null,
      series,
      chartData,
      total
    });
  } catch (error) {
    console.error('Error calculating time series:', error);
    res.status(500).json({ error: 'Failed to calculate time series' });
  }
});

// Market insights endpoint
app.get('/api/datasets/:id/insights', (req, res) => {
  try {
    const { filters } = req.query;
    const params = [];

    // Build WHERE clause for filters
    let whereClause = '';
    const parsedFilters = parseFilters(filters);
    if (parsedFilters && parsedFilters.__parseError) {
      return res.status(400).json({ error: 'Invalid filters format' });
    }

    if (parsedFilters && Object.keys(parsedFilters).length > 0) {
      const whereClauses = [];
      for (const [key, value] of Object.entries(parsedFilters)) {
        if (Array.isArray(value)) {
          whereClauses.push(`${key} IN (${value.map(() => '?').join(',')})`);
          params.push(...value);
        } else {
          whereClauses.push(`${key} = ?`);
          params.push(value);
        }
      }
      whereClause = ' WHERE ' + whereClauses.join(' AND ');
    }

    // Get total transactions
    const { totalTransactions } = db.prepare(`SELECT COUNT(*) as totalTransactions FROM transactions${whereClause}`).get(...params);

    // Get date range
    const dateRangeQuery = `
      SELECT
        MIN(transaction_date) as start,
        MAX(transaction_date) as end
      FROM transactions
      ${whereClause ? whereClause + ' AND' : 'WHERE'} transaction_date IS NOT NULL AND transaction_date != '-'
    `;
    const dateRange = db.prepare(dateRangeQuery).get(...params);

    // Property type distribution
    const propertyTypeQuery = `
      SELECT
        COALESCE(property_type, 'Unknown') as name,
        COUNT(*) as count,
        ROUND(CAST(COUNT(*) AS FLOAT) / ${totalTransactions} * 100, 1) as percentage
      FROM transactions
      ${whereClause}
      GROUP BY property_type
      ORDER BY count DESC
    `;
    const propertyTypes = db.prepare(propertyTypeQuery).all(...params);
    const topPropertyType = propertyTypes[0];

    // Transaction type distribution
    const transactionTypeQuery = `
      SELECT
        COALESCE(transaction_type, 'Unknown') as name,
        COUNT(*) as count,
        ROUND(CAST(COUNT(*) AS FLOAT) / ${totalTransactions} * 100, 1) as percentage
      FROM transactions
      ${whereClause}
      GROUP BY transaction_type
      ORDER BY count DESC
    `;
    const transactionTypes = db.prepare(transactionTypeQuery).all(...params);
    const topTransactionType = transactionTypes[0];

    // Representation distribution
    const representedQuery = `
      SELECT
        COALESCE(represented, 'Unknown') as name,
        COUNT(*) as count,
        ROUND(CAST(COUNT(*) AS FLOAT) / ${totalTransactions} * 100, 1) as percentage
      FROM transactions
      ${whereClause}
      GROUP BY represented
      ORDER BY count DESC
    `;
    const represented = db.prepare(representedQuery).all(...params);

    // Monthly trends
    const monthConversion = `
      CASE substr(transaction_date, 1, 3)
        WHEN 'JAN' THEN '01' WHEN 'FEB' THEN '02' WHEN 'MAR' THEN '03'
        WHEN 'APR' THEN '04' WHEN 'MAY' THEN '05' WHEN 'JUN' THEN '06'
        WHEN 'JUL' THEN '07' WHEN 'AUG' THEN '08' WHEN 'SEP' THEN '09'
        WHEN 'OCT' THEN '10' WHEN 'NOV' THEN '11' WHEN 'DEC' THEN '12'
      END
    `;
    const monthlyQuery = `
      SELECT
        substr(transaction_date, -4) || '-' || ${monthConversion} as period,
        COUNT(*) as count
      FROM transactions
      ${whereClause}${whereClause ? ' AND' : ' WHERE'} transaction_date IS NOT NULL AND transaction_date != '-'
      GROUP BY period
      ORDER BY period
    `;
    const monthlyData = db.prepare(monthlyQuery).all(...params);
    const monthlyAverage = monthlyData.length > 0
      ? Math.round(monthlyData.reduce((sum, row) => sum + row.count, 0) / monthlyData.length)
      : 0;

    // Yearly growth
    const yearlyQuery = `
      SELECT
        substr(transaction_date, -4) as year,
        COUNT(*) as count
      FROM transactions
      ${whereClause}${whereClause ? ' AND' : ' WHERE'} transaction_date IS NOT NULL AND transaction_date != '-'
      GROUP BY year
      ORDER BY year
    `;
    const yearlyData = db.prepare(yearlyQuery).all(...params);
    let yearlyGrowth = 0;
    if (yearlyData.length >= 2) {
      const lastYear = yearlyData[yearlyData.length - 1].count;
      const prevYear = yearlyData[yearlyData.length - 2].count;
      yearlyGrowth = ((lastYear - prevYear) / prevYear * 100).toFixed(1);
    }

    res.json({
      summary: {
        totalTransactions,
        dateRange,
        topPropertyType,
        topTransactionType
      },
      trends: {
        monthlyAverage,
        yearlyGrowth: `${yearlyGrowth}%`
      },
      distributions: {
        propertyTypes,
        transactionTypes,
        represented
      }
    });
  } catch (error) {
    console.error('Error calculating insights:', error);
    res.status(500).json({ error: 'Failed to calculate insights' });
  }
});

// Top agents ranking endpoint
// OPTIMIZATION: This is the most expensive endpoint - heavy use of aggregations
app.get('/api/datasets/:id/agents/top', (req, res) => {
  try {
    // OPTIMIZATION: Reduce default limit from 100 to 50 for faster response
    const { limit = 50, filters, search } = req.query;
    const params = [];

    // OPTIMIZATION: Use precomputed table when no filters/search
    if (!filters && !search) {
      // Fast path: Use precomputed top_agents table
      const topAgents = db.prepare('SELECT * FROM top_agents ORDER BY totalTransactions DESC LIMIT ?').all(parseInt(limit));
      const { total } = db.prepare('SELECT COUNT(*) as total FROM top_agents').get();

      // Get batch metrics
      const agentRegNums = topAgents.map(a => a.regNum);
      const batchParams = [];
      let batchWhere = `WHERE salesperson_reg_num IN (${agentRegNums.map(() => '?').join(',')})`;
      batchParams.push(...agentRegNums);

      // Batch query for top property types
      const topPropertyTypesQuery = `
        WITH ranked AS (
          SELECT
            salesperson_reg_num,
            property_type,
            COUNT(*) as count,
            ROW_NUMBER() OVER (PARTITION BY salesperson_reg_num ORDER BY COUNT(*) DESC) as rank
          FROM transactions
          ${batchWhere}
          GROUP BY salesperson_reg_num, property_type
        )
        SELECT salesperson_reg_num, property_type, count
        FROM ranked
        WHERE rank = 1
      `;
      const topPropertyTypesMap = new Map();
      db.prepare(topPropertyTypesQuery).all(...batchParams).forEach(row => {
        topPropertyTypesMap.set(row.salesperson_reg_num, [row.property_type, row.count]);
      });

      // Batch query for top transaction types
      const topTransactionTypesQuery = `
        WITH ranked AS (
          SELECT
            salesperson_reg_num,
            transaction_type,
            COUNT(*) as count,
            ROW_NUMBER() OVER (PARTITION BY salesperson_reg_num ORDER BY COUNT(*) DESC) as rank
          FROM transactions
          ${batchWhere}
          GROUP BY salesperson_reg_num, transaction_type
        )
        SELECT salesperson_reg_num, transaction_type, count
        FROM ranked
        WHERE rank = 1
      `;
      const topTransactionTypesMap = new Map();
      db.prepare(topTransactionTypesQuery).all(...batchParams).forEach(row => {
        topTransactionTypesMap.set(row.salesperson_reg_num, [row.transaction_type, row.count]);
      });

      const agentsWithDetails = topAgents.map(agent => ({
        ...agent,
        topPropertyType: topPropertyTypesMap.get(agent.regNum) || ['Unknown', 0],
        topTransactionType: topTransactionTypesMap.get(agent.regNum) || ['Unknown', 0],
        topRepresentation: ['Unknown', 0],
        topTown: null
      }));

      const totalTransactions = agentsWithDetails.reduce((sum, a) => sum + a.totalTransactions, 0);
      const averageTransactions = agentsWithDetails.length > 0
        ? (totalTransactions / agentsWithDetails.length).toFixed(0)
        : 0;

      return res.json({
        total,
        showing: agentsWithDetails.length,
        agents: agentsWithDetails,
        statistics: {
          averageTransactions: parseFloat(averageTransactions),
          topAgentMarketShare: 0,
          top10MarketShare: 0,
          totalTransactions
        }
      });
    }

    // Slow path: Dynamic filtering (keep original logic)
    // Build WHERE clause for filters
    let whereClause = 'WHERE salesperson_reg_num IS NOT NULL AND salesperson_reg_num != \'-\' AND salesperson_reg_num != \'\'';
    const parsedFilters = parseFilters(filters);
    if (parsedFilters && parsedFilters.__parseError) {
      return res.status(400).json({ error: 'Invalid filters format' });
    }

    if (parsedFilters && Object.keys(parsedFilters).length > 0) {
      const whereClauses = [];
      for (const [key, value] of Object.entries(parsedFilters)) {
        if (Array.isArray(value)) {
          whereClauses.push(`${key} IN (${value.map(() => '?').join(',')})`);
          params.push(...value);
        } else {
          whereClauses.push(`${key} = ?`);
          params.push(value);
        }
      }
      whereClause += ' AND ' + whereClauses.join(' AND ');
    }

    // Add search filter if provided
    if (search && search.trim()) {
      whereClause += ` AND (salesperson_name LIKE ? OR salesperson_reg_num LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    // Get top agents by transaction count
    const agentsQuery = `
      SELECT
        salesperson_reg_num as regNum,
        salesperson_name as name,
        COUNT(*) as totalTransactions
      FROM transactions
      ${whereClause}
      GROUP BY salesperson_reg_num, salesperson_name
      ORDER BY totalTransactions DESC
      LIMIT ?
    `;
    params.push(parseInt(limit));
    const topAgents = db.prepare(agentsQuery).all(...params);

    // Get total unique agents count (without limit)
    const totalAgentsQuery = `
      SELECT COUNT(DISTINCT salesperson_reg_num) as total
      FROM transactions
      ${whereClause}
    `;
    const { total } = db.prepare(totalAgentsQuery).get(...params.slice(0, -1)); // Exclude limit param

    // Batch query optimization: Get top metrics for all agents at once
    // Collect all agent registration numbers
    const agentRegNums = topAgents.map(a => a.regNum);
    const batchParams = [];

    // Build base WHERE clause for batch queries
    let batchWhere = `WHERE salesperson_reg_num IN (${agentRegNums.map(() => '?').join(',')})`;
    batchParams.push(...agentRegNums);

    // Add filter constraints if present
    if (parsedFilters && Object.keys(parsedFilters).length > 0) {
      for (const [key, value] of Object.entries(parsedFilters)) {
        if (Array.isArray(value)) {
          batchWhere += ` AND ${key} IN (${value.map(() => '?').join(',')})`;
          batchParams.push(...value);
        } else {
          batchWhere += ` AND ${key} = ?`;
          batchParams.push(value);
        }
      }
    }

    // Batch query for top property types
    const topPropertyTypesQuery = `
      WITH ranked AS (
        SELECT
          salesperson_reg_num,
          property_type,
          COUNT(*) as count,
          ROW_NUMBER() OVER (PARTITION BY salesperson_reg_num ORDER BY COUNT(*) DESC) as rank
        FROM transactions
        ${batchWhere}
        GROUP BY salesperson_reg_num, property_type
      )
      SELECT salesperson_reg_num, property_type, count
      FROM ranked
      WHERE rank = 1
    `;
    const topPropertyTypesMap = new Map();
    db.prepare(topPropertyTypesQuery).all(...batchParams).forEach(row => {
      topPropertyTypesMap.set(row.salesperson_reg_num, [row.property_type, row.count]);
    });

    // Batch query for top transaction types
    const topTransactionTypesQuery = `
      WITH ranked AS (
        SELECT
          salesperson_reg_num,
          transaction_type,
          COUNT(*) as count,
          ROW_NUMBER() OVER (PARTITION BY salesperson_reg_num ORDER BY COUNT(*) DESC) as rank
        FROM transactions
        ${batchWhere}
        GROUP BY salesperson_reg_num, transaction_type
      )
      SELECT salesperson_reg_num, transaction_type, count
      FROM ranked
      WHERE rank = 1
    `;
    const topTransactionTypesMap = new Map();
    db.prepare(topTransactionTypesQuery).all(...batchParams).forEach(row => {
      topTransactionTypesMap.set(row.salesperson_reg_num, [row.transaction_type, row.count]);
    });

    // Batch query for top representation
    const topRepresentationQuery = `
      WITH ranked AS (
        SELECT
          salesperson_reg_num,
          represented,
          COUNT(*) as count,
          ROW_NUMBER() OVER (PARTITION BY salesperson_reg_num ORDER BY COUNT(*) DESC) as rank
        FROM transactions
        ${batchWhere}
        GROUP BY salesperson_reg_num, represented
      )
      SELECT salesperson_reg_num, represented, count
      FROM ranked
      WHERE rank = 1
    `;
    const topRepresentationMap = new Map();
    db.prepare(topRepresentationQuery).all(...batchParams).forEach(row => {
      topRepresentationMap.set(row.salesperson_reg_num, [row.represented, row.count]);
    });

    // Batch query for top towns (excluding '-')
    const topTownsQuery = `
      WITH ranked AS (
        SELECT
          salesperson_reg_num,
          town,
          COUNT(*) as count,
          ROW_NUMBER() OVER (PARTITION BY salesperson_reg_num ORDER BY COUNT(*) DESC) as rank
        FROM transactions
        ${batchWhere} AND town != '-'
        GROUP BY salesperson_reg_num, town
      )
      SELECT salesperson_reg_num, town, count
      FROM ranked
      WHERE rank = 1
    `;
    const topTownsMap = new Map();
    db.prepare(topTownsQuery).all(...batchParams).forEach(row => {
      topTownsMap.set(row.salesperson_reg_num, [row.town, row.count]);
    });

    // Map results back to agents
    const agentsWithDetails = topAgents.map(agent => {
      return {
        ...agent,
        topPropertyType: topPropertyTypesMap.get(agent.regNum) || ['Unknown', 0],
        topTransactionType: topTransactionTypesMap.get(agent.regNum) || ['Unknown', 0],
        topRepresentation: topRepresentationMap.get(agent.regNum) || ['Unknown', 0],
        topTown: topTownsMap.get(agent.regNum) || null,
        propertyTypes: {},
        transactionTypes: {},
        representation: {},
        towns: {},
        districts: {}
      };
    });

    // Calculate aggregate statistics
    const totalTransactions = agentsWithDetails.reduce((sum, a) => sum + a.totalTransactions, 0);
    const averageTransactions = agentsWithDetails.length > 0
      ? (totalTransactions / agentsWithDetails.length).toFixed(0)
      : 0;

    const topAgentMarketShare = agentsWithDetails.length > 0 && totalTransactions > 0
      ? ((agentsWithDetails[0].totalTransactions / totalTransactions) * 100).toFixed(1)
      : '0.0';

    const top10Transactions = agentsWithDetails.slice(0, 10).reduce((sum, a) => sum + a.totalTransactions, 0);
    const top10MarketShare = totalTransactions > 0
      ? ((top10Transactions / totalTransactions) * 100).toFixed(1)
      : '0.0';

    res.json({
      total,
      showing: agentsWithDetails.length,
      agents: agentsWithDetails,
      statistics: {
        averageTransactions: parseFloat(averageTransactions),
        topAgentMarketShare: parseFloat(topAgentMarketShare),
        top10MarketShare: parseFloat(top10MarketShare),
        totalTransactions
      }
    });
  } catch (error) {
    console.error('Error calculating top agents:', error);
    res.status(500).json({ error: 'Failed to calculate top agents' });
  }
});

// Individual agent profile endpoint
app.get('/api/datasets/:id/agents/:regNum', (req, res) => {
  try {
    const { regNum } = req.params;

    // Get agent basic info and transaction count
    const agentQuery = `
      SELECT
        salesperson_name as name,
        salesperson_reg_num as regNum,
        COUNT(*) as totalTransactions
      FROM transactions
      WHERE salesperson_reg_num = ?
      GROUP BY salesperson_name, salesperson_reg_num
    `;
    const agent = db.prepare(agentQuery).get(regNum);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Get date range
    const dateRangeQuery = `
      SELECT
        MIN(transaction_date) as start,
        MAX(transaction_date) as end
      FROM transactions
      WHERE salesperson_reg_num = ?
        AND transaction_date IS NOT NULL
        AND transaction_date != '-'
    `;
    const dateRange = db.prepare(dateRangeQuery).get(regNum);

    // Property type breakdown
    const propertyTypeQuery = `
      SELECT
        property_type as type,
        COUNT(*) as count,
        ROUND(CAST(COUNT(*) AS FLOAT) / ${agent.totalTransactions} * 100, 1) as percentage
      FROM transactions
      WHERE salesperson_reg_num = ?
      GROUP BY property_type
      ORDER BY count DESC
    `;
    const propertyTypes = db.prepare(propertyTypeQuery).all(regNum);

    // Transaction type breakdown
    const transactionTypeQuery = `
      SELECT
        transaction_type as type,
        COUNT(*) as count,
        ROUND(CAST(COUNT(*) AS FLOAT) / ${agent.totalTransactions} * 100, 1) as percentage
      FROM transactions
      WHERE salesperson_reg_num = ?
      GROUP BY transaction_type
      ORDER BY count DESC
    `;
    const transactionTypes = db.prepare(transactionTypeQuery).all(regNum);

    // Representation breakdown
    const representationQuery = `
      SELECT
        represented as type,
        COUNT(*) as count,
        ROUND(CAST(COUNT(*) AS FLOAT) / ${agent.totalTransactions} * 100, 1) as percentage
      FROM transactions
      WHERE salesperson_reg_num = ?
      GROUP BY represented
      ORDER BY count DESC
    `;
    const representation = db.prepare(representationQuery).all(regNum);

    // Top 10 towns
    const topTownsQuery = `
      SELECT
        town,
        COUNT(*) as count,
        ROUND(CAST(COUNT(*) AS FLOAT) / ${agent.totalTransactions} * 100, 1) as percentage
      FROM transactions
      WHERE salesperson_reg_num = ? AND town != '-'
      GROUP BY town
      ORDER BY count DESC
      LIMIT 10
    `;
    const topTowns = db.prepare(topTownsQuery).all(regNum);

    // Monthly activity time series
    const monthConversion = `
      CASE substr(transaction_date, 1, 3)
        WHEN 'JAN' THEN '01' WHEN 'FEB' THEN '02' WHEN 'MAR' THEN '03'
        WHEN 'APR' THEN '04' WHEN 'MAY' THEN '05' WHEN 'JUN' THEN '06'
        WHEN 'JUL' THEN '07' WHEN 'AUG' THEN '08' WHEN 'SEP' THEN '09'
        WHEN 'OCT' THEN '10' WHEN 'NOV' THEN '11' WHEN 'DEC' THEN '12'
      END
    `;
    const monthlyActivityQuery = `
      SELECT
        substr(transaction_date, -4) || '-' || ${monthConversion} as period,
        COUNT(*) as count
      FROM transactions
      WHERE salesperson_reg_num = ?
        AND transaction_date IS NOT NULL
        AND transaction_date != '-'
      GROUP BY period
      ORDER BY period
    `;
    const monthlyActivity = db.prepare(monthlyActivityQuery).all(regNum);

    res.json({
      agent,
      dateRange,
      propertyTypes,
      transactionTypes,
      representation,
      topTowns,
      monthlyActivity
    });
  } catch (error) {
    console.error('Error fetching agent profile:', error);
    res.status(500).json({ error: 'Failed to fetch agent profile' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Cache management endpoints
app.get('/api/cache/stats', getCacheStats);
app.post('/api/cache/clear', clearCache);
app.post('/api/cache/clear/:datasetId', clearCache);

// Catch-all route - serve frontend for client-side routing
// Only used in production when frontend is built
// Use middleware instead of route for Express 5 compatibility
if (existsSync(frontendDistPath)) {
  app.use((req, res) => {
    const indexPath = join(frontendDistPath, 'index.html');
    res.sendFile(indexPath);
  });
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API server running on http://0.0.0.0:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Datasets: http://localhost:${PORT}/api/datasets`);
  console.log('Using SQLite database for efficient queries');
});
