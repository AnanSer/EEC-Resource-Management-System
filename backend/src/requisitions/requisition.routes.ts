import { Router } from '../http/router';
import { AppRequest, AppResponse } from '../http/types';
import { requireAuth, requireRole } from '../auth/auth.middleware';
import prisma from '../lib/prisma';
import { VALID_CATEGORIES } from '../resources/resource.routes';

const router = new Router();

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
    requiredDate: r.requiredDate ? r.requiredDate.toISOString().split('T')[0] : '',
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
    const limitNum = Math.max(1, Math.min(100, parseInt(limit || '50', 10)));
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
      // Find an active employee in target department
      const firstEmp = await prisma.employee.findFirst({
        where: { departmentId: targetDeptId, isActive: true },
      });
      if (!firstEmp) {
        return res.status(400).json({
          success: false,
          message: 'No active employee found in target department to assign requisition custody',
        });
      }
      targetEmployeeId = firstEmp.id;
    }

    const targetEmp = await prisma.employee.findUnique({
      where: { id: targetEmployeeId },
      include: { department: true },
    });

    if (!targetEmp || !targetEmp.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Target employee is either invalid or inactive',
      });
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
        requiredDate: requiredDate ? new Date(requiredDate) : undefined,
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
        message: `Resource '${resource.itemCode}' is currently '${resource.status}'. Only AVAILABLE resources can be allocated.`,
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
  } catch (err) {
    console.error('[POST /api/requisitions/:id/fulfill Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fulfill requisition',
    });
  }
});

export default router;

