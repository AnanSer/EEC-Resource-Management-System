import { Router } from '../http/router';
import { AppRequest, AppResponse } from '../http/types';
import { requireAuth } from '../auth/auth.middleware';
import prisma from '../lib/prisma';
import { VALID_CONDITIONS } from '../resources/resource.routes';

const router = new Router();

function formatAssignment(a: any) {
  return {
    id: a.id,
    assignmentNumber: a.assignmentNumber,
    resourceId: a.resourceId,
    resourceName: a.resource?.name || '',
    resourceCode: a.resource?.itemCode || '',
    resourceCategory: a.resource?.category || '',
    employeeId: a.employeeId,
    employeeName: a.employee?.name || '',
    employeeDesignation: a.employee?.designation || '',
    employeeEmail: a.employee?.email || '',
    departmentId: a.departmentId,
    departmentName: a.department?.name || '',
    departmentCode: a.department?.code || '',
    assignedBy: a.assignedByName,
    assignedById: a.assignedById,
    assignedAt: a.assignedAt ? a.assignedAt.toISOString() : '',
    returnedAt: a.returnedAt ? a.returnedAt.toISOString() : undefined,
    expectedReturnDate: a.expectedReturnDate ? a.expectedReturnDate.toISOString().split('T')[0] : undefined,
    purpose: a.purpose,
    notes: a.notes || undefined,
    conditionOnAssignment: a.resource?.condition || 'GOOD',
    conditionOnReturn: a.returnCondition || undefined,
    returnLocation: a.returnLocation || undefined,
    returnNotes: a.returnNotes || undefined,
    returnReceivedByName: a.returnReceivedByName || undefined,
    returnReceivedById: a.returnReceivedById || undefined,
    isCurrent: a.isCurrent,
    status: a.status,
    createdAt: a.createdAt ? a.createdAt.toISOString() : '',
    updatedAt: a.updatedAt ? a.updatedAt.toISOString() : '',
  };
}

function formatTransfer(t: any) {
  return {
    id: t.id,
    transferNumber: t.transferNumber,
    resourceId: t.resourceId,
    resourceName: t.resource?.name || '',
    resourceCode: t.resource?.itemCode || '',
    fromAssignmentId: t.fromAssignmentId,
    toAssignmentId: t.toAssignmentId,
    fromEmployeeId: t.fromEmployeeId,
    fromEmployeeName: t.fromEmployee?.name || '',
    toEmployeeId: t.toEmployeeId,
    toEmployeeName: t.toEmployee?.name || '',
    fromDepartmentId: t.fromDepartmentId,
    fromDepartmentName: t.fromDepartment?.name || '',
    toDepartmentId: t.toDepartmentId,
    toDepartmentName: t.toDepartment?.name || '',
    transferredByName: t.transferredByName,
    transferredById: t.transferredById,
    reason: t.reason || '',
    notes: t.notes || '',
    transferredAt: t.transferredAt ? t.transferredAt.toISOString() : '',
    createdAt: t.createdAt ? t.createdAt.toISOString() : '',
  };
}

/**
 * GET /api/assignments
 * List assignments with role-based scoping, status filter, and pagination
 */
router.get('/', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const userRole = req.user!.role;
    const userDeptId = req.user!.departmentId;
    const { search, status, departmentId, employeeId, resourceId, page, limit } = req.query || {};

    let filter: any = {};

    // RBAC: Department Manager and Employee are scoped to their department
    if (userRole === 'DEPARTMENT_MANAGER' || userRole === 'EMPLOYEE') {
      if (!userDeptId) {
        return res.status(200).json({
          success: true,
          assignments: [],
          pagination: { total: 0, page: 1, limit: 50, totalPages: 0 },
        });
      }
      filter.departmentId = userDeptId;
    } else if (departmentId && departmentId !== 'ALL') {
      filter.departmentId = departmentId;
    }

    if (status && status !== 'ALL') {
      filter.status = status;
    }

    if (employeeId && employeeId !== 'ALL') {
      filter.employeeId = employeeId;
    }

    if (resourceId && resourceId !== 'ALL') {
      filter.resourceId = resourceId;
    }

    if (search && search.trim()) {
      const q = search.trim();
      filter.OR = [
        { assignmentNumber: { contains: q, mode: 'insensitive' } },
        { purpose: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
        { resource: { name: { contains: q, mode: 'insensitive' } } },
        { resource: { itemCode: { contains: q, mode: 'insensitive' } } },
        { employee: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page || '1', 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit || '50', 10)));
    const skip = (pageNum - 1) * limitNum;

    const [total, rawAssignments] = await Promise.all([
      prisma.resourceAssignment.count({ where: filter }),
      prisma.resourceAssignment.findMany({
        where: filter,
        include: {
          resource: true,
          employee: true,
          department: true,
        },
        orderBy: [{ isCurrent: 'desc' }, { assignedAt: 'desc' }],
        skip,
        take: limitNum,
      }),
    ]);

    const assignments = rawAssignments.map(formatAssignment);

    return res.status(200).json({
      success: true,
      assignments,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('[GET /api/assignments Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve assignment records',
    });
  }
});

/**
 * GET /api/assignments/history/:resourceId
 * Complete custody timeline and assignment/transfer records for a specific resource
 */
router.get('/history/:resourceId', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const { resourceId } = req.params;
    const userRole = req.user!.role;
    const userDeptId = req.user!.departmentId;

    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
      include: {
        department: true,
        currentAssignee: true,
      },
    });

    if (!resource) {
      return res.status(404).json({
        success: false,
        message: `Resource with ID '${resourceId}' not found`,
      });
    }

    // Role-based visibility check
    if (userRole === 'DEPARTMENT_MANAGER' || userRole === 'EMPLOYEE') {
      if (resource.departmentId !== userDeptId) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You do not have permission to view custody records for resources outside your directorate',
        });
      }
    }

    const [assignments, transfers] = await Promise.all([
      prisma.resourceAssignment.findMany({
        where: { resourceId },
        include: {
          resource: true,
          employee: true,
          department: true,
        },
        orderBy: { assignedAt: 'desc' },
      }),
      prisma.custodyTransfer.findMany({
        where: { resourceId },
        include: {
          resource: true,
          fromEmployee: true,
          toEmployee: true,
          fromDepartment: true,
          toDepartment: true,
        },
        orderBy: { transferredAt: 'desc' },
      }),
    ]);

    // Build a unified chronological timeline
    const timelineEvents: any[] = [];

    // 1. Initial Intake
    if (resource.purchaseDate) {
      timelineEvents.push({
        type: 'INTAKE',
        title: 'Initial Procurement Intake',
        description: `Central store intake recorded. Supplier: ${resource.supplier || 'EEC Central Tender'}`,
        date: resource.purchaseDate.toISOString(),
        actor: 'Chief Store Keeper',
      });
    } else {
      timelineEvents.push({
        type: 'INTAKE',
        title: 'Registry Ingestion',
        description: `Resource registered in ${resource.department?.name || 'Central Store'}`,
        date: resource.createdAt.toISOString(),
        actor: 'System Registry',
      });
    }

    // 2. Add assignments & returns
    assignments.forEach((a) => {
      timelineEvents.push({
        type: 'ASSIGNMENT',
        title: `Assigned to ${a.employee.name}`,
        description: `Purpose: ${a.purpose}${a.notes ? ` (${a.notes})` : ''}`,
        date: a.assignedAt.toISOString(),
        actor: a.assignedByName,
        assignmentNumber: a.assignmentNumber,
        department: a.department.name,
        status: a.status,
      });

      if (a.returnedAt) {
        timelineEvents.push({
          type: 'RETURN',
          title: `Returned by ${a.employee.name}`,
          description: `Condition: ${a.returnCondition || 'GOOD'} • Location: ${a.returnLocation || 'Central Store'}${a.returnNotes ? ` • Notes: ${a.returnNotes}` : ''}`,
          date: a.returnedAt.toISOString(),
          actor: a.returnReceivedByName || 'Receiving Officer',
          assignmentNumber: a.assignmentNumber,
        });
      }
    });

    // 3. Add transfers
    transfers.forEach((t) => {
      timelineEvents.push({
        type: 'TRANSFER',
        title: `Custody Transferred: ${t.fromEmployee.name} ➔ ${t.toEmployee.name}`,
        description: `Reason: ${t.reason || 'Inter-departmental allocation'}${t.notes ? ` • ${t.notes}` : ''}`,
        date: t.transferredAt.toISOString(),
        actor: t.transferredByName,
        transferNumber: t.transferNumber,
        fromDept: t.fromDepartment.name,
        toDept: t.toDepartment.name,
      });
    });

    // Sort timeline newest first
    timelineEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const currentAssignment = assignments.find((a) => a.isCurrent && a.status === 'ACTIVE');

    return res.status(200).json({
      success: true,
      resource: {
        id: resource.id,
        itemCode: resource.itemCode,
        name: resource.name,
        category: resource.category,
        status: resource.status,
        condition: resource.condition,
        location: resource.location,
        departmentId: resource.departmentId,
        departmentName: resource.department?.name,
        currentAssigneeId: resource.currentAssigneeId,
        currentAssigneeName: resource.currentAssignee?.name,
      },
      currentAssignment: currentAssignment ? formatAssignment(currentAssignment) : null,
      assignments: assignments.map(formatAssignment),
      transfers: transfers.map(formatTransfer),
      timeline: timelineEvents,
    });
  } catch (err) {
    console.error('[GET /api/assignments/history Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve asset custody history',
    });
  }
});

/**
 * GET /api/assignments/:id
 * Single assignment details
 */
router.get('/:id', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const { id } = req.params;
    const userRole = req.user!.role;
    const userDeptId = req.user!.departmentId;

    const assignment = await prisma.resourceAssignment.findUnique({
      where: { id },
      include: {
        resource: true,
        employee: true,
        department: true,
      },
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: `Assignment record with ID '${id}' not found`,
      });
    }

    if (userRole === 'DEPARTMENT_MANAGER' || userRole === 'EMPLOYEE') {
      if (assignment.departmentId !== userDeptId) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You do not have permission to view assignment records outside your directorate',
        });
      }
    }

    return res.status(200).json({
      success: true,
      assignment: formatAssignment(assignment),
    });
  } catch (err) {
    console.error('[GET /api/assignments/:id Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve assignment record',
    });
  }
});

/**
 * POST /api/assignments
 * Direct Assignment: Assign an AVAILABLE resource to an active employee
 */
router.post('/', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const user = req.user!;
    const userRole = user.role;
    const userDeptId = user.departmentId;

    // RBAC check: ADMIN, STORE_KEEPER, DEPARTMENT_MANAGER can assign
    if (!['ADMIN', 'STORE_KEEPER', 'DEPARTMENT_MANAGER'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Your role does not have permission to assign resources',
      });
    }

    const { resourceId, employeeId, purpose, expectedReturnDate, notes, location } = req.body || {};

    if (!resourceId || typeof resourceId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Resource ID is required',
      });
    }

    if (!employeeId || typeof employeeId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Employee ID is required',
      });
    }

    if (!purpose || typeof purpose !== 'string' || purpose.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Purpose of assignment is required (minimum 3 characters)',
      });
    }

    // Fetch resource and employee
    const [resource, employee] = await Promise.all([
      prisma.resource.findUnique({
        where: { id: resourceId },
        include: { department: true },
      }),
      prisma.employee.findUnique({
        where: { id: employeeId },
        include: { department: true },
      }),
    ]);

    if (!resource) {
      return res.status(404).json({
        success: false,
        message: `Resource with ID '${resourceId}' not found in registry`,
      });
    }

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: `Employee with ID '${employeeId}' not found in directory`,
      });
    }

    // Validate employee is active
    if (!employee.isActive) {
      return res.status(400).json({
        success: false,
        message: `Employee '${employee.name}' (${employee.employeeId}) is currently marked inactive and cannot receive asset custody`,
      });
    }

    // Validate resource status is AVAILABLE
    if (resource.status !== 'AVAILABLE') {
      return res.status(400).json({
        success: false,
        message: `Resource '${resource.itemCode}' is currently '${resource.status}' and cannot be assigned. Only AVAILABLE resources can be assigned.`,
      });
    }

    // Check duplicate active assignment
    const existingActive = await prisma.resourceAssignment.findFirst({
      where: {
        resourceId,
        isCurrent: true,
        status: 'ACTIVE',
      },
    });

    if (existingActive) {
      return res.status(409).json({
        success: false,
        message: `Resource '${resource.itemCode}' already has an active assignment (${existingActive.assignmentNumber})`,
      });
    }

    // Department boundary check for DEPARTMENT_MANAGER
    if (userRole === 'DEPARTMENT_MANAGER') {
      if (!userDeptId) {
        return res.status(403).json({
          success: false,
          message: 'Your manager account is not assigned to any directorate',
        });
      }
      if (resource.departmentId !== userDeptId) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Department managers may only assign resources belonging to their own directorate',
        });
      }
      if (employee.departmentId !== userDeptId) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Department managers may only assign resources to employees within their own directorate',
        });
      }
    }

    // Parse expected return date if provided
    let expReturn: Date | undefined = undefined;
    if (expectedReturnDate) {
      const parsed = new Date(expectedReturnDate);
      if (isNaN(parsed.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid expectedReturnDate format. Use YYYY-MM-DD',
        });
      }
      expReturn = parsed;
    }

    // Generate unique assignment number
    const count = await prisma.resourceAssignment.count();
    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    const assignmentNumber = `ASGN-${year}-${String(count + 1).padStart(4, '0')}-${rand}`;

    const assignmentDeptId = employee.departmentId || resource.departmentId;
    const now = new Date();

    // Execute atomically
    const result = await prisma.$transaction(async (tx) => {
      const newAssignment = await tx.resourceAssignment.create({
        data: {
          assignmentNumber,
          resourceId: resource.id,
          employeeId: employee.id,
          departmentId: assignmentDeptId,
          assignedByName: user.fullName || `${user.email} (${userRole})`,
          assignedById: user.id,
          assignedAt: now,
          expectedReturnDate: expReturn,
          purpose: purpose.trim(),
          notes: notes ? notes.trim() : null,
          status: 'ACTIVE',
          isCurrent: true,
        },
        include: {
          resource: true,
          employee: true,
          department: true,
        },
      });

      const updatedResource = await tx.resource.update({
        where: { id: resource.id },
        data: {
          status: 'ASSIGNED',
          currentAssigneeId: employee.id,
          departmentId: assignmentDeptId,
          assignedAt: now,
          location: location ? location.trim() : resource.location,
        },
        include: {
          department: true,
          currentAssignee: true,
        },
      });

      return { newAssignment, updatedResource };
    });

    return res.status(201).json({
      success: true,
      message: `Resource '${resource.itemCode}' successfully assigned to ${employee.name}`,
      assignment: formatAssignment(result.newAssignment),
      resource: {
        id: result.updatedResource.id,
        itemCode: result.updatedResource.itemCode,
        status: result.updatedResource.status,
        currentAssigneeName: result.updatedResource.currentAssignee?.name,
        currentDepartmentName: result.updatedResource.department?.name,
      },
    });
  } catch (err) {
    console.error('[POST /api/assignments Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create resource assignment',
    });
  }
});

/**
 * POST /api/assignments/transfer
 * Custody Transfer: Reassign an ASSIGNED resource from one employee to another
 */
router.post('/transfer', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const user = req.user!;
    const userRole = user.role;
    const userDeptId = user.departmentId;

    if (!['ADMIN', 'STORE_KEEPER', 'DEPARTMENT_MANAGER'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Your role does not have permission to transfer resource custody',
      });
    }

    const { resourceId, toEmployeeId, reason, notes, newLocation } = req.body || {};

    if (!resourceId || typeof resourceId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Resource ID is required',
      });
    }

    if (!toEmployeeId || typeof toEmployeeId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Target employee ID (toEmployeeId) is required',
      });
    }

    // Fetch resource and current active assignment
    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
      include: {
        department: true,
        currentAssignee: true,
      },
    });

    if (!resource) {
      return res.status(404).json({
        success: false,
        message: `Resource with ID '${resourceId}' not found in registry`,
      });
    }

    if (resource.status !== 'ASSIGNED') {
      return res.status(400).json({
        success: false,
        message: `Resource '${resource.itemCode}' is currently '${resource.status}'. Only ASSIGNED resources can be transferred.`,
      });
    }

    const currentAssignment = await prisma.resourceAssignment.findFirst({
      where: {
        resourceId,
        isCurrent: true,
        status: 'ACTIVE',
      },
      include: {
        employee: true,
        department: true,
      },
    });

    if (!currentAssignment) {
      return res.status(400).json({
        success: false,
        message: `No active assignment found for resource '${resource.itemCode}'`,
      });
    }

    if (currentAssignment.employeeId === toEmployeeId) {
      return res.status(400).json({
        success: false,
        message: `Target employee is already the current custodian of this resource`,
      });
    }

    // Fetch target employee
    const toEmployee = await prisma.employee.findUnique({
      where: { id: toEmployeeId },
      include: { department: true },
    });

    if (!toEmployee) {
      return res.status(404).json({
        success: false,
        message: `Target employee with ID '${toEmployeeId}' not found in directory`,
      });
    }

    if (!toEmployee.isActive) {
      return res.status(400).json({
        success: false,
        message: `Target employee '${toEmployee.name}' (${toEmployee.employeeId}) is currently marked inactive and cannot receive asset custody`,
      });
    }

    // Department boundary check for DEPARTMENT_MANAGER
    if (userRole === 'DEPARTMENT_MANAGER') {
      if (!userDeptId) {
        return res.status(403).json({
          success: false,
          message: 'Your manager account is not assigned to any directorate',
        });
      }
      if (resource.departmentId !== userDeptId) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Department managers may only transfer resources belonging to their own directorate',
        });
      }
      if (toEmployee.departmentId !== userDeptId) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Department managers cannot transfer resources to another directorate. Inter-department transfers require Admin or Store Keeper authority.',
        });
      }
    }

    // Numbers for records
    const year = new Date().getFullYear();
    const asgnCount = await prisma.resourceAssignment.count();
    const trfCount = await prisma.custodyTransfer.count();
    const rand = Math.floor(1000 + Math.random() * 9000);
    const newAssignmentNumber = `ASGN-${year}-${String(asgnCount + 1).padStart(4, '0')}-${rand}`;
    const transferNumber = `TRF-${year}-${String(trfCount + 1).padStart(4, '0')}-${rand}`;

    const now = new Date();
    const targetDeptId = toEmployee.departmentId;

    // Execute transfer transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Close current assignment
      await tx.resourceAssignment.update({
        where: { id: currentAssignment.id },
        data: {
          status: 'TRANSFERRED',
          isCurrent: false,
          notes: notes ? `${currentAssignment.notes || ''} [Transferred: ${notes}]`.trim() : currentAssignment.notes,
        },
      });

      // 2. Create new assignment for target employee
      const newAssignment = await tx.resourceAssignment.create({
        data: {
          assignmentNumber: newAssignmentNumber,
          resourceId: resource.id,
          employeeId: toEmployee.id,
          departmentId: targetDeptId,
          assignedByName: user.fullName || `${user.email} (${userRole})`,
          assignedById: user.id,
          assignedAt: now,
          purpose: reason ? reason.trim() : `Custody transfer from ${currentAssignment.employee.name}`,
          notes: notes ? notes.trim() : null,
          status: 'ACTIVE',
          isCurrent: true,
        },
        include: {
          resource: true,
          employee: true,
          department: true,
        },
      });

      // 3. Create CustodyTransfer record
      const transferRecord = await tx.custodyTransfer.create({
        data: {
          transferNumber,
          resourceId: resource.id,
          fromAssignmentId: currentAssignment.id,
          toAssignmentId: newAssignment.id,
          fromEmployeeId: currentAssignment.employeeId,
          toEmployeeId: toEmployee.id,
          fromDepartmentId: currentAssignment.departmentId,
          toDepartmentId: targetDeptId,
          transferredByName: user.fullName || `${user.email} (${userRole})`,
          transferredById: user.id,
          reason: reason ? reason.trim() : 'Operational reallocation',
          notes: notes ? notes.trim() : null,
          transferredAt: now,
        },
        include: {
          resource: true,
          fromEmployee: true,
          toEmployee: true,
          fromDepartment: true,
          toDepartment: true,
        },
      });

      // 4. Update Resource
      const updatedResource = await tx.resource.update({
        where: { id: resource.id },
        data: {
          currentAssigneeId: toEmployee.id,
          departmentId: targetDeptId,
          assignedAt: now,
          location: newLocation ? newLocation.trim() : resource.location,
        },
        include: {
          department: true,
          currentAssignee: true,
        },
      });

      return { newAssignment, transferRecord, updatedResource };
    });

    return res.status(200).json({
      success: true,
      message: `Custody of '${resource.itemCode}' transferred from ${currentAssignment.employee.name} to ${toEmployee.name}`,
      assignment: formatAssignment(result.newAssignment),
      transfer: formatTransfer(result.transferRecord),
      resource: {
        id: result.updatedResource.id,
        itemCode: result.updatedResource.itemCode,
        status: result.updatedResource.status,
        currentAssigneeName: result.updatedResource.currentAssignee?.name,
        currentDepartmentName: result.updatedResource.department?.name,
      },
    });
  } catch (err) {
    console.error('[POST /api/assignments/transfer Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to process custody transfer',
    });
  }
});

/**
 * POST /api/assignments/return
 * Return Resource: Close active assignment and return resource to Central Store / Available status
 */
router.post('/return', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const user = req.user!;
    const userRole = user.role;
    const userDeptId = user.departmentId;

    if (!['ADMIN', 'STORE_KEEPER', 'DEPARTMENT_MANAGER'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Your role does not have permission to process asset returns',
      });
    }

    const { resourceId, condition, returnLocation, notes } = req.body || {};

    if (!resourceId || typeof resourceId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Resource ID is required',
      });
    }

    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
      include: {
        department: true,
        currentAssignee: true,
      },
    });

    if (!resource) {
      return res.status(404).json({
        success: false,
        message: `Resource with ID '${resourceId}' not found in registry`,
      });
    }

    if (resource.status !== 'ASSIGNED') {
      return res.status(400).json({
        success: false,
        message: `Resource '${resource.itemCode}' is currently '${resource.status}'. Only ASSIGNED resources can be returned.`,
      });
    }

    const currentAssignment = await prisma.resourceAssignment.findFirst({
      where: {
        resourceId,
        isCurrent: true,
        status: 'ACTIVE',
      },
      include: {
        employee: true,
        department: true,
      },
    });

    if (!currentAssignment) {
      return res.status(400).json({
        success: false,
        message: `No active assignment found for resource '${resource.itemCode}'`,
      });
    }

    // Role check: Department Manager can only process return if resource belongs to their department
    if (userRole === 'DEPARTMENT_MANAGER') {
      if (!userDeptId || resource.departmentId !== userDeptId) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Department managers may only process returns for resources belonging to their own directorate',
        });
      }
    }

    // Validate condition if provided
    let finalCondition = resource.condition;
    if (condition) {
      if (!VALID_CONDITIONS.includes(condition)) {
        return res.status(400).json({
          success: false,
          message: `Invalid condition '${condition}'. Must be one of: [${VALID_CONDITIONS.join(', ')}]`,
        });
      }
      finalCondition = condition;
    }

    // Determine new status based on condition
    let newStatus = 'AVAILABLE';
    if (finalCondition === 'NEEDS_REPAIR' || finalCondition === 'DAMGED') {
      newStatus = 'MAINTENANCE';
    } else if (finalCondition === 'RETIRED') {
      newStatus = 'RETIRED';
    }

    const now = new Date();
    const finalLocation = returnLocation ? returnLocation.trim() : 'Central Store - Kersa';

    const result = await prisma.$transaction(async (tx) => {
      // 1. Mark assignment as RETURNED
      const closedAssignment = await tx.resourceAssignment.update({
        where: { id: currentAssignment.id },
        data: {
          status: 'RETURNED',
          isCurrent: false,
          returnedAt: now,
          returnCondition: finalCondition,
          returnLocation: finalLocation,
          returnNotes: notes ? notes.trim() : null,
          returnReceivedByName: user.fullName || `${user.email} (${userRole})`,
          returnReceivedById: user.id,
        },
        include: {
          resource: true,
          employee: true,
          department: true,
        },
      });

      // 2. Update resource back to AVAILABLE (or MAINTENANCE / RETIRED)
      const updatedResource = await tx.resource.update({
        where: { id: resource.id },
        data: {
          status: newStatus,
          condition: finalCondition,
          location: finalLocation,
          currentAssigneeId: null,
          assignedAt: null,
        },
        include: {
          department: true,
        },
      });

      return { closedAssignment, updatedResource };
    });

    return res.status(200).json({
      success: true,
      message: `Resource '${resource.itemCode}' successfully returned and marked as ${newStatus}`,
      assignment: formatAssignment(result.closedAssignment),
      resource: {
        id: result.updatedResource.id,
        itemCode: result.updatedResource.itemCode,
        status: result.updatedResource.status,
        condition: result.updatedResource.condition,
        location: result.updatedResource.location,
        currentDepartmentName: result.updatedResource.department?.name,
      },
    });
  } catch (err) {
    console.error('[POST /api/assignments/return Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to process resource return',
    });
  }
});

export default router;

