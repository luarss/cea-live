/**
 * Optimized SQLite database connection with WAL mode and performance tuning
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..', '..');

const dbPath = join(ROOT_DIR, 'data', 'processed', 'cea-transactions.db');

// Open database with performance options
const db = new Database(dbPath, {
  readonly: true,
  fileMustExist: true
});

// AGGRESSIVE PERFORMANCE TUNING
// Enable WAL mode for better concurrent read performance
try {
  db.pragma('journal_mode = WAL');
} catch (e) {
  console.warn('Could not enable WAL mode (readonly database):', e.message);
}

// Cache size: Use more memory for faster queries (10MB)
db.pragma('cache_size = -10000'); // Negative means KB

// Memory-mapped I/O for faster reads (30MB)
db.pragma('mmap_size = 30000000');

// Reduce fsync() calls for better performance (safe for readonly)
db.pragma('synchronous = NORMAL');

// Optimize query planner
db.pragma('optimize');

console.log('✅ Database optimized with WAL mode and performance tuning');

// Prepare frequently used queries for better performance
const preparedQueries = {
  // Metadata
  getMetadata: db.prepare('SELECT key, value FROM metadata'),

  // Count queries
  countAll: db.prepare('SELECT COUNT(*) as total FROM transactions'),
  countWithFilter: null, // Dynamic based on filters

  // Top agents (most expensive query)
  topAgentsPrepared: db.prepare(`
    SELECT
      salesperson_reg_num as regNum,
      salesperson_name as name,
      COUNT(*) as totalTransactions
    FROM transactions
    WHERE salesperson_reg_num IS NOT NULL
      AND salesperson_reg_num != '-'
      AND salesperson_reg_num != ''
    GROUP BY salesperson_reg_num, salesperson_name
    ORDER BY totalTransactions DESC
    LIMIT ?
  `),

  // Property type stats
  propertyTypeStats: db.prepare(`
    SELECT
      COALESCE(property_type, 'Unknown') as value,
      COUNT(*) as count
    FROM transactions
    GROUP BY property_type
    ORDER BY count DESC
  `),

  // Transaction type stats
  transactionTypeStats: db.prepare(`
    SELECT
      COALESCE(transaction_type, 'Unknown') as value,
      COUNT(*) as count
    FROM transactions
    GROUP BY transaction_type
    ORDER BY count DESC
  `)
};

export default db;
export { preparedQueries };
