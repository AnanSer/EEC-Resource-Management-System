import { ServerResponse } from 'node:http';
import { AppResponse } from './types';
import { attachCookieHelpers } from './cookies';

/**
 * Decorates a Node.js ServerResponse with json() and status() methods.
 */
export function decorateResponse(res: ServerResponse): AppResponse {
  const appRes = res as AppResponse;

  attachCookieHelpers(res);

  appRes.status = (code: number) => {
    appRes.statusCode = code;
    return appRes;
  };

  appRes.json = (data: any, statusCode?: number) => {
    const code = statusCode || appRes.statusCode || 200;
    const body = JSON.stringify(data);

    if (!appRes.headersSent) {
      appRes.writeHead(code, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
      });
    }
    appRes.end(body);
  };

  return appRes;
}
