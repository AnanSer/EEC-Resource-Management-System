import { IncomingMessage } from 'node:http';

const MAX_PAYLOAD_BYTES = 1024 * 1024; // 1MB payload limit

/**
 * Reads and parses incoming request body streams natively.
 * Supports application/json and application/x-www-form-urlencoded.
 */
export async function parseRequestBody(req: IncomingMessage): Promise<any> {
  const method = req.method?.toUpperCase();
  if (method === 'GET' || method === 'HEAD') {
    return {};
  }

  return new Promise((resolve, reject) => {
    let raw = '';
    let bytesRead = 0;

    req.on('data', (chunk: Buffer) => {
      bytesRead += chunk.length;
      if (bytesRead > MAX_PAYLOAD_BYTES) {
        req.destroy();
        return reject(new Error('Payload Too Large: Maximum allowed body size is 1MB'));
      }
      raw += chunk.toString('utf8');
    });

    req.on('end', () => {
      if (!raw.trim()) {
        return resolve({});
      }

      const contentType = (req.headers['content-type'] || '').toLowerCase();

      if (contentType.includes('application/json')) {
        try {
          resolve(JSON.parse(raw));
        } catch {
          reject(new Error('Invalid JSON format in request body'));
        }
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const params = new URLSearchParams(raw);
        const result: Record<string, any> = {};
        params.forEach((val, key) => {
          result[key] = val;
        });
        resolve(result);
      } else {
        // Fallback raw text
        resolve(raw);
      }
    });

    req.on('error', (err) => {
      reject(err);
    });
  });
}
