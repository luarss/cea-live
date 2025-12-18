/**
 * Middleware for caching API responses
 * Skips cache for requests with filters or search parameters
 */

import { apiCache, statsCache } from '../cache.js';

/**
 * Generate cache key from request
 */
function getCacheKey(req) {
  const url = req.originalUrl || req.url;
  return `${req.method}:${url}`;
}

/**
 * Determine if request should be cached
 */
function shouldCache(req) {
  // Don't cache if filters or search parameters present
  if (req.query.filters || req.query.search) {
    return false;
  }

  // Cache GET requests only
  return req.method === 'GET';
}

/**
 * Select appropriate cache based on endpoint
 */
function selectCache(req) {
  if (req.path.includes('/stats') ||
      req.path.includes('/insights') ||
      req.path.includes('/analytics') ||
      req.path.includes('/timeseries') ||
      req.path.includes('/agents')) {
    return statsCache;
  }
  return apiCache;
}

/**
 * Cache middleware
 */
export function cacheMiddleware(req, res, next) {
  if (!shouldCache(req)) {
    return next();
  }

  const cache = selectCache(req);
  const key = getCacheKey(req);
  const cached = cache.get(key);

  if (cached) {
    // Cache hit - send cached response
    res.set('X-Cache', 'HIT');
    return res.json(cached);
  }

  // Cache miss - intercept json() to cache the response
  res.set('X-Cache', 'MISS');
  const originalJson = res.json.bind(res);

  res.json = function(body) {
    // Only cache successful responses
    if (res.statusCode >= 200 && res.statusCode < 300) {
      cache.set(key, body);
    }
    return originalJson(body);
  };

  next();
}

/**
 * Cache stats endpoint
 */
export function getCacheStats(req, res) {
  res.json({
    api: apiCache.stats(),
    stats: statsCache.stats()
  });
}

/**
 * Clear cache endpoint
 */
export function clearCache(req, res) {
  const { datasetId } = req.params;

  if (datasetId) {
    const apiCount = apiCache.invalidateDataset(datasetId);
    const statsCount = statsCache.invalidateDataset(datasetId);
    return res.json({
      message: 'Dataset cache cleared',
      entriesCleared: apiCount + statsCount
    });
  }

  apiCache.clear();
  statsCache.clear();
  res.json({ message: 'All caches cleared' });
}
