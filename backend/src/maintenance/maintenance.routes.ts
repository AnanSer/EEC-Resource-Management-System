import { Router } from '../http/router';
import { AppRequest, AppResponse } from '../http/types';
import { requireAuth } from '../auth/auth.middleware';
import prisma from '../lib/prisma';
import { recordAuditEvent } from '../audit/audit.service';

const router = new Router();

const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const VALID_STATUSES = ['SUBMITTED', 'APPROVED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'REJECTED'];

function formatMaintenanceRequest(m: any) {
  return {
    id: m.id,
    requestNumber: m.requestNumber,
    resourceId: m.resourceId,
    resourceName: m.resource?.name || '',
    resourceCode: m.resource?.itemCode || '',
    resourceCategory: m.resource?.category || '',
    resourceStatus: m.resource?.status || '',
    resourceCondition: m.resource?.condition || '',
    departmentId: m.departmentId,
    departmentName: m.department?.name || '',
    departmentCode: m.department?.code || '',
    reportedById: m.reportedById,
    reportedByName: m.reportedByName,
    reportedByRole: m.reportedByRole,
    assignedTechnicianId: m.assignedTechnicianId || undefined,
    assignedTechnicianName: m.assignedTechnicianName || undefined,
    title: m.title,
    description: m.description,
    priority: m.priority,
    status: m.status,
    reportedDate: m.reportedDate ? m.reportedDate.toISOString() : '',
    reviewedById: m.reviewedById || undefined,
    reviewedByName: m.reviewedByName || undefined,
    reviewedAt: m.reviewedAt ? m.reviewedAt.toISOString() : undefined,
    reviewComments: m.reviewComments || undefined,
    rejectionReason: m.rejectionReason || undefined,
    startedAt: m.startedAt ? m.startedAt.toISOString() : undefined,
    completedAt: m.completedAt ? m.completedAt.toISOString() : undefined,
    diagnosis: m.diagnosis || undefined,
    repairActions: m.repairActions || undefined,
    partsReplaced: m.partsReplaced || undefined,
    estimatedCostETB: m.estimatedCostETB ?? undefined,
    actualCostETB: m.actualCostETB ?? undefined,
    resolutionNotes: m.resolutionNotes || undefined,
    outcome: m.outcome || undefined,
    custodyAction: m.custodyAction || undefined,
    custodianIdAtRequest: m.custodianIdAtRequest || undefined,
    custodianNameAtRequest: m.custodianNameAtRequest || undefined,
    currentAssigneeId: m.resource?.currentAssigneeId || undefined,
    currentAssigneeName: m.resource?.currentAssignee?.name || undefined,
    logs: Array.isArray(m.logs)
      ? m.logs.map((l: any) => ({
          id: l.id,
          fromStatus: l.fromStatus,
          toStatus: l.toStatus,
          action: l.action,
          actorId: l.actorId,
          actorName: l.actorName,
          actorRole: l.actorRole,
          notes: l.notes,
          createdAt: l.createdAt ? l.createdAt.toISOString() : '',
        }))
      : [],
    inspections: Array.isArray(m.inspections)
      ? m.inspections.map((i: any) => ({
          id: i.id,
          inspectionType: i.inspectionType,
          passed: i.passed,
          findings: i.findings,
          conductedByName: i.conductedByName,
          certificationNumber: i.certificationNumber,
          remarks: i.remarks,
          inspectedAt: i.inspectedAt ? i.inspectedAt.toISOString() : '',
        }))
      : [],
    createdAt: m.createdAt ? m.createdAt.toISOString() : '',
    updatedAt: m.updatedAt ? m.updatedAt.toISOString() : '',
  };
}

/**
 * Generate formatted request number: MNT-YYYY-XXXX
 */
async function generateRequestNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `MNT-${currentYear}-`;
  const count = await prisma.maintenanceRequest.count({
    where: {
      requestNumber: { startsWith: prefix },
    },
  });
  const seq = String(count + 1).padStart(4, '0');
  const candidate = `${prefix}${seq}`;
  const exists = await prisma.maintenanceRequest.findUnique({ where: { requestNumber: candidate } });
  if (exists) {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}${seq}-${randomSuffix}`;
  }
  return candidate;
}

/**
 * Helper to resolve user's linked Employee record
 */
async function resolveEmployeeRecord(user: { id: string; email: string; employeeRecordId?: string | null }) {
  if (user.employeeRecordId) {
    const emp = await prisma.employee.findUnique({ where: { id: user.employeeRecordId } });
    if (emp) return emp;
  }
  return prisma.employee.findFirst({
    where: { OR: [{ userId: user.id }, { email: user.email }] },
  });
}

/**
 * GET /api/maintenance/metrics
 * Maintenance operational metrics (scoped strictly by role/department)
 */
router.get('/metrics', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const user = req.user!;
    const userRole = user.role;
    const userDeptId = user.departmentId;

    const filter: any = {};
    let scope = 'CORPORATION';

    if (userRole === 'EMPLOYEE') {
      scope = 'EMPLOYEE';
      const emp = await resolveEmployeeRecord(user);
      filter.OR = [
        { reportedById: user.id },
        ...(emp ? [{ custodianIdAtRequest: emp.id }] : []),
      ];
    } else if (userRole === 'DEPARTMENT_MANAGER') {
      scope = 'DEPARTMENT';
      filter.departmentId = userDeptId || '__NO_DEPT__';
    }

    const allRequests = await prisma.maintenanceRequest.findMany({
      where: filter,
      select: {
        id: true,
        status: true,
        priority: true,
        estimatedCostETB: true,
        actualCostETB: true,
      },
    });

    const totalRequests = allRequests.length;
    let submittedCount = 0;
    let approvedCount = 0;
    let inProgressCount = 0;
    let onHoldCount = 0;
    let completedCount = 0;
    let rejectedCount = 0;
    let highOrCriticalCount = 0;
    let totalActualCostETB = 0;

    for (const r of allRequests) {
      if (r.status === 'SUBMITTED') submittedCount++;
      else if (r.status === 'APPROVED') approvedCount++;
      else if (r.status === 'IN_PROGRESS') inProgressCount++;
      else if (r.status === 'ON_HOLD') onHoldCount++;
      else if (r.status === 'COMPLETED') completedCount++;
      else if (r.status === 'REJECTED') rejectedCount++;

      if (r.priority === 'HIGH' || r.priority === 'CRITICAL') {
        highOrCriticalCount++;
      }

      if (r.actualCostETB) {
        totalActualCostETB += r.actualCostETB;
      }
    }

    const activeWorkOrders = submittedCount + approvedCount + inProgressCount + onHoldCount;

    return res.status(200).json({
      success: true,
      metrics: {
        scope,
        departmentId: userRole === 'DEPARTMENT_MANAGER' ? userDeptId : undefined,
        totalRequests,
        activeWorkOrders,
        submittedCount,
        approvedCount,
        inProgressCount,
        onHoldCount,
        completedCount,
        rejectedCount,
        highOrCriticalCount,
        totalActualCostETB,
      },
    });
  } catch (err) {
    console.error('[GET /api/maintenance/metrics Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve maintenance metrics',
    });
  }
});

/**
 * GET /api/maintenance
 * List maintenance requests with RBAC and department boundary scoping
 */
router.get('/', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const user = req.user!;
    const userRole = user.role;
    const userDeptId = user.departmentId;

    const { status, priority, departmentId, resourceId, search, page, limit } = req.query || {};

    const filter: any = {};

    // 1. Role-based scoping
    if (userRole === 'EMPLOYEE') {
      const emp = await resolveEmployeeRecord(user);
      filter.OR = [
        { reportedById: user.id },
        ...(emp ? [{ custodianIdAtRequest: emp.id }] : []),
        ...(emp ? [{ resource: { currentAssigneeId: emp.id } }] : []),
      ];
    } else if (userRole === 'DEPARTMENT_MANAGER') {
      filter.departmentId = userDeptId || '__NO_DEPT__';
    } else if (departmentId && departmentId !== 'ALL') {
      filter.departmentId = departmentId;
    }

    // 2. Additional filters
    if (status && status !== 'ALL') {
      filter.status = status;
    }

    if (priority && priority !== 'ALL') {
      filter.priority = priority;
    }

    if (resourceId && resourceId !== 'ALL') {
      filter.resourceId = resourceId;
    }

    if (search && search.trim()) {
      const q = search.trim();
      const searchConditions = [
        { requestNumber: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { reportedByName: { contains: q, mode: 'insensitive' } },
        { assignedTechnicianName: { contains: q, mode: 'insensitive' } },
        { resource: { name: { contains: q, mode: 'insensitive' } } },
        { resource: { itemCode: { contains: q, mode: 'insensitive' } } },
      ];

      if (filter.OR) {
        filter.AND = [{ OR: filter.OR }, { OR: searchConditions }];
        delete filter.OR;
      } else {
        filter.OR = searchConditions;
      }
    }

    const pageNum = Math.max(1, parseInt(page || '1', 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit || '50', 10)));
    const skip = (pageNum - 1) * limitNum;

    const [total, rawRequests] = await Promise.all([
      prisma.maintenanceRequest.count({ where: filter }),
      prisma.maintenanceRequest.findMany({
        where: filter,
        include: {
          resource: {
            include: { currentAssignee: true },
          },
          department: true,
          logs: { orderBy: { createdAt: 'desc' }, take: 1 },
          inspections: { orderBy: { inspectedAt: 'desc' }, take: 1 },
        },
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limitNum,
      }),
    ]);

    const requests = rawRequests.map(formatMaintenanceRequest);

    return res.status(200).json({
      success: true,
      requests,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('[GET /api/maintenance Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve maintenance requests',
    });
  }
});

/**
 * GET /api/maintenance/inspections
 * List inspection tests across the enterprise
 */
router.get('/inspections', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const rawInspections = await prisma.maintenanceInspection.findMany({
      include: {
        resource: true,
      },
      orderBy: { inspectedAt: 'desc' },
      take: 100,
    });

    const inspections = rawInspections.map((i) => ({
      id: i.id,
      ticketId: i.maintenanceRequestId || undefined,
      resourceId: i.resourceId,
      resourceName: i.resource?.name || '',
      resourceCode: i.resource?.itemCode || '',
      inspectionType: i.inspectionType,
      passed: i.passed,
      findings: i.findings,
      conductedBy: i.conductedByName,
      certificationNumber: i.certificationNumber || undefined,
      remarks: i.remarks || undefined,
      date: i.inspectedAt.toISOString().split('T')[0],
      createdAt: i.createdAt.toISOString(),
    }));

    return res.status(200).json({
      success: true,
      inspections,
    });
  } catch (err) {
    console.error('[GET /api/maintenance/inspections Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve inspections',
    });
  }
});

/**
 * GET /api/maintenance/:id
 * Retrieve maintenance request detail including complete logs and inspections
 */
router.get('/:id', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const user = req.user!;
    const userRole = user.role;
    const userDeptId = user.departmentId;
    const targetId = req.params!.id;

    const requestRecord = await prisma.maintenanceRequest.findFirst({
      where: {
        OR: [{ id: targetId }, { requestNumber: targetId }],
      },
      include: {
        resource: {
          include: { currentAssignee: true, department: true },
        },
        department: true,
        logs: { orderBy: { createdAt: 'asc' } },
        inspections: { orderBy: { inspectedAt: 'desc' } },
      },
    });

    if (!requestRecord) {
      return res.status(404).json({
        success: false,
        message: `Maintenance request '${targetId}' not found`,
      });
    }

    // Role-based boundary enforcement
    if (userRole === 'EMPLOYEE') {
      const emp = await resolveEmployeeRecord(user);
      const isReporter = requestRecord.reportedById === user.id;
      const wasCustodian = Boolean(emp && requestRecord.custodianIdAtRequest === emp.id);
      const isCurrentCustodian = Boolean(emp && requestRecord.resource.currentAssigneeId === emp.id);

      if (!isReporter && !wasCustodian && !isCurrentCustodian) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You may only view maintenance requests you personally reported or equipment currently in your custody.',
        });
      }
    } else if (userRole === 'DEPARTMENT_MANAGER') {
      if (requestRecord.departmentId !== userDeptId) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Department boundary access denied. This maintenance record belongs to another directorate.',
        });
      }
    }

    return res.status(200).json({
      success: true,
      request: formatMaintenanceRequest(requestRecord),
    });
  } catch (err) {
    console.error('[GET /api/maintenance/:id Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve maintenance request details',
    });
  }
});

/**
 * POST /api/maintenance
 * Report a faulty resource / Submit maintenance request
 */
router.post('/', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const user = req.user!;
    const userRole = user.role;
    const userDeptId = user.departmentId;

    const {
      resourceId,
      title,
      description,
      priority = 'MEDIUM',
      reportedDate,
      estimatedCostETB,
      assignedTechnicianId,
      assignedTechnicianName,
    } = req.body || {};

    if (!resourceId || typeof resourceId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Resource ID is required',
      });
    }

    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Summary/title is required (minimum 3 characters)',
      });
    }

    if (!description || typeof description !== 'string' || description.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Detailed defect description is required (minimum 5 characters)',
      });
    }

    const cleanPriority = String(priority).toUpperCase();
    if (!VALID_PRIORITIES.includes(cleanPriority)) {
      return res.status(400).json({
        success: false,
        message: `Invalid priority '${priority}'. Valid priorities: ${VALID_PRIORITIES.join(', ')}`,
      });
    }

    // 1. Fetch resource and verify existence
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

    // 2. Resource authority and department boundary enforcement
    const emp = await resolveEmployeeRecord(user);
    if (userRole === 'EMPLOYEE') {
      if (!emp) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: No linked employee record found for your user account.',
        });
      }

      // Verify that the resource is currently assigned to this authenticated employee
      if (!resource.currentAssigneeId || resource.currentAssigneeId !== emp.id) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Employees may only report faults on equipment currently assigned to them (active custody). You cannot report unassigned equipment or assets assigned to other employees.',
        });
      }

      // Verify that the selected resource has an active assignment belonging to the authenticated employee
      const activeAssignment = await prisma.resourceAssignment.findFirst({
        where: {
          resourceId: resource.id,
          employeeId: emp.id,
          isCurrent: true,
          status: 'ACTIVE',
        },
      });

      if (!activeAssignment) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Equipment has no valid active custody assignment record for your account.',
        });
      }
    } else if (userRole === 'DEPARTMENT_MANAGER') {
      if (resource.departmentId !== userDeptId) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Department managers may only submit maintenance requests for equipment belonging to their assigned directorate.',
        });
      }
    } else if (userRole === 'STORE_KEEPER') {
      const isOwnDept = resource.departmentId === userDeptId;
      const isUnassignedInventory = !resource.currentAssigneeId;
      if (!isOwnDept && !isUnassignedInventory) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Store Keeper may only report faults on unassigned inventory equipment or resources in their department.',
        });
      }
    }

    // 3. Prevent duplicate active maintenance requests on the same resource
    if (resource.status === 'MAINTENANCE') {
      return res.status(409).json({
        success: false,
        message: `Resource ${resource.name} (${resource.itemCode}) is already currently under MAINTENANCE.`,
      });
    }

    const existingActiveRequest = await prisma.maintenanceRequest.findFirst({
      where: {
        resourceId: resource.id,
        status: { in: ['SUBMITTED', 'APPROVED', 'IN_PROGRESS', 'ON_HOLD'] },
      },
    });

    if (existingActiveRequest) {
      return res.status(409).json({
        success: false,
        message: `An active maintenance request (${existingActiveRequest.requestNumber} - ${existingActiveRequest.status}) is already open for ${resource.name} (${resource.itemCode}).`,
      });
    }

    // 4. Determine initial status & technician
    const requestNumber = await generateRequestNumber();
    const isDirectTechOpen = ['IT_TECHNICIAN', 'ADMIN'].includes(userRole);
    const initialStatus = 'SUBMITTED';

    const parseReportedDate = reportedDate ? new Date(reportedDate) : new Date();

    // 5. Atomic creation: MaintenanceRequest, Log, and update resource status to MAINTENANCE
    const result = await prisma.$transaction(async (tx) => {
      // Never silently close active assignments!
      // If resource was ASSIGNED, currentAssigneeId is preserved.
      // Status becomes MAINTENANCE so it cannot be newly assigned or transferred.
      const updatedResource = await tx.resource.update({
        where: { id: resource.id },
        data: {
          status: 'MAINTENANCE',
          condition: resource.condition === 'EXCELLENT' ? 'GOOD' : resource.condition,
        },
        include: { currentAssignee: true, department: true },
      });

      const newRequest = await tx.maintenanceRequest.create({
        data: {
          requestNumber,
          resourceId: resource.id,
          departmentId: resource.departmentId,
          reportedById: user.id,
          reportedByName: user.fullName,
          reportedByRole: userRole,
          title: title.trim(),
          description: description.trim(),
          priority: cleanPriority,
          status: initialStatus,
          reportedDate: parseReportedDate,
          estimatedCostETB: estimatedCostETB ? Number(estimatedCostETB) : undefined,
          assignedTechnicianId: isDirectTechOpen ? assignedTechnicianId || (userRole === 'IT_TECHNICIAN' ? user.id : undefined) : undefined,
          assignedTechnicianName: isDirectTechOpen ? assignedTechnicianName || (userRole === 'IT_TECHNICIAN' ? user.fullName : undefined) : undefined,
          custodianIdAtRequest: resource.currentAssigneeId,
          custodianNameAtRequest: resource.currentAssignee?.name,
        },
        include: {
          resource: { include: { currentAssignee: true } },
          department: true,
          logs: true,
          inspections: true,
        },
      });

      await tx.maintenanceLog.create({
        data: {
          maintenanceRequestId: newRequest.id,
          fromStatus: null,
          toStatus: initialStatus,
          action: 'SUBMITTED',
          actorId: user.id,
          actorName: user.fullName,
          actorRole: userRole,
          notes: `Defect reported: ${title.trim()}`,
        },
      });

      await recordAuditEvent(tx, {
        actionType: 'MAINTENANCE_SUBMITTED',
        resourceId: resource.id,
        resourceName: resource.name,
        resourceCode: resource.itemCode,
        resourceCategory: resource.category,
        departmentId: resource.departmentId,
        actorId: user.id,
        actorName: user.fullName,
        actorRole: userRole,
        referenceId: newRequest.requestNumber,
        details: `Maintenance defect reported: ${title.trim()} (Priority: ${priority || 'MEDIUM'})`,
      });

      return { newRequest, updatedResource };
    });

    return res.status(201).json({
      success: true,
      message: `Maintenance request ${result.newRequest.requestNumber} submitted successfully`,
      request: formatMaintenanceRequest(result.newRequest),
      resource: {
        id: result.updatedResource.id,
        itemCode: result.updatedResource.itemCode,
        status: result.updatedResource.status,
        currentAssigneeName: result.updatedResource.currentAssignee?.name,
      },
    });
  } catch (err) {
    console.error('[POST /api/maintenance Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create maintenance request',
    });
  }
});

/**
 * POST /api/maintenance/:id/review
 * Admin or Department Manager reviews request (APPROVE or REJECT)
 */
router.post('/:id/review', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const user = req.user!;
    const userRole = user.role;
    const userDeptId = user.departmentId;
    const targetId = req.params!.id;

    const { action, comments, rejectionReason, assignedTechnicianId, assignedTechnicianName } = req.body || {};

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action must be either 'APPROVE' or 'REJECT'",
      });
    }

    if (!['ADMIN', 'DEPARTMENT_MANAGER'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Your role does not have authority to review maintenance requests',
      });
    }

    const requestRecord = await prisma.maintenanceRequest.findFirst({
      where: { OR: [{ id: targetId }, { requestNumber: targetId }] },
      include: { resource: true, department: true },
    });

    if (!requestRecord) {
      return res.status(404).json({
        success: false,
        message: `Maintenance request '${targetId}' not found`,
      });
    }

    // Department boundary check for Manager
    if (userRole === 'DEPARTMENT_MANAGER' && requestRecord.departmentId !== userDeptId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Department managers may only review requests within their assigned directorate',
      });
    }

    // State validation
    if (requestRecord.status !== 'SUBMITTED') {
      return res.status(400).json({
        success: false,
        message: `Cannot review request in '${requestRecord.status}' state. Only 'SUBMITTED' requests can be approved or rejected.`,
      });
    }

    if (action === 'REJECT' && (!rejectionReason || typeof rejectionReason !== 'string' || rejectionReason.trim().length < 3)) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required when rejecting a maintenance request (minimum 3 characters)',
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      let updatedResourceStatus = requestRecord.resource.status;

      if (action === 'APPROVE') {
        // Ensure resource status is marked MAINTENANCE
        updatedResourceStatus = 'MAINTENANCE';
        await tx.resource.update({
          where: { id: requestRecord.resourceId },
          data: { status: 'MAINTENANCE' },
        });

        const updatedRequest = await tx.maintenanceRequest.update({
          where: { id: requestRecord.id },
          data: {
            status: 'APPROVED',
            reviewedById: user.id,
            reviewedByName: user.fullName,
            reviewedAt: new Date(),
            reviewComments: comments ? comments.trim() : undefined,
            assignedTechnicianId: assignedTechnicianId || requestRecord.assignedTechnicianId,
            assignedTechnicianName: assignedTechnicianName || requestRecord.assignedTechnicianName,
          },
          include: {
            resource: { include: { currentAssignee: true } },
            department: true,
            logs: true,
            inspections: true,
          },
        });

        await tx.maintenanceLog.create({
          data: {
            maintenanceRequestId: requestRecord.id,
            fromStatus: requestRecord.status,
            toStatus: 'APPROVED',
            action: 'APPROVED',
            actorId: user.id,
            actorName: user.fullName,
            actorRole: userRole,
            notes: comments ? comments.trim() : 'Maintenance request approved for servicing',
          },
        });

        await recordAuditEvent(tx, {
          actionType: 'MAINTENANCE_APPROVED',
          resourceId: requestRecord.resourceId,
          resourceName: requestRecord.resource.name,
          resourceCode: requestRecord.resource.itemCode,
          resourceCategory: requestRecord.resource.category,
          departmentId: requestRecord.departmentId,
          actorId: user.id,
          actorName: user.fullName,
          actorRole: userRole,
          referenceId: requestRecord.requestNumber,
          details: `Maintenance request ${requestRecord.requestNumber} approved for servicing: ${comments ? comments.trim() : 'Approved'}`,
        });

        return { updatedRequest, resourceStatus: updatedResourceStatus };
      } else {
        // REJECT action: Restore resource status safely
        // If it had a custodian: ASSIGNED. Else: AVAILABLE.
        const safeRestoreStatus = requestRecord.custodianIdAtRequest ? 'ASSIGNED' : 'AVAILABLE';
        await tx.resource.update({
          where: { id: requestRecord.resourceId },
          data: { status: safeRestoreStatus },
        });

        const updatedRequest = await tx.maintenanceRequest.update({
          where: { id: requestRecord.id },
          data: {
            status: 'REJECTED',
            reviewedById: user.id,
            reviewedByName: user.fullName,
            reviewedAt: new Date(),
            rejectionReason: rejectionReason.trim(),
            reviewComments: comments ? comments.trim() : undefined,
          },
          include: {
            resource: { include: { currentAssignee: true } },
            department: true,
            logs: true,
            inspections: true,
          },
        });

        await tx.maintenanceLog.create({
          data: {
            maintenanceRequestId: requestRecord.id,
            fromStatus: requestRecord.status,
            toStatus: 'REJECTED',
            action: 'REJECTED',
            actorId: user.id,
            actorName: user.fullName,
            actorRole: userRole,
            notes: rejectionReason.trim(),
          },
        });

        await recordAuditEvent(tx, {
          actionType: 'MAINTENANCE_REJECTED',
          resourceId: requestRecord.resourceId,
          resourceName: requestRecord.resource.name,
          resourceCode: requestRecord.resource.itemCode,
          resourceCategory: requestRecord.resource.category,
          departmentId: requestRecord.departmentId,
          actorId: user.id,
          actorName: user.fullName,
          actorRole: userRole,
          referenceId: requestRecord.requestNumber,
          details: `Maintenance request ${requestRecord.requestNumber} rejected: ${rejectionReason.trim()}`,
        });

        return { updatedRequest, resourceStatus: safeRestoreStatus };
      }
    });

    return res.status(200).json({
      success: true,
      message: `Maintenance request ${result.updatedRequest.requestNumber} ${action === 'APPROVE' ? 'approved' : 'rejected'} successfully`,
      request: formatMaintenanceRequest(result.updatedRequest),
      resourceStatus: result.resourceStatus,
    });
  } catch (err) {
    console.error('[POST /api/maintenance/:id/review Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to process maintenance review',
    });
  }
});

/**
 * PUT /api/maintenance/:id/progress
 * IT Technicians & Admins diagnose, progress, hold, or complete work orders
 */
router.put('/:id/progress', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const user = req.user!;
    const userRole = user.role;
    const targetId = req.params!.id;

    // RBAC: Only IT_TECHNICIAN and ADMIN can execute technical servicing & progress
    if (!['IT_TECHNICIAN', 'ADMIN'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only IT Technicians and System Administrators can perform technical diagnostics and update work orders',
      });
    }

    const {
      status: targetStatus,
      assignedTechnicianId,
      assignedTechnicianName,
      diagnosis,
      repairActions,
      partsReplaced,
      actualCostETB,
      resolutionNotes,
      outcome = 'REPAIRED_FIT_FOR_USE',
      conditionOnCompletion = 'GOOD',
      notes,
    } = req.body || {};

    if (!targetStatus || !VALID_STATUSES.includes(targetStatus)) {
      return res.status(400).json({
        success: false,
        message: `Valid target status is required. Options: ${VALID_STATUSES.join(', ')}`,
      });
    }

    const requestRecord = await prisma.maintenanceRequest.findFirst({
      where: { OR: [{ id: targetId }, { requestNumber: targetId }] },
      include: {
        resource: { include: { currentAssignee: true } },
        department: true,
        inspections: true,
      },
    });

    if (!requestRecord) {
      return res.status(404).json({
        success: false,
        message: `Maintenance request '${targetId}' not found`,
      });
    }

    const currentStatus = requestRecord.status;

    // State transition validations
    const allowedTransitions: Record<string, string[]> = {
      SUBMITTED: ['APPROVED', 'REJECTED'],
      APPROVED: ['IN_PROGRESS', 'REJECTED'],
      IN_PROGRESS: ['ON_HOLD', 'COMPLETED'],
      ON_HOLD: ['IN_PROGRESS', 'COMPLETED', 'REJECTED'],
      COMPLETED: [], // Terminal state
      REJECTED: [], // Terminal state
    };

    if (currentStatus === targetStatus) {
      // Allow intermediate metadata updates without status transition
    } else {
      const allowed = allowedTransitions[currentStatus] || [];
      if (!allowed.includes(targetStatus)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status transition from '${currentStatus}' to '${targetStatus}'. Allowed transitions: ${allowed.length > 0 ? allowed.join(', ') : 'None (Terminal state)'}`,
        });
      }
    }

    // Specific validation for completion
    if (targetStatus === 'COMPLETED') {
      if (!resolutionNotes && !repairActions) {
        return res.status(400).json({
          success: false,
          message: 'Resolution notes or repair actions are mandatory to complete a maintenance work order',
        });
      }
    }

    if (targetStatus === 'ON_HOLD') {
      const holdReason = (notes || resolutionNotes || diagnosis || '').trim();
      if (!holdReason) {
        return res.status(400).json({
          success: false,
          message: 'A specific reason is mandatory when placing a work order on hold',
        });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const resolvedTechName = assignedTechnicianName !== undefined
        ? assignedTechnicianName
        : (requestRecord.assignedTechnicianName || (userRole === 'IT_TECHNICIAN' ? user.fullName : undefined));
      const resolvedTechId = assignedTechnicianId !== undefined
        ? assignedTechnicianId
        : (requestRecord.assignedTechnicianId || (userRole === 'IT_TECHNICIAN' ? user.id : undefined));

      const updateData: any = {
        status: targetStatus,
        assignedTechnicianId: resolvedTechId,
        assignedTechnicianName: resolvedTechName,
        diagnosis: diagnosis !== undefined ? diagnosis : requestRecord.diagnosis,
        repairActions: repairActions !== undefined ? repairActions : requestRecord.repairActions,
        partsReplaced: partsReplaced !== undefined ? partsReplaced : requestRecord.partsReplaced,
        actualCostETB: actualCostETB !== undefined ? Number(actualCostETB) : requestRecord.actualCostETB,
        resolutionNotes: resolutionNotes !== undefined ? resolutionNotes : (notes !== undefined ? notes : requestRecord.resolutionNotes),
      };

      if (targetStatus === 'IN_PROGRESS' && !requestRecord.startedAt) {
        updateData.startedAt = new Date();
      }

      let resourceStatusUpdate: any = {};
      let custodyActionTaken: string | undefined = undefined;

      if (targetStatus === 'COMPLETED') {
        updateData.completedAt = new Date();
        updateData.outcome = outcome;

        if (outcome === 'REPAIRED_FIT_FOR_USE') {
          // Safe Return Workflow:
          // "return a fit resource to AVAILABLE only when it has no active custodian; otherwise, define and enforce a safe return-to-custodian workflow."
          // "Never silently close active assignments."
          const hasActiveCustodian = Boolean(requestRecord.resource.currentAssigneeId);

          if (hasActiveCustodian) {
            // Restore resource to ASSIGNED so employee can resume use
            resourceStatusUpdate = {
              status: 'ASSIGNED',
              condition: conditionOnCompletion || 'GOOD',
            };
            custodyActionTaken = 'RETURNED_TO_CUSTODIAN';
            updateData.custodyAction = 'RETURNED_TO_CUSTODIAN';
          } else {
            // Unassigned asset: return to AVAILABLE in store
            resourceStatusUpdate = {
              status: 'AVAILABLE',
              condition: conditionOnCompletion || 'GOOD',
            };
            custodyActionTaken = 'RETURNED_TO_AVAILABLE';
            updateData.custodyAction = 'RETURNED_TO_AVAILABLE';
          }
        } else if (outcome === 'REQUIRES_FURTHER_REPAIR' || outcome === 'DAMAGED_UNRESOLVED') {
          // Damaged resources remain in MAINTENANCE when further repair is required
          resourceStatusUpdate = {
            status: 'MAINTENANCE',
            condition: conditionOnCompletion || 'POOR',
          };
          custodyActionTaken = 'REMAINS_IN_MAINTENANCE';
          updateData.custodyAction = 'REMAINS_IN_MAINTENANCE';
        } else if (outcome === 'BEYOND_ECONOMIC_REPAIR' || outcome === 'DISPOSED') {
          // Decommissioned asset: mark RETIRED or DISPOSED
          resourceStatusUpdate = {
            status: outcome === 'DISPOSED' ? 'DISPOSED' : 'RETIRED',
            condition: 'SCRAP',
          };
          custodyActionTaken = 'DECOMMISSIONED';
          updateData.custodyAction = 'DECOMMISSIONED';
        }

        if (Object.keys(resourceStatusUpdate).length > 0) {
          await tx.resource.update({
            where: { id: requestRecord.resourceId },
            data: resourceStatusUpdate,
          });
        }
      } else if (targetStatus === 'IN_PROGRESS' || targetStatus === 'ON_HOLD') {
        // While in progress or on hold, resource must remain in MAINTENANCE
        await tx.resource.update({
          where: { id: requestRecord.resourceId },
          data: { status: 'MAINTENANCE' },
        });
      }

      const updatedRequest = await tx.maintenanceRequest.update({
        where: { id: requestRecord.id },
        data: updateData,
        include: {
          resource: { include: { currentAssignee: true } },
          department: true,
          logs: true,
          inspections: true,
        },
      });

      await tx.maintenanceLog.create({
        data: {
          maintenanceRequestId: requestRecord.id,
          fromStatus: currentStatus,
          toStatus: targetStatus,
          action: targetStatus === 'IN_PROGRESS'
            ? (currentStatus === 'IN_PROGRESS' ? 'PROGRESS_UPDATED' : 'STARTED')
            : targetStatus,
          actorId: user.id,
          actorName: user.fullName,
          actorRole: userRole,
          notes: notes || resolutionNotes || diagnosis || `Work order updated to ${targetStatus}`,
        },
      });

      let auditAction = 'MAINTENANCE_PROGRESS';
      if (targetStatus === 'IN_PROGRESS' && currentStatus !== 'IN_PROGRESS') {
        auditAction = 'MAINTENANCE_STARTED';
      } else if (targetStatus === 'ON_HOLD') {
        auditAction = 'MAINTENANCE_ON_HOLD';
      } else if (targetStatus === 'COMPLETED') {
        auditAction = 'MAINTENANCE_COMPLETED';
      } else if (currentStatus === 'ON_HOLD' && targetStatus === 'IN_PROGRESS') {
        auditAction = 'MAINTENANCE_RESUMED';
      }

      await recordAuditEvent(tx, {
        actionType: auditAction,
        resourceId: requestRecord.resourceId,
        resourceName: requestRecord.resource.name,
        resourceCode: requestRecord.resource.itemCode,
        resourceCategory: requestRecord.resource.category,
        departmentId: requestRecord.departmentId,
        actorId: user.id,
        actorName: user.fullName,
        actorRole: userRole,
        referenceId: requestRecord.requestNumber,
        details: `Work order ${requestRecord.requestNumber} updated to ${targetStatus}: ${notes || resolutionNotes || diagnosis || 'Servicing progress updated'}${actualCostETB ? ` (Cost: ${actualCostETB} ETB)` : ''}`,
      });

      return { updatedRequest, custodyActionTaken };
    });

    return res.status(200).json({
      success: true,
      message: `Maintenance request ${result.updatedRequest.requestNumber} updated to ${targetStatus}`,
      request: formatMaintenanceRequest(result.updatedRequest),
      custodyAction: result.custodyActionTaken,
    });
  } catch (err) {
    console.error('[PUT /api/maintenance/:id/progress Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update maintenance progress',
    });
  }
});

/**
 * POST /api/maintenance/:id/inspections
 * Record technical QA / calibration / roadworthiness inspection
 */
router.post('/:id/inspections', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const user = req.user!;
    const userRole = user.role;
    const targetId = req.params!.id;

    if (!['IT_TECHNICIAN', 'ADMIN'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only technicians and administrators can log inspection tests',
      });
    }

    const {
      inspectionType = 'MAINTENANCE_QA',
      passed,
      findings,
      certificationNumber,
      remarks,
    } = req.body || {};

    if (typeof passed !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: "Inspection result 'passed' (boolean true/false) is required",
      });
    }

    if (!findings || typeof findings !== 'string' || findings.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Inspection findings are required (minimum 3 characters)',
      });
    }

    const requestRecord = await prisma.maintenanceRequest.findFirst({
      where: { OR: [{ id: targetId }, { requestNumber: targetId }] },
    });

    if (!requestRecord) {
      return res.status(404).json({
        success: false,
        message: `Maintenance request '${targetId}' not found`,
      });
    }

    const inspection = await prisma.maintenanceInspection.create({
      data: {
        maintenanceRequestId: requestRecord.id,
        resourceId: requestRecord.resourceId,
        inspectionType,
        passed,
        findings: findings.trim(),
        conductedById: user.id,
        conductedByName: user.fullName,
        certificationNumber: certificationNumber ? certificationNumber.trim() : undefined,
        remarks: remarks ? remarks.trim() : undefined,
      },
    });

    // Also append an entry to maintenance logs
    await prisma.maintenanceLog.create({
      data: {
        maintenanceRequestId: requestRecord.id,
        fromStatus: requestRecord.status,
        toStatus: requestRecord.status,
        action: 'INSPECTION_RECORDED',
        actorId: user.id,
        actorName: user.fullName,
        actorRole: userRole,
        notes: `QA Inspection (${inspectionType}): ${passed ? 'PASSED' : 'FAILED'}. Findings: ${findings.trim()}`,
      },
    });

    await recordAuditEvent(prisma, {
      actionType: 'INSPECTION_RECORDED',
      resourceId: requestRecord.resourceId,
      departmentId: requestRecord.departmentId,
      actorId: user.id,
      actorName: user.fullName,
      actorRole: userRole,
      referenceId: requestRecord.requestNumber,
      details: `QA Inspection (${inspectionType}): ${passed ? 'PASSED' : 'FAILED'}. Findings: ${findings.trim()}${certificationNumber ? ` [Cert #${certificationNumber.trim()}]` : ''}`,
    });

    return res.status(201).json({
      success: true,
      message: `Inspection recorded as ${passed ? 'PASSED' : 'FAILED'}`,
      inspection: {
        id: inspection.id,
        inspectionType: inspection.inspectionType,
        passed: inspection.passed,
        findings: inspection.findings,
        conductedByName: inspection.conductedByName,
        certificationNumber: inspection.certificationNumber,
        remarks: inspection.remarks,
        inspectedAt: inspection.inspectedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('[POST /api/maintenance/:id/inspections Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to record maintenance inspection',
    });
  }
});

export default router;
