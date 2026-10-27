import { Request, Response, NextFunction } from 'express';
import { validateSession, SESSION_COOKIE_NAME, SessionUser } from './session';

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
      sessionToken?: string;
      cookies?: Record<string, string>;
    }
  }
}

/**
 * Cookie parsing middleware (zero external dependencies)
 */
export function cookieParserMiddleware(req: Request, _res: Response, next: NextFunction) {
  req.cookies = {};
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    cookieHeader.split(';').forEach((cookie) => {
      const parts = cookie.split('=');
      const name = parts[0]?.trim();
      const val = parts.slice(1).join('=').trim();
      if (name) {
        req.cookies![name] = decodeURIComponent(val);
      }
    });
  }
  next();
}

/**
 * Session verification middleware - attaches authenticated user to req.user if session cookie is valid
 */
export async function sessionMiddleware(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (!token) return next();

  try {
    const result = await validateSession(token);
    if (result) {
      req.user = result.user;
      req.sessionToken = token;
    }
  } catch (error) {
    console.error('[EEC-RMS Auth] Error verifying session:', error);
  }
  next();
}

/**
 * Route guard that requires an active authenticated session
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): any {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Valid session required',
    });
  }
  next();
}