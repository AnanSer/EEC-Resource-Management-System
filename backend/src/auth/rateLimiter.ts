import { IncomingMessage } from 'node:http';

/**
 * In-memory sliding-window rate limiter for sensitive authentication endpoints (SEC-09).
 * 
 * ARCHITECTURE NOTE:
 * This in-memory store is fully suitable and highly performant for single-instance backend deployments
 * (e.g. Render starter/standard instances).
 * Before scaling out to multiple horizontal backend instances behind a round-robin load balancer,
 * this store should be transitioned to shared Redis / Valkey storage to maintain unified rate limits across nodes.
 */

interface RateLimitRecord {
  timestamps: number[];
}

const store = new Map<string, RateLimitRecord>();

/**
 * Safely extracts client IP behind reverse proxies (e.g. Render / Cloudflare).
 * When an untrusted client sends a forged X-Forwarded-For header, reverse proxies
 * append the verified client IP to the end of the chain. We extract the verified last address.
 */
export function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    const ips = forwarded.split(',').map((p) => p.trim()).filter(Boolean);
    if (ips.length > 0) {
      return ips[ips.length - 1];
    }
  }

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }

  return req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Check if an action is within rate limits.
 * @param key Unique identifier (e.g., `login:ip:${ip}` or `login:account:${email}`)
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
