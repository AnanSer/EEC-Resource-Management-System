/**
 * In-memory sliding-window rate limiter for sensitive authentication endpoints
 */

interface RateLimitRecord {
  timestamps: number[];
}

const store = new Map<string, RateLimitRecord>();

/**
 * Check if an action is within rate limits.
 * @param key Unique identifier (e.g., `ip:${ip}` or `email:${email}`)
 * @param maxRequests Maximum allowed requests in the window
 * @param windowMs Time window in milliseconds
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 5,
  windowMs: number = 15 * 60 * 1000
): { allowed: boolean; retryAfterSeconds: number; remaining: number } {
  const now = Date.now();
  const windowStart = now - windowMs;

  let record = store.get(key);
  if (!record) {
    record = { timestamps: [] };
    store.set(key, record);
  }

  // Filter out timestamps outside the active window
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

  if (record.timestamps.length >= maxRequests) {
    const oldestInWindow = record.timestamps[0];
    const retryAfterMs = oldestInWindow + windowMs - now;
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    return {
      allowed: false,
      retryAfterSeconds,
      remaining: 0,
    };
  }

  // Record this attempt
  record.timestamps.push(now);

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: maxRequests - record.timestamps.length,
  };
}

/**
 * Clear the rate limiter store (primarily for automated tests)
 */
export function resetRateLimiter(): void {
  store.clear();
}

