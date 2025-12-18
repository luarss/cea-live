import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..', '..');

console.log('Starting migration to SQLite...');

// Load JSON data
const dataPath = join(ROOT_DIR, 'data', 'processed', 'cea-property-transactions.json');
console.log(`Reading JSON from: ${dataPath}`);
const rawData = readFileSync(dataPath, 'utf-8');
const dataset = JSON.parse(rawData);

console.log(`Loaded ${dataset.data.length} records`);

// Create/open database
const dbPath = join(ROOT_DIR, 'data', 'processed', 'cea-transactions.db');
console.log(`Creating database at: ${dbPath}`);
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create table
console.log('Creating table...');
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
console.log('Inserting data...');
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
  console.log(`Inserted ${Math.min(i + BATCH_SIZE, dataset.data.length)} / ${dataset.data.length} records`);
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
console.log(`✓ Migration complete! ${count.count} records in database`);

// Show database size
const { size } = db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get();
console.log(`Database size: ${(size / 1024 / 1024).toFixed(2)} MB`);

db.close();
