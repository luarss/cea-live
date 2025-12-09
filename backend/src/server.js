import express from 'express';
import cors from 'cors';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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

    res.json({
      field,
      total: data.length,
      uniqueValues: stats.length,
      stats: stats.slice(0, 100) // Return top 100
    });
  } catch (error) {
    console.error('Error calculating stats:', error);
    res.status(500).json({ error: 'Failed to calculate stats' });
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
