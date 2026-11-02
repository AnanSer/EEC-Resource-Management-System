import { ServerResponse } from 'node:http';

/**
 * Centralized HTTP Security Headers for EEC RMS Native Node.js Backend (SEC-08).
 * Applied uniformly to API responses, errors, and preflight OPTIONS responses.
 */
export function applySecurityHeaders(res: ServerResponse): void {
  // Prevent MIME-sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent framing and clickjacking attacks
  res.setHeader('X-Frame-Options', 'DENY');

  // Strict origin referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // API-only Content Security Policy:
  // EEC RMS API serves structured JSON, CSV, PDF, and XLSX data streams.
  // Setting default-src 'none' and frame-ancestors 'none' ensures the API cannot be framed
  // or misused as an active script execution surface.
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none';");

  // HTTP Strict Transport Security (HSTS):
  // Applied in production mode when HTTPS is guaranteed by the hosting platform (e.g. Render / Cloudflare).
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

