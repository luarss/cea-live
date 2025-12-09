import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { fetchDataWithPlaywright } from './fetchers/playwright-fetcher.js';
import logger from './utils/logger.js';
import { analyzeSchema } from './utils/schemaAnalyzer.js';
import { generateVisualizationRecommendations } from './utils/vizRecommender.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..', '..');

async function processDataset(config) {
  const { id, name, source } = config;

  logger.log(`Processing dataset: ${name} (${id})`);

  try {
    // Fetch data using Playwright
    logger.log(`Fetching data from data.gov.sg (dataset: ${source.resourceId})`);
    const rawData = await fetchDataWithPlaywright(source.resourceId);

    if (!rawData || rawData.length === 0) {
      throw new Error('No data fetched');
    }

    logger.success(`Fetched ${rawData.length} rows`);

    // Analyze schema
    logger.log('Analyzing schema...');
    const schema = analyzeSchema(rawData);
    logger.success(`Analyzed ${schema.columns.length} columns`);

    // Generate visualization recommendations
    logger.log('Generating visualization recommendations...');
    const visualizationRecommendations = generateVisualizationRecommendations(schema, rawData);
    logger.success(`Generated ${visualizationRecommendations.length} visualization recommendations`);

    // Prepare output
    const output = {
      id,
      name,
      description: config.description || '',
      metadata: {
        lastUpdated: new Date().toISOString(),
        rowCount: rawData.length,
        columnCount: schema.columns.length,
        resourceId: source.resourceId,
        sourceType: source.type
      },
      schema,
      visualizationRecommendations,
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
      metadata: {
        lastUpdated: output.metadata.lastUpdated,
        rowCount: output.metadata.rowCount,
        columnCount: output.metadata.columnCount,
        resourceId: output.metadata.resourceId,
        sourceType: output.metadata.sourceType
      }
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
