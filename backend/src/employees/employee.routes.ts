import { Router } from '../http/router';
import { AppRequest, AppResponse } from '../http/types';
import { requireAuth, requireRole } from '../auth/auth.middleware';
import prisma from '../lib/prisma';
import { recordAuditEvent } from '../audit/audit.service';
import { safeNotifyUser } from '../notifications/notification.service';

const router = new Router();

const VALID_ROLES = [
  'ADMIN',
  'STORE_KEEPER',
  'IT_TECHNICIAN',
  'DEPARTMENT_MANAGER',
  'EMPLOYEE',
] as const;

function formatEmployeeBasic(e: any) {
  const accountStatus = e.user 
    ? e.user.status 
    : (e.isActive ? 'ACTIVE' : 'UNREGISTERED');

  const activeCount = Array.isArray(e.assignments)
    ? e.assignments.length
    : (e._count?.assignedResources || 0);

  return {
    id: e.id,
    employeeId: e.employeeId,
    name: e.name,
    email: e.email,
    phone: e.phone || e.user?.phone || '',
    departmentId: e.departmentId,
    departmentName: e.department?.name || '',
    departmentCode: e.department?.code || '',
    designation: e.designation,
    role: e.user?.role || e.role,
    accountStatus,
    isActive: Boolean(e.isActive && (!e.user || e.user.status === 'APPROVED')),
    userId: e.userId || null,
    hireDate: e.hireDate ? e.hireDate.toISOString().split('T')[0] : '',
    createdAt: e.createdAt ? e.createdAt.toISOString() : '',
    updatedAt: e.updatedAt ? e.updatedAt.toISOString() : '',
    assignedResourcesCount: activeCount,
    assignmentsCount: e._count?.assignments || 0,
    requisitionsCount: e._count?.requisitions || 0,
  };
}

/**
 * GET /api/employees
 * List employees with role and department boundary enforcement.
 * - ADMIN, STORE_KEEPER, IT_TECHNICIAN: corporation-wide roster (with optional ?departmentId filter)
 * - DEPARTMENT_MANAGER: strictly scoped to personnel within their assigned department
 * - EMPLOYEE: strictly scoped to personnel within their assigned department
 * Supports search, role, status, and pagination.
 */
router.get('/', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const userRole = req.user!.role;
    const userDeptId = req.user!.departmentId;
    const { departmentId, search, role, status, page, limit } = req.query || {};

    let targetDeptId: string | undefined = undefined;

    if (userRole === 'DEPARTMENT_MANAGER' || userRole === 'EMPLOYEE') {
      // Must not trust client-supplied department ID
      if (!userDeptId) {
        return res.status(200).json({
          success: true,
          employees: [],
          counts: { total: 0, active: 0, pending: 0, suspended: 0 },
          pagination: { total: 0, page: 1, limit: 50, totalPages: 0 }
        });
      }
      targetDeptId = userDeptId;
    } else if (departmentId && departmentId !== 'ALL') {
      targetDeptId = String(departmentId);
    }

    const where: any = {};
    if (targetDeptId) {
      where.departmentId = targetDeptId;
    }

    if (role && role !== 'ALL') {
      const r = String(role).toUpperCase();
      where.OR = [
        { role: r },
        { user: { role: r } }
      ];
    }

    if (search && String(search).trim()) {
      const q = String(search).trim();
      const searchConditions = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { employeeId: { contains: q, mode: 'insensitive' } },
        { designation: { contains: q, mode: 'insensitive' } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchConditions }];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    // Status filtering
    if (status && status !== 'ALL') {
      const s = String(status).toUpperCase();
      if (s === 'PENDING') {
        where.user = { status: 'PENDING' };
      } else if (s === 'APPROVED' || s === 'ACTIVE') {
        where.isActive = true;
        const activeCondition = [
          { user: { status: 'APPROVED' } },
          { user: null }
        ];
        if (where.OR) {
          where.AND = [{ OR: where.OR }, { OR: activeCondition }];
          delete where.OR;
        } else {
          where.OR = activeCondition;
        }
      } else if (s === 'SUSPENDED') {
        where.user = { status: 'SUSPENDED' };
      } else if (s === 'REJECTED') {
        where.user = { status: 'REJECTED' };
      } else if (s === 'UNREGISTERED') {
        where.userId = null;
      }
    }

    const pageNum = Math.max(1, parseInt(String(page || '1'), 10));
    const limitNum = Math.max(1, Math.min(200, parseInt(String(limit || '100'), 10)));
    const skip = (pageNum - 1) * limitNum;

    const [totalMatching, employees, allScoped] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.findMany({
        where,
        include: {
          department: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              status: true,
              role: true,
              phone: true,
              createdAt: true,
            },
          },
          assignments: {
            where: { isCurrent: true, status: 'ACTIVE' },
            select: { id: true },
          },
          _count: {
            select: {
              assignedResources: true,
              assignments: true,
              requisitions: true,
            },
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limitNum,
      }),
      // Query all scoped employees to compute live KPI statistics
      prisma.employee.findMany({
        where: targetDeptId ? { departmentId: targetDeptId } : undefined,
        select: {
          isActive: true,
          user: {
            select: {
              status: true,
            },
          },
        },
      }),
    ]);

    const activeCount = allScoped.filter(e => e.isActive && (!e.user || e.user.status === 'APPROVED')).length;
    const pendingCount = allScoped.filter(e => e.user?.status === 'PENDING' || (!e.isActive && (!e.user || e.user.status === 'PENDING'))).length;
    const suspendedCount = allScoped.filter(e => e.user?.status === 'SUSPENDED').length;

    const formatted = employees.map(formatEmployeeBasic);

    return res.status(200).json({
      success: true,
      employees: formatted,
      counts: {
        total: allScoped.length,
        active: activeCount,
        pending: pendingCount,
        suspended: suspendedCount,
      },
      pagination: {
        total: totalMatching,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalMatching / limitNum),
      },
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
 * Retrieve employee profile and complete operational history.
 * Department Managers are strictly forbidden from viewing personnel outside their directorate.
 * Employees can only view their own profile.
 */
router.get('/:id', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const targetId = req.params.id;
    const userRole = req.user!.role;
    const userDeptId = req.user!.departmentId;
    const userId = req.user!.id;
    const userEmployeeRecordId = req.user!.employeeRecordId;

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
            location: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            status: true,
            role: true,
            phone: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        _count: {
          select: {
            assignedResources: true,
            assignments: true,
            requisitions: true,
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

    // Role-based boundary checks
    if (userRole === 'DEPARTMENT_MANAGER') {
      if (employee.departmentId !== userDeptId) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Department boundary access denied. Personnel is outside your assigned directorate.',
        });
      }
    } else if (userRole === 'EMPLOYEE') {
      const isSelf = employee.userId === userId || employee.id === userEmployeeRecordId;
      if (!isSelf && employee.departmentId !== userDeptId) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You do not have permission to view other employee records.',
        });
      }
    }

    // Retrieve active resources held in custody and complete operational dossier
    const [activeAssignments, assignments, transfers, requisitions, maintenanceRequests, auditEvents] = await Promise.all([
      // Active current assignments (defines active equipment currently held in custody)
      prisma.resourceAssignment.findMany({
        where: {
          employeeId: employee.id,
          isCurrent: true,
          status: 'ACTIVE',
        },
        include: {
          resource: {
            select: {
              id: true,
              itemCode: true,
              name: true,
              category: true,
              subcategory: true,
              status: true,
              condition: true,
              location: true,
              assignedAt: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: { assignedAt: 'desc' },
      }),
      // Lifetime Assignment history (both active, returned, and transferred)
      prisma.resourceAssignment.findMany({
        where: { employeeId: employee.id },
        include: {
          resource: {
            select: {
              id: true,
              itemCode: true,
              name: true,
              category: true,
              status: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: { assignedAt: 'desc' },
        take: 100,
      }),
      // Custody Transfers involving this employee
      prisma.custodyTransfer.findMany({
        where: {
          OR: [
            { fromEmployeeId: employee.id },
            { toEmployeeId: employee.id },
          ],
        },
        include: {
          resource: {
            select: {
              id: true,
              itemCode: true,
              name: true,
            },
          },
          fromDepartment: { select: { name: true, code: true } },
          toDepartment: { select: { name: true, code: true } },
          fromEmployee: { select: { name: true, employeeId: true } },
          toEmployee: { select: { name: true, employeeId: true } },
        },
        orderBy: { transferredAt: 'desc' },
        take: 100,
      }),
      // Requisitions submitted for/by this employee
      prisma.resourceRequisition.findMany({
        where: {
          OR: [
            { employeeId: employee.id },
            ...(employee.userId ? [{ requesterId: employee.userId }, { requesterId: employee.id }] : []),
          ],
        },
        include: {
          department: { select: { name: true, code: true } },
          fulfilledResource: { select: { id: true, itemCode: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      // Maintenance tickets reported by employee or where employee was custodian
      prisma.maintenanceRequest.findMany({
        where: {
          OR: [
            { reportedById: employee.id },
            ...(employee.userId ? [{ reportedById: employee.userId }] : []),
            { custodianIdAtRequest: employee.id },
            ...(employee.userId ? [{ custodianIdAtRequest: employee.userId }] : []),
          ],
        },
        include: {
          resource: { select: { id: true, itemCode: true, name: true, category: true } },
          department: { select: { name: true } },
        },
        orderBy: { reportedDate: 'desc' },
        take: 100,
      }),
      // Audit trail events relating to this personnel record
      prisma.auditEvent.findMany({
        where: {
          OR: [
            { referenceId: employee.employeeId },
            { referenceId: employee.id },
            { actorId: employee.id },
            ...(employee.userId ? [{ actorId: employee.userId }] : []),
          ],
        },
        orderBy: { timestamp: 'desc' },
        take: 100,
      }),
    ]);

    const formattedEmployee = formatEmployeeBasic(employee);

    const dossierData = {
      assignedResources: activeAssignments.map(a => ({
        id: a.resource.id,
        itemCode: a.resource.itemCode,
        name: a.resource.name,
        category: a.resource.category,
        subcategory: a.resource.subcategory || '',
        status: a.resource.status,
        condition: a.resource.condition,
        location: a.resource.location,
        assignedAt: a.assignedAt ? a.assignedAt.toISOString() : (a.resource.assignedAt ? a.resource.assignedAt.toISOString() : null),
        assignmentId: a.id,
        assignmentNumber: a.assignmentNumber,
      })),
      assignments: assignments.map(a => ({
        id: a.id,
        assignmentNumber: a.assignmentNumber,
        resourceId: a.resourceId,
        resourceName: a.resource.name,
        resourceCode: a.resource.itemCode,
        resourceCategory: a.resource.category,
        assignedAt: a.assignedAt ? a.assignedAt.toISOString() : '',
        returnedAt: a.returnedAt ? a.returnedAt.toISOString() : null,
        expectedReturnDate: a.expectedReturnDate ? a.expectedReturnDate.toISOString().split('T')[0] : null,
        status: a.status,
        isCurrent: a.isCurrent,
        purpose: a.purpose,
        notes: a.notes,
      })),
      transfers: transfers.map(t => ({
        id: t.id,
        transferNumber: t.transferNumber,
        resourceId: t.resourceId,
        resourceName: t.resource.name,
        resourceCode: t.resource.itemCode,
        fromEmployeeName: t.fromEmployee?.name || '',
        toEmployeeName: t.toEmployee?.name || '',
        isOrigin: t.fromEmployeeId === employee.id,
        fromDepartmentName: t.fromDepartment.name,
        toDepartmentName: t.toDepartment.name,
        transferredAt: t.transferredAt.toISOString(),
        reason: t.reason,
        notes: t.notes,
      })),
      requisitions: requisitions.map(r => ({
        id: r.id,
        requisitionNumber: r.requisitionNumber,
        category: r.category,
        itemDescription: r.itemDescription,
        justification: r.justification,
        urgency: r.urgency,
        status: r.status,
        requiredDate: r.requiredDate
          ? new Intl.DateTimeFormat('en-CA', {
              timeZone: 'Africa/Addis_Ababa',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            }).format(r.requiredDate)
          : '',
        createdAt: r.createdAt.toISOString(),
        fulfilledResourceName: r.fulfilledResource?.name || null,
        fulfilledResourceCode: r.fulfilledResource?.itemCode || null,
      })),
      maintenanceRequests: maintenanceRequests.map(m => ({
        id: m.id,
        requestNumber: m.requestNumber,
        resourceId: m.resourceId,
        resourceName: m.resource.name,
        resourceCode: m.resource.itemCode,
        title: m.title,
        description: m.description,
        priority: m.priority,
        status: m.status,
        reportedDate: m.reportedDate.toISOString(),
        actualCostETB: m.actualCostETB,
      })),
      auditEvents: auditEvents.map(ev => ({
        id: ev.id,
        actionType: ev.actionType,
        actorName: ev.actorName,
        actorRole: ev.actorRole,
        details: ev.details,
        timestamp: ev.timestamp.toISOString(),
      })),
    };

    return res.status(200).json({
      success: true,
      employee: formattedEmployee,
      ...dossierData,
      profile: dossierData,
      dossier: dossierData,
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

    // Do not trust frontend-supplied department ID for Department Managers
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

    // Record audit event
    await recordAuditEvent(prisma, {
      actionType: 'EMPLOYEE_REGISTERED',
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      actorRole: req.user!.role,
      departmentId: targetDeptId,
      referenceId: created.employeeId,
      details: `Registered personnel record: ${created.name} (${created.employeeId}) as ${created.designation} in ${dept.name}`,
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
 * Update employee record and sync changes with linked User account.
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
      include: { user: true, department: true },
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

    // Validate role changes
    let newRole = employee.role;
    if (role) {
      const normalizedRole = String(role).toUpperCase();
      if (!VALID_ROLES.includes(normalizedRole as any)) {
        return res.status(400).json({
          success: false,
          message: `Invalid role '${role}'. Must be one of: [${VALID_ROLES.join(', ')}]`,
        });
      }
      if (userRole === 'DEPARTMENT_MANAGER' && (normalizedRole === 'ADMIN' || normalizedRole === 'DEPARTMENT_MANAGER')) {
        return res.status(403).json({
          success: false,
          message: 'Department managers cannot assign privileged administrator or manager roles',
        });
      }
      newRole = normalizedRole;
    }

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
        role: newRole,
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
        user: {
          select: {
            id: true,
            status: true,
            role: true,
          },
        },
      },
    });

    // Sync with linked User record if one exists
    if (employee.userId) {
      await prisma.user.update({
        where: { id: employee.userId },
        data: {
          ...(name ? { fullName: name.trim() } : {}),
          ...(phone !== undefined ? { phone: phone?.trim() || null } : {}),
          departmentId: newDeptId,
          role: newRole,
          ...(isActive !== undefined ? { status: isActive ? 'APPROVED' : 'SUSPENDED' } : {}),
        },
      }).catch((uErr) => console.warn('[EEC-RMS] Could not sync user record:', uErr));
    }

    // Audit log
    await recordAuditEvent(prisma, {
      actionType: 'EMPLOYEE_UPDATED',
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      actorRole: req.user!.role,
      departmentId: newDeptId,
      referenceId: updated.employeeId,
      details: `Updated personnel record for ${updated.name} (${updated.employeeId}) by ${req.user!.fullName}`,
    });

    return res.status(200).json({
      success: true,
      message: 'Employee record updated successfully',
      employee: formatEmployeeBasic(updated),
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
 * POST /api/employees/:id/approve
 * ADMIN-only endpoint to approve a pending employee registration.
 * Admin can confirm or change department, and assign system role.
 */
router.post('/:id/approve', requireRole(['ADMIN']), async (req: AppRequest, res: AppResponse) => {
  try {
    const targetId = req.params.id;
    const { role, departmentId, designation } = req.body || {};

    const employee = await prisma.employee.findFirst({
      where: { OR: [{ id: targetId }, { employeeId: targetId }] },
      include: { user: true, department: true },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee record not found',
      });
    }

    const assignedRole = role ? String(role).toUpperCase() : (employee.user?.role || employee.role || 'EMPLOYEE');
    if (!VALID_ROLES.includes(assignedRole as any)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role assignment '${role}'. Must be one of: [${VALID_ROLES.join(', ')}]`,
      });
    }

    let targetDeptId = employee.departmentId;
    if (departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!dept) {
        return res.status(400).json({ success: false, message: 'Specified department does not exist' });
      }
      targetDeptId = departmentId;
    }

    // Update linked User record first if exists
    if (employee.userId) {
      await prisma.user.update({
        where: { id: employee.userId },
        data: {
          status: 'APPROVED',
          role: assignedRole,
          departmentId: targetDeptId,
        },
      });

      await safeNotifyUser({
        recipientId: employee.userId,
        title: 'Account Approved',
        message: `Your EEC RMS account has been approved with role ${assignedRole}. You can now sign in.`,
        type: 'USER',
        priority: 'HIGH',
        actionUrl: '/profile',
        relatedEntityType: 'USER',
        relatedEntityId: employee.userId,
      });
    }

    // Update Employee record
    const updatedEmployee = await prisma.employee.update({
      where: { id: employee.id },
      data: {
        role: assignedRole,
        departmentId: targetDeptId,
        isActive: true,
        ...(designation ? { designation: designation.trim() } : {}),
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
        user: true,
      },
    });

    // Audit log
    await recordAuditEvent(prisma, {
      actionType: 'USER_APPROVED',
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      actorRole: req.user!.role,
      departmentId: targetDeptId,
      referenceId: updatedEmployee.employeeId,
      details: `Administrator approved personnel ${updatedEmployee.name} (${updatedEmployee.employeeId}) with role ${assignedRole}`,
    });

    return res.status(200).json({
      success: true,
      message: `Employee ${updatedEmployee.name} approved with role ${assignedRole}`,
      employee: formatEmployeeBasic(updatedEmployee),
    });
  } catch (err: any) {
    console.error('[EEC-RMS Employees] Approve error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to approve employee',
    });
  }
});

/**
 * POST /api/employees/:id/reject
 * ADMIN-only endpoint to reject an employee application.
 */
router.post('/:id/reject', requireRole(['ADMIN']), async (req: AppRequest, res: AppResponse) => {
  try {
    const targetId = req.params.id;
    const { reason } = req.body || {};

    const employee = await prisma.employee.findFirst({
      where: { OR: [{ id: targetId }, { employeeId: targetId }] },
      include: { user: true },
    });

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee record not found' });
    }

    await prisma.employee.update({
      where: { id: employee.id },
      data: { isActive: false },
    });

    if (employee.userId) {
      await prisma.user.update({
        where: { id: employee.userId },
        data: { status: 'REJECTED' },
      });

      await prisma.session.deleteMany({ where: { userId: employee.userId } }).catch(() => {});

      await safeNotifyUser({
        recipientId: employee.userId,
        title: 'Account Registration Rejected',
        message: `Your account registration was rejected${reason ? ': ' + reason : '.'}`,
        type: 'USER',
        priority: 'HIGH',
        actionUrl: '/profile',
        relatedEntityType: 'USER',
        relatedEntityId: employee.userId,
      });
    }

    await recordAuditEvent(prisma, {
      actionType: 'USER_REJECTED',
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      actorRole: req.user!.role,
      departmentId: employee.departmentId,
      referenceId: employee.employeeId,
      details: `Administrator rejected personnel application for ${employee.name} (${employee.employeeId}). Reason: ${reason || 'Not specified'}`,
    });

    return res.status(200).json({
      success: true,
      message: `Registration for ${employee.name} was rejected`,
    });
  } catch (err: any) {
    console.error('[EEC-RMS Employees] Reject error:', err);
    return res.status(500).json({ success: false, message: 'Failed to reject employee' });
  }
});

/**
 * POST /api/employees/:id/suspend
 * ADMIN-only endpoint to suspend an active employee account.
 */
router.post('/:id/suspend', requireRole(['ADMIN']), async (req: AppRequest, res: AppResponse) => {
  try {
    const targetId = req.params.id;
    const { reason } = req.body || {};

    const employee = await prisma.employee.findFirst({
      where: { OR: [{ id: targetId }, { employeeId: targetId }] },
      include: { user: true },
    });

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee record not found' });
    }

    if (employee.userId === req.user?.id) {
      return res.status(400).json({ success: false, message: 'Cannot suspend your own administrator account' });
    }

    await prisma.employee.update({
      where: { id: employee.id },
      data: { isActive: false },
    });

    if (employee.userId) {
      await prisma.user.update({
        where: { id: employee.userId },
        data: { status: 'SUSPENDED' },
      });

      await prisma.session.deleteMany({ where: { userId: employee.userId } }).catch(() => {});

      await safeNotifyUser({
        recipientId: employee.userId,
        title: 'Account Suspended',
        message: `Your account has been suspended${reason ? ': ' + reason : '. Please contact EEC Security Administration.'}`,
        type: 'USER',
        priority: 'CRITICAL',
        actionUrl: '/profile',
        relatedEntityType: 'USER',
        relatedEntityId: employee.userId,
      });
    }

    await recordAuditEvent(prisma, {
      actionType: 'USER_SUSPENDED',
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      actorRole: req.user!.role,
      departmentId: employee.departmentId,
      referenceId: employee.employeeId,
      details: `Administrator suspended personnel account for ${employee.name} (${employee.employeeId}). Reason: ${reason || 'Not specified'}`,
    });

    return res.status(200).json({
      success: true,
      message: `Employee ${employee.name} account suspended`,
    });
  } catch (err: any) {
    console.error('[EEC-RMS Employees] Suspend error:', err);
    return res.status(500).json({ success: false, message: 'Failed to suspend employee' });
  }
});

/**
 * POST /api/employees/:id/reactivate
 * ADMIN-only endpoint to reactivate a suspended employee account.
 */
router.post('/:id/reactivate', requireRole(['ADMIN']), async (req: AppRequest, res: AppResponse) => {
  try {
    const targetId = req.params.id;

    const employee = await prisma.employee.findFirst({
      where: { OR: [{ id: targetId }, { employeeId: targetId }] },
      include: { user: true },
    });

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee record not found' });
    }

    await prisma.employee.update({
      where: { id: employee.id },
      data: { isActive: true },
    });

    if (employee.userId) {
      await prisma.user.update({
        where: { id: employee.userId },
        data: { status: 'APPROVED' },
      });

      await safeNotifyUser({
        recipientId: employee.userId,
        title: 'Account Reactivated',
        message: 'Your EEC RMS account has been reactivated. You can now sign in.',
        type: 'USER',
        priority: 'HIGH',
        actionUrl: '/profile',
        relatedEntityType: 'USER',
        relatedEntityId: employee.userId,
      });
    }

    await recordAuditEvent(prisma, {
      actionType: 'USER_REACTIVATED',
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      actorRole: req.user!.role,
      departmentId: employee.departmentId,
      referenceId: employee.employeeId,
      details: `Administrator reactivated personnel account for ${employee.name} (${employee.employeeId})`,
    });

    return res.status(200).json({
      success: true,
      message: `Employee ${employee.name} account reactivated`,
    });
  } catch (err: any) {
    console.error('[EEC-RMS Employees] Reactivate error:', err);
    return res.status(500).json({ success: false, message: 'Failed to reactivate employee' });
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
      include: {
        assignedResources: true,
      },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: `Employee with ID '${targetId}' not found`,
      });
    }

    if (employee.assignedResources.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete employee '${employee.name}' who currently has ${employee.assignedResources.length} active resource(s) in custody. Return or transfer them first.`,
      });
    }

    await prisma.employee.delete({
      where: { id: targetId },
    });

    await recordAuditEvent(prisma, {
      actionType: 'EMPLOYEE_DELETED',
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      actorRole: req.user!.role,
      departmentId: employee.departmentId,
      referenceId: employee.employeeId,
      details: `Administrator removed employee record for ${employee.name} (${employee.employeeId})`,
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
