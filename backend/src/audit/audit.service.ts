import prisma from '../lib/prisma';

export interface RecordAuditParams {
  actionType: string;
  resourceId?: string | null;
  resourceName?: string | null;
  resourceCode?: string | null;
  resourceCategory?: string | null;
  departmentId?: string | null;
  actorId?: string | null;
  actorName: string;
  actorRole: string;
  referenceId?: string | null;
  details?: string | null;
  metadata?: any;
  timestamp?: Date;
}

export interface AuditQueryFilters {
  search?: string;
  startDate?: string;
  endDate?: string;
  departmentId?: string;
  actionType?: string;
  category?: string;
  userId?: string;
  resourceId?: string;
  page?: number;
  limit?: number;
}

/**
 * Resolves an authenticated user's linked Employee record
 */
export async function resolveEmployeeRecord(user: { id: string; email: string; employeeRecordId?: string | null }) {
  if (user.employeeRecordId) {
    const emp = await prisma.employee.findUnique({ where: { id: user.employeeRecordId } });
    if (emp) return emp;
  }
  return prisma.employee.findFirst({
    where: { OR: [{ userId: user.id }, { email: user.email }] },
  });
}

/**
 * Record a new audit event
 */
export async function recordAuditEvent(
  client: any = prisma,
  params: RecordAuditParams
) {
  try {
    return await client.auditEvent.create({
      data: {
        actionType: params.actionType,
        resourceId: params.resourceId || null,
        resourceName: params.resourceName || null,
        resourceCode: params.resourceCode || null,
        resourceCategory: params.resourceCategory || null,
        departmentId: params.departmentId || null,
        actorId: params.actorId || null,
        actorName: params.actorName,
        actorRole: params.actorRole,
        referenceId: params.referenceId || null,
        details: params.details || null,
        metadata: params.metadata || undefined,
        timestamp: params.timestamp || new Date(),
      },
    });
  } catch (err) {
    console.error('[EEC-RMS Audit] Failed to record audit event:', err);
    return null;
  }
}

/**
 * Idempotently backfills historical database events into the centralized AuditEvent table
 */
export async function backfillHistoricalAuditEvents() {
  try {
    // 1. Backfill Resource registrations
    const resources = await prisma.resource.findMany({
      include: { department: true },
    });
    for (const r of resources) {
      const hasReg = await prisma.auditEvent.findFirst({
        where: { actionType: 'RESOURCE_REGISTERED', resourceId: r.id },
      });
      if (!hasReg) {
        await prisma.auditEvent.create({
          data: {
            actionType: 'RESOURCE_REGISTERED',
            resourceId: r.id,
            resourceName: r.name,
            resourceCode: r.itemCode,
            resourceCategory: r.category,
            departmentId: r.departmentId,
            actorName: 'System / Logistics Registry',
            actorRole: 'STORE_KEEPER',
            referenceId: r.itemCode,
            details: `Resource ${r.name} (${r.itemCode}) registered in ${r.department.name}`,
            timestamp: r.createdAt,
          },
        });
      }
    }

    // 2. Backfill Assignments
    const assignments = await prisma.resourceAssignment.findMany({
      include: { resource: true, employee: true, department: true },
    });
    for (const a of assignments) {
      const hasAsg = await prisma.auditEvent.findFirst({
        where: { actionType: 'RESOURCE_ASSIGNED', referenceId: a.assignmentNumber },
      });
      if (!hasAsg) {
        await prisma.auditEvent.create({
          data: {
            actionType: 'RESOURCE_ASSIGNED',
            resourceId: a.resourceId,
            resourceName: a.resource.name,
            resourceCode: a.resource.itemCode,
            resourceCategory: a.resource.category,
            departmentId: a.departmentId,
            actorId: a.assignedById,
            actorName: a.assignedByName || 'Issuing Store Keeper',
            actorRole: 'STORE_KEEPER',
            referenceId: a.assignmentNumber,
            details: `Assigned to ${a.employee.name} for purpose: ${a.purpose}`,
            timestamp: a.assignedAt,
          },
        });
      }

      if (a.returnedAt) {
        const hasRet = await prisma.auditEvent.findFirst({
          where: { actionType: 'RESOURCE_RETURNED', referenceId: a.assignmentNumber },
        });
        if (!hasRet) {
          await prisma.auditEvent.create({
            data: {
              actionType: 'RESOURCE_RETURNED',
              resourceId: a.resourceId,
              resourceName: a.resource.name,
              resourceCode: a.resource.itemCode,
              resourceCategory: a.resource.category,
              departmentId: a.departmentId,
              actorId: a.returnReceivedById,
              actorName: a.returnReceivedByName || 'Receiving Store Officer',
              actorRole: 'STORE_KEEPER',
              referenceId: a.assignmentNumber,
              details: `Custody returned from ${a.employee.name}. Return condition: ${a.returnCondition || 'GOOD'}`,
              timestamp: a.returnedAt,
            },
          });
        }
      }
    }

    // 3. Backfill Custody Transfers
    const transfers = await prisma.custodyTransfer.findMany({
      include: {
        resource: true,
        fromEmployee: true,
        toEmployee: true,
        toDepartment: true,
      },
    });
    for (const t of transfers) {
      const hasTrf = await prisma.auditEvent.findFirst({
        where: { actionType: 'CUSTODY_TRANSFERRED', referenceId: t.transferNumber },
      });
      if (!hasTrf) {
        await prisma.auditEvent.create({
          data: {
            actionType: 'CUSTODY_TRANSFERRED',
            resourceId: t.resourceId,
            resourceName: t.resource.name,
            resourceCode: t.resource.itemCode,
            resourceCategory: t.resource.category,
            departmentId: t.toDepartmentId,
            actorId: t.transferredById,
            actorName: t.transferredByName,
            actorRole: 'STORE_KEEPER',
            referenceId: t.transferNumber,
            details: `Custody transferred from ${t.fromEmployee.name} to ${t.toEmployee.name}. Reason: ${t.reason || 'Field re-allocation'}`,
            timestamp: t.transferredAt,
          },
        });
      }
    }

    // 4. Backfill Maintenance Requests & Logs
    const maintenanceRequests = await prisma.maintenanceRequest.findMany({
      include: { resource: true, logs: true },
    });
    for (const m of maintenanceRequests) {
      for (const l of m.logs) {
        let action = 'MAINTENANCE_STATUS_CHANGED';
        if (l.action === 'SUBMITTED') action = 'MAINTENANCE_SUBMITTED';
        else if (l.action === 'APPROVED') action = 'MAINTENANCE_APPROVED';
        else if (l.action === 'REJECTED') action = 'MAINTENANCE_REJECTED';
        else if (l.action === 'STARTED') action = 'MAINTENANCE_STARTED';
        else if (l.action === 'PROGRESS_UPDATED') action = 'MAINTENANCE_PROGRESS';
        else if (l.action === 'ON_HOLD' || l.action === 'PUT_ON_HOLD') action = 'MAINTENANCE_ON_HOLD';
        else if (l.action === 'RESUMED') action = 'MAINTENANCE_RESUMED';
        else if (l.action === 'COMPLETED') action = 'MAINTENANCE_COMPLETED';

        const hasLog = await prisma.auditEvent.findFirst({
          where: {
            resourceId: m.resourceId,
            referenceId: m.requestNumber,
            actionType: action,
          },
        });
        if (!hasLog) {
          await prisma.auditEvent.create({
            data: {
              actionType: action,
              resourceId: m.resourceId,
              resourceName: m.resource.name,
              resourceCode: m.resource.itemCode,
              resourceCategory: m.resource.category,
              departmentId: m.departmentId,
              actorId: l.actorId,
              actorName: l.actorName,
              actorRole: l.actorRole,
              referenceId: m.requestNumber,
              details: l.notes || `Maintenance status transitioned to ${l.toStatus}`,
              timestamp: l.createdAt,
            },
          });
        }
      }
    }

    // 5. Backfill Inspections
    const inspections = await prisma.maintenanceInspection.findMany({
      include: { resource: true },
    });
    for (const i of inspections) {
      const hasInsp = await prisma.auditEvent.findFirst({
        where: {
          actionType: 'INSPECTION_RECORDED',
          resourceId: i.resourceId,
        },
      });
      if (!hasInsp) {
        await prisma.auditEvent.create({
          data: {
            actionType: 'INSPECTION_RECORDED',
            resourceId: i.resourceId,
            resourceName: i.resource.name,
            resourceCode: i.resource.itemCode,
            resourceCategory: i.resource.category,
            departmentId: i.resource.departmentId,
            actorId: i.conductedById,
            actorName: i.conductedByName,
            actorRole: 'IT_TECHNICIAN',
            referenceId: i.maintenanceRequestId,
            details: `QA Inspection (${i.inspectionType}): ${i.passed ? 'PASSED' : 'FAILED'}. Findings: ${i.findings}`,
            timestamp: i.inspectedAt,
          },
        });
      }
    }
  } catch (err) {
    console.error('[EEC-RMS Audit] Failed to backfill historical audit events:', err);
  }
}

/**
 * Query Audit Trail with full RBAC, search, and filtering
 */
export async function queryAuditTrail(user: any, filters: AuditQueryFilters) {
  // Ensure historical records are backfilled
  await backfillHistoricalAuditEvents();

  const userRole = user.role;
  const userDeptId = user.departmentId;

  // 1. Role-based scoping
  const where: any = {};
  let emp = null;

  if (userRole === 'EMPLOYEE') {
    emp = await resolveEmployeeRecord(user);
    if (!emp) {
      where.id = '__NONE__';
    } else {
      // Find all resources employee currently has or historically had custody of
      const userAssignments = await prisma.resourceAssignment.findMany({
        where: { employeeId: emp.id },
        select: { resourceId: true },
      });
      const authorizedResourceIds = Array.from(new Set(userAssignments.map((a) => a.resourceId)));

      where.OR = [
        { actorId: user.id },
        ...(emp ? [{ actorId: emp.id }] : []),
        { resourceId: { in: authorizedResourceIds } },
      ];
    }
  } else if (userRole === 'DEPARTMENT_MANAGER') {
    where.departmentId = userDeptId || '__NO_DEPT__';

    // Disallow cross-department query
    if (filters.departmentId && filters.departmentId !== 'ALL' && filters.departmentId !== userDeptId) {
      throw new Error('FORBIDDEN_DEPARTMENT');
    }
  } else {
    // ADMIN, STORE_KEEPER, IT_TECHNICIAN
    if (filters.departmentId && filters.departmentId !== 'ALL') {
      where.departmentId = filters.departmentId;
    }
  }

  // 2. Additional filters
  if (filters.actionType && filters.actionType !== 'ALL') {
    where.actionType = filters.actionType;
  }

  if (filters.category && filters.category !== 'ALL') {
    where.resourceCategory = filters.category;
  }

  if (filters.resourceId && filters.resourceId !== 'ALL') {
    where.resourceId = filters.resourceId;
  }

  if (filters.userId && filters.userId !== 'ALL') {
    where.actorId = filters.userId;
  }

  if (filters.startDate || filters.endDate) {
    where.timestamp = {};
    if (filters.startDate) {
      where.timestamp.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      where.timestamp.lte = end;
    }
  }

  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim();
    const searchConditions = [
      { resourceName: { contains: q, mode: 'insensitive' } },
      { resourceCode: { contains: q, mode: 'insensitive' } },
      { referenceId: { contains: q, mode: 'insensitive' } },
      { actorName: { contains: q, mode: 'insensitive' } },
      { details: { contains: q, mode: 'insensitive' } },
    ];

    if (where.OR) {
      where.AND = [{ OR: where.OR }, { OR: searchConditions }];
      delete where.OR;
    } else {
      where.OR = searchConditions;
    }
  }

  const pageNum = Math.max(1, filters.page || 1);
  const limitNum = Math.max(1, Math.min(200, filters.limit || 50));
  const skip = (pageNum - 1) * limitNum;

  const [total, events] = await Promise.all([
    prisma.auditEvent.count({ where }),
    prisma.auditEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip,
      take: limitNum,
      include: {
        department: { select: { id: true, name: true, code: true } },
      },
    }),
  ]);

  return {
    events,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  };
}

/**
 * Fetch complete chronological lifecycle history for a resource
 */
export async function getResourceLifecycleHistory(user: any, resourceIdOrCode: string) {
  await backfillHistoricalAuditEvents();

  const userRole = user.role;
  const userDeptId = user.departmentId;

  // 1. Resolve resource
  const resource = await prisma.resource.findFirst({
    where: {
      OR: [{ id: resourceIdOrCode }, { itemCode: resourceIdOrCode }],
    },
    include: {
      department: true,
      currentAssignee: true,
    },
  });

  if (!resource) {
    throw new Error('RESOURCE_NOT_FOUND');
  }

  // 2. Enforce Access Security
  if (userRole === 'EMPLOYEE') {
    const emp = await resolveEmployeeRecord(user);
    if (!emp) throw new Error('FORBIDDEN');

    // Check if employee is current custodian OR historical assignee
    const isCurrent = resource.currentAssigneeId === emp.id;
    const hasPastAssignment = await prisma.resourceAssignment.findFirst({
      where: {
        resourceId: resource.id,
        employeeId: emp.id,
      },
    });

    if (!isCurrent && !hasPastAssignment) {
      throw new Error('FORBIDDEN');
    }
  } else if (userRole === 'DEPARTMENT_MANAGER') {
    if (resource.departmentId !== userDeptId) {
      throw new Error('FORBIDDEN');
    }
  }

  // 3. Query all chronological events for this resource
  const events = await prisma.auditEvent.findMany({
    where: { resourceId: resource.id },
    orderBy: { timestamp: 'asc' }, // Chronological: earliest to latest
    include: {
      department: { select: { id: true, name: true, code: true } },
    },
  });

  return {
    resource: {
      id: resource.id,
      itemCode: resource.itemCode,
      name: resource.name,
      category: resource.category,
      subcategory: resource.subcategory,
      status: resource.status,
      condition: resource.condition,
      location: resource.location,
      departmentId: resource.departmentId,
      departmentName: resource.department?.name,
      departmentCode: resource.department?.code,
      currentAssigneeId: resource.currentAssigneeId,
      currentAssigneeName: resource.currentAssignee?.name,
      purchaseDate: resource.purchaseDate?.toISOString() || null,
      purchaseCostETB: resource.purchaseCostETB || 0,
      currentValueETB: resource.currentValueETB || 0,
      createdAt: resource.createdAt.toISOString(),
    },
    events,
  };
}
