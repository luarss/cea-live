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

// Middleware
app.use(cors());
app.use(express.json());

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

    res.json(metadata);
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
    let filteredData = data;
    if (req.query.filters) {
      try {
        const filters = JSON.parse(req.query.filters);
        filteredData = data.filter(row => {
          return Object.entries(filters).every(([key, value]) => {
            if (Array.isArray(value)) {
              return value.includes(row[key]);
            }
            return row[key] === value;
          });
        });
      } catch (error) {
        return res.status(400).json({ error: 'Invalid filters format' });
      }
    }

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
    let filteredData = data;
    if (filters) {
      try {
        const filterObj = JSON.parse(filters);
        filteredData = data.filter(row => {
          return Object.entries(filterObj).every(([key, value]) => {
            if (Array.isArray(value)) {
              return value.includes(row[key]);
            }
            return row[key] === value;
          });
        });
      } catch (error) {
        return res.status(400).json({ error: 'Invalid filters format' });
      }
    }

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
    if (dimension2) {
      results = Object.entries(counts).map(([key, count]) => {
        const [val1, val2] = key.split('|');
        return { [dimension1]: val1, [dimension2]: val2, count };
      });
    } else {
      results = Object.entries(counts).map(([value, count]) => {
        return { [dimension1]: value, count };
      });
    }

    // Sort by count descending
    results.sort((a, b) => b.count - a.count);

    res.json({
      dimensions: dimension2 ? [dimension1, dimension2] : [dimension1],
      data: results,
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
    let filteredData = data;
    if (filters) {
      try {
        const filterObj = JSON.parse(filters);
        filteredData = data.filter(row => {
          return Object.entries(filterObj).every(([key, value]) => {
            if (Array.isArray(value)) {
              return value.includes(row[key]);
            }
            return row[key] === value;
          });
        });
      } catch (error) {
        return res.status(400).json({ error: 'Invalid filters format' });
      }
    }

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

    res.json({
      period,
      groupBy: groupBy || null,
      series,
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
    let filteredData = data;
    if (filters) {
      try {
        const filterObj = JSON.parse(filters);
        filteredData = data.filter(row => {
          return Object.entries(filterObj).every(([key, value]) => {
            if (Array.isArray(value)) {
              return value.includes(row[key]);
            }
            return row[key] === value;
          });
        });
      } catch (error) {
        return res.status(400).json({ error: 'Invalid filters format' });
      }
    }

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
