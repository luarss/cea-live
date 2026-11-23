import { DatabaseSync } from 'node:sqlite';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..', '..');

const dbPath = join(ROOT_DIR, 'data', 'processed', 'cea-transactions.db');
const db = new DatabaseSync(dbPath, { readOnly: true });

console.log('Connected to SQLite database');

export default db;
