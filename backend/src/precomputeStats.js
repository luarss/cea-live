/**
 * Precompute expensive aggregations and store in separate tables
 * Run this during the build process to speed up API responses
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..', '..');

const dbPath = join(ROOT_DIR, 'data', 'processed', 'cea-transactions.db');

console.log('📊 Precomputing aggregations...\n');

const db = new Database(dbPath);

try {
  db.exec('BEGIN TRANSACTION');

  // 1. Create precomputed top agents table
  console.log('1. Creating top_agents table...');
  db.exec(`
    DROP TABLE IF EXISTS top_agents;
    CREATE TABLE top_agents AS
    SELECT
      salesperson_reg_num as regNum,
      salesperson_name as name,
      COUNT(*) as totalTransactions,
      MAX(transaction_date) as lastTransaction
    FROM transactions
    WHERE salesperson_reg_num IS NOT NULL
      AND salesperson_reg_num != '-'
      AND salesperson_reg_num != ''
    GROUP BY salesperson_reg_num, salesperson_name
    ORDER BY totalTransactions DESC;
  `);
  db.exec('CREATE INDEX idx_top_agents_total ON top_agents(totalTransactions DESC)');
  const agentCount = db.prepare('SELECT COUNT(*) as count FROM top_agents').get();
  console.log(`   ✅ ${agentCount.count} agents precomputed`);

  // 2. Create precomputed monthly stats
  console.log('\n2. Creating monthly_stats table...');
  db.exec(`
    DROP TABLE IF EXISTS monthly_stats;
    CREATE TABLE monthly_stats AS
    SELECT
      substr(transaction_date, -4) || '-' ||
      CASE substr(transaction_date, 1, 3)
        WHEN 'JAN' THEN '01' WHEN 'FEB' THEN '02' WHEN 'MAR' THEN '03'
        WHEN 'APR' THEN '04' WHEN 'MAY' THEN '05' WHEN 'JUN' THEN '06'
        WHEN 'JUL' THEN '07' WHEN 'AUG' THEN '08' WHEN 'SEP' THEN '09'
        WHEN 'OCT' THEN '10' WHEN 'NOV' THEN '11' WHEN 'DEC' THEN '12'
      END as period,
      property_type,
      transaction_type,
      COUNT(*) as count
    FROM transactions
    WHERE transaction_date IS NOT NULL AND transaction_date != '-'
    GROUP BY period, property_type, transaction_type
    ORDER BY period;
  `);
  db.exec('CREATE INDEX idx_monthly_period ON monthly_stats(period)');
  const monthCount = db.prepare('SELECT COUNT(DISTINCT period) as count FROM monthly_stats').get();
  console.log(`   ✅ ${monthCount.count} months precomputed`);

  // 3. Create property type stats
  console.log('\n3. Creating property_type_stats table...');
  db.exec(`
    DROP TABLE IF EXISTS property_type_stats;
    CREATE TABLE property_type_stats AS
    SELECT
      COALESCE(property_type, 'Unknown') as propertyType,
      COUNT(*) as count,
      ROUND(CAST(COUNT(*) AS FLOAT) / (SELECT COUNT(*) FROM transactions) * 100, 2) as percentage
    FROM transactions
    GROUP BY property_type
    ORDER BY count DESC;
  `);
  const propCount = db.prepare('SELECT COUNT(*) as count FROM property_type_stats').get();
  console.log(`   ✅ ${propCount.count} property types precomputed`);

  // 4. Create transaction type stats
  console.log('\n4. Creating transaction_type_stats table...');
  db.exec(`
    DROP TABLE IF EXISTS transaction_type_stats;
    CREATE TABLE transaction_type_stats AS
    SELECT
      COALESCE(transaction_type, 'Unknown') as transactionType,
      COUNT(*) as count,
      ROUND(CAST(COUNT(*) AS FLOAT) / (SELECT COUNT(*) FROM transactions) * 100, 2) as percentage
    FROM transactions
    GROUP BY transaction_type
    ORDER BY count DESC;
  `);
  const txCount = db.prepare('SELECT COUNT(*) as count FROM transaction_type_stats').get();
  console.log(`   ✅ ${txCount.count} transaction types precomputed`);

  // 5. Create town stats
  console.log('\n5. Creating town_stats table...');
  db.exec(`
    DROP TABLE IF EXISTS town_stats;
    CREATE TABLE town_stats AS
    SELECT
      town,
      COUNT(*) as count,
      ROUND(CAST(COUNT(*) AS FLOAT) / (SELECT COUNT(*) FROM transactions WHERE town != '-') * 100, 2) as percentage
    FROM transactions
    WHERE town != '-'
    GROUP BY town
    ORDER BY count DESC;
  `);
  const townCount = db.prepare('SELECT COUNT(*) as count FROM town_stats').get();
  console.log(`   ✅ ${townCount.count} towns precomputed`);

  db.exec('COMMIT');

  // Run ANALYZE to update statistics
  console.log('\n6. Updating statistics...');
  db.exec('ANALYZE');
  console.log('   ✅ Statistics updated');

  console.log('\n✅ Precomputation complete!');
  console.log('\nPrecomputed tables:');
  console.log('  - top_agents: Fast agent rankings');
  console.log('  - monthly_stats: Fast time series');
  console.log('  - property_type_stats: Fast property stats');
  console.log('  - transaction_type_stats: Fast transaction stats');
  console.log('  - town_stats: Fast location stats');

} catch (error) {
  db.exec('ROLLBACK');
  console.error('❌ Error during precomputation:', error);
  process.exit(1);
} finally {
  db.close();
}
