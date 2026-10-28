import { Router } from '../http/router';
import { AppRequest, AppResponse } from '../http/types';
import { requireAuth, requireRole } from '../auth/auth.middleware';
import prisma from '../lib/prisma';

const router = new Router();

/**
 * GET /api/departments
 * List departments.
 * - ADMIN, STORE_KEEPER, IT_TECHNICIAN: all corporate directorates.
 * - DEPARTMENT_MANAGER: strictly scoped to their assigned department.
 * - EMPLOYEE: strictly scoped to their assigned department.
 */
router.get('/', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const userRole = req.user!.role;
    const userDeptId = req.user!.departmentId;

    let whereClause: any = undefined;

    if (userRole === 'DEPARTMENT_MANAGER' || userRole === 'EMPLOYEE') {
      if (!userDeptId) {
        return res.status(200).json({ success: true, departments: [] });
      }
      whereClause = { id: userDeptId };
    }

    const depts = await prisma.department.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { employees: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const formatted = depts.map(d => ({
      id: d.id,
      name: d.name,
      code: d.code,
      description: d.description || '',
      managerName: d.managerName || undefined,
      location: d.location || 'Headquarters',
      employeeCount: d._count.employees,
      assetCount: 0,
      budgetCode: d.budgetCode || undefined,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    }));

    return res.status(200).json({
      success: true,
      departments: formatted,
    });
  } catch (err: any) {
    console.error('[EEC-RMS Departments] List error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve departments',
    });
  }
});

/**
 * GET /api/departments/:id
 * Retrieve specific department by ID.
 * Department Managers and Employees can only query their own assigned department.
 */
router.get('/:id', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const targetId = req.params.id;
    const userRole = req.user!.role;
    const userDeptId = req.user!.departmentId;

    if (userRole === 'DEPARTMENT_MANAGER' || userRole === 'EMPLOYEE') {
      if (userDeptId !== targetId) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Department boundary access denied. You may only view your assigned directorate.',
        });
      }
    }

    const dept = await prisma.department.findUnique({
      where: { id: targetId },
      include: {
        _count: {
          select: { employees: true },
        },
      },
    });

    if (!dept) {
      return res.status(404).json({
        success: false,
        message: `Department with ID '${targetId}' not found`,
      });
    }

    return res.status(200).json({
      success: true,
      department: {
        id: dept.id,
        name: dept.name,
        code: dept.code,
        description: dept.description || '',
        managerName: dept.managerName || undefined,
        location: dept.location || 'Headquarters',
        employeeCount: dept._count.employees,
        assetCount: 0,
        budgetCode: dept.budgetCode || undefined,
        createdAt: dept.createdAt.toISOString(),
        updatedAt: dept.updatedAt.toISOString(),
      },
    });
  } catch (err: any) {
    console.error('[EEC-RMS Departments] Get error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve department',
    });
  }
});

/**
 * POST /api/departments
 * Create new corporate directorate. ADMIN only.
 */
router.post('/', requireRole(['ADMIN']), async (req: AppRequest, res: AppResponse) => {
  try {
    const { name, code, description, managerName, location, budgetCode } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Department name is required and must be at least 2 characters',
      });
    }

    if (!code || typeof code !== 'string' || code.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Department corporate code is required (e.g. TID, WRI)',
      });
    }

    const trimmedName = name.trim();
    const sanitizedCode = code.trim().toUpperCase();

    // Check duplicate name or code
    const existing = await prisma.department.findFirst({
      where: {
        OR: [
          { name: { equals: trimmedName, mode: 'insensitive' } },
          { code: sanitizedCode },
        ],
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A department with name '${trimmedName}' or code '${sanitizedCode}' already exists`,
      });
    }

    const created = await prisma.department.create({
      data: {
        name: trimmedName,
        code: sanitizedCode,
        description: description ? String(description).trim() : null,
        managerName: managerName ? String(managerName).trim() : null,
        location: location ? String(location).trim() : null,
        budgetCode: budgetCode ? String(budgetCode).trim() : null,
      },
    });

    return res.status(201).json({
      success: true,
      message: `Department '${created.name}' created successfully`,
      department: {
        id: created.id,
        name: created.name,
        code: created.code,
        description: created.description || '',
        managerName: created.managerName || undefined,
        location: created.location || 'Headquarters',
        employeeCount: 0,
        assetCount: 0,
        budgetCode: created.budgetCode || undefined,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
    });
  } catch (err: any) {
    console.error('[EEC-RMS Departments] Create error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create department',
    });
  }
});

/**
 * PUT /api/departments/:id
 * Update corporate directorate. ADMIN only.
 */
router.put('/:id', requireRole(['ADMIN']), async (req: AppRequest, res: AppResponse) => {
  try {
    const targetId = req.params.id;
    const { name, code, description, managerName, location, budgetCode } = req.body || {};

    const existing = await prisma.department.findUnique({
      where: { id: targetId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `Department with ID '${targetId}' not found`,
      });
    }

    // Check code/name collision if updated
    if (code && code.trim().toUpperCase() !== existing.code) {
      const codeClash = await prisma.department.findUnique({
        where: { code: code.trim().toUpperCase() },
      });
      if (codeClash) {
        return res.status(409).json({
          success: false,
          message: `Department code '${code}' is already used by another department`,
        });
      }
    }

    const updated = await prisma.department.update({
      where: { id: targetId },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(code ? { code: code.trim().toUpperCase() } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(managerName !== undefined ? { managerName: managerName?.trim() || null } : {}),
        ...(location !== undefined ? { location: location?.trim() || null } : {}),
        ...(budgetCode !== undefined ? { budgetCode: budgetCode?.trim() || null } : {}),
      },
      include: {
        _count: {
          select: { employees: true },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Department updated successfully',
      department: {
        id: updated.id,
        name: updated.name,
        code: updated.code,
        description: updated.description || '',
        managerName: updated.managerName || undefined,
        location: updated.location || 'Headquarters',
        employeeCount: updated._count.employees,
        assetCount: 0,
        budgetCode: updated.budgetCode || undefined,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (err: any) {
    console.error('[EEC-RMS Departments] Update error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update department',
    });
  }
});

/**
 * DELETE /api/departments/:id
 * Delete corporate directorate. ADMIN only.
 */
router.delete('/:id', requireRole(['ADMIN']), async (req: AppRequest, res: AppResponse) => {
  try {
    const targetId = req.params.id;

    const existing = await prisma.department.findUnique({
      where: { id: targetId },
      include: {
        _count: {
          select: { employees: true, users: true },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `Department with ID '${targetId}' not found`,
      });
    }

    if (existing._count.employees > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete department with ${existing._count.employees} assigned personnel. Reassign personnel before deleting.`,
      });
    }

    await prisma.department.delete({
      where: { id: targetId },
    });

    return res.status(200).json({
      success: true,
      message: `Department '${existing.name}' was removed successfully`,
    });
  } catch (err: any) {
    console.error('[EEC-RMS Departments] Delete error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete department',
    });
  }
});

export default router;
