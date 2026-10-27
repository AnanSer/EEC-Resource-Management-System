import { AppRequest, AppResponse } from '../http/types';
import { validateSession, SESSION_COOKIE_NAME } from './session';

/**
 * Cookie parsing middleware (zero external dependencies)
 * Populates req.cookies from raw HTTP header
 */
export function cookieParserMiddleware(req: AppRequest, _res: AppResponse, next: () => Promise<void>) {
  // cookies are parsed in requestListener, ensure object exists
  if (!req.cookies) {
    req.cookies = {};
  }
  return next();
}

/**
 * Session verification middleware - attaches authenticated user to req.user if session cookie is valid
 */
export async function sessionMiddleware(req: AppRequest, _res: AppResponse, next: () => Promise<void>): Promise<void> {
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
  await next();
}

/**
 * Route guard that requires an active authenticated session
 */
export async function requireAuth(req: AppRequest, res: AppResponse, next?: () => Promise<void>): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Unauthorized: Valid session required',
    });
    return;
  }
  if (next) await next();
}

/**
 * Route guard that requires one of the specified roles.
 * Preserves the 5 original EEC roles:
 * - 'ADMIN'
 * - 'STORE_KEEPER'
 * - 'IT_TECHNICIAN'
 * - 'DEPARTMENT_MANAGER'
 * - 'EMPLOYEE'
 */
export function requireRole(allowedRoles: string[]) {
  return async (req: AppRequest, res: AppResponse, next: () => Promise<void>): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized: Valid session required',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Forbidden: Requires one of [${allowedRoles.join(', ')}] role authority`,
      });
      return;
    }

    await next();
  };
}

/**
 * Route guard that enforces department data visibility boundaries.
 * In accordance with EEC Resource Governance (handover doc 02-roles-and-permissions.md):
 * - 'ADMIN': Enterprise-wide governance across all directorates.
 * - 'STORE_KEEPER' / 'IT_TECHNICIAN': Enterprise inventory & technical authority.
 * - 'DEPARTMENT_MANAGER': Strictly scoped to their own department.
 */
export function requireDepartmentAccess(getTargetDepartmentId: (req: AppRequest) => string | undefined) {
  return async (req: AppRequest, res: AppResponse, next: () => Promise<void>): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized: Valid session required',
      });
      return;
    }

    // Admin, Store Keeper, and IT Tech have enterprise operational scope
    if (req.user.role === 'ADMIN' || req.user.role === 'STORE_KEEPER' || req.user.role === 'IT_TECHNICIAN') {
      return next();
    }

    const targetDeptId = getTargetDepartmentId(req);
    const userDeptId = (req.user as any).departmentId;

    if (req.user.role === 'DEPARTMENT_MANAGER') {
      if (targetDeptId && userDeptId && targetDeptId !== userDeptId) {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Department boundary access denied. You may only access resources within your directorate.',
        });
        return;
      }
    }

    await next();
  };
}
