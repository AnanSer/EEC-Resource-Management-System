import { Router } from '../http/router';
import { AppRequest, AppResponse } from '../http/types';
import { hashPassword, verifyPassword } from './password';
import { createSession, destroySession, SESSION_COOKIE_NAME, SESSION_EXPIRY_DAYS } from './session';
import { requireRole } from './auth.middleware';
import prisma from '../lib/prisma';
import { safeNotifyUser, safeNotifyUsers, findActiveUserIdsByRole } from '../notifications/notification.service';
import { recordAuditEvent } from '../audit/audit.service';

const router = new Router();

const VALID_ROLES = [
  'ADMIN',
  'STORE_KEEPER',
  'IT_TECHNICIAN',
  'DEPARTMENT_MANAGER',
  'EMPLOYEE',
] as const;

/**
 * GET /api/auth/departments
 * Public endpoint to list corporate directorates for registration dropdown.
 */
router.get('/departments', async (_req: AppRequest, res: AppResponse) => {
  try {
    const departments = await prisma.department.findMany({
      select: {
        id: true,
        name: true,
        code: true,
      },
      orderBy: { name: 'asc' },
    });

    return res.status(200).json({
      success: true,
      departments,
    });
  } catch (err: any) {
    console.error('[EEC-RMS Auth] Public departments error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve department list',
    });
  }
});

/**
 * POST /api/auth/register
 * Public registration endpoint. Always assigns role EMPLOYEE and status PENDING.
 * Collects full legal name, institutional email, department, optional employeeId & phone, password.
 */
router.post('/register', async (req: AppRequest, res: AppResponse) => {
  try {
    const { email, password, fullName, departmentId, employeeId, phone } = req.body || {};

    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Full legal name is required and must be at least 2 characters',
      });
    }

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'A valid institutional email address is required',
      });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password is required and must be at least 6 characters',
      });
    }

    let dept: any = null;
    let targetDeptId = departmentId;
    if (departmentId && typeof departmentId === 'string') {
      dept = await prisma.department.findUnique({
        where: { id: departmentId },
      });
      if (!dept) {
        return res.status(400).json({
          success: false,
          message: 'The selected department does not exist in the corporate directory',
        });
      }
      targetDeptId = departmentId;
    } else {
      dept = await prisma.department.findFirst({ orderBy: { code: 'asc' } });
      targetDeptId = dept?.id || null;
    }

    const sanitizedEmail = email.trim().toLowerCase();

    // Prevent duplicate email registrations in User
    const existingUser = await prisma.user.findUnique({
      where: { email: sanitizedEmail },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this institutional email address already exists',
      });
    }

    // Check if employee with this email already has a user account
    const existingEmpWithEmail = await prisma.employee.findUnique({
      where: { email: sanitizedEmail },
    });
    if (existingEmpWithEmail && existingEmpWithEmail.userId) {
      return res.status(409).json({
        success: false,
        message: 'An account with this institutional email address already exists',
      });
    }

    // Validate employeeId if provided
    let sanitizedEmpId: string | null = null;
    if (employeeId && typeof employeeId === 'string' && employeeId.trim()) {
      sanitizedEmpId = employeeId.trim().toUpperCase();

      const existingEmpWithId = await prisma.employee.findUnique({
        where: { employeeId: sanitizedEmpId },
      });
      if (existingEmpWithId && existingEmpWithId.userId) {
        return res.status(409).json({
          success: false,
          message: `Employee ID '${sanitizedEmpId}' is already associated with an active account`,
        });
      }

      const existingUserWithEmpId = await prisma.user.findFirst({
        where: { employeeId: sanitizedEmpId },
      });
      if (existingUserWithEmpId) {
        return res.status(409).json({
          success: false,
          message: `Employee ID '${sanitizedEmpId}' is already registered`,
        });
      }
    }

    // Hash password securely with built-in scrypt
    const passwordHash = await hashPassword(password);

    // Determine final employee ID
    let finalEmpId = sanitizedEmpId || existingEmpWithEmail?.employeeId;
    if (!finalEmpId) {
      let attempts = 0;
      do {
        finalEmpId = `EEC-EMP-${Math.floor(100 + Math.random() * 900)}`;
        const collision = await prisma.employee.findUnique({ where: { employeeId: finalEmpId } });
        if (!collision) break;
        attempts++;
      } while (attempts < 10);
    }

    // Public registration always assigns role EMPLOYEE and status PENDING
    const newUser = await prisma.user.create({
      data: {
        email: sanitizedEmail,
        fullName: fullName.trim(),
        passwordHash,
        role: 'EMPLOYEE',
        status: 'PENDING',
        departmentId: targetDeptId,
        employeeId: finalEmpId,
        phone: phone && typeof phone === 'string' ? phone.trim() : null,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        departmentId: true,
        employeeId: true,
        phone: true,
        createdAt: true,
      },
    });

    // Create or link Employee record
    if (existingEmpWithEmail) {
      await prisma.employee.update({
        where: { id: existingEmpWithEmail.id },
        data: {
          userId: newUser.id,
          name: fullName.trim(),
          phone: phone ? String(phone).trim() : existingEmpWithEmail.phone,
          departmentId: targetDeptId,
          role: 'EMPLOYEE',
          isActive: false, // inactive until approved
        },
      });
    } else {
      await prisma.employee.create({
        data: {
          employeeId: finalEmpId,
          name: fullName.trim(),
          email: sanitizedEmail,
          phone: phone && typeof phone === 'string' ? phone.trim() : null,
          departmentId: targetDeptId,
          designation: 'Staff Member',
          role: 'EMPLOYEE',
          isActive: false, // inactive until approved
          userId: newUser.id,
          hireDate: new Date(),
        },
      });
    }

    // Audit log
    await recordAuditEvent(prisma, {
      actionType: 'USER_REGISTERED',
      actorId: newUser.id,
      actorName: newUser.fullName,
      actorRole: 'EMPLOYEE',
      departmentId: targetDeptId,
      referenceId: finalEmpId,
      details: `New employee registered awaiting administrator verification: ${newUser.fullName} (${newUser.email}) - Department: ${dept.name}`,
    });

    const adminUserIds = await findActiveUserIdsByRole(['ADMIN']);
    await safeNotifyUsers(adminUserIds, {
      title: `New User Registration: ${newUser.fullName}`,
      message: `User ${newUser.fullName} (${newUser.email}) registered an account in ${dept.name} awaiting administrator approval.`,
      type: 'USER',
      priority: 'NORMAL',
      actionUrl: '/employees',
      relatedEntityType: 'USER',
      relatedEntityId: newUser.id,
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
        employeeId: true,
        phone: true,
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

    // Sync linked Employee record
    const targetDept = departmentId || updatedUser.departmentId || (await prisma.department.findFirst())?.id || 'dept-101';
    const linkedEmp = await prisma.employee.findFirst({
      where: { OR: [{ userId: updatedUser.id }, { email: updatedUser.email }] },
    });
    if (linkedEmp) {
      await prisma.employee.update({
        where: { id: linkedEmp.id },
        data: {
          role: assignedRole,
          departmentId: targetDept,
          isActive: true,
          userId: updatedUser.id,
          name: updatedUser.fullName,
        },
      });
    } else {
      await prisma.employee.create({
        data: {
          employeeId: updatedUser.employeeId || `EEC-EMP-${Math.floor(100 + Math.random() * 900)}`,
          name: updatedUser.fullName,
          email: updatedUser.email,
          phone: updatedUser.phone,
          departmentId: targetDept,
          designation: 'Staff Member',
          role: assignedRole,
          isActive: true,
          userId: updatedUser.id,
          hireDate: new Date(),
        },
      });
    }

    await recordAuditEvent(prisma, {
      actionType: 'USER_APPROVED',
      actorId: req.user?.id || null,
      actorName: req.user?.fullName || 'System Administrator',
      actorRole: req.user?.role || 'ADMIN',
      departmentId: targetDept,
      referenceId: updatedUser.employeeId || updatedUser.id,
      details: `Administrator approved user account for ${updatedUser.fullName} (${updatedUser.email}) with role ${assignedRole}`,
    });

    await safeNotifyUser({
      recipientId: updatedUser.id,
      title: 'Account Approved',
      message: `Your EEC RMS account has been approved with role ${updatedUser.role}. You can now sign in and access the system.`,
      type: 'USER',
      priority: 'HIGH',
      actionUrl: '/profile',
      relatedEntityType: 'USER',
      relatedEntityId: updatedUser.id,
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

    // Inactivate linked employee
    await prisma.employee.updateMany({
      where: { OR: [{ userId }, { email: updatedUser.email }] },
      data: { isActive: false },
    }).catch(() => {});

    await recordAuditEvent(prisma, {
      actionType: 'USER_REJECTED',
      actorId: req.user?.id || null,
      actorName: req.user?.fullName || 'System Administrator',
      actorRole: req.user?.role || 'ADMIN',
      referenceId: updatedUser.id,
      details: `Administrator rejected user registration for ${updatedUser.fullName} (${updatedUser.email}). Reason: ${reason || 'Not specified'}`,
    });

    await safeNotifyUser({
      recipientId: updatedUser.id,
      title: 'Account Registration Rejected',
      message: `Your account registration was rejected${reason ? ': ' + reason : '.'}`,
      type: 'USER',
      priority: 'HIGH',
      actionUrl: '/profile',
      relatedEntityType: 'USER',
      relatedEntityId: updatedUser.id,
    });

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

/**
 * POST /api/auth/users/:id/suspend
 * ADMIN-only endpoint to suspend an active user account
 */
router.post('/users/:id/suspend', requireRole(['ADMIN']), async (req: AppRequest, res: AppResponse) => {
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

    if (targetUser.id === req.user?.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot suspend your own administrator account',
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'SUSPENDED',
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

    await prisma.session.deleteMany({
      where: { userId },
    }).catch(() => {});

    // Inactivate linked employee
    await prisma.employee.updateMany({
      where: { OR: [{ userId }, { email: updatedUser.email }] },
      data: { isActive: false },
    }).catch(() => {});

    await recordAuditEvent(prisma, {
      actionType: 'USER_SUSPENDED',
      actorId: req.user?.id || null,
      actorName: req.user?.fullName || 'System Administrator',
      actorRole: req.user?.role || 'ADMIN',
      referenceId: updatedUser.id,
      details: `Administrator suspended user account for ${updatedUser.fullName} (${updatedUser.email}). Reason: ${reason || 'Not specified'}`,
    });

    await safeNotifyUser({
      recipientId: updatedUser.id,
      title: 'Account Suspended',
      message: `Your account has been suspended${reason ? ': ' + reason : '. Please contact EEC Security Administration.'}`,
      type: 'USER',
      priority: 'CRITICAL',
      actionUrl: '/profile',
      relatedEntityType: 'USER',
      relatedEntityId: updatedUser.id,
    });

    return res.status(200).json({
      success: true,
      message: `User ${updatedUser.fullName} was suspended`,
      user: updatedUser,
      reason: reason || 'Not specified',
    });
  } catch (err: any) {
    console.error('[EEC-RMS Auth] Suspend user error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to suspend user account',
    });
  }
});

/**
 * POST /api/auth/users/:id/reactivate
 * ADMIN-only endpoint to reactivate a suspended user account
 */
router.post('/users/:id/reactivate', requireRole(['ADMIN']), async (req: AppRequest, res: AppResponse) => {
  try {
    const userId = req.params.id;

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User account not found',
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'APPROVED',
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        departmentId: true,
        updatedAt: true,
      },
    });

    // Reactivate linked employee
    await prisma.employee.updateMany({
      where: { OR: [{ userId }, { email: updatedUser.email }] },
      data: { isActive: true },
    }).catch(() => {});

    await recordAuditEvent(prisma, {
      actionType: 'USER_REACTIVATED',
      actorId: req.user?.id || null,
      actorName: req.user?.fullName || 'System Administrator',
      actorRole: req.user?.role || 'ADMIN',
      departmentId: updatedUser.departmentId,
      referenceId: updatedUser.id,
      details: `Administrator reactivated user account for ${updatedUser.fullName} (${updatedUser.email})`,
    });

    await safeNotifyUser({
      recipientId: updatedUser.id,
      title: 'Account Reactivated',
      message: 'Your EEC RMS account has been reactivated. You may now sign in and access the system.',
      type: 'USER',
      priority: 'HIGH',
      actionUrl: '/profile',
      relatedEntityType: 'USER',
      relatedEntityId: updatedUser.id,
    });

    return res.status(200).json({
      success: true,
      message: `User ${updatedUser.fullName} was reactivated`,
      user: updatedUser,
    });
  } catch (err: any) {
    console.error('[EEC-RMS Auth] Reactivate user error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to reactivate user account',
    });
  }
});

export default router;
