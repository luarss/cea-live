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
    logger.log('CEA Property Transactions Pipeline');
    logger.log('='.repeat(60));

    // Hardcoded configuration for CEA data
    const datasetConfig = {
      id: 'cea-property-transactions',
      name: 'CEA Salespersons Property Transaction Records',
      description: 'Property transaction records from Singapore Council for Estate Agencies',
      source: {
        type: 'datagovsg',
        resourceId: 'd_ee7e46d3c57f7865790704632b0aef71'
      },
      processing: {
        maxRows: 10000
      }
    };

    // Process the dataset
    const result = await processDataset(datasetConfig);

    // Summary
    logger.log('='.repeat(60));
    logger.success(`Pipeline completed successfully`);
    logger.log(`Fetched ${result.metadata.rowCount} records`);

  } catch (error) {
    logger.error('Pipeline failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
