import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/server.js';
import db from '../src/database.js';

const DATASET_PATH = '/api/datasets/cea-property-transactions';

const FILTER_CASES = [
  {},
  { property_type: ['HDB'] },
  { transaction_type: ['RESALE', 'NEW SALE'], represented: ['BUYER'] },
  { property_type: ['LANDED', 'STRATA_LANDED'], transaction_type: ['RESALE'], represented: ['SELLER'] }
];

let server;
let baseUrl;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
});

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  assert.equal(response.status, 200, `${path} returned ${response.status}`);
  return response.json();
}

function filterQuery(filters) {
  return Object.keys(filters).length > 0
    ? `filters=${encodeURIComponent(JSON.stringify(filters))}`
    : '';
}

function whereFor(filters, baseConditions = []) {
  const clauses = [...baseConditions];
  const params = [];
  for (const [column, values] of Object.entries(filters)) {
    clauses.push(`${column} IN (${values.map(() => '?').join(',')})`);
    params.push(...values);
  }
  return {
    where: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    params
  };
}

function countsBy(column, filters) {
  const { where, params } = whereFor(filters);
  const rows = db.prepare(`
    SELECT COALESCE(${column}, 'Unknown') AS name, COUNT(*) AS count
    FROM transactions ${where}
    GROUP BY ${column}
  `).all(...params);
  return Object.fromEntries(rows.map(row => [row.name, row.count]));
}

function toCountMap(rows) {
  return Object.fromEntries(rows.map(row => [row.name, row.count]));
}

for (const filters of FILTER_CASES) {
  const label = JSON.stringify(filters);

  test(`insights matches raw transactions for ${label}`, async () => {
    const query = filterQuery(filters);
    const insights = await getJson(`${DATASET_PATH}/insights${query ? `?${query}` : ''}`);

    const { where, params } = whereFor(filters);
    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM transactions ${where}`).get(...params);
    assert.equal(insights.summary.totalTransactions, total);

    assert.deepEqual(toCountMap(insights.distributions.propertyTypes), countsBy('property_type', filters));
    assert.deepEqual(toCountMap(insights.distributions.transactionTypes), countsBy('transaction_type', filters));
    assert.deepEqual(toCountMap(insights.distributions.represented), countsBy('represented', filters));

    const dated = whereFor(filters, ['period_month IS NOT NULL']);
    const range = db.prepare(`
      SELECT MIN(period_month) AS startMonth, MAX(period_month) AS endMonth
      FROM transactions ${dated.where}
    `).get(...dated.params);
    const monthOf = date => db.prepare('SELECT period_month FROM transactions WHERE transaction_date = ? LIMIT 1').get(date).period_month;
    assert.equal(monthOf(insights.summary.dateRange.start), range.startMonth);
    assert.equal(monthOf(insights.summary.dateRange.end), range.endMonth);

    const monthly = db.prepare(`
      SELECT COUNT(*) AS count FROM transactions ${dated.where} GROUP BY period_month
    `).all(...dated.params);
    const expectedAverage = Math.round(monthly.reduce((sum, row) => sum + row.count, 0) / monthly.length);
    assert.equal(insights.trends.monthlyAverage, expectedAverage);
  });

  test(`timeseries matches raw transactions for ${label}`, async () => {
    const query = filterQuery(filters);
    const timeseries = await getJson(`${DATASET_PATH}/timeseries?period=month${query ? `&${query}` : ''}`);

    const { where, params } = whereFor(filters, ['period_month IS NOT NULL']);
    const expected = db.prepare(`
      SELECT period_month AS period, COUNT(*) AS count
      FROM transactions ${where}
      GROUP BY period_month ORDER BY period_month
    `).all(...params).map(row => ({ ...row }));
    assert.deepEqual(timeseries.series.map(row => ({ ...row })), expected);
    assert.equal(timeseries.total, expected.reduce((sum, row) => sum + row.count, 0));
  });

  test(`agents/top matches raw transactions for ${label}`, async () => {
    const query = filterQuery(filters);
    const result = await getJson(`${DATASET_PATH}/agents/top?limit=20${query ? `&${query}` : ''}`);

    const agentConditions = ["salesperson_reg_num IS NOT NULL", "salesperson_reg_num != '-'", "salesperson_reg_num != ''"];
    const { where, params } = whereFor(filters, agentConditions);
    const { total } = db.prepare(`SELECT COUNT(DISTINCT salesperson_reg_num) AS total FROM transactions ${where}`).get(...params);
    assert.equal(result.total, total);

    const expectedTop = db.prepare(`
      SELECT COUNT(*) AS count FROM transactions ${where}
      GROUP BY salesperson_reg_num, salesperson_name
      ORDER BY count DESC LIMIT 20
    `).all(...params).map(row => row.count);
    assert.deepEqual(result.agents.map(agent => agent.totalTransactions), expectedTop);

    for (const agent of result.agents.slice(0, 5)) {
      const scoped = whereFor(filters, ['salesperson_reg_num = ?']);
      const { count } = db.prepare(`
        SELECT COUNT(*) AS count FROM transactions ${scoped.where}
        GROUP BY property_type ORDER BY count DESC LIMIT 1
      `).get(agent.regNum, ...scoped.params);
      assert.equal(agent.topPropertyType[1], count);
    }
  });
}

test('falls back to raw transactions for filters outside the aggregates', async () => {
  const filters = { town: ['TAMPINES'] };
  const insights = await getJson(`${DATASET_PATH}/insights?${filterQuery(filters)}`);
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM transactions WHERE town = ?').get('TAMPINES');
  assert.equal(insights.summary.totalTransactions, total);
});

test('api responses are gzipped and browser-cacheable', async () => {
  const response = await fetch(`${baseUrl}${DATASET_PATH}/timeseries?period=month`, {
    headers: { 'Accept-Encoding': 'gzip' }
  });
  assert.equal(response.headers.get('content-encoding'), 'gzip');
  assert.match(response.headers.get('cache-control'), /max-age=3600/);
});
