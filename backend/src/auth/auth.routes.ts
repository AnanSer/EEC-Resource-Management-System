import { Router } from '../http/router';
import { AppRequest, AppResponse } from '../http/types';
import { hashPassword, verifyPassword } from './password';
import { createSession, destroySession, SESSION_COOKIE_NAME, SESSION_EXPIRY_DAYS } from './session';
import { requireRole } from './auth.middleware';
import prisma from '../lib/prisma';

const router = new Router();

const VALID_ROLES = [
  'ADMIN',
  'STORE_KEEPER',
  'IT_TECHNICIAN',
  'DEPARTMENT_MANAGER',
  'EMPLOYEE',
] as const;

/**
 * POST /api/auth/register
 * Public registration endpoint. Always assigns role EMPLOYEE and status PENDING.
 */
router.post('/register', async (req: AppRequest, res: AppResponse) => {
  try {
    const { email, password, fullName, departmentId } = req.body || {};

    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Full name is required and must be at least 2 characters',
      });
    }

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'A valid email address is required',
      });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password is required and must be at least 6 characters',
      });
    }

    const sanitizedEmail = email.trim().toLowerCase();

    // Prevent duplicate email registrations
    const existingUser = await prisma.user.findUnique({
      where: { email: sanitizedEmail },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists',
      });
    }

    // Hash password securely with built-in scrypt
    const passwordHash = await hashPassword(password);

    // Rule 8: Public registration cannot create ADMIN or assign privileged roles
    const newUser = await prisma.user.create({
      data: {
        email: sanitizedEmail,
        fullName: fullName.trim(),
        passwordHash,
        role: 'EMPLOYEE',
        status: 'PENDING',
        departmentId: departmentId || null,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        departmentId: true,
        createdAt: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Account registration submitted successfully. Your account is pending administrator approval before you can sign in.',
      user: newUser,
    });
  } catch (err: any) {
    console.error('[EEC-RMS Auth] Registration error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during registration',
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticates user credentials, rejects unapproved accounts, and issues HttpOnly session cookie
 */
router.post('/login', async (req: AppRequest, res: AppResponse) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const sanitizedEmail = String(email).trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: sanitizedEmail },
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
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const passwordValid = await verifyPassword(String(password), user.passwordHash);
    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Check account approval status
    if (user.status === 'PENDING') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_PENDING',
        message: 'Your account registration is currently pending administrator approval. Please wait for an administrator to activate your account.',
      });
    }

    if (user.status === 'REJECTED') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_REJECTED',
        message: 'Your account registration was rejected by an administrator. Please contact EEC IT Governance.',
      });
    }

    if (user.status === 'SUSPENDED') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_SUSPENDED',
        message: 'Your account has been suspended. Please contact EEC Security Administration.',
      });
    }

    if (user.status !== 'APPROVED' && user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: `Account is not active (current status: ${user.status}). Access denied.`,
      });
    }

    // Create database-backed session
    const { token } = await createSession(user.id);

    // Set secure HttpOnly cookie
    res.setCookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/',
      maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60,
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        departmentId: user.departmentId,
        departmentName: user.department?.name || null,
        employeeRecordId: user.employee?.id || null,
        employeeId: user.employee?.employeeId || null,
        employee: user.employee ? {
          id: user.employee.id,
          employeeId: user.employee.employeeId,
          name: user.employee.name,
          designation: user.employee.designation,
          phone: user.employee.phone,
          departmentId: user.employee.departmentId,
          isActive: user.employee.isActive,
        } : null,
      },
    });
  } catch (err: any) {
    console.error('[EEC-RMS Auth] Login error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during login',
    });
  }
});

/**
 * GET /api/auth/me
 * Returns the current authenticated session state and user details
 */
router.get('/me', (req: AppRequest, res: AppResponse) => {
  if (!req.user) {
    return res.status(200).json({
      authenticated: false,
      user: null,
    });
  }

  return res.status(200).json({
    authenticated: true,
    user: req.user,
  });
});

/**
 * POST /api/auth/logout
 * Destroys the database session and clears the HttpOnly cookie
 */
router.post('/logout', async (req: AppRequest, res: AppResponse) => {
  try {
    if (req.sessionToken) {
      await destroySession(req.sessionToken);
    }

    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/',
    });

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (err: any) {
    console.error('[EEC-RMS Auth] Logout error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during logout',
    });
  }
});

/**
 * GET /api/auth/users
 * ADMIN-only endpoint to list all users, optionally filtered by status
 */
router.get('/users', requireRole(['ADMIN']), async (req: AppRequest, res: AppResponse) => {
  try {
    const statusFilter = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : undefined;

    const users = await prisma.user.findMany({
      where: statusFilter ? { status: statusFilter } : undefined,
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
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      users,
    });
  } catch (err: any) {
    console.error('[EEC-RMS Auth] List users error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve users',
    });
  }
});

/**
 * GET /api/auth/users/pending
 * ADMIN-only endpoint to list users awaiting approval
 */
router.get('/users/pending', requireRole(['ADMIN']), async (_req: AppRequest, res: AppResponse) => {
  try {
    const pendingUsers = await prisma.user.findMany({
      where: { status: 'PENDING' },
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
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      users: pendingUsers,
    });
  } catch (err: any) {
    console.error('[EEC-RMS Auth] List pending users error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve pending users',
    });
  }
});

/**
 * POST /api/auth/users/:id/approve
 * ADMIN-only endpoint to approve a pending user and assign an authorized role & optional department
 */
router.post('/users/:id/approve', requireRole(['ADMIN']), async (req: AppRequest, res: AppResponse) => {
  try {
    const userId = req.params.id;
    const { role, departmentId } = req.body || {};

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User account not found',
      });
    }

    if (targetUser.status === 'APPROVED' || targetUser.status === 'ACTIVE') {
      return res.status(400).json({
        success: false,
        message: 'User account is already approved',
      });
    }

    const assignedRole = role ? String(role).toUpperCase() : targetUser.role;
    if (!VALID_ROLES.includes(assignedRole as any)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role assignment '${role}'. Must be one of: [${VALID_ROLES.join(', ')}]`,
      });
    }

    if (departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!dept) {
        return res.status(400).json({
          success: false,
          message: `Department with ID '${departmentId}' does not exist`,
        });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'APPROVED',
        role: assignedRole,
        ...(departmentId ? { departmentId } : {}),
      },
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
        updatedAt: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: `User ${updatedUser.fullName} approved with role ${updatedUser.role}`,
      user: updatedUser,
    });
  } catch (err: any) {
    console.error('[EEC-RMS Auth] Approve user error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to approve user account',
    });
  }
});

/**
 * POST /api/auth/users/:id/reject
 * ADMIN-only endpoint to reject a pending user registration
 */
router.post('/users/:id/reject', requireRole(['ADMIN']), async (req: AppRequest, res: AppResponse) => {
  try {
    const userId = req.params.id;
    const { reason } = req.body || {};

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User account not found',
      });
    }

    // Admin cannot reject their own account
    if (targetUser.id === req.user?.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot reject your own administrator account',
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'REJECTED',
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });

    // Invalidate any active sessions for the rejected user
    await prisma.session.deleteMany({
      where: { userId },
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: `Registration for ${updatedUser.fullName} was rejected`,
      user: updatedUser,
      reason: reason || 'Not specified',
    });
  } catch (err: any) {
    console.error('[EEC-RMS Auth] Reject user error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to reject user registration',
    });
  }
});

export default router;
