/**
 * Aggressive in-memory LRU cache for API responses
 * Keeps frequently accessed data in RAM for sub-millisecond response times
 */

class LRUCache {
  constructor(maxSize = 100, ttl = 5 * 60 * 1000) { // 5 min default TTL
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    const item = this.cache.get(key);

    if (!item) {
      this.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);
    this.hits++;

    return item.value;
  }

  set(key, value, customTTL) {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    const ttl = customTTL || this.ttl;
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl
    });
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  stats() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total * 100).toFixed(1) : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: `${hitRate}%`,
      ttl: `${this.ttl / 1000}s`
    };
  }

  // Invalidate all caches for a specific dataset
  invalidateDataset(datasetId) {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(`/api/datasets/${datasetId}`)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }
}

// Create cache instances
// Heavy queries get longer TTL since data doesn't change often
const apiCache = new LRUCache(200, 10 * 60 * 1000); // 10 min TTL, 200 entries
const statsCache = new LRUCache(50, 30 * 60 * 1000); // 30 min TTL for stats

export { apiCache, statsCache };
