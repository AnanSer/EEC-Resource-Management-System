import { ServerResponse } from 'node:http';
import { CookieOptions, AppResponse } from './types';

/**
 * Parses the Cookie header from an incoming HTTP request into a key-value record.
 */
export function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const name = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (!name) continue;
    try {
      cookies[name] = decodeURIComponent(val);
    } catch {
      cookies[name] = val;
    }
  }
  return cookies;
}

/**
 * Serializes a cookie name, value, and options into a Set-Cookie header value.
 */
export function serializeCookie(name: string, val: string, options: CookieOptions = {}): string {
  let cookie = `${name}=${encodeURIComponent(val)}`;

  if (options.maxAge !== undefined) {
    cookie += `; Max-Age=${Math.floor(options.maxAge)}`;
  }
  if (options.expires) {
    cookie += `; Expires=${options.expires.toUTCString()}`;
  }
  cookie += `; Path=${options.path || '/'}`;

  if (options.domain) {
    cookie += `; Domain=${options.domain}`;
  }
  if (options.httpOnly) {
    cookie += '; HttpOnly';
  }
  if (options.secure) {
    cookie += '; Secure';
  }
  if (options.sameSite) {
    cookie += `; SameSite=${options.sameSite}`;
  }
  return cookie;
}

/**
 * Augments a Node ServerResponse with setCookie and clearCookie helper methods.
 */
export function attachCookieHelpers(res: ServerResponse): void {
  const appRes = res as AppResponse;

  appRes.setCookie = (name: string, val: string, options: CookieOptions = {}) => {
    const serialized = serializeCookie(name, val, options);
    const current = res.getHeader('Set-Cookie');
    if (!current) {
      res.setHeader('Set-Cookie', serialized);
    } else if (Array.isArray(current)) {
      res.setHeader('Set-Cookie', [...current, serialized]);
    } else {
      res.setHeader('Set-Cookie', [current.toString(), serialized]);
    }
  };

  appRes.clearCookie = (name: string, options: Omit<CookieOptions, 'maxAge' | 'expires'> = {}) => {
    appRes.setCookie(name, '', {
      ...options,
      expires: new Date(0),
      maxAge: 0,
      path: options.path || '/',
    });
  };
}
