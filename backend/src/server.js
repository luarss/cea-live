import express from 'express';
import cors from 'cors';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { groupByPeriod, sortPeriods, getDateRange } from './utils/dateParser.js';

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

/**
 * Apply filters to dataset
 * @param {Array} data - Array of data records
 * @param {Object|null} filters - Filters object from parseFilters
 * @returns {Array} - Filtered data array
 */
function applyFilters(data, filters) {
  if (!filters || Object.keys(filters).length === 0) {
    return data;
  }

  return data.filter(row => {
    return Object.entries(filters).every(([key, value]) => {
      if (Array.isArray(value)) {
        return value.includes(row[key]);
      }
      return row[key] === value;
    });
  });
}

// Serve frontend static files in production
const frontendDistPath = join(ROOT_DIR, 'frontend', 'dist');
if (existsSync(frontendDistPath)) {
  console.log('Serving frontend from:', frontendDistPath);
  app.use(express.static(frontendDistPath));
}

// In-memory cache for dataset
let dataCache = null;
let metadataCache = null;

function loadDataset() {
  if (!dataCache) {
    console.log('Loading dataset into memory...');
    const dataPath = join(ROOT_DIR, 'data', 'processed', 'cea-property-transactions.json');
    const rawData = readFileSync(dataPath, 'utf-8');
    const dataset = JSON.parse(rawData);

    dataCache = dataset.data;
    metadataCache = {
      id: dataset.id,
      name: dataset.name,
      description: dataset.description,
      metadata: dataset.metadata,
      schema: dataset.schema,
      visualizationRecommendations: dataset.visualizationRecommendations
    };

    console.log(`Loaded ${dataCache.length} records into memory`);
  }
  return { data: dataCache, metadata: metadataCache };
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
    const { metadata } = loadDataset();

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
    const { data } = loadDataset();

    // Parse query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000); // Max 1000 per request
    const offset = (page - 1) * limit;

    // Apply filters if provided
    const parsedFilters = parseFilters(req.query.filters);
    if (parsedFilters && parsedFilters.__parseError) {
      return res.status(400).json({ error: 'Invalid filters format' });
    }
    const filteredData = applyFilters(data, parsedFilters);

    // Paginate
    const paginatedData = filteredData.slice(offset, offset + limit);

    res.json({
      data: paginatedData,
      pagination: {
        page,
        limit,
        total: filteredData.length,
        totalPages: Math.ceil(filteredData.length / limit)
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
    const { data } = loadDataset();
    const field = req.query.field;

    if (!field) {
      return res.status(400).json({ error: 'Field parameter is required' });
    }

    // Count occurrences of each value
    const counts = {};
    data.forEach(row => {
      const value = row[field] || '(null)';
      counts[value] = (counts[value] || 0) + 1;
    });

    // Sort by count descending
    const stats = Object.entries(counts)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

    // Support optional limit parameter
    const limit = req.query.limit ? parseInt(req.query.limit) : stats.length;

    res.json({
      field,
      total: data.length,
      uniqueValues: stats.length,
      stats: stats.slice(0, limit)
    });
  } catch (error) {
    console.error('Error calculating stats:', error);
    res.status(500).json({ error: 'Failed to calculate stats' });
  }
});

// Multi-dimensional analytics endpoint
app.get('/api/datasets/:id/analytics', (req, res) => {
  try {
    const { data } = loadDataset();
    const { dimension1, dimension2, filters } = req.query;

    if (!dimension1) {
      return res.status(400).json({ error: 'dimension1 parameter is required' });
    }

    // Apply filters if provided
    const parsedFilters = parseFilters(filters);
    if (parsedFilters && parsedFilters.__parseError) {
      return res.status(400).json({ error: 'Invalid filters format' });
    }
    const filteredData = applyFilters(data, parsedFilters);

    // Count by dimensions
    const counts = {};
    filteredData.forEach(row => {
      const value1 = row[dimension1] || 'Unknown';

      if (dimension2) {
        const value2 = row[dimension2] || 'Unknown';
        const key = `${value1}|${value2}`;
        counts[key] = (counts[key] || 0) + 1;
      } else {
        counts[value1] = (counts[value1] || 0) + 1;
      }
    });

    // Format results
    let results;
    let chartData;

    if (dimension2) {
      results = Object.entries(counts).map(([key, count]) => {
        const [val1, val2] = key.split('|');
        return { [dimension1]: val1, [dimension2]: val2, count };
      });
      chartData = results; // For 2D data, return as-is
    } else {
      results = Object.entries(counts).map(([value, count]) => {
        return { [dimension1]: value, count };
      });

      // Create chart-ready format with 'name' and 'value' keys for pie charts
      chartData = results.map(item => ({
        name: item[dimension1],
        value: item.count
      }));
    }

    // Sort by count descending
    results.sort((a, b) => b.count - a.count);
    chartData.sort((a, b) => (b.value || b.count) - (a.value || a.count));

    res.json({
      dimensions: dimension2 ? [dimension1, dimension2] : [dimension1],
      data: results,
      chartData: chartData, // Chart-ready format
      total: filteredData.length
    });
  } catch (error) {
    console.error('Error calculating analytics:', error);
    res.status(500).json({ error: 'Failed to calculate analytics' });
  }
});

// Time-series analytics endpoint
app.get('/api/datasets/:id/timeseries', (req, res) => {
  try {
    const { data } = loadDataset();
    const { period = 'month', groupBy, filters } = req.query;

    // Apply filters if provided
    const parsedFilters = parseFilters(filters);
    if (parsedFilters && parsedFilters.__parseError) {
      return res.status(400).json({ error: 'Invalid filters format' });
    }
    const filteredData = applyFilters(data, parsedFilters);

    // Group data by period
    const grouped = groupByPeriod(filteredData, period, groupBy);

    // Sort periods chronologically
    const sortedPeriods = sortPeriods(Object.keys(grouped));

    // Format results
    const series = sortedPeriods.map(periodKey => {
      const periodData = grouped[periodKey];

      if (groupBy) {
        return { period: periodKey, ...periodData };
      } else {
        return { period: periodKey, count: periodData };
      }
    });

    // Create chart-ready data (limit to last 24 months for better visualization)
    const chartData = series.slice(-24);

    res.json({
      period,
      groupBy: groupBy || null,
      series,
      chartData, // Last 24 periods, ready for charts
      total: filteredData.length
    });
  } catch (error) {
    console.error('Error calculating time series:', error);
    res.status(500).json({ error: 'Failed to calculate time series' });
  }
});

// Market insights endpoint
app.get('/api/datasets/:id/insights', (req, res) => {
  try {
    const { data } = loadDataset();
    const { filters } = req.query;

    // Apply filters if provided
    const parsedFilters = parseFilters(filters);
    if (parsedFilters && parsedFilters.__parseError) {
      return res.status(400).json({ error: 'Invalid filters format' });
    }
    const filteredData = applyFilters(data, parsedFilters);

    // Calculate summary statistics
    const totalTransactions = filteredData.length;
    const dateRange = getDateRange(filteredData);

    // Property type distribution
    const propertyTypeCounts = {};
    filteredData.forEach(row => {
      const type = row.property_type || 'Unknown';
      propertyTypeCounts[type] = (propertyTypeCounts[type] || 0) + 1;
    });
    const propertyTypes = Object.entries(propertyTypeCounts)
      .map(([name, count]) => ({ name, count, percentage: (count / totalTransactions * 100).toFixed(1) }))
      .sort((a, b) => b.count - a.count);
    const topPropertyType = propertyTypes[0];

    // Transaction type distribution
    const transactionTypeCounts = {};
    filteredData.forEach(row => {
      const type = row.transaction_type || 'Unknown';
      transactionTypeCounts[type] = (transactionTypeCounts[type] || 0) + 1;
    });
    const transactionTypes = Object.entries(transactionTypeCounts)
      .map(([name, count]) => ({ name, count, percentage: (count / totalTransactions * 100).toFixed(1) }))
      .sort((a, b) => b.count - a.count);
    const topTransactionType = transactionTypes[0];

    // Representation distribution
    const representedCounts = {};
    filteredData.forEach(row => {
      const type = row.represented || 'Unknown';
      representedCounts[type] = (representedCounts[type] || 0) + 1;
    });
    const represented = Object.entries(representedCounts)
      .map(([name, count]) => ({ name, count, percentage: (count / totalTransactions * 100).toFixed(1) }))
      .sort((a, b) => b.count - a.count);

    // Calculate monthly trends
    const monthlyData = groupByPeriod(filteredData, 'month');
    const monthlyTotals = Object.values(monthlyData);
    const monthlyAverage = Math.round(monthlyTotals.reduce((sum, val) => sum + val, 0) / monthlyTotals.length);

    // Calculate yearly growth (compare last year to previous year)
    const yearlyData = groupByPeriod(filteredData, 'year');
    const years = sortPeriods(Object.keys(yearlyData));
    let yearlyGrowth = 0;
    if (years.length >= 2) {
      const lastYear = yearlyData[years[years.length - 1]];
      const prevYear = yearlyData[years[years.length - 2]];
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
app.get('/api/datasets/:id/agents/top', (req, res) => {
  try {
    const { data } = loadDataset();
    const { limit = 100, filters, search } = req.query;

    // Apply filters if provided
    const parsedFilters = parseFilters(filters);
    if (parsedFilters && parsedFilters.__parseError) {
      return res.status(400).json({ error: 'Invalid filters format' });
    }
    const filteredData = applyFilters(data, parsedFilters);

    // Aggregate by agent (exclude entries with missing/invalid agent info)
    const agentStats = {};
    filteredData.forEach(row => {
      const agentKey = row.salesperson_reg_num;

      // Skip rows where agent information is missing or invalid
      if (!agentKey || agentKey === '-' || agentKey.trim() === '') {
        return;
      }
      if (!agentStats[agentKey]) {
        agentStats[agentKey] = {
          name: row.salesperson_name,
          regNum: row.salesperson_reg_num,
          totalTransactions: 0,
          propertyTypes: {},
          transactionTypes: {},
          representation: {},
          towns: {},
          districts: {}
        };
      }

      const agent = agentStats[agentKey];
      agent.totalTransactions++;
      agent.propertyTypes[row.property_type] = (agent.propertyTypes[row.property_type] || 0) + 1;
      agent.transactionTypes[row.transaction_type] = (agent.transactionTypes[row.transaction_type] || 0) + 1;
      agent.representation[row.represented] = (agent.representation[row.represented] || 0) + 1;
      if (row.town !== '-') agent.towns[row.town] = (agent.towns[row.town] || 0) + 1;
      if (row.district !== '-') agent.districts[row.district] = (agent.districts[row.district] || 0) + 1;
    });

    // Convert to array and apply search filter if provided
    let agentsList = Object.values(agentStats)
      .map(agent => ({
        ...agent,
        topPropertyType: Object.entries(agent.propertyTypes).sort((a, b) => b[1] - a[1])[0] || ['Unknown', 0],
        topTransactionType: Object.entries(agent.transactionTypes).sort((a, b) => b[1] - a[1])[0] || ['Unknown', 0],
        topRepresentation: Object.entries(agent.representation).sort((a, b) => b[1] - a[1])[0] || ['Unknown', 0],
        topTown: Object.keys(agent.towns).length > 0
          ? Object.entries(agent.towns).sort((a, b) => b[1] - a[1])[0]
          : null
      }));

    // Apply search filter if provided
    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      agentsList = agentsList.filter(agent =>
        agent.name.toLowerCase().includes(searchLower) ||
        agent.regNum.toLowerCase().includes(searchLower)
      );
    }

    // Sort by transaction count and limit results
    const topAgents = agentsList
      .sort((a, b) => b.totalTransactions - a.totalTransactions)
      .slice(0, parseInt(limit));

    // Calculate aggregate statistics
    const totalTransactions = topAgents.reduce((sum, a) => sum + a.totalTransactions, 0);
    const averageTransactions = topAgents.length > 0
      ? (totalTransactions / topAgents.length).toFixed(0)
      : 0;

    const topAgentMarketShare = topAgents.length > 0 && totalTransactions > 0
      ? ((topAgents[0].totalTransactions / totalTransactions) * 100).toFixed(1)
      : '0.0';

    const top10Transactions = topAgents.slice(0, 10).reduce((sum, a) => sum + a.totalTransactions, 0);
    const top10MarketShare = totalTransactions > 0
      ? ((top10Transactions / totalTransactions) * 100).toFixed(1)
      : '0.0';

    res.json({
      total: Object.keys(agentStats).length,
      showing: topAgents.length,
      agents: topAgents,
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
    const { data } = loadDataset();
    const { regNum } = req.params;

    // Filter transactions for this agent
    const agentTransactions = data.filter(row => row.salesperson_reg_num === regNum);

    if (agentTransactions.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const agent = {
      name: agentTransactions[0].salesperson_name,
      regNum: regNum,
      totalTransactions: agentTransactions.length
    };

    // Get date range
    const dateRange = getDateRange(agentTransactions);

    // Property type breakdown
    const propertyTypes = {};
    agentTransactions.forEach(t => {
      propertyTypes[t.property_type] = (propertyTypes[t.property_type] || 0) + 1;
    });
    const propertyTypeStats = Object.entries(propertyTypes)
      .map(([type, count]) => ({ type, count, percentage: (count / agent.totalTransactions * 100).toFixed(1) }))
      .sort((a, b) => b.count - a.count);

    // Transaction type breakdown
    const transactionTypes = {};
    agentTransactions.forEach(t => {
      transactionTypes[t.transaction_type] = (transactionTypes[t.transaction_type] || 0) + 1;
    });
    const transactionTypeStats = Object.entries(transactionTypes)
      .map(([type, count]) => ({ type, count, percentage: (count / agent.totalTransactions * 100).toFixed(1) }))
      .sort((a, b) => b.count - a.count);

    // Representation breakdown
    const representation = {};
    agentTransactions.forEach(t => {
      representation[t.represented] = (representation[t.represented] || 0) + 1;
    });
    const representationStats = Object.entries(representation)
      .map(([type, count]) => ({ type, count, percentage: (count / agent.totalTransactions * 100).toFixed(1) }))
      .sort((a, b) => b.count - a.count);

    // Town distribution (top 10)
    const towns = {};
    agentTransactions.forEach(t => {
      if (t.town !== '-') towns[t.town] = (towns[t.town] || 0) + 1;
    });
    const topTowns = Object.entries(towns)
      .map(([town, count]) => ({ town, count, percentage: (count / agent.totalTransactions * 100).toFixed(1) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Time series data
    const timeSeries = groupByPeriod(agentTransactions, 'month');
    const sortedPeriods = sortPeriods(Object.keys(timeSeries));
    const monthlyActivity = sortedPeriods.map(period => ({
      period,
      count: timeSeries[period]
    }));

    res.json({
      agent,
      dateRange,
      propertyTypes: propertyTypeStats,
      transactionTypes: transactionTypeStats,
      representation: representationStats,
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
if (existsSync(frontendDistPath)) {
  app.get('*', (req, res) => {
    const indexPath = join(frontendDistPath, 'index.html');
    res.sendFile(indexPath);
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Datasets: http://localhost:${PORT}/api/datasets`);

  // Pre-load dataset into memory
  loadDataset();
});
