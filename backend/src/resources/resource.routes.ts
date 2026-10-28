import { Router } from '../http/router';
import { AppRequest, AppResponse } from '../http/types';
import { requireAuth } from '../auth/auth.middleware';
import prisma from '../lib/prisma';

const router = new Router();

export const VALID_CATEGORIES = [
  'IT_EQUIPMENT',
  'VEHICLES',
  'HEAVY_MACHINERY',
  'SURVEYING_GEOTECHNICAL',
  'CAMP_FACILITY_FURNITURE',
  'OTHER',
];

export const VALID_STATUSES = [
  'AVAILABLE',
  'ASSIGNED',
  'MAINTENANCE',
  'TESTING',
  'RETIRED',
  'DISPOSED',
];

export const VALID_CONDITIONS = [
  'EXCELLENT',
  'GOOD',
  'FAIR',
  'NEEDS_REPAIR',
  'DAMGED',
  'RETIRED',
];

function formatResource(r: any) {
  const formatted: any = {
    id: r.id,
    itemCode: r.itemCode,
    name: r.name,
    category: r.category,
    subcategory: r.subcategory || 'Standard Equipment',
    description: r.description || '',
    manufacturer: r.manufacturer || '',
    model: r.model || '',
    serialNumber: r.serialNumber || '',
    status: r.status,
    condition: r.condition,
    location: r.location,
    departmentId: r.departmentId,
    department: r.department ? { id: r.department.id, name: r.department.name, code: r.department.code } : null,
    currentDepartmentId: r.departmentId,
    currentDepartmentName: r.department?.name || 'Central Warehouse',
    currentAssigneeId: r.currentAssigneeId || undefined,
    currentAssigneeName: r.currentAssignee?.name || undefined,
    assignedAt: r.assignedAt ? r.assignedAt.toISOString() : undefined,
    purchaseDate: r.purchaseDate ? r.purchaseDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    purchaseCostETB: r.purchaseCostETB ?? 0,
    currentValueETB: r.currentValueETB ?? 0,
    warrantyExpiry: r.warrantyExpiry ? r.warrantyExpiry.toISOString().split('T')[0] : undefined,
    supplier: r.supplier || undefined,
    notes: r.notes || '',
    createdAt: r.createdAt ? r.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: r.updatedAt ? r.updatedAt.toISOString() : new Date().toISOString(),
  };

  if (r.specs && typeof r.specs === 'object') {
    if (r.category === 'IT_EQUIPMENT') {
      formatted.itSpecs = r.specs;
    } else if (r.category === 'VEHICLES') {
      formatted.vehicleSpecs = r.specs;
    } else if (r.category === 'HEAVY_MACHINERY') {
      formatted.machinerySpecs = r.specs;
    } else if (r.category === 'SURVEYING_GEOTECHNICAL') {
      formatted.surveyingSpecs = r.specs;
    }
  }


  return formatted;
}


router.get('/metrics', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const userRole = req.user!.role;
    const userDeptId = req.user!.departmentId;

    let whereClause: any = {};
    if (userRole === 'DEPARTMENT_MANAGER' || userRole === 'EMPLOYEE') {
      if (!userDeptId) {
        return res.status(200).json({
          success: true,
          metrics: {
            totalAssets: 0,
            availableAssets: 0,
            assignedAssets: 0,
            maintenanceAssets: 0,
            testingAssets: 0,
            retiredAssets: 0,
            totalValueETB: 0,
            categoryCounts: {},
            statusCounts: {},
          },
        });
      }
      whereClause = { departmentId: userDeptId };
    }

    const allResources = await prisma.resource.findMany({
      where: whereClause,
      select: {
        category: true,
        status: true,
        currentValueETB: true,
      },
    });

    const totalAssets = allResources.length;
    let availableAssets = 0;
    let assignedAssets = 0;
    let maintenanceAssets = 0;
    let testingAssets = 0;
    let retiredAssets = 0;
    let totalValueETB = 0;

    const categoryCounts: Record<string, number> = {};
    const statusCounts: Record<string, number> = {};


    for (const r of allResources) {
      if (r.status === 'AVAILABLE') availableAssets++;
      else if (r.status === 'ASSIGNED') assignedAssets++;
      else if (r.status === 'MAINTENANCE') maintenanceAssets++;
      else if (r.status === 'TESTING') testingAssets++;
      else if (r.status === 'RETIRED' || r.status === 'DISPOSED') retiredAssets++;

      totalValueETB += r.currentValueETB || 0;
      categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1;
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    }

    return res.status(200).json({
      success: true,
      metrics: {
        totalAssets,
        availableAssets,
        assignedAssets,
        maintenanceAssets,
        testingAssets,
        retiredAssets,
        totalValueETB,
        categoryCounts,
        statusCounts,
      },
    });
  } catch (err) {
    console.error('[GET /api/resources/metrics Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to compute resource metrics',
    });
  }
});



router.get('/', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const userRole = req.user!.role;
    const userDeptId = req.user!.departmentId;

    const { search, category, status, departmentId, page, limit } = req.query || {};

    let filterRestriction: any = {};

    // Enforce server-side department boundary for Managers and Employees
    if (userRole === 'DEPARTMENT_MANAGER' || userRole === 'EMPLOYEE') {
      if (!userDeptId) {
        return res.status(200).json({
          success: true,
          resources: [],
          pagination: {
            total: 0,
            page: 1,
            limit: 20,
            totalPages: 0,
          },
        });
      }
      filterRestriction.departmentId = userDeptId;
    } else if (departmentId && departmentId !== 'ALL') {
      filterRestriction.departmentId = departmentId;
    }


    if (category && category !== 'ALL') {
      filterRestriction.category = category;
    }

    if (status && status !== 'ALL') {
      filterRestriction.status = status;
    }

    if (search && search.trim()) {
      const q = search.trim();
      filterRestriction.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { itemCode: { contains: q, mode: 'insensitive' } },
        { location: { contains: q, mode: 'insensitive' } },
        { manufacturer: { contains: q, mode: 'insensitive' } },
        { model: { contains: q, mode: 'insensitive' } },
        { serialNumber: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page || '1', 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit || '50', 10)));
    const skip = (pageNum - 1) * limitNum;


    const [total, rawResources] = await Promise.all([
      prisma.resource.count({ where: filterRestriction }),
      prisma.resource.findMany({
        where: filterRestriction,
        include: {
          department: true,
          currentAssignee: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
    ]);


    const formatted = rawResources.map(formatResource);

    return res.status(200).json({
      success: true,
      resources: formatted,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('[GET /api/resources Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve resources from registry',
    });
  }
});



router.get('/:id', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const targetId = req.params!.id;
    const userRole = req.user!.role;
    const userDeptId = req.user!.departmentId;

    // Find by ID or itemCode
    const resource = await prisma.resource.findFirst({
      where: {
        OR: [{ id: targetId }, { itemCode: targetId }],
      },
      include: {
        department: true,
        currentAssignee: true,
      },
    });


    if (!resource) {
      return res.status(404).json({
        success: false,
        message: `Resource '${targetId}' not found in corporate registry`,
      });
    }


    // Enforce department boundary access control
    if (userRole === 'DEPARTMENT_MANAGER' || userRole === 'EMPLOYEE') {
      if (resource.departmentId !== userDeptId) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Department boundary access denied. You may only view resources within your assigned directorate.',
        });
      }
    }

    return res.status(200).json({
      success: true,
      resource: formatResource(resource),
    });
  } catch (err) {
    console.error('[GET /api/resources/:id Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve resource details',
    });
  }
});



router.post('/', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const userRole = req.user!.role;
    const userDeptId = req.user!.departmentId;

    // Requirement 7: ADMIN, STORE_KEEPER, or DEPARTMENT_MANAGER may register new items
    if (userRole !== 'ADMIN' && userRole !== 'STORE_KEEPER' && userRole !== 'DEPARTMENT_MANAGER') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to register new assets in the registry',
      });
    }


    const {
      itemCode,
      name,
      category,
      subcategory,
      description,
      manufacturer,
      model,
      serialNumber,
      condition,
      location,
      departmentId,
      purchaseDate,
      purchaseCostETB,
      currentValueETB,
      warrantyExpiry,
      supplier,
      notes,
      specs,
      itSpecs,
      vehicleSpecs,
      machinerySpecs,
      surveyingSpecs,
    } = req.body || {};


    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Resource name is required (minimum 2 characters)',
      });
    }


    if (!category || !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Invalid resource category '${category}'. Must be one of: [${VALID_CATEGORIES.join(', ')}]`,
      });
    }


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
          message: 'Forbidden: Department managers may only register resources within their own directorate',
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

    const dept = await prisma.department.findUnique({ where: { id: targetDeptId } });
    if (!dept) {
      return res.status(400).json({
        success: false,
        message: `Department with ID '${targetDeptId}' does not exist in directory`,
      });
    }


    let finalCode = itemCode ? String(itemCode).trim().toUpperCase() : '';
    if (!finalCode) {
      const prefix =
        category === 'IT_EQUIPMENT' ? 'EEC-IT' :
        category === 'VEHICLES' ? 'EEC-VEHC' :
        category === 'HEAVY_MACHINERY' ? 'EEC-MACH' :
        category === 'SURVEYING_GEOTECHNICAL' ? 'EEC-SURV' :
        category === 'CAMP_FACILITY_FURNITURE' ? 'EEC-FURN' : 'EEC-RES';
      const year = new Date().getFullYear();
      const rand = Math.floor(1000 + Math.random() * 9000);
      finalCode = `${prefix}-${year}-${rand}`;
    }


    const existingCode = await prisma.resource.findUnique({ where: { itemCode: finalCode } });
    if (existingCode) {
      return res.status(409).json({
        success: false,
        message: `Resource with asset code '${finalCode}' already exists in registry`,
      });
    }


    const reqHighStatus = req.body.status;
    if (reqHighStatus && reqHighStatus !== 'AVAILABLE' && reqHighStatus !== 'RETIRED') {
      return res.status(400).json({
        success: false,
        message: 'New assets may only be registered with AVAILABLE status. Assignment or Maintenance statuses require their respective workflows.',
      });
    }


    const finalCondition = condition && VALID_CONDITIONS.includes(condition) ? condition : 'EXCELLENT';
    const combinedSpecs = specs || itSpecs || vehicleSpecs || machinerySpecs || surveyingSpecs || null;


    const created = await prisma.resource.create({
      data: {
        itemCode: finalCode,
        name: name.trim(),
        category,
        subcategory: subcategory ? subcategory.trim() : null,
        description: description ? description.trim() : null,
        manufacturer: manufacturer ? manufacturer.trim() : null,
        model: model ? model.trim() : null,
        serialNumber: serialNumber ? serialNumber.trim() : null,
        status: reqHighStatus || 'AVAILABLE',
        condition: finalCondition,
        location: location ? location.trim() : 'Central Store - Kersa',
        departmentId: targetDeptId,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
        purchaseCostETB: purchaseCostETB ? Number(purchaseCostETB) : 0,
        currentValueETB: currentValueETB ? Number(currentValueETB) : (purchaseCostETB ? Number(purchaseCostETB) : 0),
        warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
        supplier: supplier ? supplier.trim() : null,
        notes: notes ? notes.trim() : null,
        specs: combinedSpecs,
      },
      include: {
        department: true,
        currentAssignee: true,
      },
    });


    return res.status(201).json({
      success: true,
      message: 'Resource registered successfully',
      resource: formatResource(created),
    });
  } catch (err) {
    console.error('[POST /api/resources Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to register new resource',
    });
  }
});



router.put('/:id', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const targetId = req.params!.id;
    const userRole = req.user!.role;
    const userDeptId = req.user!.departmentId;

    if (userRole === 'EMPLOYEE') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to edit resource records',
      });
    }

    const existing = await prisma.resource.findFirst({
      where: {
        OR: [{ id: targetId }, { itemCode: targetId }],
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `Resource '${targetId}' not found in corporate registry`,
      });
    }


    if (userRole === 'DEPARTMENT_MANAGER') {
      if (existing.departmentId !== userDeptId) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Department managers may only modify resources within their own directorate',
        });
      }
    }


    const {
      itemCode,
      name,
      category,
      subcategory,
      description,
      manufacturer,
      model,
      serialNumber,
      status,
      condition,
      location,
      departmentId,
      purchaseDate,
      purchaseCostETB,
      currentValueETB,
      warrantyExpiry,
      supplier,
      notes,
      specs,
      itSpecs,
      vehicleSpecs,
      machinerySpecs,
      surveyingSpecs,
    } = req.body || {};


    if (status && status !== existing.status) {
      if (status === 'ASSIGNED' || status === 'MAINTENANCE' || status === 'TESTING') {
        return res.status(400).json({
          success: false,
          message: `Status transitions to ${status} must be initiated through their respective workflows (Custody Assignment or Maintenance Ticket).`,
        });
      }

      if (existing.status === 'ASSIGNED' && status === 'AVAILABLE') {
        return res.status(400).json({
          success: false,
          message: 'Cannot directly set status to AVAILABLE while assigned to personnel. A return workflow must be completed.',
        });
      }
    }


    if (departmentId && departmentId !== existing.departmentId) {
      if (userRole === 'DEPARTMENT_MANAGER') {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Department managers cannot transfer assets across directorates',
        });
      }
      const dept = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!dept) {
        return res.status(400).json({
          success: false,
          message: `Target department '${departmentId}' does not exist`,
        });
      }
    }


    if (itemCode && itemCode.trim().toUpperCase() !== existing.itemCode) {
      const dupCode = await prisma.resource.findUnique({
        where: { itemCode: itemCode.trim().toUpperCase() },
      });
      if (dupCode && dupCode.id !== existing.id) {
        return res.status(409).json({
          success: false,
          message: `Resource code '${itemCode.trim().toUpperCase()}' is already in use`,
        });
      }
    }


    const combinedSpecs = specs || itSpecs || vehicleSpecs || machinerySpecs || surveyingSpecs || undefined;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (itemCode !== undefined) updateData.itemCode = itemCode.trim().toUpperCase();
    if (category !== undefined && VALID_CATEGORIES.includes(category)) updateData.category = category;
    if (subcategory !== undefined) updateData.subcategory = subcategory ? subcategory.trim() : null;
    if (description !== undefined) updateData.description = description ? description.trim() : null;
    if (manufacturer !== undefined) updateData.manufacturer = manufacturer ? manufacturer.trim() : null;
    if (model !== undefined) updateData.model = model ? model.trim() : null;
    if (serialNumber !== undefined) updateData.serialNumber = serialNumber ? serialNumber.trim() : null;
    if (status !== undefined) updateData.status = status;
    if (condition !== undefined && VALID_CONDITIONS.includes(condition)) updateData.condition = condition;
    if (location !== undefined) updateData.location = location ? location.trim() : existing.location;
    if (departmentId !== undefined) updateData.departmentId = departmentId;
    if (purchaseDate !== undefined) updateData.purchaseDate = purchaseDate ? new Date(purchaseDate) : null;
    if (purchaseCostETB !== undefined) updateData.purchaseCostETB = Number(purchaseCostETB);
    if (currentValueETB !== undefined) updateData.currentValueETB = Number(currentValueETB);
    if (warrantyExpiry !== undefined) updateData.warrantyExpiry = warrantyExpiry ? new Date(warrantyExpiry) : null;
    if (supplier !== undefined) updateData.supplier = supplier ? supplier.trim() : null;
    if (notes !== undefined) updateData.notes = notes ? notes.trim() : null;
    if (combinedSpecs !== undefined) updateData.specs = combinedSpecs;

    const updated = await prisma.resource.update({
      where: { id: existing.id },
      data: updateData,
      include: {
        department: true,
        currentAssignee: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Resource updated successfully',
      resource: formatResource(updated),
    });
  } catch (err) {
    console.error('[PUT /api/resources/:id Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update resource',
    });
  }
});



router.delete('/:id', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const targetId = req.params!.id;
    const userRole = req.user!.role;

    // Requirement 7: Only ADMIN can delete registry records
    if (userRole !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only system administrators can delete resources from the registry',
      });
    }

    const existing = await prisma.resource.findFirst({
      where: {
        OR: [{ id: targetId }, { itemCode: targetId }],
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `Resource '${targetId}' not found in corporate registry`,
      });
    }

    if (existing.status === 'ASSIGNED' || existing.currentAssigneeId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a resource that is currently assigned to personnel',
      });
    }

    await prisma.resource.delete({ where: { id: existing.id } });

    return res.status(200).json({
      success: true,
      message: `Resource ${existing.itemCode} deleted from registry successfully`,
    });
  } catch (err) {
    console.error('[DELETE /api/resources/:id Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete resource',
    });
  }
});

export default router;
