import { Router } from '../http/router';
import { AppRequest, AppResponse } from '../http/types';
import { requireAuth, requireRole } from '../auth/auth.middleware';
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
 * GET /api/employees
 * List employees with role and department boundary enforcement.
 * - ADMIN, STORE_KEEPER, IT_TECHNICIAN: corporation-wide roster (with optional ?departmentId filter)
 * - DEPARTMENT_MANAGER: strictly scoped to personnel within their assigned department
 * - EMPLOYEE: strictly scoped to personnel within their assigned department
 */
router.get('/', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const userRole = req.user!.role;
    const userDeptId = req.user!.departmentId;
    const requestedDeptId = typeof req.query.departmentId === 'string' ? req.query.departmentId : undefined;

    let targetDeptId: string | undefined = undefined;

    if (userRole === 'DEPARTMENT_MANAGER' || userRole === 'EMPLOYEE') {
      // Must not trust client-supplied department ID
      if (!userDeptId) {
        return res.status(200).json({ success: true, employees: [] });
      }
      targetDeptId = userDeptId;
    } else {
      // Enterprise roles: can filter by requestedDeptId if provided
      targetDeptId = requestedDeptId;
    }

    const employees = await prisma.employee.findMany({
      where: targetDeptId ? { departmentId: targetDeptId } : undefined,
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const formatted = employees.map(e => ({
      id: e.id,
      employeeId: e.employeeId,
      name: e.name,
      email: e.email,
      phone: e.phone || '',
      departmentId: e.departmentId,
      departmentName: e.department.name,
      designation: e.designation,
      role: e.role,
      isActive: e.isActive,
      hireDate: e.hireDate.toISOString().split('T')[0],
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    }));

    return res.status(200).json({
      success: true,
      employees: formatted,
    });
  } catch (err: any) {
    console.error('[EEC-RMS Employees] List error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve employee roster',
    });
  }
});

/**
 * GET /api/employees/:id
 * Retrieve employee by ID.
 * Department Managers and Employees are forbidden from viewing personnel outside their directorate.
 */
router.get('/:id', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const targetId = req.params.id;
    const userRole = req.user!.role;
    const userDeptId = req.user!.departmentId;

    const employee = await prisma.employee.findFirst({
      where: {
        OR: [
          { id: targetId },
          { employeeId: targetId },
        ],
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: `Employee '${targetId}' not found in corporate directory`,
      });
    }

    // Check department boundary access
    if (userRole === 'DEPARTMENT_MANAGER' || userRole === 'EMPLOYEE') {
      if (employee.departmentId !== userDeptId) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Department boundary access denied. Personnel is outside your assigned directorate.',
        });
      }
    }

    return res.status(200).json({
      success: true,
      employee: {
        id: employee.id,
        employeeId: employee.employeeId,
        name: employee.name,
        email: employee.email,
        phone: employee.phone || '',
        departmentId: employee.departmentId,
        departmentName: employee.department.name,
        designation: employee.designation,
        role: employee.role,
        isActive: employee.isActive,
        hireDate: employee.hireDate.toISOString().split('T')[0],
        createdAt: employee.createdAt.toISOString(),
        updatedAt: employee.updatedAt.toISOString(),
      },
    });
  } catch (err: any) {
    console.error('[EEC-RMS Employees] Get error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve employee details',
    });
  }
});

/**
 * POST /api/employees
 * Register new personnel in corporate roster.
 * Permitted: ADMIN (corporation-wide) or DEPARTMENT_MANAGER (scoped to their own directorate).
 */
router.post('/', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const userRole = req.user!.role;
    const userDeptId = req.user!.departmentId;

    if (userRole !== 'ADMIN' && userRole !== 'DEPARTMENT_MANAGER') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Requires Administrator or Department Manager authority to register personnel',
      });
    }

    const {
      name,
      email,
      phone,
      departmentId,
      designation,
      role,
      employeeId,
      hireDate,
    } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Full legal name is required',
      });
    }

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'A valid email address is required',
      });
    }

    if (!designation || typeof designation !== 'string' || designation.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Job designation / title is required',
      });
    }

    // Requirement 6: Do not trust frontend-supplied department ID for Department Managers
    let targetDeptId = departmentId;
    if (userRole === 'DEPARTMENT_MANAGER') {
      if (!userDeptId) {
        return res.status(400).json({
          success: false,
          message: 'Your account is not assigned to any directorate',
        });
      }
      if (departmentId && departmentId !== userDeptId) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Department managers may only register personnel within their own directorate',
        });
      }
      targetDeptId = userDeptId;
    }

    if (!targetDeptId) {
      return res.status(400).json({
        success: false,
        message: 'Target department ID is required',
      });
    }

    // Verify department exists in database
    const dept = await prisma.department.findUnique({
      where: { id: targetDeptId },
    });

    if (!dept) {
      return res.status(400).json({
        success: false,
        message: `Department with ID '${targetDeptId}' does not exist in corporate directory`,
      });
    }

    const sanitizedEmail = email.trim().toLowerCase();

    // Check duplicate email
    const existingEmail = await prisma.employee.findUnique({
      where: { email: sanitizedEmail },
    });

    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: `An employee with email '${sanitizedEmail}' already exists in roster`,
      });
    }

    // Validate role assignment
    const assignedRole = role ? String(role).toUpperCase() : 'EMPLOYEE';
    if (!VALID_ROLES.includes(assignedRole as any)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role assignment '${role}'. Must be one of: [${VALID_ROLES.join(', ')}]`,
      });
    }

    if (userRole === 'DEPARTMENT_MANAGER' && (assignedRole === 'ADMIN' || assignedRole === 'DEPARTMENT_MANAGER')) {
      return res.status(403).json({
        success: false,
        message: 'Department managers cannot assign privileged administrator or manager roles',
      });
    }

    // Generate unique employee ID if not provided
    let empId = employeeId ? String(employeeId).trim().toUpperCase() : '';
    if (!empId) {
      const randomNum = Math.floor(100 + Math.random() * 900);
      empId = `EEC-EMP-${randomNum}`;
    }

    // Ensure employeeId is unique
    const existingEmpId = await prisma.employee.findUnique({
      where: { employeeId: empId },
    });

    if (existingEmpId) {
      empId = `EEC-EMP-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // Check if there is an existing User with matching email to link
    const matchingUser = await prisma.user.findUnique({
      where: { email: sanitizedEmail },
    });

    const created = await prisma.employee.create({
      data: {
        employeeId: empId,
        name: name.trim(),
        email: sanitizedEmail,
        phone: phone ? String(phone).trim() : null,
        departmentId: targetDeptId,
        designation: designation.trim(),
        role: assignedRole,
        isActive: true,
        hireDate: hireDate ? new Date(hireDate) : new Date(),
        userId: matchingUser ? matchingUser.id : null,
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: `Employee '${created.name}' (${created.employeeId}) registered successfully`,
      employee: {
        id: created.id,
        employeeId: created.employeeId,
        name: created.name,
        email: created.email,
        phone: created.phone || '',
        departmentId: created.departmentId,
        departmentName: created.department.name,
        designation: created.designation,
        role: created.role,
        isActive: created.isActive,
        hireDate: created.hireDate.toISOString().split('T')[0],
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
    });
  } catch (err: any) {
    console.error('[EEC-RMS Employees] Create error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to register employee',
    });
  }
});

/**
 * PUT /api/employees/:id
 * Update employee record.
 */
router.put('/:id', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const targetId = req.params.id;
    const userRole = req.user!.role;
    const userDeptId = req.user!.departmentId;

    if (userRole !== 'ADMIN' && userRole !== 'DEPARTMENT_MANAGER') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Requires Administrator or Department Manager authority to modify personnel',
      });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: targetId },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: `Employee with ID '${targetId}' not found`,
      });
    }

    if (userRole === 'DEPARTMENT_MANAGER' && employee.departmentId !== userDeptId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You may only modify personnel within your assigned directorate',
      });
    }

    const {
      name,
      phone,
      designation,
      role,
      departmentId,
      isActive,
    } = req.body || {};

    // Department managers cannot reassign personnel to another department
    let newDeptId = employee.departmentId;
    if (departmentId && departmentId !== employee.departmentId) {
      if (userRole !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Only Administrators can transfer employees across departments',
        });
      }
      const deptExists = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!deptExists) {
        return res.status(400).json({ success: false, message: 'Specified department does not exist' });
      }
      newDeptId = departmentId;
    }

    const updated = await prisma.employee.update({
      where: { id: targetId },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(phone !== undefined ? { phone: phone?.trim() || null } : {}),
        ...(designation ? { designation: designation.trim() } : {}),
        ...(role ? { role: role.toUpperCase() } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
        departmentId: newDeptId,
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Employee record updated successfully',
      employee: {
        id: updated.id,
        employeeId: updated.employeeId,
        name: updated.name,
        email: updated.email,
        phone: updated.phone || '',
        departmentId: updated.departmentId,
        departmentName: updated.department.name,
        designation: updated.designation,
        role: updated.role,
        isActive: updated.isActive,
        hireDate: updated.hireDate.toISOString().split('T')[0],
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (err: any) {
    console.error('[EEC-RMS Employees] Update error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update employee record',
    });
  }
});

/**
 * DELETE /api/employees/:id
 * Remove employee record. ADMIN only.
 */
router.delete('/:id', requireRole(['ADMIN']), async (req: AppRequest, res: AppResponse) => {
  try {
    const targetId = req.params.id;

    const employee = await prisma.employee.findUnique({
      where: { id: targetId },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: `Employee with ID '${targetId}' not found`,
      });
    }

    await prisma.employee.delete({
      where: { id: targetId },
    });

    return res.status(200).json({
      success: true,
      message: `Employee '${employee.name}' (${employee.employeeId}) removed from roster`,
    });
  } catch (err: any) {
    console.error('[EEC-RMS Employees] Delete error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete employee record',
    });
  }
});

export default router;
