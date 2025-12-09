import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { fetchData } from './fetchers/index.js';
import logger from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..', '..');

async function processDataset(config) {
  const { id, name, source, processing = {} } = config;

  logger.log(`Processing dataset: ${name} (${id})`);

  try {
    // Fetch data
    logger.log(`Fetching data from data.gov.sg (resource: ${source.resourceId})`);
    const rawData = await fetchData(source, {
      maxRecords: processing.maxRows || 10000
    });

    if (!rawData || rawData.length === 0) {
      throw new Error('No data fetched');
    }

    logger.success(`Fetched ${rawData.length} rows`);

    // Prepare output
    const output = {
      id,
      name,
      description: config.description || '',
      metadata: {
        lastUpdated: new Date().toISOString(),
        rowCount: rawData.length,
        resourceId: source.resourceId,
        sourceType: source.type
      },
      data: rawData
    };

    // Write to file
    const outputDir = join(ROOT_DIR, 'data', 'processed');
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = join(outputDir, `${id}.json`);
    writeFileSync(outputPath, JSON.stringify(output, null, 2));
    logger.success(`Wrote ${rawData.length} records to ${outputPath}`);

    return {
      id,
      name,
      description: config.description || '',
      metadata: output.metadata
    };

  } catch (error) {
    logger.error(`Failed to process dataset ${id}:`, error.message);
    throw error;
  }
}

async function main() {
  try {
    logger.log('='.repeat(60));
    logger.log('CEA-VIZ Data Pipeline');
    logger.log('='.repeat(60));

    // Read configuration
    const configPath = join(ROOT_DIR, 'data', 'sources.config.json');
    if (!existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }

    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    logger.log(`Loaded configuration with ${config.datasets.length} dataset(s)`);

    // Process each dataset
    const results = [];
    for (const datasetConfig of config.datasets) {
      if (datasetConfig.refresh?.enabled !== false) {
        try {
          const result = await processDataset(datasetConfig);
          results.push(result);
        } catch (error) {
          logger.error(`Skipping dataset ${datasetConfig.id} due to error`);
          results.push({
            id: datasetConfig.id,
            name: datasetConfig.name,
            error: error.message
          });
        }
      } else {
        logger.log(`Skipping disabled dataset: ${datasetConfig.id}`);
      }
    }

    // Create catalog file
    const catalogPath = join(ROOT_DIR, 'data', 'processed', 'datasets.json');
    const catalog = {
      version: config.version || '1.0',
      lastUpdated: new Date().toISOString(),
      datasets: results.filter(r => !r.error)
    };

    writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
    logger.success(`Created dataset catalog: ${catalogPath}`);

    // Summary
    logger.log('='.repeat(60));
    logger.success(`Pipeline completed successfully`);
    logger.log(`Processed: ${results.filter(r => !r.error).length}/${results.length} datasets`);

    if (results.some(r => r.error)) {
      logger.warn('Some datasets failed - check logs above');
      process.exit(1);
    }

  } catch (error) {
    logger.error('Pipeline failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
