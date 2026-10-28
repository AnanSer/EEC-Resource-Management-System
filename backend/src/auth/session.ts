import crypto from 'crypto';
import prisma from '../lib/prisma';

export const SESSION_COOKIE_NAME = 'rms_session';
export const SESSION_EXPIRY_DAYS = 7;

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  departmentId?: string | null;
  departmentName?: string | null;
  departmentCode?: string | null;
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
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
          departmentId: true,
          department: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
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
