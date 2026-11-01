import { Router } from '../http/router';
import { AppRequest, AppResponse } from '../http/types';
import { requireAuth, requireRole } from '../auth/auth.middleware';
import prisma from '../lib/prisma';
import { VALID_CATEGORIES } from '../resources/resource.routes';
import {
  safeNotifyUser,
  safeNotifyUsers,
  findActiveUserIdsByRole,
  resolveEmployeeUserId,
} from '../notifications/notification.service';

const router = new Router();

/**
 * Helper to get current calendar date in Ethiopia (Africa/Addis_Ababa) in YYYY-MM-DD format
 */
export function getEthiopiaTodayDateString(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Format a Date or date string to YYYY-MM-DD in Ethiopia timezone
 */
export function formatRequiredDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dateObj);
}

function formatRequisition(r: any) {
  return {
    id: r.id,
    requisitionNumber: r.requisitionNumber,
    requesterId: r.requesterId,
    requesterName: r.requesterName,
    requesterRole: r.requesterRole,
    employeeId: r.employeeId,
    employeeName: r.employee?.name || r.requesterName,
    departmentId: r.departmentId,
    departmentName: r.department?.name || '',
    category: r.category,
    itemDescription: r.itemDescription,
    justification: r.justification,
    urgency: r.urgency,
    status: r.status,
    requiredDate: formatRequiredDate(r.requiredDate),
    isDirectAllocation: r.isDirectAllocation,
    approvedBy: r.approvedByName || undefined,
    approvedAt: r.approvedAt ? r.approvedAt.toISOString() : undefined,
    approvalComments: r.approvalComments || undefined,
    rejectionReason: r.rejectionReason || undefined,
    rejectedAt: r.rejectedAt ? r.rejectedAt.toISOString() : undefined,
    fulfilledResourceId: r.fulfilledResourceId || undefined,
    fulfilledResourceName: r.fulfilledResource?.name || undefined,
    fulfilledResourceCode: r.fulfilledResource?.itemCode || undefined,
    fulfilledAssignmentId: r.fulfilledAssignmentId || undefined,
    fulfilledBy: r.fulfilledByName || undefined,
    fulfilledAt: r.fulfilledAt ? r.fulfilledAt.toISOString() : undefined,
    handoverNotes: r.handoverNotes || undefined,
    createdAt: r.createdAt ? r.createdAt.toISOString() : '',
    updatedAt: r.updatedAt ? r.updatedAt.toISOString() : '',
  };
}

/**
 * GET /api/requisitions
 * List requisitions with role-based scoping, status filter, and pagination
 */
router.get('/', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const user = req.user!;
    const userRole = user.role;
    const userDeptId = user.departmentId;
    const { status, departmentId, category, urgency, search, page, limit } = req.query || {};

    let filter: any = {};

    // Role Scoping
    if (userRole === 'DEPARTMENT_MANAGER') {
      if (!userDeptId) {
        return res.status(200).json({
          success: true,
          requisitions: [],
          pagination: { total: 0, page: 1, limit: 50, totalPages: 0 },
        });
      }
      filter.departmentId = userDeptId;
    } else if (userRole === 'EMPLOYEE') {
      // Find employee record
      const empId = user.employeeRecordId;
      if (empId) {
        filter.OR = [
          { employeeId: empId },
          { requesterId: user.id },
          { requesterId: empId },
        ];
      } else {
        filter.requesterId = user.id;
      }
    } else if (departmentId && departmentId !== 'ALL') {
      filter.departmentId = departmentId;
    }

    if (status && status !== 'ALL') {
      filter.status = status;
    }

    if (category && category !== 'ALL') {
      filter.category = category;
    }

    if (urgency && urgency !== 'ALL') {
      filter.urgency = urgency;
    }

    if (search && search.trim()) {
      const q = search.trim();
      const searchConditions = [
        { requisitionNumber: { contains: q, mode: 'insensitive' } },
        { itemDescription: { contains: q, mode: 'insensitive' } },
        { justification: { contains: q, mode: 'insensitive' } },
        { requesterName: { contains: q, mode: 'insensitive' } },
        { employee: { name: { contains: q, mode: 'insensitive' } } },
      ];
      if (filter.OR) {
        filter.AND = [{ OR: filter.OR }, { OR: searchConditions }];
        delete filter.OR;
      } else {
        filter.OR = searchConditions;
      }
    }

    const pageNum = Math.max(1, parseInt(page || '1', 10));
    const limitNum = Math.max(1, Math.min(500, parseInt(limit || '100', 10)));
    const skip = (pageNum - 1) * limitNum;

    const [total, rawReqs] = await Promise.all([
      prisma.resourceRequisition.count({ where: filter }),
      prisma.resourceRequisition.findMany({
        where: filter,
        include: {
          department: true,
          employee: true,
          fulfilledResource: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
    ]);

    return res.status(200).json({
      success: true,
      requisitions: rawReqs.map(formatRequisition),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('[GET /api/requisitions Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve requisitions',
    });
  }
});

/**
 * GET /api/requisitions/:id
 * Single requisition details
 */
router.get('/:id', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const { id } = req.params;
    const user = req.user!;
    const userRole = user.role;
    const userDeptId = user.departmentId;

    const reqItem = await prisma.resourceRequisition.findUnique({
      where: { id },
      include: {
        department: true,
        employee: true,
        fulfilledResource: true,
        fulfilledAssignment: true,
      },
    });

    if (!reqItem) {
      return res.status(404).json({
        success: false,
        message: `Requisition with ID '${id}' not found`,
      });
    }

    // Role boundary checks
    if (userRole === 'DEPARTMENT_MANAGER' && reqItem.departmentId !== userDeptId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to view requisitions from another directorate',
      });
    }

    if (userRole === 'EMPLOYEE') {
      const isOwner = reqItem.requesterId === user.id || reqItem.employeeId === user.employeeRecordId;
      if (!isOwner && reqItem.departmentId !== userDeptId) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You can only view your own requisitions',
        });
      }
    }

    return res.status(200).json({
      success: true,
      requisition: formatRequisition(reqItem),
    });
  } catch (err) {
    console.error('[GET /api/requisitions/:id Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve requisition details',
    });
  }
});

/**
 * POST /api/requisitions
 * Submit a new resource request or initiate an Admin direct allocation
 */
router.post('/', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const user = req.user!;
    const userRole = user.role;
    const userDeptId = user.departmentId;

    const {
      category,
      itemDescription,
      justification,
      urgency,
      requiredDate,
      departmentId,
      employeeId,
      isDirectAllocation,
    } = req.body || {};

    if (!category || !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category. Must be one of: [${VALID_CATEGORIES.join(', ')}]`,
      });
    }

    if (!itemDescription || typeof itemDescription !== 'string' || itemDescription.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Item description is required (minimum 3 characters)',
      });
    }

    if (!justification || typeof justification !== 'string' || justification.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Justification / project purpose is required',
      });
    }

    // Validate requiredDate (or default to current local date in Africa/Addis_Ababa)
    const todayInEthiopia = getEthiopiaTodayDateString();
    let parsedRequiredDate: Date;

    if (requiredDate !== undefined && requiredDate !== null && String(requiredDate).trim() !== '') {
      const trimmedDate = String(requiredDate).trim();
      const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmedDate);
      if (!dateMatch) {
        return res.status(400).json({
          success: false,
          message: 'Invalid required date format. Expected YYYY-MM-DD',
        });
      }

      const year = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10);
      const day = parseInt(dateMatch[3], 10);

      const utcDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      if (
        utcDate.getUTCFullYear() !== year ||
        utcDate.getUTCMonth() !== month - 1 ||
        utcDate.getUTCDate() !== day
      ) {
        return res.status(400).json({
          success: false,
          message: 'Invalid calendar date for required by date',
        });
      }

      const dateOnlyStr = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (dateOnlyStr < todayInEthiopia) {
        return res.status(400).json({
          success: false,
          message: `Required by date cannot be in the past. Minimum selectable date is today (${todayInEthiopia})`,
        });
      }

      parsedRequiredDate = utcDate;
    } else {
      const [tYear, tMonth, tDay] = todayInEthiopia.split('-').map(Number);
      parsedRequiredDate = new Date(Date.UTC(tYear, tMonth - 1, tDay, 0, 0, 0, 0));
    }

    // Determine target department and target employee
    let targetDeptId = departmentId;
    let targetEmployeeId = employeeId;

    if (userRole === 'EMPLOYEE') {
      // Employee submits for themselves in their department
      if (!userDeptId) {
        return res.status(400).json({
          success: false,
          message: 'Your account is not assigned to any directorate',
        });
      }
      targetDeptId = userDeptId;
      // Resolve employee record
      let emp = null;
      if (user.employeeRecordId) {
        emp = await prisma.employee.findUnique({ where: { id: user.employeeRecordId } });
      }
      if (!emp) {
        emp = await prisma.employee.findFirst({
          where: { OR: [{ userId: user.id }, { email: user.email }] },
        });
      }
      if (!emp) {
        return res.status(400).json({
          success: false,
          message: 'No active employee profile linked to your account',
        });
      }
      targetEmployeeId = emp.id;
    } else if (userRole === 'DEPARTMENT_MANAGER') {
      if (!userDeptId) {
        return res.status(400).json({
          success: false,
          message: 'Your manager account is not assigned to any directorate',
        });
      }
      targetDeptId = userDeptId;

      if (!targetEmployeeId) {
        // Manager requesting for themselves or default
        let emp = await prisma.employee.findFirst({
          where: { OR: [{ userId: user.id }, { email: user.email }] },
        });
        if (emp) targetEmployeeId = emp.id;
      }

      if (targetEmployeeId) {
        const emp = await prisma.employee.findUnique({ where: { id: targetEmployeeId } });
        if (!emp || emp.departmentId !== userDeptId) {
          return res.status(403).json({
            success: false,
            message: 'Forbidden: Department managers may only submit requests for personnel within their own directorate',
          });
        }
      }
    } else if (userRole === 'ADMIN') {
      // Admin can submit for any department / employee
      if (!targetDeptId && targetEmployeeId) {
        const emp = await prisma.employee.findUnique({ where: { id: targetEmployeeId } });
        if (emp) targetDeptId = emp.departmentId;
      }
    } else {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Store Keepers and IT Technicians do not submit requisitions. Use Employee, Department Manager, or Admin accounts.',
      });
    }

    if (!targetDeptId) {
      return res.status(400).json({
        success: false,
        message: 'Target department ID is required',
      });
    }

    if (!targetEmployeeId) {
      // Find an active approved employee in target department
      const firstEmp = await prisma.employee.findFirst({
        where: {
          departmentId: targetDeptId,
          isActive: true,
          OR: [
            { user: null },
            { user: { status: 'APPROVED' } },
          ],
        },
      });
      if (!firstEmp) {
        return res.status(400).json({
          success: false,
          message: 'No active approved employee found in target department to assign requisition custody',
        });
      }
      targetEmployeeId = firstEmp.id;
    }

    const targetEmp = await prisma.employee.findUnique({
      where: { id: targetEmployeeId },
      include: { department: true, user: true },
    });

    if (!targetEmp || !targetEmp.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Target employee is either invalid or inactive',
      });
    }

    // Validate department membership
    if (targetEmp.departmentId !== targetDeptId) {
      return res.status(400).json({
        success: false,
        message: `Department mismatch: Employee '${targetEmp.name}' belongs to '${targetEmp.department?.name || targetEmp.departmentId}', not '${targetDeptId}'.`,
      });
    }

    // Validate account eligibility (APPROVED required; PENDING, REJECTED, SUSPENDED forbidden)
    if (targetEmp.user) {
      const userStatus = targetEmp.user.status;
      if (userStatus === 'PENDING' || userStatus === 'REJECTED' || userStatus === 'SUSPENDED') {
        return res.status(400).json({
          success: false,
          message: `Employee '${targetEmp.name}' cannot be assigned because their account status is '${userStatus}'. Only APPROVED employees can be assigned.`,
        });
      }
      if (userStatus !== 'APPROVED') {
        return res.status(400).json({
          success: false,
          message: `Employee '${targetEmp.name}' cannot be assigned because their account status is '${userStatus}'. Only APPROVED employees can be assigned.`,
        });
      }
    }

    // Generate requisition number
    const count = await prisma.resourceRequisition.count();
    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    const requisitionNumber = `REQ-${year}-${String(count + 1).padStart(4, '0')}-${rand}`;

    // Admin direct allocation check
    const isDirect = Boolean(userRole === 'ADMIN' && isDirectAllocation);
    const now = new Date();

    const createdReq = await prisma.resourceRequisition.create({
      data: {
        requisitionNumber,
        requesterId: user.id,
        requesterName: user.fullName || user.email,
        requesterRole: userRole,
        employeeId: targetEmp.id,
        departmentId: targetDeptId,
        category,
        itemDescription: itemDescription.trim(),
        justification: justification.trim(),
        urgency: urgency || 'ROUTINE',
        status: isDirect ? 'APPROVED' : 'PENDING',
        requiredDate: parsedRequiredDate,
        isDirectAllocation: isDirect,
        approvedById: isDirect ? user.id : null,
        approvedByName: isDirect ? user.fullName : null,
        approvedAt: isDirect ? now : null,
        approvalComments: isDirect ? 'Direct allocation initiated by Corporate Administration' : null,
      },
      include: {
        department: true,
        employee: true,
      },
    });

    // Notify relevant roles upon successful creation
    if (isDirect) {
      const storeKeepers = await findActiveUserIdsByRole(['STORE_KEEPER']);
      await safeNotifyUsers(storeKeepers, {
        title: `Direct Allocation Ready: ${createdReq.requisitionNumber}`,
        message: `Direct allocation of ${category} (${itemDescription.trim()}) for ${targetEmp.name} is approved and ready for warehouse fulfillment.`,
        type: 'REQUISITION',
        priority: 'HIGH',
        actionUrl: '/requisitions',
        relatedEntityType: 'REQUISITION',
        relatedEntityId: createdReq.id,
      });

      const empUserId = await resolveEmployeeUserId(targetEmp.id);
      if (empUserId && empUserId !== user.id) {
        await safeNotifyUser({
          recipientId: empUserId,
          title: `Direct Allocation Initiated: ${createdReq.requisitionNumber}`,
          message: `Corporate Administration initiated an asset allocation for ${itemDescription.trim()}.`,
          type: 'REQUISITION',
          priority: 'NORMAL',
          actionUrl: '/requisitions',
          relatedEntityType: 'REQUISITION',
          relatedEntityId: createdReq.id,
        });
      }
    } else {
      const adminAndStoreKeepers = await findActiveUserIdsByRole(['ADMIN', 'STORE_KEEPER']);
      const recipients = adminAndStoreKeepers.filter((id) => id !== user.id);
      await safeNotifyUsers(recipients, {
        title: `New Requisition: ${createdReq.requisitionNumber}`,
        message: `${user.fullName || user.email} submitted a request for ${category}: ${itemDescription.trim()} (${urgency || 'ROUTINE'}).`,
        type: 'REQUISITION',
        priority: urgency === 'CRITICAL' ? 'CRITICAL' : urgency === 'URGENT' ? 'HIGH' : 'NORMAL',
        actionUrl: '/requisitions',
        relatedEntityType: 'REQUISITION',
        relatedEntityId: createdReq.id,
      });
    }

    return res.status(201).json({
      success: true,
      message: isDirect
        ? 'Direct allocation initiated and approved. Store Keeper can now fulfill the physical asset.'
        : 'Requisition submitted successfully. Awaiting Administrator approval.',
      requisition: formatRequisition(createdReq),
    });
  } catch (err) {
    console.error('[POST /api/requisitions Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit requisition',
    });
  }
});

/**
 * POST /api/requisitions/:id/approve
 * Admin approves a pending requisition
 */
router.post('/:id/approve', requireAuth, requireRole(['ADMIN']), async (req: AppRequest, res: AppResponse) => {
  try {
    const { id } = req.params;
    const user = req.user!;
    const { approvalComments } = req.body || {};

    const reqItem = await prisma.resourceRequisition.findUnique({
      where: { id },
      include: { department: true, employee: true },
    });

    if (!reqItem) {
      return res.status(404).json({
        success: false,
        message: `Requisition with ID '${id}' not found`,
      });
    }

    if (reqItem.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Cannot approve requisition. Current status is '${reqItem.status}' (must be PENDING)`,
      });
    }

    const updated = await prisma.resourceRequisition.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById: user.id,
        approvedByName: user.fullName || user.email,
        approvedAt: new Date(),
        approvalComments: approvalComments ? String(approvalComments).trim() : 'Approved for warehouse fulfillment',
      },
      include: {
        department: true,
        employee: true,
      },
    });

    // Notify requesting employee
    const requesterUserId = reqItem.requesterId || (await resolveEmployeeUserId(reqItem.employeeId));
    if (requesterUserId) {
      await safeNotifyUser({
        recipientId: requesterUserId,
        title: `Requisition Approved: ${reqItem.requisitionNumber}`,
        message: `Your requisition for ${reqItem.itemDescription} was approved by ${user.fullName || 'Administrator'}. Ready for warehouse fulfillment.`,
        type: 'REQUISITION',
        priority: 'HIGH',
        actionUrl: `/requisitions?search=${encodeURIComponent(reqItem.requisitionNumber)}`,
        relatedEntityType: 'REQUISITION',
        relatedEntityId: reqItem.id,
      });
    }

    // Also notify Store Keepers
    const storeKeepers = await findActiveUserIdsByRole(['STORE_KEEPER']);
    await safeNotifyUsers(storeKeepers, {
      title: `Requisition Ready to Fulfill: ${reqItem.requisitionNumber}`,
      message: `Requisition ${reqItem.requisitionNumber} (${reqItem.category} - ${reqItem.itemDescription}) has been approved and is ready for fulfillment.`,
      type: 'REQUISITION',
      priority: 'NORMAL',
      actionUrl: '/requisitions',
      relatedEntityType: 'REQUISITION',
      relatedEntityId: reqItem.id,
    });

    return res.status(200).json({
      success: true,
      message: `Requisition '${reqItem.requisitionNumber}' approved. Ready for Store Keeper fulfillment.`,
      requisition: formatRequisition(updated),
    });
  } catch (err) {
    console.error('[POST /api/requisitions/:id/approve Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to approve requisition',
    });
  }
});

/**
 * POST /api/requisitions/:id/reject
 * Admin rejects a pending requisition with mandatory reason
 */
router.post('/:id/reject', requireAuth, requireRole(['ADMIN']), async (req: AppRequest, res: AppResponse) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'A rejection reason / comments is required (minimum 3 characters)',
      });
    }

    const reqItem = await prisma.resourceRequisition.findUnique({ where: { id } });

    if (!reqItem) {
      return res.status(404).json({
        success: false,
        message: `Requisition with ID '${id}' not found`,
      });
    }

    if (reqItem.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject requisition. Current status is '${reqItem.status}' (must be PENDING)`,
      });
    }

    const updated = await prisma.resourceRequisition.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason.trim(),
        rejectedAt: new Date(),
      },
      include: {
        department: true,
        employee: true,
      },
    });

    // Notify requesting employee
    const requesterUserId = reqItem.requesterId || (await resolveEmployeeUserId(reqItem.employeeId));
    if (requesterUserId) {
      await safeNotifyUser({
        recipientId: requesterUserId,
        title: `Requisition Rejected: ${reqItem.requisitionNumber}`,
        message: `Your requisition for ${reqItem.itemDescription} was rejected: ${reason.trim()}`,
        type: 'REQUISITION',
        priority: 'HIGH',
        actionUrl: '/requisitions',
        relatedEntityType: 'REQUISITION',
        relatedEntityId: reqItem.id,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Requisition '${reqItem.requisitionNumber}' rejected`,
      requisition: formatRequisition(updated),
    });
  } catch (err) {
    console.error('[POST /api/requisitions/:id/reject Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to reject requisition',
    });
  }
});

/**
 * POST /api/requisitions/:id/cancel
 * Requester or Admin cancels a pending requisition
 */
router.post('/:id/cancel', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const reqItem = await prisma.resourceRequisition.findUnique({ where: { id } });

    if (!reqItem) {
      return res.status(404).json({
        success: false,
        message: `Requisition with ID '${id}' not found`,
      });
    }

    if (reqItem.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Only PENDING requisitions can be cancelled. Current status is '${reqItem.status}'`,
      });
    }

    const isOwner = reqItem.requesterId === user.id || reqItem.employeeId === user.employeeRecordId;
    if (!isOwner && user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only cancel your own requisitions',
      });
    }

    const updated = await prisma.resourceRequisition.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: { department: true, employee: true },
    });

    return res.status(200).json({
      success: true,
      message: `Requisition '${reqItem.requisitionNumber}' cancelled`,
      requisition: formatRequisition(updated),
    });
  } catch (err) {
    console.error('[POST /api/requisitions/:id/cancel Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel requisition',
    });
  }
});

/**
 * POST /api/requisitions/:id/fulfill
 * STORE_KEEPER fulfills an approved requisition by selecting an actual AVAILABLE physical asset.
 * Admin may create direct allocations and approve requests, but must NOT physically fulfill them.
 */
router.post('/:id/fulfill', requireAuth, requireRole(['STORE_KEEPER']), async (req: AppRequest, res: AppResponse) => {
  try {
    const { id } = req.params;
    const user = req.user!;
    const { resourceId, handoverNotes, location } = req.body || {};

    if (!resourceId || typeof resourceId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Physical resource ID (resourceId) is required for fulfillment',
      });
    }

    const reqItem = await prisma.resourceRequisition.findUnique({
      where: { id },
      include: { department: true, employee: true },
    });

    if (!reqItem) {
      return res.status(404).json({
        success: false,
        message: `Requisition with ID '${id}' not found`,
      });
    }

    if (reqItem.status !== 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: `Requisition cannot be fulfilled because status is '${reqItem.status}'. Must be APPROVED by Administrator first.`,
      });
    }

    // Fetch and validate physical resource
    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
      include: { department: true },
    });

    if (!resource) {
      return res.status(404).json({
        success: false,
        message: `Resource with ID '${resourceId}' not found in registry`,
      });
    }

    if (resource.status !== 'AVAILABLE') {
      return res.status(400).json({
        success: false,
        message: `Resource '${resource.itemCode}' cannot be assigned because its status is '${resource.status}'. Only AVAILABLE resources can be allocated.`,
      });
    }

    if (resource.category !== reqItem.category) {
      return res.status(400).json({
        success: false,
        message: `Category mismatch: Requisition requires '${reqItem.category}', but selected resource '${resource.itemCode}' is '${resource.category}'.`,
      });
    }

    // Generate assignment number
    const asgnCount = await prisma.resourceAssignment.count();
    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    const assignmentNumber = `ASGN-${year}-${String(asgnCount + 1).padStart(4, '0')}-${rand}`;

    const now = new Date();
    const targetDeptId = reqItem.departmentId;

    // Fulfill atomically via transaction
    const result = await prisma.$transaction(async (tx) => {
      // Re-fetch and re-verify resource availability and category within transaction to avoid race conditions
      const currentResource = await tx.resource.findUnique({
        where: { id: resource.id },
      });

      if (!currentResource) {
        throw new Error(`Resource with ID '${resource.id}' not found in registry`);
      }

      if (currentResource.status !== 'AVAILABLE') {
        throw new Error(`Resource '${currentResource.itemCode}' cannot be assigned because its status is '${currentResource.status}'. Only AVAILABLE resources can be allocated.`);
      }

      if (currentResource.category !== reqItem.category) {
        throw new Error(`Category mismatch: Requisition requires '${reqItem.category}', but selected resource '${currentResource.itemCode}' is '${currentResource.category}'.`);
      }

      // 0. Ensure any prior assignments for this resource are not current
      await tx.resourceAssignment.updateMany({
        where: { resourceId: resource.id, isCurrent: true },
        data: { isCurrent: false },
      });

      // 1. Create ResourceAssignment
      const newAssignment = await tx.resourceAssignment.create({
        data: {
          assignmentNumber,
          resourceId: resource.id,
          employeeId: reqItem.employeeId,
          departmentId: targetDeptId,
          assignedByName: user.fullName || `${user.email} (${user.role})`,
          assignedById: user.id,
          assignedAt: now,
          expectedReturnDate: reqItem.requiredDate,
          purpose: `Requisition ${reqItem.requisitionNumber}: ${reqItem.itemDescription}`,
          notes: handoverNotes ? handoverNotes.trim() : reqItem.justification,
          status: 'ACTIVE',
          isCurrent: true,
        },
        include: {
          resource: true,
          employee: true,
          department: true,
        },
      });

      // 2. Update Resource status to ASSIGNED and set currentAssigneeId
      const updatedResource = await tx.resource.update({
        where: { id: resource.id },
        data: {
          status: 'ASSIGNED',
          currentAssigneeId: reqItem.employeeId,
          departmentId: targetDeptId,
          assignedAt: now,
          location: location ? location.trim() : resource.location,
        },
        include: {
          department: true,
          currentAssignee: true,
        },
      });

      // 3. Update Requisition status to FULFILLED
      const updatedRequisition = await tx.resourceRequisition.update({
        where: { id: reqItem.id },
        data: {
          status: 'FULFILLED',
          fulfilledResourceId: resource.id,
          fulfilledAssignmentId: newAssignment.id,
          fulfilledById: user.id,
          fulfilledByName: user.fullName || `${user.email} (${user.role})`,
          fulfilledAt: now,
          handoverNotes: handoverNotes ? handoverNotes.trim() : null,
        },
        include: {
          department: true,
          employee: true,
          fulfilledResource: true,
          fulfilledAssignment: true,
        },
      });

      return { newAssignment, updatedResource, updatedRequisition };
    });

    // Notify requesting employee
    const recipientUserId = reqItem.requesterId || (await resolveEmployeeUserId(reqItem.employeeId));
    if (recipientUserId) {
      await safeNotifyUser({
        recipientId: recipientUserId,
        title: `Requisition Fulfilled: ${reqItem.requisitionNumber}`,
        message: `Physical asset '${resource.name}' (${resource.itemCode}) has been allocated and handed over for your requisition.`,
        type: 'REQUISITION',
        priority: 'HIGH',
        actionUrl: `/requisitions?search=${encodeURIComponent(reqItem.requisitionNumber)}`,
        relatedEntityType: 'RESOURCE',
        relatedEntityId: resource.id,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Resource '${resource.itemCode}' successfully allocated and handed over to ${reqItem.employee.name}`,
      requisition: formatRequisition(result.updatedRequisition),
      assignment: result.newAssignment,
      resource: {
        id: result.updatedResource.id,
        itemCode: result.updatedResource.itemCode,
        status: result.updatedResource.status,
        currentAssigneeName: result.updatedResource.currentAssignee?.name,
      },
    });
  } catch (err: any) {
    console.error('[POST /api/requisitions/:id/fulfill Error]', err);
    if (err && typeof err.message === 'string' && (
      err.message.includes('cannot be assigned') ||
      err.message.includes('Category mismatch') ||
      err.message.includes('not found in registry')
    )) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to fulfill requisition',
    });
  }
});

export default router;

