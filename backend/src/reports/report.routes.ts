import { Router } from '../http/router';
import { AppRequest, AppResponse } from '../http/types';
import { requireAuth } from '../auth/auth.middleware';
import prisma from '../lib/prisma';
import { queryAuditTrail, getResourceLifecycleHistory } from '../audit/audit.service';
import { exportAuditTrailCSV, exportAuditTrailXLSX, exportAuditTrailPDF, exportResourceLifecyclePDF } from './export.service';

const router = new Router();

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
 * GET /api/reports/overview
 * Comprehensive corporate & departmental reports dashboard
 */
router.get('/overview', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const user = req.user!;
    const userRole = user.role;
    const userDeptId = user.departmentId;

    const {
      startDate,
      endDate,
      departmentId,
      category,
      status,
      maintenanceStatus,
    } = req.query || {};

    // 1. Role-based scoping and department boundary enforcement
    let effectiveDeptId: string | undefined = undefined;
    let scope: 'CORPORATION' | 'DEPARTMENT' | 'EMPLOYEE' | 'STORE' | 'TECHNICAL' = 'CORPORATION';
    let emp = null;

    if (userRole === 'EMPLOYEE') {
      scope = 'EMPLOYEE';
      emp = await resolveEmployeeRecord(user);
      effectiveDeptId = userDeptId || emp?.departmentId;
    } else if (userRole === 'DEPARTMENT_MANAGER') {
      scope = 'DEPARTMENT';
      effectiveDeptId = userDeptId || undefined;

      // Reject attempts to access other department reports
      if (departmentId && departmentId !== 'ALL' && departmentId !== userDeptId) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Department managers may only view reports for their assigned directorate.',
        });
      }
    } else if (userRole === 'STORE_KEEPER') {
      scope = 'STORE';
      if (departmentId && departmentId !== 'ALL') {
        effectiveDeptId = departmentId;
      }
    } else if (userRole === 'IT_TECHNICIAN') {
      scope = 'TECHNICAL';
      if (departmentId && departmentId !== 'ALL') {
        effectiveDeptId = departmentId;
      }
    } else {
      // ADMIN: Corporation-wide with optional department filter
      scope = 'CORPORATION';
      if (departmentId && departmentId !== 'ALL') {
        effectiveDeptId = departmentId;
      }
    }

    // Parse date boundaries if supplied
    let dateFilter: { gte?: Date; lte?: Date } | undefined = undefined;
    if (startDate || endDate) {
      dateFilter = {};
      if (startDate) {
        dateFilter.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
    }

    // 2. Build where clauses
    const resourceWhere: any = {};
    if (userRole === 'EMPLOYEE') {
      if (emp) {
        resourceWhere.OR = [
          { currentAssigneeId: emp.id },
          { assignments: { some: { employeeId: emp.id } } },
        ];
      } else {
        resourceWhere.id = '__NONE__';
      }
    } else if (effectiveDeptId) {
      resourceWhere.departmentId = effectiveDeptId;
    }

    if (category && category !== 'ALL') {
      resourceWhere.category = category;
    }

    if (status && status !== 'ALL') {
      resourceWhere.status = status;
    }

    if (dateFilter) {
      resourceWhere.createdAt = dateFilter;
    }

    // Maintenance requests filter
    const maintenanceWhere: any = {};
    if (userRole === 'EMPLOYEE') {
      maintenanceWhere.OR = [
        { reportedById: user.id },
        ...(emp ? [{ custodianIdAtRequest: emp.id }] : []),
        ...(emp ? [{ resource: { currentAssigneeId: emp.id } }] : []),
      ];
    } else if (effectiveDeptId) {
      maintenanceWhere.departmentId = effectiveDeptId;
    }

    if (maintenanceStatus && maintenanceStatus !== 'ALL') {
      maintenanceWhere.status = maintenanceStatus;
    }

    if (category && category !== 'ALL') {
      maintenanceWhere.resource = { category };
    }

    if (dateFilter) {
      maintenanceWhere.reportedDate = dateFilter;
    }

    // Assignment filter
    const assignmentWhere: any = {};
    if (userRole === 'EMPLOYEE') {
      if (emp) {
        assignmentWhere.employeeId = emp.id;
      } else {
        assignmentWhere.id = '__NONE__';
      }
    } else if (effectiveDeptId) {
      assignmentWhere.departmentId = effectiveDeptId;
    }

    if (category && category !== 'ALL') {
      assignmentWhere.resource = { category };
    }

    if (dateFilter) {
      assignmentWhere.assignedAt = dateFilter;
    }

    // 3. Fetch data concurrently
    const [
      resources,
      maintenanceRequests,
      activeAssignments,
      recentAssignments,
      recentTransfers,
      recentMaintenance,
      departmentMeta,
    ] = await Promise.all([
      prisma.resource.findMany({
        where: resourceWhere,
        select: {
          id: true,
          itemCode: true,
          name: true,
          category: true,
          status: true,
          condition: true,
          departmentId: true,
          department: {
            select: { id: true, name: true, code: true },
          },
          currentAssigneeId: true,
          currentAssignee: {
            select: { id: true, name: true },
          },
          purchaseCostETB: true,
          currentValueETB: true,
          createdAt: true,
        },
      }),

      prisma.maintenanceRequest.findMany({
        where: maintenanceWhere,
        select: {
          id: true,
          requestNumber: true,
          title: true,
          priority: true,
          status: true,
          reportedDate: true,
          estimatedCostETB: true,
          actualCostETB: true,
          outcome: true,
          custodyAction: true,
          departmentId: true,
          department: {
            select: { id: true, name: true, code: true },
          },
          resourceId: true,
          resource: {
            select: { name: true, itemCode: true, category: true },
          },
          reportedByName: true,
          assignedTechnicianName: true,
          completedAt: true,
        },
      }),

      prisma.resourceAssignment.findMany({
        where: {
          ...assignmentWhere,
          isCurrent: true,
          status: 'ACTIVE',
        },
        include: {
          resource: {
            select: { id: true, name: true, itemCode: true, category: true },
          },
          employee: {
            select: { id: true, name: true, employeeId: true },
          },
          department: {
            select: { id: true, name: true, code: true },
          },
        },
      }),

      // Recent 10 assignments
      prisma.resourceAssignment.findMany({
        where: assignmentWhere,
        take: 10,
        orderBy: { assignedAt: 'desc' },
        include: {
          resource: { select: { id: true, name: true, itemCode: true } },
          employee: { select: { id: true, name: true } },
          department: { select: { id: true, name: true, code: true } },
        },
      }),

      // Recent 10 custody transfers
      prisma.custodyTransfer.findMany({
        where: userRole === 'EMPLOYEE' && emp
          ? { OR: [{ fromEmployeeId: emp.id }, { toEmployeeId: emp.id }] }
          : effectiveDeptId
          ? { OR: [{ fromDepartmentId: effectiveDeptId }, { toDepartmentId: effectiveDeptId }] }
          : {},
        take: 10,
        orderBy: { transferredAt: 'desc' },
        include: {
          resource: { select: { id: true, name: true, itemCode: true } },
          fromEmployee: { select: { id: true, name: true } },
          toEmployee: { select: { id: true, name: true } },
          fromDepartment: { select: { id: true, name: true, code: true } },
          toDepartment: { select: { id: true, name: true, code: true } },
        },
      }),

      // Recent 10 maintenance logs/tickets
      prisma.maintenanceRequest.findMany({
        where: maintenanceWhere,
        take: 10,
        orderBy: { reportedDate: 'desc' },
        include: {
          resource: { select: { id: true, name: true, itemCode: true } },
          department: { select: { id: true, name: true, code: true } },
        },
      }),

      // Department name lookup
      effectiveDeptId
        ? prisma.department.findUnique({ where: { id: effectiveDeptId }, select: { id: true, name: true, code: true } })
        : Promise.resolve(null),
    ]);

    // 4. Calculate Resource Counts & Valuations
    const totalResources = resources.length;
    let availableCount = 0;
    let assignedCount = 0;
    let maintenanceCount = 0;
    let retiredCount = 0;
    let disposedCount = 0;
    let totalPurchaseCostETB = 0;
    let totalCurrentValueETB = 0;

    const categoryMap = new Map<string, { category: string; count: number; totalValueETB: number; available: number; assigned: number; maintenance: number }>();
    const departmentMap = new Map<string, { departmentId: string; departmentName: string; departmentCode: string; count: number; totalValueETB: number }>();

    for (const r of resources) {
      const pCost = r.purchaseCostETB || 0;
      const cVal = r.currentValueETB || 0;
      totalPurchaseCostETB += pCost;
      totalCurrentValueETB += cVal;

      if (r.status === 'AVAILABLE') availableCount++;
      else if (r.status === 'ASSIGNED') assignedCount++;
      else if (r.status === 'MAINTENANCE') maintenanceCount++;
      else if (r.status === 'RETIRED') retiredCount++;
      else if (r.status === 'DISPOSED') disposedCount++;

      // Category breakdown
      const cat = r.category || 'OTHER';
      const catEntry = categoryMap.get(cat) || {
        category: cat,
        count: 0,
        totalValueETB: 0,
        available: 0,
        assigned: 0,
        maintenance: 0,
      };
      catEntry.count++;
      catEntry.totalValueETB += cVal || pCost;
      if (r.status === 'AVAILABLE') catEntry.available++;
      if (r.status === 'ASSIGNED') catEntry.assigned++;
      if (r.status === 'MAINTENANCE') catEntry.maintenance++;
      categoryMap.set(cat, catEntry);

      // Department breakdown
      const deptId = r.departmentId;
      const deptName = r.department?.name || 'Unassigned';
      const deptCode = r.department?.code || 'N/A';
      const deptEntry = departmentMap.get(deptId) || {
        departmentId: deptId,
        departmentName: deptName,
        departmentCode: deptCode,
        count: 0,
        totalValueETB: 0,
      };
      deptEntry.count++;
      deptEntry.totalValueETB += cVal || pCost;
      departmentMap.set(deptId, deptEntry);
    }

    const categoryDistribution = Array.from(categoryMap.values()).sort((a, b) => b.count - a.count);
    const departmentDistribution = Array.from(departmentMap.values()).sort((a, b) => b.count - a.count);

    // 5. Custody & Assignment Distribution
    const totalActiveAssignments = activeAssignments.length;
    const totalUnassigned = resources.filter((r) => !r.currentAssigneeId && r.status === 'AVAILABLE').length;

    const custodyDeptMap = new Map<string, { departmentId: string; departmentName: string; departmentCode: string; count: number }>();
    const custodyEmpMap = new Map<string, { employeeId: string; employeeName: string; departmentName: string; count: number }>();

    for (const a of activeAssignments) {
      // Dept custody
      const dId = a.departmentId;
      const dName = a.department?.name || 'Department';
      const dCode = a.department?.code || '';
      const dEntry = custodyDeptMap.get(dId) || { departmentId: dId, departmentName: dName, departmentCode: dCode, count: 0 };
      dEntry.count++;
      custodyDeptMap.set(dId, dEntry);

      // Employee custody
      const eId = a.employeeId;
      const eName = a.employee?.name || 'Employee';
      const eEntry = custodyEmpMap.get(eId) || { employeeId: eId, employeeName: eName, departmentName: dName, count: 0 };
      eEntry.count++;
      custodyEmpMap.set(eId, eEntry);
    }

    const custodyByDepartment = Array.from(custodyDeptMap.values()).sort((a, b) => b.count - a.count);
    const custodyByEmployee = Array.from(custodyEmpMap.values()).sort((a, b) => b.count - a.count).slice(0, 10);

    // 6. Maintenance Metrics & Financials
    const maintenanceStatusCounts: Record<string, number> = {
      SUBMITTED: 0,
      APPROVED: 0,
      IN_PROGRESS: 0,
      ON_HOLD: 0,
      COMPLETED: 0,
      REJECTED: 0,
      total: maintenanceRequests.length,
    };

    let totalEstimatedMaintenanceETB = 0;
    let totalActualMaintenanceETB = 0;
    const maintCatMap = new Map<string, { category: string; count: number; actualCostETB: number }>();

    for (const m of maintenanceRequests) {
      if (maintenanceStatusCounts[m.status] !== undefined) {
        maintenanceStatusCounts[m.status]++;
      }
      const est = m.estimatedCostETB || 0;
      const act = m.actualCostETB || 0;
      totalEstimatedMaintenanceETB += est;
      totalActualMaintenanceETB += act;

      const mCat = m.resource?.category || 'OTHER';
      const mEntry = maintCatMap.get(mCat) || { category: mCat, count: 0, actualCostETB: 0 };
      mEntry.count++;
      mEntry.actualCostETB += act;
      maintCatMap.set(mCat, mEntry);
    }

    const maintenanceCostsByCategory = Array.from(maintCatMap.values()).sort((a, b) => b.actualCostETB - a.actualCostETB);

    // 7. Unified Recent Activities Feed
    const recentActivities = [
      ...recentAssignments.map((a) => ({
        type: 'ASSIGNMENT' as const,
        id: a.id,
        referenceCode: a.assignmentNumber,
        title: `Asset assigned to ${a.employee?.name || 'Staff'}`,
        resourceId: a.resourceId,
        resourceName: a.resource?.name || '',
        resourceCode: a.resource?.itemCode || '',
        actorName: a.assignedByName || 'Store Keeper',
        departmentName: a.department?.name || '',
        timestamp: a.assignedAt.toISOString(),
        status: a.status,
      })),
      ...recentTransfers.map((t) => ({
        type: 'TRANSFER' as const,
        id: t.id,
        referenceCode: t.transferNumber,
        title: `Custody transferred: ${t.fromEmployee?.name || 'Prior Custodian'} → ${t.toEmployee?.name || 'New Custodian'}`,
        resourceId: t.resourceId,
        resourceName: t.resource?.name || '',
        resourceCode: t.resource?.itemCode || '',
        actorName: t.transferredByName || 'Officer',
        departmentName: t.toDepartment?.name || t.fromDepartment?.name || '',
        timestamp: t.transferredAt.toISOString(),
        status: 'TRANSFERRED',
      })),
      ...recentMaintenance.map((m) => ({
        type: 'MAINTENANCE' as const,
        id: m.id,
        referenceCode: m.requestNumber,
        title: `${m.title} (${m.priority})`,
        resourceId: m.resourceId,
        resourceName: m.resource?.name || '',
        resourceCode: m.resource?.itemCode || '',
        actorName: m.reportedByName || 'Reporter',
        departmentName: m.department?.name || '',
        timestamp: m.reportedDate.toISOString(),
        status: m.status,
      })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 15);

    return res.status(200).json({
      success: true,
      metadata: {
        scope,
        scopeLabel:
          scope === 'CORPORATION'
            ? 'Corporation-wide (All Directorates)'
            : scope === 'DEPARTMENT'
            ? `Directorate-scoped: ${departmentMeta?.name || 'Assigned Directorate'}`
            : scope === 'EMPLOYEE'
            ? `Personal Custody & Activity: ${emp?.name || user.fullName}`
            : scope === 'STORE'
            ? 'Central Store & Logistics Inventory'
            : 'Technical Engineering & Workshop Maintenance',
        departmentId: effectiveDeptId,
        departmentName: departmentMeta?.name || undefined,
        departmentCode: departmentMeta?.code || undefined,
        generatedAt: new Date().toISOString(),
        filtersApplied: {
          startDate: startDate || null,
          endDate: endDate || null,
          departmentId: departmentId || 'ALL',
          category: category || 'ALL',
          status: status || 'ALL',
          maintenanceStatus: maintenanceStatus || 'ALL',
        },
      },
      overview: {
        totalResources,
        available: availableCount,
        assigned: assignedCount,
        underMaintenance: maintenanceCount,
        retired: retiredCount,
        disposed: disposedCount,
        totalPurchaseCostETB,
        totalCurrentValueETB,
      },
      distribution: {
        byCategory: categoryDistribution,
        byDepartment: departmentDistribution,
      },
      custody: {
        totalActiveAssignments,
        totalUnassigned,
        byDepartment: custodyByDepartment,
        byEmployee: custodyByEmployee,
      },
      maintenance: {
        byStatus: maintenanceStatusCounts,
        totalEstimatedCostETB: totalEstimatedMaintenanceETB,
        totalActualCostETB: totalActualMaintenanceETB,
        byCategory: maintenanceCostsByCategory,
      },
      recentActivities,
    });
  } catch (err: any) {
    console.error('[GET /api/reports/overview Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate reports overview',
    });
  }
});

/**
 * GET /api/reports/audit
 * Query detailed operational audit trail with pagination, search, and filters
 */
router.get('/audit', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const user = req.user!;
    const result = await queryAuditTrail(user, req.query || {});
    return res.status(200).json({
      success: true,
      events: result.events,
      pagination: result.pagination,
    });
  } catch (err: any) {
    if (err.message === 'FORBIDDEN_DEPARTMENT') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Department managers may only view audit records for their assigned directorate.',
      });
    }
    console.error('[GET /api/reports/audit Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit trail records',
    });
  }
});

/**
 * GET /api/reports/audit/export/csv
 * Export filtered audit records to CSV
 */
router.get('/audit/export/csv', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const user = req.user!;
    const result = await queryAuditTrail(user, { ...req.query, limit: 1000, page: 1 });
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const filename = `EEC_Audit_Trail_${dateStr}.csv`;

    const csvContent = exportAuditTrailCSV(result.events, {
      generatedAt: now.toISOString(),
      generatedBy: `${user.fullName} (${user.role})`,
      scopeLabel: user.role === 'ADMIN' ? 'Corporation-wide' : user.role === 'DEPARTMENT_MANAGER' ? `Directorate: ${user.departmentId}` : user.role,
      filtersApplied: req.query || {},
    });

    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': Buffer.byteLength(csvContent, 'utf-8'),
    });
    return res.end(csvContent);
  } catch (err: any) {
    if (err.message === 'FORBIDDEN_DEPARTMENT') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Cannot export audit records outside assigned directorate.',
      });
    }
    console.error('[GET /api/reports/audit/export/csv Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to generate audit CSV export' });
  }
});

/**
 * GET /api/reports/audit/export/xlsx
 * Export filtered audit records to native Microsoft Excel (.xlsx) format
 */
router.get('/audit/export/xlsx', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const user = req.user!;
    const result = await queryAuditTrail(user, { ...req.query, limit: 1000, page: 1 });
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const filename = `EEC_Audit_Trail_${dateStr}.xlsx`;

    const xlsxBuffer = exportAuditTrailXLSX(result.events, {
      generatedAt: now.toISOString(),
      generatedBy: `${user.fullName} (${user.role})`,
      scopeLabel: user.role === 'ADMIN' ? 'Corporation-wide' : user.role === 'DEPARTMENT_MANAGER' ? `Directorate: ${user.departmentId}` : user.role,
      filtersApplied: req.query || {},
    });

    res.writeHead(200, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': xlsxBuffer.length,
    });
    return res.end(xlsxBuffer);
  } catch (err: any) {
    if (err.message === 'FORBIDDEN_DEPARTMENT') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Cannot export audit records outside assigned directorate.',
      });
    }
    console.error('[GET /api/reports/audit/export/xlsx Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to generate audit Excel export' });
  }
});

/**
 * GET /api/reports/audit/export/pdf
 * Export filtered audit records to PDF
 */
router.get('/audit/export/pdf', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const user = req.user!;
    const result = await queryAuditTrail(user, { ...req.query, limit: 500, page: 1 });
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const filename = `EEC_Audit_Trail_${dateStr}.pdf`;

    const pdfBuffer = exportAuditTrailPDF(result.events, {
      generatedAt: now.toISOString(),
      generatedBy: `${user.fullName} (${user.role})`,
      scopeLabel: user.role === 'ADMIN' ? 'Corporation-wide' : user.role === 'DEPARTMENT_MANAGER' ? `Directorate: ${user.departmentId}` : user.role,
      filtersApplied: req.query || {},
    });

    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });
    return res.end(pdfBuffer);
  } catch (err: any) {
    if (err.message === 'FORBIDDEN_DEPARTMENT') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Cannot export audit records outside assigned directorate.',
      });
    }
    console.error('[GET /api/reports/audit/export/pdf Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to generate audit PDF export' });
  }
});

/**
 * GET /api/reports/lifecycle/:id
 * Retrieve complete chronological lifecycle history for a resource
 */
router.get('/lifecycle/:id', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const user = req.user!;
    const resourceIdOrCode = req.params!.id;
    const result = await getResourceLifecycleHistory(user, resourceIdOrCode);
    return res.status(200).json({
      success: true,
      resource: result.resource,
      events: result.events,
    });
  } catch (err: any) {
    if (err.message === 'RESOURCE_NOT_FOUND') {
      return res.status(404).json({ success: false, message: `Resource '${req.params!.id}' not found` });
    }
    if (err.message === 'FORBIDDEN') {
      return res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to view lifecycle history for this resource.' });
    }
    console.error('[GET /api/reports/lifecycle/:id Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve resource lifecycle history' });
  }
});

/**
 * GET /api/reports/lifecycle/:id/export/pdf
 * Export a resource's complete lifecycle history dossier to PDF
 */
router.get('/lifecycle/:id/export/pdf', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const user = req.user!;
    const resourceIdOrCode = req.params!.id;
    const result = await getResourceLifecycleHistory(user, resourceIdOrCode);
    const now = new Date();
    const filename = `EEC_Lifecycle_${result.resource.itemCode}_${now.toISOString().slice(0, 10)}.pdf`;

    const pdfBuffer = exportResourceLifecyclePDF(result.resource, result.events, {
      generatedAt: now.toISOString(),
      generatedBy: `${user.fullName} (${user.role})`,
    });

    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });
    return res.end(pdfBuffer);
  } catch (err: any) {
    if (err.message === 'RESOURCE_NOT_FOUND') {
      return res.status(404).json({ success: false, message: `Resource '${req.params!.id}' not found` });
    }
    if (err.message === 'FORBIDDEN') {
      return res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to export lifecycle dossier for this resource.' });
    }
    console.error('[GET /api/reports/lifecycle/:id/export/pdf Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to generate resource lifecycle PDF' });
  }
});

export default router;

