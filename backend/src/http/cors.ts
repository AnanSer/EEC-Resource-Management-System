import { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Handles CORS headers and OPTIONS preflight requests natively without external libraries (SEC-07).
 * - Exact origin matching from allowedOrigins (no wildcard with credentials).
 * - Exposes required response headers (e.g. Retry-After, Content-Disposition).
 * Returns true if the request was an OPTIONS preflight and has been fully responded to.
 */
export function handleCors(
  req: IncomingMessage,
  res: ServerResponse,
  allowedOrigins: string[]
): boolean {
  const origin = req.headers.origin;

  if (origin) {
    const isAllowed = allowedOrigins.includes(origin) || (
      process.env.NODE_ENV !== 'production' && (
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')
      )
    );

    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      res.setHeader('Access-Control-Expose-Headers', 'Retry-After, Content-Disposition');
      res.setHeader('Access-Control-Max-Age', '86400');
      res.setHeader('Vary', 'Origin');
    }
  }

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }

  return false;
}
