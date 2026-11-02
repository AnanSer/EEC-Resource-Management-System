import crypto from 'crypto';
import prisma from '../lib/prisma';
import { CookieOptions } from '../http/types';

export const SESSION_COOKIE_NAME = 'rms_session';
export const SESSION_EXPIRY_DAYS = 7;

/**
 * Returns environment-aware, validated cookie options for session management (SEC-07).
 * Supports separate frontend (Vercel) and backend (Render) deployments.
 */
export function getSessionCookieOptions(overrides: Partial<CookieOptions> = {}): CookieOptions {
  // 1. SameSite configuration (COOKIE_SAME_SITE: 'None' | 'Lax' | 'Strict')
  const envSameSite = process.env.COOKIE_SAME_SITE?.trim().toLowerCase();
  let sameSite: 'Lax' | 'None' | 'Strict' = 'Lax';

  if (envSameSite === 'none') {
    sameSite = 'None';
  } else if (envSameSite === 'strict') {
    sameSite = 'Strict';
  } else if (envSameSite === 'lax') {
    sameSite = 'Lax';
  } else if (process.env.NODE_ENV === 'production') {
    // If FRONTEND_URL indicates cross-site deployment (e.g. Vercel frontend on https://*.vercel.app
    // or distinct domain from backend), default to None for cross-site cookie transmission
    const frontendUrl = process.env.FRONTEND_URL || '';
    if (frontendUrl.startsWith('https://') && !frontendUrl.includes('localhost')) {
      sameSite = 'None';
    }
  }

  // 2. Secure configuration (COOKIE_SECURE: 'true' | 'false')
  let secure: boolean;
  if (process.env.COOKIE_SECURE !== undefined) {
    secure = process.env.COOKIE_SECURE === 'true' || process.env.COOKIE_SECURE === '1';
  } else {
    // Secure is required when SameSite=None or in production
    secure = sameSite === 'None' || process.env.NODE_ENV === 'production';
  }

  // 3. Validation: Browsers (Chrome, Safari, Firefox) strictly drop SameSite=None if Secure is false
  if (sameSite === 'None' && !secure) {
    console.warn('[EEC-RMS Security Warning] Cookie SameSite=None requires Secure=true. Auto-enforcing Secure=true.');
    secure = true;
  }

  // 4. Domain configuration (COOKIE_DOMAIN, optional for shared subdomains)
  const domain = process.env.COOKIE_DOMAIN?.trim() || undefined;

  return {
    httpOnly: true, // Never expose session token to frontend JS
    secure,
    sameSite,
    path: '/',
    ...(domain ? { domain } : {}),
    ...overrides,
  };
}

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  departmentId?: string | null;
  departmentName?: string | null;
  departmentCode?: string | null;
  employeeRecordId?: string | null;
  employeeId?: string | null;
  employee?: {
    id: string;
    employeeId: string;
    name: string;
    designation: string;
    phone?: string | null;
    departmentId: string;
    isActive: boolean;
  } | null;
}

/**
 * Generate a cryptographically secure random session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a new session in the database
 */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

/**
 * Validate a session token from an HTTP cookie
 */
export async function validateSession(token: string): Promise<{ session: { id: string; expiresAt: Date }; user: SessionUser } | null> {
  const record = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        include: {
          department: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          employee: true,
        },
      },
    },
  });

  if (!record) return null;

  // Check expiration
  if (record.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: record.id } }).catch(() => {});
    return null;
  }

  const user: SessionUser = {
    id: record.user.id,
    email: record.user.email,
    fullName: record.user.fullName,
    role: record.user.role,
    status: record.user.status,
    departmentId: record.user.departmentId,
    departmentName: record.user.department?.name || null,
    departmentCode: record.user.department?.code || null,
    employeeRecordId: record.user.employee?.id || null,
    employeeId: record.user.employee?.employeeId || null,
    employee: record.user.employee ? {
      id: record.user.employee.id,
      employeeId: record.user.employee.employeeId,
      name: record.user.employee.name,
      designation: record.user.employee.designation,
      phone: record.user.employee.phone,
      departmentId: record.user.employee.departmentId,
      isActive: record.user.employee.isActive,
    } : null,
  };

  return {
    session: {
      id: record.id,
      expiresAt: record.expiresAt,
    },
    user,
  };
}

/**
 * Invalidate a session token
 */
export async function destroySession(token: string): Promise<void> {
  await prisma.session.delete({ where: { token } }).catch(() => {});
}
