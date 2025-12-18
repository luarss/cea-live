/**
 * Concurrent Load Testing Benchmark
 * Tests mission-critical API endpoints with concurrent requests
 * Reports p50, p95, p99 latencies
 */

import axios from 'axios';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3003';
const DATASET_ID = 'cea-transactions';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

/**
 * Calculate percentiles from sorted array
 */
function calculatePercentiles(sortedValues) {
  const len = sortedValues.length;
  if (len === 0) return { p50: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0 };

  const p50 = sortedValues[Math.floor(len * 0.50)];
  const p95 = sortedValues[Math.floor(len * 0.95)];
  const p99 = sortedValues[Math.floor(len * 0.99)];
  const min = sortedValues[0];
  const max = sortedValues[len - 1];
  const avg = sortedValues.reduce((a, b) => a + b, 0) / len;

  return { p50, p95, p99, min, max, avg };
}

/**
 * Format latency with color coding
 */
function formatLatency(ms, threshold = 1000) {
  const rounded = Math.round(ms);
  if (rounded < threshold * 0.5) return `${colors.green}${rounded}ms${colors.reset}`;
  if (rounded < threshold) return `${colors.yellow}${rounded}ms${colors.reset}`;
  return `${colors.red}${rounded}ms${colors.reset}`;
}

/**
 * Run concurrent requests to an endpoint
 */
async function loadTest(name, url, concurrency = 10, iterations = 100) {
  console.log(`\n${colors.cyan}Testing: ${name}${colors.reset}`);
  console.log(`  Concurrency: ${concurrency} | Total Requests: ${iterations}`);

  const latencies = [];
  const errors = [];
  let completedRequests = 0;

  // Create batches of concurrent requests
  const batchSize = concurrency;
  const numBatches = Math.ceil(iterations / batchSize);

  const startTime = Date.now();

  for (let batch = 0; batch < numBatches; batch++) {
    const requestsInBatch = Math.min(batchSize, iterations - batch * batchSize);
    const promises = [];

    for (let i = 0; i < requestsInBatch; i++) {
      const requestStart = Date.now();

      const promise = axios.get(url, {
        headers: { 'Accept-Encoding': 'gzip' },
        timeout: 30000
      })
        .then(() => {
          const latency = Date.now() - requestStart;
          latencies.push(latency);
          completedRequests++;
        })
        .catch((error) => {
          const latency = Date.now() - requestStart;
          errors.push({ error: error.message, latency });
          completedRequests++;
        });

      promises.push(promise);
    }

    // Wait for all requests in this batch to complete
    await Promise.all(promises);

    // Progress indicator
    process.stdout.write(`\r  Progress: ${completedRequests}/${iterations} requests`);
  }

  const totalDuration = Date.now() - startTime;
  process.stdout.write('\n');

  // Calculate statistics
  latencies.sort((a, b) => a - b);
  const stats = calculatePercentiles(latencies);
  const successRate = ((latencies.length / iterations) * 100).toFixed(1);
  const requestsPerSecond = (iterations / (totalDuration / 1000)).toFixed(1);

  // Display results
  console.log(`  ${colors.bright}Results:${colors.reset}`);
  console.log(`    Success Rate: ${successRate}% (${latencies.length}/${iterations})`);
  console.log(`    Requests/sec: ${requestsPerSecond}`);
  console.log(`    Min:  ${formatLatency(stats.min)}`);
  console.log(`    p50:  ${formatLatency(stats.p50)}`);
  console.log(`    p95:  ${formatLatency(stats.p95)}`);
  console.log(`    p99:  ${formatLatency(stats.p99)}`);
  console.log(`    Max:  ${formatLatency(stats.max)}`);
  console.log(`    Avg:  ${formatLatency(stats.avg)}`);

  if (errors.length > 0) {
    console.log(`    ${colors.red}Errors: ${errors.length}${colors.reset}`);
    errors.slice(0, 3).forEach(e => {
      console.log(`      - ${e.error} (${e.latency}ms)`);
    });
  }

  return {
    name,
    stats,
    successRate: parseFloat(successRate),
    requestsPerSecond: parseFloat(requestsPerSecond),
    errors: errors.length,
    totalRequests: iterations
  };
}

/**
 * Test if server is ready
 */
async function waitForServer(maxAttempts = 30) {
  console.log(`${colors.cyan}Waiting for server to be ready...${colors.reset}`);

  for (let i = 0; i < maxAttempts; i++) {
    try {
      await axios.get(`${BASE_URL}/health`, { timeout: 2000 });
      console.log(`${colors.green}✓ Server is ready${colors.reset}\n`);
      return true;
    } catch (error) {
      process.stdout.write(`\r  Attempt ${i + 1}/${maxAttempts}...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`\n${colors.red}✗ Server not ready after ${maxAttempts} attempts${colors.reset}`);
  return false;
}

/**
 * Main benchmark suite
 */
async function runLoadTests() {
  console.log(`\n${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}  CEA-VIZ Concurrent Load Testing Benchmark${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}  Target: Sub-1000ms p99 latency | 512MB memory${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`Server: ${BASE_URL}`);

  // Wait for server
  const serverReady = await waitForServer();
  if (!serverReady) {
    process.exit(1);
  }

  const results = [];

  // Define test scenarios
  const tests = [
    // Light endpoints (should be cached)
    {
      name: '1. Datasets List (Cached)',
      url: `${BASE_URL}/api/datasets`,
      concurrency: 20,
      iterations: 200
    },
    {
      name: '2. Dataset Metadata (Cached)',
      url: `${BASE_URL}/api/datasets/${DATASET_ID}`,
      concurrency: 20,
      iterations: 200
    },

    // Medium endpoints
    {
      name: '3. Paginated Data (50 rows)',
      url: `${BASE_URL}/api/datasets/${DATASET_ID}/data?page=1&limit=50`,
      concurrency: 15,
      iterations: 150
    },
    {
      name: '4. Property Type Stats',
      url: `${BASE_URL}/api/datasets/${DATASET_ID}/stats?field=property_type`,
      concurrency: 15,
      iterations: 150
    },
    {
      name: '5. Transaction Type Stats',
      url: `${BASE_URL}/api/datasets/${DATASET_ID}/stats?field=transaction_type`,
      concurrency: 15,
      iterations: 150
    },

    // Heavy endpoints (mission-critical)
    {
      name: '6. Analytics (1D)',
      url: `${BASE_URL}/api/datasets/${DATASET_ID}/analytics?dimension1=property_type`,
      concurrency: 10,
      iterations: 100
    },
    {
      name: '7. Analytics (2D)',
      url: `${BASE_URL}/api/datasets/${DATASET_ID}/analytics?dimension1=property_type&dimension2=transaction_type`,
      concurrency: 10,
      iterations: 100
    },
    {
      name: '8. Time Series (Monthly)',
      url: `${BASE_URL}/api/datasets/${DATASET_ID}/timeseries?period=month`,
      concurrency: 10,
      iterations: 100
    },
    {
      name: '9. Time Series (Grouped)',
      url: `${BASE_URL}/api/datasets/${DATASET_ID}/timeseries?period=month&groupBy=property_type`,
      concurrency: 8,
      iterations: 80
    },
    {
      name: '10. Market Insights',
      url: `${BASE_URL}/api/datasets/${DATASET_ID}/insights`,
      concurrency: 10,
      iterations: 100
    },

    // Most critical endpoint
    {
      name: '11. Top Agents (CRITICAL - Precomputed)',
      url: `${BASE_URL}/api/datasets/${DATASET_ID}/agents/top?limit=50`,
      concurrency: 10,
      iterations: 100
    },
    {
      name: '12. Agent Profile',
      url: `${BASE_URL}/api/datasets/${DATASET_ID}/agents/R012345A`,
      concurrency: 10,
      iterations: 100
    }
  ];

  // Run tests sequentially to avoid overwhelming the server
  for (const test of tests) {
    const result = await loadTest(test.name, test.url, test.concurrency, test.iterations);
    results.push(result);

    // Brief pause between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Summary
  console.log(`\n${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}  SUMMARY${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════${colors.reset}\n`);

  // Summary table
  console.log(`${colors.bright}Endpoint Performance Summary:${colors.reset}`);
  console.log('─'.repeat(95));
  console.log(`${'Endpoint'.padEnd(45)} ${'p50'.padStart(8)} ${'p95'.padStart(8)} ${'p99'.padStart(8)} ${'Success%'.padStart(10)} ${'RPS'.padStart(8)}`);
  console.log('─'.repeat(95));

  let totalRequests = 0;
  let totalErrors = 0;
  let criticalFailures = 0;

  results.forEach(r => {
    const name = r.name.length > 43 ? r.name.substring(0, 40) + '...' : r.name;
    const p50Color = r.stats.p50 < 500 ? colors.green : r.stats.p50 < 1000 ? colors.yellow : colors.red;
    const p95Color = r.stats.p95 < 800 ? colors.green : r.stats.p95 < 1000 ? colors.yellow : colors.red;
    const p99Color = r.stats.p99 < 1000 ? colors.green : colors.red;

    console.log(
      `${name.padEnd(45)} ` +
      `${p50Color}${Math.round(r.stats.p50)}ms${colors.reset}`.padStart(15) +
      `${p95Color}${Math.round(r.stats.p95)}ms${colors.reset}`.padStart(15) +
      `${p99Color}${Math.round(r.stats.p99)}ms${colors.reset}`.padStart(15) +
      `${r.successRate.toFixed(1)}%`.padStart(10) +
      `${r.requestsPerSecond.toFixed(1)}`.padStart(8)
    );

    totalRequests += r.totalRequests;
    totalErrors += r.errors;

    // Check for critical failures
    if (r.stats.p99 > 1000 || r.successRate < 95) {
      criticalFailures++;
    }
  });

  console.log('─'.repeat(95));
  console.log(`\nTotal Requests: ${totalRequests} | Errors: ${totalErrors} | Success Rate: ${((totalRequests - totalErrors) / totalRequests * 100).toFixed(1)}%`);

  // Final verdict
  console.log(`\n${colors.bright}Final Assessment:${colors.reset}`);

  const allP99Under1s = results.every(r => r.stats.p99 < 1000);
  const allSuccessOver95 = results.every(r => r.successRate >= 95);

  if (allP99Under1s && allSuccessOver95) {
    console.log(`${colors.green}${colors.bright}✓ EXCELLENT: All endpoints meet p99 < 1000ms target${colors.reset}`);
    console.log(`${colors.green}${colors.bright}✓ Ready for production deployment${colors.reset}`);
  } else if (criticalFailures <= 2) {
    console.log(`${colors.yellow}${colors.bright}⚠ GOOD: Most endpoints meet targets${colors.reset}`);
    console.log(`${colors.yellow}${colors.bright}⚠ ${criticalFailures} endpoint(s) need optimization${colors.reset}`);
  } else {
    console.log(`${colors.red}${colors.bright}✗ NEEDS WORK: ${criticalFailures} endpoints failing targets${colors.reset}`);
    console.log(`${colors.red}${colors.bright}✗ Further optimization required${colors.reset}`);
  }

  // Get cache stats
  console.log(`\n${colors.bright}Cache Performance:${colors.reset}`);
  try {
    const cacheStats = await axios.get(`${BASE_URL}/api/cache/stats`);
    console.log('  API Cache:');
    console.log(`    Hit Rate: ${cacheStats.data.api.hitRate}`);
    console.log(`    Size: ${cacheStats.data.api.size}/${cacheStats.data.api.maxSize}`);
    console.log(`    Hits: ${cacheStats.data.api.hits} | Misses: ${cacheStats.data.api.misses}`);
    console.log('  Stats Cache:');
    console.log(`    Hit Rate: ${cacheStats.data.stats.hitRate}`);
    console.log(`    Size: ${cacheStats.data.stats.size}/${cacheStats.data.stats.maxSize}`);
    console.log(`    Hits: ${cacheStats.data.stats.hits} | Misses: ${cacheStats.data.stats.misses}`);
  } catch (e) {
    console.log('  Could not fetch cache stats');
  }

  console.log(`\n${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════${colors.reset}\n`);
}

// Run the benchmark
runLoadTests().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error.message);
  process.exit(1);
});
