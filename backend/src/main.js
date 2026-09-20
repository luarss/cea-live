import { writeFileSync, mkdirSync, existsSync, createReadStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config as dotenvConfig } from 'dotenv';
import Database from 'better-sqlite3';
import { parse } from 'csv-parse';
import { getS3UrlFromDataGovSG, downloadCSVFromS3 } from './fetchers/data-gov-fetcher.js';
import logger from './utils/logger.js';
import { analyzeSchema } from './utils/schemaAnalyzer.js';
import { generateVisualizationRecommendations } from './utils/vizRecommender.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..', '..');

dotenvConfig({ path: join(ROOT_DIR, '.env') });

// Rows sampled for schema analysis/viz recommendations instead of the full dataset
const SCHEMA_SAMPLE_SIZE = 50000;
// Rows buffered per SQLite insert transaction
const INSERT_BATCH_SIZE = 10000;

async function streamCSVIntoSQLite(config) {
  const { id, name, source } = config;

  const csvPath = join(ROOT_DIR, 'data', 'CEASalespersonsPropertyTransactionRecordsresidential.csv');
  if (!existsSync(csvPath)) {
    throw new Error(`Local CSV file not found at ${csvPath}. Run 'npm run download' to fetch it.`);
  }

  const outputDir = join(ROOT_DIR, 'data', 'processed');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const dbPath = join(outputDir, 'cea-transactions.db');
  logger.log(`Streaming CSV into database at: ${dbPath}`);
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

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
  `);

  const insert = db.prepare(`
    INSERT INTO transactions (
      salesperson_name, transaction_date, salesperson_reg_num,
      property_type, transaction_type, represented,
      town, district, general_location
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertBatch = db.transaction((records) => {
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

  const schemaSample = [];
  let rowCount = 0;
  let batch = [];

  await new Promise((resolve, reject) => {
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      quote: '"',
      escape: '"'
    });

    parser.on('readable', () => {
      let record;
      while ((record = parser.read()) !== null) {
        rowCount++;
        if (schemaSample.length < SCHEMA_SAMPLE_SIZE) {
          schemaSample.push(record);
        }
        batch.push(record);
        if (batch.length >= INSERT_BATCH_SIZE) {
          insertBatch(batch);
          logger.log(`Inserted ${rowCount} records`);
          batch = [];
        }
      }
    });

    parser.on('error', reject);
    parser.on('end', () => {
      if (batch.length > 0) {
        insertBatch(batch);
        logger.log(`Inserted ${rowCount} records`);
      }
      resolve();
    });

    createReadStream(csvPath).pipe(parser);
  });

  if (rowCount === 0) {
    db.close();
    throw new Error('No data fetched');
  }

  logger.success(`Inserted ${rowCount} rows`);

  // Build indexes after bulk load (faster than maintaining them during insert)
  logger.log('Creating indexes...');
  db.exec(`
    CREATE INDEX idx_transaction_date ON transactions(transaction_date);
    CREATE INDEX idx_property_type ON transactions(property_type);
    CREATE INDEX idx_salesperson_reg_num ON transactions(salesperson_reg_num);
    CREATE INDEX idx_town ON transactions(town);
    CREATE INDEX idx_transaction_type ON transactions(transaction_type);
  `);

  // Analyze schema and generate viz recommendations from a sample, not the full dataset
  logger.log(`Analyzing schema from a ${schemaSample.length}-row sample...`);
  const schema = analyzeSchema(schemaSample);
  logger.success(`Analyzed ${schema.columns.length} columns`);

  const visualizationRecommendations = generateVisualizationRecommendations(schema, schemaSample);
  logger.success(`Generated ${visualizationRecommendations.length} visualization recommendations`);

  const metadata = {
    lastUpdated: new Date().toISOString(),
    rowCount,
    columnCount: schema.columns.length,
    resourceId: source.resourceId,
    sourceType: source.type
  };

  db.exec(`
    DROP TABLE IF EXISTS metadata;

    CREATE TABLE metadata (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  const insertMeta = db.prepare('INSERT INTO metadata (key, value) VALUES (?, ?)');
  insertMeta.run('id', id);
  insertMeta.run('name', name);
  insertMeta.run('description', config.description || '');
  insertMeta.run('metadata', JSON.stringify(metadata));
  insertMeta.run('schema', JSON.stringify(schema));
  insertMeta.run('visualizationRecommendations', JSON.stringify(visualizationRecommendations));

  const count = db.prepare('SELECT COUNT(*) as count FROM transactions').get();
  logger.success(`Migration complete! ${count.count} records in database`);

  const { size } = db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get();
  logger.log(`Database size: ${(size / 1024 / 1024).toFixed(2)} MB`);

  // Checkpoint WAL into the main db file and drop back to a single-file journal
  // mode so the runtime's read-only connection isn't left with stray WAL/SHM state
  db.pragma('wal_checkpoint(TRUNCATE)');
  db.pragma('journal_mode = DELETE');

  db.close();

  return { id, name, description: config.description || '', metadata };
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

  // Stream CSV rows straight into SQLite (no intermediate full-dataset JSON)
  const result = await streamCSVIntoSQLite(datasetConfig);

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
  logger.log('='.repeat(60));
  logger.success(`Build complete! CSV → SQLite`);

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
