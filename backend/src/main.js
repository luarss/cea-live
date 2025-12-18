import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { fetchDataWithPlaywright, getS3UrlFromDataGovSG, downloadCSVFromS3 } from './fetchers/playwright-fetcher.js';
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

function migrateToSQLite(dataset) {
  logger.log('='.repeat(60));
  logger.log('Migrating to SQLite');
  logger.log('='.repeat(60));

  // Create/open database
  const dbPath = join(ROOT_DIR, 'data', 'processed', 'cea-transactions.db');
  logger.log(`Creating database at: ${dbPath}`);
  const db = new Database(dbPath);

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');

  // Create table
  logger.log('Creating table...');
  db.exec(`
    DROP TABLE IF EXISTS transactions;

    CREATE TABLE transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salesperson_name TEXT,
      transaction_date TEXT,
      salesperson_reg_num TEXT,
      property_type TEXT,
      transaction_type TEXT,
      represented TEXT,
      town TEXT,
      district TEXT,
      general_location TEXT
    );

    CREATE INDEX idx_transaction_date ON transactions(transaction_date);
    CREATE INDEX idx_property_type ON transactions(property_type);
    CREATE INDEX idx_salesperson_reg_num ON transactions(salesperson_reg_num);
    CREATE INDEX idx_town ON transactions(town);
    CREATE INDEX idx_transaction_type ON transactions(transaction_type);
  `);

  // Insert data in batches
  logger.log('Inserting data...');
  const insert = db.prepare(`
    INSERT INTO transactions (
      salesperson_name, transaction_date, salesperson_reg_num,
      property_type, transaction_type, represented,
      town, district, general_location
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((records) => {
    for (const record of records) {
      insert.run(
        record.salesperson_name || null,
        record.transaction_date || null,
        record.salesperson_reg_num || null,
        record.property_type || null,
        record.transaction_type || null,
        record.represented || null,
        record.town || null,
        record.district || null,
        record.general_location || null
      );
    }
  });

  // Insert in batches of 10000
  const BATCH_SIZE = 10000;
  for (let i = 0; i < dataset.data.length; i += BATCH_SIZE) {
    const batch = dataset.data.slice(i, i + BATCH_SIZE);
    insertMany(batch);
    logger.log(`Inserted ${Math.min(i + BATCH_SIZE, dataset.data.length)} / ${dataset.data.length} records`);
  }

  // Store metadata in a separate table
  db.exec(`
    DROP TABLE IF EXISTS metadata;

    CREATE TABLE metadata (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  const insertMeta = db.prepare('INSERT INTO metadata (key, value) VALUES (?, ?)');
  insertMeta.run('id', dataset.id);
  insertMeta.run('name', dataset.name);
  insertMeta.run('description', dataset.description);
  insertMeta.run('metadata', JSON.stringify(dataset.metadata));
  insertMeta.run('schema', JSON.stringify(dataset.schema));
  insertMeta.run('visualizationRecommendations', JSON.stringify(dataset.visualizationRecommendations));

  // Get final count
  const count = db.prepare('SELECT COUNT(*) as count FROM transactions').get();
  logger.success(`Migration complete! ${count.count} records in database`);

  // Show database size
  const { size } = db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get();
  logger.log(`Database size: ${(size / 1024 / 1024).toFixed(2)} MB`);

  db.close();
}

export async function runPipeline() {
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

  // Generate datasets catalog file
  logger.log('Generating datasets catalog...');
  const catalog = {
    version: '1.0',
    lastUpdated: new Date().toISOString(),
    datasets: [result]
  };

  const catalogPath = join(ROOT_DIR, 'data', 'processed', 'datasets.json');
  writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
  logger.success(`Wrote datasets catalog to ${catalogPath}`);

  logger.log('='.repeat(60));
  logger.success(`Pipeline completed successfully`);
  logger.log(`Processed ${result.metadata.rowCount} records`);

  // Migrate to SQLite
  const outputDir = join(ROOT_DIR, 'data', 'processed');
  const outputPath = join(outputDir, `${result.id}.json`);
  const jsonData = JSON.parse(readFileSync(outputPath, 'utf-8'));
  migrateToSQLite(jsonData);

  logger.log('='.repeat(60));
  logger.success(`Build complete! CSV → JSON → SQLite`);

  return result;
}

async function downloadFreshCSV() {
  logger.log('='.repeat(60));
  logger.log('Downloading fresh CSV from data.gov.sg');
  logger.log('='.repeat(60));

  const datasetId = 'd_ee7e46d3c57f7865790704632b0aef71';

  // Get the S3 URL using Playwright
  logger.log('Extracting S3 URL from data.gov.sg...');
  const s3Url = await getS3UrlFromDataGovSG(datasetId);

  // Download the CSV from S3
  logger.log('Downloading CSV from S3...');
  const csvContent = await downloadCSVFromS3(s3Url);

  // Save to data directory
  const dataDir = join(ROOT_DIR, 'data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const csvPath = join(dataDir, 'CEASalespersonsPropertyTransactionRecordsresidential.csv');
  writeFileSync(csvPath, csvContent);

  logger.success(`CSV downloaded and saved to ${csvPath}`);
  logger.log(`File size: ${(csvContent.length / 1024 / 1024).toFixed(2)} MB`);
  logger.log('='.repeat(60));
  logger.success('Download complete!');
}

async function main() {
  try {
    const command = process.argv[2];

    if (command === 'download') {
      await downloadFreshCSV();
    } else {
      await runPipeline();
    }
  } catch (error) {
    logger.error('Failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
