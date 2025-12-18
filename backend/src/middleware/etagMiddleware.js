/**
 * ETag middleware for conditional requests
 * Returns 304 Not Modified if content hasn't changed
 */

import crypto from 'crypto';

/**
 * Generate ETag from response body
 */
function generateETag(body) {
  const hash = crypto
    .createHash('md5')
    .update(JSON.stringify(body))
    .digest('hex');
  return `"${hash}"`;
}

/**
 * ETag middleware
 */
export function etagMiddleware(req, res, next) {
  // Only apply to GET requests
  if (req.method !== 'GET') {
    return next();
  }

  // Intercept json() to add ETag and check If-None-Match
  const originalJson = res.json.bind(res);

  res.json = function(body) {
    // Generate ETag
    const etag = generateETag(body);
    res.set('ETag', etag);

    // Check If-None-Match header
    const clientETag = req.headers['if-none-match'];
    if (clientETag === etag) {
      // Content hasn't changed - return 304
      res.status(304).end();
      return res;
    }

    // Content changed - return full response
    return originalJson(body);
  };

  next();
}
