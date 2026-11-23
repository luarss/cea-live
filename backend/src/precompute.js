import { writeFileSync } from 'fs';
import { app, WARMUP_PATHS, PRECOMPUTED_RESPONSES_PATH } from './server.js';
import logger from './utils/logger.js';

async function fetchResponses(port) {
  const responses = {};
  for (const path of WARMUP_PATHS) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    if (!response.ok) {
      throw new Error(`${path} returned ${response.status}`);
    }
    responses[path] = await response.json();
  }
  return responses;
}

async function precompute() {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));

  try {
    const startedAt = Date.now();
    const responses = await fetchResponses(server.address().port);
    writeFileSync(PRECOMPUTED_RESPONSES_PATH, JSON.stringify(responses));
    logger.success(`Precomputed ${Object.keys(responses).length} responses in ${Date.now() - startedAt}ms`);
  } finally {
    server.close();
  }
}

precompute().catch(error => {
  logger.error('Precompute failed:', error.message);
  process.exit(1);
});
