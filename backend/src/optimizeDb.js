/**
 * Database optimization script
 * Run this to add additional indexes and optimize the database
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..', '..');

const dbPath = join(ROOT_DIR, 'data', 'processed', 'cea-transactions.db');

console.log('🔧 Optimizing database...\n');

// Open database in read-write mode
const db = new Database(dbPath);

try {
  // Enable WAL mode for better concurrent performance
  console.log('1. Enabling WAL mode...');
  db.pragma('journal_mode = WAL');
  console.log('   ✅ WAL mode enabled');

  // Add composite indexes for common query patterns
  console.log('\n2. Adding composite indexes...');

  // For /agents/top queries (filtering + grouping)
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_agent_composite ON transactions(salesperson_reg_num, property_type, transaction_type, represented, town)');
    console.log('   ✅ Composite index for agent queries');
  } catch (e) {
    console.log('   ⚠️  Composite index already exists');
  }

  // For time series queries
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_date_composite ON transactions(transaction_date, property_type, transaction_type)');
    console.log('   ✅ Composite index for time series');
  } catch (e) {
    console.log('   ⚠️  Time series index already exists');
  }

  // For district queries
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_district ON transactions(district)');
    console.log('   ✅ Index for district');
  } catch (e) {
    console.log('   ⚠️  District index already exists');
  }

  // For represented column
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_represented ON transactions(represented)');
    console.log('   ✅ Index for represented');
  } catch (e) {
    console.log('   ⚠️  Represented index already exists');
  }

  // Optimize database
  console.log('\n3. Running ANALYZE to update statistics...');
  db.exec('ANALYZE');
  console.log('   ✅ Statistics updated');

  console.log('\n4. Running VACUUM to optimize file...');
  db.exec('VACUUM');
  console.log('   ✅ Database vacuumed');

  // Set performance PRAGMAs
  console.log('\n5. Setting performance pragmas...');
  db.pragma('cache_size = -10000'); // 10MB cache
  db.pragma('mmap_size = 30000000'); // 30MB mmap
  db.pragma('temp_store = MEMORY'); // Keep temp tables in memory
  db.pragma('synchronous = NORMAL'); // Faster writes
  console.log('   ✅ Performance settings applied');

  // Show current indexes
  console.log('\n6. Current indexes:');
  const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND sql IS NOT NULL").all();
  indexes.forEach(idx => console.log(`   - ${idx.name}`));

  // Show database size
  const stats = db.prepare('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()').get();
  console.log(`\n📊 Database size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  console.log('\n✅ Optimization complete!');

} catch (error) {
  console.error('❌ Error during optimization:', error);
  process.exit(1);
} finally {
  db.close();
}
