/**
 * Simple in-memory cache with TTL
 * Protects free-tier API call limits
 */

const cache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

// Cleanup expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      cache.delete(key);
    }
  }
}, 10 * 60 * 1000);
