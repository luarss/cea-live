import express from 'express';
import cors from 'cors';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import db from './database.js';

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

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

const MAX_CACHED_RESPONSES = 500;
const responseCache = new Map();
export const PRECOMPUTED_RESPONSES_PATH = join(ROOT_DIR, 'data', 'processed', 'precomputed-responses.json');

app.use('/api', (req, res, next) => {
  if (req.method !== 'GET') {
    return next();
  }

  const cacheKey = req.originalUrl;
  if (responseCache.has(cacheKey)) {
    return res.json(responseCache.get(cacheKey));
  }

  const sendJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode === 200) {
      if (responseCache.size >= MAX_CACHED_RESPONSES) {
        responseCache.delete(responseCache.keys().next().value);
      }
      responseCache.set(cacheKey, body);
    }
    return sendJson(body);
  };
  next();
});

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

// Columns that may be safely interpolated into SQL (filter keys, GROUP BY
// fields, dimensions). Every such value from the query string must be
// checked against this set before it touches a query string.
const ALLOWED_COLUMNS = new Set([
  'salesperson_name',
  'transaction_date',
  'salesperson_reg_num',
  'property_type',
  'transaction_type',
  'represented',
  'town',
  'district',
  'general_location'
]);

/**
 * Build parameterized SQL filter conditions from a parsed filters object,
 * validating every field name against ALLOWED_COLUMNS.
 * @param {Object|null} parsedFilters
 * @returns {{conditions: string|null, params: Array, invalidField: string|null}}
 */
function buildFilterConditions(parsedFilters) {
  if (!parsedFilters || Object.keys(parsedFilters).length === 0) {
    return { conditions: null, params: [], invalidField: null };
  }

  const clauses = [];
  const params = [];

  for (const [key, value] of Object.entries(parsedFilters)) {
    if (!ALLOWED_COLUMNS.has(key)) {
      return { conditions: null, params: [], invalidField: key };
    }
    if (Array.isArray(value)) {
      clauses.push(`${key} IN (${value.map(() => '?').join(',')})`);
      params.push(...value);
    } else {
      clauses.push(`${key} = ?`);
      params.push(value);
    }
  }

  return { conditions: clauses.join(' AND '), params, invalidField: null };
}


// Serve frontend static files in production
const frontendDistPath = join(ROOT_DIR, 'frontend', 'dist');
if (existsSync(frontendDistPath)) {
  console.log('Serving frontend from:', frontendDistPath);
  const hashedAssetsPath = join(frontendDistPath, 'assets');
  app.use(express.static(frontendDistPath, {
    index: 'index.html',
    setHeaders: (res, filePath) => {
      if (filePath.startsWith(hashedAssetsPath)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }
  }));
}

// SQLite helper functions
// Metadata is build-time constant, so it's computed once and reused across
// requests instead of re-querying and re-parsing it every call.
let cachedMetadata = null;
function getMetadata() {
  if (cachedMetadata) {
    return cachedMetadata;
  }

  const metaRows = db.prepare('SELECT key, value FROM metadata').all();
  const meta = {};
  for (const row of metaRows) {
    try {
      meta[row.key] = JSON.parse(row.value);
    } catch {
      meta[row.key] = row.value;
    }
  }
  cachedMetadata = {
    id: meta.id,
    name: meta.name,
    description: meta.description,
    metadata: meta.metadata,
    schema: meta.schema,
    visualizationRecommendations: meta.visualizationRecommendations
  };
  return cachedMetadata;
}


// Routes

// Datasets catalog is build-time constant; load it lazily on first request
// and reuse it thereafter instead of re-reading/re-parsing the file every
// call. A failed read is not cached, so it's retried on the next request.
let cachedDatasets = null;

// Get datasets list
app.get('/api/datasets', (req, res) => {
  try {
    if (!cachedDatasets) {
      const datasetsPath = join(ROOT_DIR, 'data', 'processed', 'datasets.json');
      cachedDatasets = JSON.parse(readFileSync(datasetsPath, 'utf-8'));
    }
    res.json(cachedDatasets);
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
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000); // Max 1000 per request
    const offset = (page - 1) * limit;

    // Build SQL query with filters
    let sql = 'SELECT * FROM transactions';
    let countSql = 'SELECT COUNT(*) as total FROM transactions';

    // Apply filters if provided
    const parsedFilters = parseFilters(req.query.filters);
    if (parsedFilters && parsedFilters.__parseError) {
      return res.status(400).json({ error: 'Invalid filters format' });
    }

    const { conditions, params, invalidField } = buildFilterConditions(parsedFilters);
    if (invalidField) {
      return res.status(400).json({ error: `Invalid filter field: ${invalidField}` });
    }

    if (conditions) {
      const whereClause = ' WHERE ' + conditions;
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
    if (!ALLOWED_COLUMNS.has(field)) {
      return res.status(400).json({ error: `Invalid field: ${field}` });
    }

    // Get total count
    const { total } = db.prepare('SELECT COUNT(*) as total FROM transactions').get();

    // Get unique values count without materializing every group
    const { uniqueValues } = db.prepare(`
      SELECT COUNT(DISTINCT COALESCE(${field}, '(null)')) as uniqueValues
      FROM transactions
    `).get();

    // Get value counts using SQL GROUP BY, with LIMIT applied in SQL
    // rather than after fetching every group into memory
    let sql = `
      SELECT
        COALESCE(${field}, '(null)') as value,
        COUNT(*) as count
      FROM transactions
      GROUP BY ${field}
      ORDER BY count DESC
    `;
    const sqlParams = [];
    if (req.query.limit) {
      sql += ' LIMIT ?';
      sqlParams.push(parseInt(req.query.limit));
    }

    const stats = db.prepare(sql).all(...sqlParams);

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
const MAX_GROUPS = 1000;
app.get('/api/datasets/:id/analytics', (req, res) => {
  try {
    const { dimension1, dimension2, filters, limit } = req.query;

    if (!dimension1) {
      return res.status(400).json({ error: 'dimension1 parameter is required' });
    }
    if (!ALLOWED_COLUMNS.has(dimension1)) {
      return res.status(400).json({ error: `Invalid dimension1: ${dimension1}` });
    }
    if (dimension2 && !ALLOWED_COLUMNS.has(dimension2)) {
      return res.status(400).json({ error: `Invalid dimension2: ${dimension2}` });
    }

    const effectiveLimit = Math.min(Math.max(parseInt(limit) || MAX_GROUPS, 1), MAX_GROUPS);

    // Build SQL query
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

    const { conditions, params, invalidField } = buildFilterConditions(parsedFilters);
    if (invalidField) {
      return res.status(400).json({ error: `Invalid filter field: ${invalidField}` });
    }

    if (conditions) {
      const whereClause = ' WHERE ' + conditions;
      sql += whereClause;
      countSql += whereClause;
    }

    // Add GROUP BY, ORDER BY, and LIMIT (fetch one extra row to detect truncation
    // cheaply, without a second full-table COUNT(DISTINCT ...) scan)
    if (dimension2) {
      sql += ` GROUP BY ${dimension1}, ${dimension2} ORDER BY count DESC LIMIT ?`;
    } else {
      sql += ` GROUP BY ${dimension1} ORDER BY count DESC LIMIT ?`;
    }
    const sqlParams = [...params, effectiveLimit + 1];

    // Execute queries
    let results = db.prepare(sql).all(...sqlParams);
    const { total } = db.prepare(countSql).get(...params);

    const truncated = results.length > effectiveLimit;
    if (truncated) {
      results = results.slice(0, effectiveLimit);
    }

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
      total,
      truncated
    });
  } catch (error) {
    console.error('Error calculating analytics:', error);
    res.status(500).json({ error: 'Failed to calculate analytics' });
  }
});

// Bound the number of distinct groupBy series returned by /timeseries so a
// high-cardinality column (e.g. salesperson_name with 32k+ distinct values)
// can't blow up the response into tens-of-thousands-of-properties objects.
const MAX_SERIES = 12;
const MAX_SERIES_CEILING = 50;

// Time-series analytics endpoint
app.get('/api/datasets/:id/timeseries', (req, res) => {
  try {
    const { period = 'month', groupBy, filters, seriesLimit } = req.query;

    if (groupBy && !ALLOWED_COLUMNS.has(groupBy)) {
      return res.status(400).json({ error: `Invalid groupBy: ${groupBy}` });
    }

    // Clamp the requested series limit into [1, MAX_SERIES_CEILING], defaulting
    // to MAX_SERIES when absent or not a valid number.
    const parsedSeriesLimit = parseInt(seriesLimit, 10);
    const effectiveSeriesLimit = Number.isFinite(parsedSeriesLimit)
      ? Math.min(Math.max(parsedSeriesLimit, 1), MAX_SERIES_CEILING)
      : MAX_SERIES;

    // period_month is precomputed as "YYYY-MM" at build time (see main.js),
    // so grouping by it is a plain indexed GROUP BY instead of a per-row
    // CASE/substr expression over transaction_date.
    const periodExpression = period === 'year'
      ? `substr(period_month, 1, 4)` // Extract "YYYY" from "YYYY-MM"
      : `period_month`;

    // Apply filters if provided (computed up-front since the top-N query
    // below, when groupBy is present, needs the same WHERE conditions).
    const parsedFilters = parseFilters(filters);
    if (parsedFilters && parsedFilters.__parseError) {
      return res.status(400).json({ error: 'Invalid filters format' });
    }

    const { conditions, params, invalidField } = buildFilterConditions(parsedFilters);
    if (invalidField) {
      return res.status(400).json({ error: `Invalid filter field: ${invalidField}` });
    }

    let sql, countSql;
    let topValues = [];

    if (groupBy) {
      // Find the top-N groupBy values by total count (honoring the same
      // filters as the main query), so the main query can fold everything
      // else into a single 'Other' bucket and stay bounded to N+1 series.
      let topSql = `
        SELECT ${groupBy} as groupByValue, COUNT(*) as cnt
        FROM transactions
        WHERE period_month IS NOT NULL
      `;
      const topParams = [...params];
      if (conditions) {
        topSql += ' AND ' + conditions;
      }
      topSql += ` GROUP BY ${groupBy} ORDER BY cnt DESC LIMIT ?`;
      topParams.push(effectiveSeriesLimit);

      const topRows = db.prepare(topSql).all(...topParams);
      topValues = topRows.map(row => row.groupByValue);

      const inPlaceholders = topValues.map(() => '?').join(',');
      sql = `
        SELECT
          ${periodExpression} as period,
          CASE WHEN ${groupBy} IN (${inPlaceholders}) THEN COALESCE(${groupBy}, 'Unknown') ELSE 'Other' END as groupByValue,
          COUNT(*) as count
        FROM transactions
        WHERE period_month IS NOT NULL
      `;
      countSql = `SELECT COUNT(*) as total FROM transactions WHERE period_month IS NOT NULL`;
    } else {
      sql = `
        SELECT
          ${periodExpression} as period,
          COUNT(*) as count
        FROM transactions
        WHERE period_month IS NOT NULL
      `;
      countSql = `SELECT COUNT(*) as total FROM transactions WHERE period_month IS NOT NULL`;
    }

    if (conditions) {
      const whereClause = ' AND ' + conditions;
      sql += whereClause;
      countSql += whereClause;
    }

    // Add GROUP BY and ORDER BY
    if (groupBy) {
      sql += ` GROUP BY period, groupByValue ORDER BY period`;
    } else {
      sql += ` GROUP BY period ORDER BY period`;
    }

    // Execute queries. When groupBy is set, the CASE WHEN's IN (...) list in
    // the SELECT clause is bound first, followed by the filter params in the
    // WHERE clause, matching the order '?' placeholders appear in the SQL text.
    const mainParams = groupBy ? [...topValues, ...params] : params;
    const results = db.prepare(sql).all(...mainParams);
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

    // Create chart-ready data (limit to last 24 periods for better visualization)
    const chartData = series.slice(-24);

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

    // Build WHERE clause for filters
    const parsedFilters = parseFilters(filters);
    if (parsedFilters && parsedFilters.__parseError) {
      return res.status(400).json({ error: 'Invalid filters format' });
    }

    const { conditions, params, invalidField } = buildFilterConditions(parsedFilters);
    if (invalidField) {
      return res.status(400).json({ error: `Invalid filter field: ${invalidField}` });
    }
    const whereClause = conditions ? ' WHERE ' + conditions : '';

    // Get total transactions
    const { totalTransactions } = db.prepare(`SELECT COUNT(*) as totalTransactions FROM transactions${whereClause}`).get(...params);

    // Get date range
    const datedRows = `FROM transactions ${whereClause ? whereClause + ' AND' : 'WHERE'} period_month IS NOT NULL`;
    const dateRangeQuery = `
      SELECT
        (SELECT transaction_date ${datedRows} ORDER BY period_month ASC LIMIT 1) as start,
        (SELECT transaction_date ${datedRows} ORDER BY period_month DESC LIMIT 1) as end
    `;
    const dateRange = db.prepare(dateRangeQuery).get(...params, ...params);

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
    const monthlyQuery = `
      SELECT period_month as period, COUNT(*) as count
      FROM transactions
      ${whereClause}${whereClause ? ' AND' : ' WHERE'} period_month IS NOT NULL
      GROUP BY period_month
      ORDER BY period_month
    `;
    const monthlyData = db.prepare(monthlyQuery).all(...params);
    const monthlyAverage = monthlyData.length > 0
      ? Math.round(monthlyData.reduce((sum, row) => sum + row.count, 0) / monthlyData.length)
      : 0;

    // Yearly growth
    const yearlyCounts = new Map();
    for (const row of monthlyData) {
      const year = row.period.substring(0, 4);
      yearlyCounts.set(year, (yearlyCounts.get(year) || 0) + row.count);
    }
    const yearlyData = [...yearlyCounts.entries()].map(([year, count]) => ({ year, count }));
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
const MAX_AGENTS = 500;
app.get('/api/datasets/:id/agents/top', (req, res) => {
  try {
    const { limit = 100, filters, search } = req.query;
    const clampedLimit = Math.min(Math.max(parseInt(limit) || 100, 1), MAX_AGENTS);

    // Build WHERE clause for filters
    let whereClause = 'WHERE salesperson_reg_num IS NOT NULL AND salesperson_reg_num != \'-\' AND salesperson_reg_num != \'\'';
    const parsedFilters = parseFilters(filters);
    if (parsedFilters && parsedFilters.__parseError) {
      return res.status(400).json({ error: 'Invalid filters format' });
    }

    const { conditions, params, invalidField } = buildFilterConditions(parsedFilters);
    if (invalidField) {
      return res.status(400).json({ error: `Invalid filter field: ${invalidField}` });
    }
    if (conditions) {
      whereClause += ' AND ' + conditions;
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
    params.push(clampedLimit);
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
    let agentsWithDetails = [];

    // Skip all batch CTE queries when there are no agents to look up -
    // otherwise batchWhere would become "WHERE salesperson_reg_num IN ()",
    // which is a SQLite syntax error.
    if (agentRegNums.length > 0) {
      const batchParams = [];

      // Build base WHERE clause for batch queries
      let batchWhere = `WHERE salesperson_reg_num IN (${agentRegNums.map(() => '?').join(',')})`;
      batchParams.push(...agentRegNums);

      // Add filter constraints if present (fields already validated against
      // ALLOWED_COLUMNS above; rebuild params fresh since `params` above also
      // carries the search/limit values which don't belong here)
      if (conditions) {
        batchWhere += ' AND ' + conditions;
        batchParams.push(...buildFilterConditions(parsedFilters).params);
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
      agentsWithDetails = topAgents.map(agent => {
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
    }

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
        (SELECT transaction_date FROM transactions WHERE salesperson_reg_num = ? AND period_month IS NOT NULL ORDER BY period_month ASC LIMIT 1) as start,
        (SELECT transaction_date FROM transactions WHERE salesperson_reg_num = ? AND period_month IS NOT NULL ORDER BY period_month DESC LIMIT 1) as end
    `;
    const dateRange = db.prepare(dateRangeQuery).get(regNum, regNum);

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
    const monthlyActivityQuery = `
      SELECT period_month as period, COUNT(*) as count
      FROM transactions
      WHERE salesperson_reg_num = ?
        AND period_month IS NOT NULL
      GROUP BY period_month
      ORDER BY period_month
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

// Catch-all route - serve frontend for client-side routing
// Only used in production when frontend is built
// Use middleware instead of route for Express 5 compatibility
if (existsSync(frontendDistPath)) {
  app.use((req, res) => {
    const indexPath = join(frontendDistPath, 'index.html');
    res.sendFile(indexPath);
  });
}

export const WARMUP_PATHS = [
  '/api/datasets',
  '/api/datasets/cea-property-transactions/insights',
  '/api/datasets/cea-property-transactions/timeseries?period=month',
  '/api/datasets/cea-property-transactions/agents/top?limit=50'
];

async function warmResponseCache() {
  const startedAt = Date.now();
  for (const path of WARMUP_PATHS) {
    try {
      await fetch(`http://127.0.0.1:${PORT}${path}`);
    } catch (error) {
      console.warn(`Cache warmup failed for ${path}:`, error.message);
    }
  }
  console.log(`Response cache warmed in ${Date.now() - startedAt}ms`);
}

function loadPrecomputedResponses() {
  if (!existsSync(PRECOMPUTED_RESPONSES_PATH)) {
    return false;
  }
  try {
    const precomputed = JSON.parse(readFileSync(PRECOMPUTED_RESPONSES_PATH, 'utf-8'));
    for (const [path, body] of Object.entries(precomputed)) {
      responseCache.set(path, body);
    }
    console.log(`Loaded ${responseCache.size} precomputed responses`);
    return true;
  } catch (error) {
    console.warn('Failed to load precomputed responses:', error.message);
    return false;
  }
}

export { app };

// Start server
if (import.meta.url === `file://${process.argv[1]}`) {
  const hasPrecomputedResponses = loadPrecomputedResponses();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`API server running on http://0.0.0.0:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Datasets: http://localhost:${PORT}/api/datasets`);
    console.log('Using SQLite database for efficient queries');
    if (!hasPrecomputedResponses) {
      warmResponseCache();
    }
  });
}
