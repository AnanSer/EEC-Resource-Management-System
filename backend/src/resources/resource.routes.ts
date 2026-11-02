import { Router } from '../http/router';
import { AppRequest, AppResponse } from '../http/types';
import { requireAuth } from '../auth/auth.middleware';
import prisma from '../lib/prisma';
import { recordAuditEvent } from '../audit/audit.service';

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
    serialNumber: r.serialNumber || (r.specs && typeof r.specs === 'object' ? (r.specs.serialNumber || r.specs.chassisNumber || '') : '') || '',
    status: r.status,
    condition: r.condition,
    location: r.location,
    departmentId: r.departmentId,
    department: r.department ? { id: r.department.id, name: r.department.name, code: r.department.code } : null,
    currentDepartmentId: r.departmentId,
    currentDepartmentName: r.department?.name || 'Central Warehouse',
    currentAssigneeId: r.currentAssigneeId || null,
    currentAssigneeName: r.currentAssignee?.name || undefined,
    currentAssigneeEmployeeId: r.currentAssignee?.employeeId || undefined,
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
    formatted.specs = r.specs;
    if (r.category === 'IT_EQUIPMENT') {
      formatted.itSpecs = r.specs;
    } else if (r.category === 'VEHICLES') {
      formatted.vehicleSpecs = r.specs;
    } else if (r.category === 'HEAVY_MACHINERY') {
      formatted.machinerySpecs = r.specs;
    } else if (r.category === 'SURVEYING_GEOTECHNICAL') {
      formatted.surveyingSpecs = r.specs;
    } else if (r.category === 'CAMP_FACILITY_FURNITURE') {
      formatted.furnitureSpecs = r.specs;
    }
  }


  return formatted;
}


router.get('/metrics', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const userRole = req.user!.role;
    const userDeptId = req.user!.departmentId;
    const isDepartmentScoped = (userRole === 'DEPARTMENT_MANAGER' || userRole === 'EMPLOYEE');

    let whereClause: any = {};
    if (isDepartmentScoped) {
      if (!userDeptId) {
        return res.status(200).json({
          success: true,
          metrics: {
            scope: 'DEPARTMENT',
            departmentId: null,
            departmentName: null,
            departmentCode: null,
            totalAssets: 0,
            availableAssets: 0,
            assignedAssets: 0,
            maintenanceAssets: 0,
            testingAssets: 0,
            retiredAssets: 0,
            totalValueETB: 0,
            utilizationRate: 0,
            categoryCounts: {},
            categoryValues: {},
            categoryPercentages: {},
            statusCounts: {},
          },
        });
      }
      whereClause = { departmentId: userDeptId };
    } else if (req.query?.departmentId && req.query.departmentId !== 'ALL') {
      whereClause = { departmentId: req.query.departmentId };
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
    const categoryValues: Record<string, number> = {};
    const statusCounts: Record<string, number> = {};

    for (const r of allResources) {
      if (r.status === 'AVAILABLE') availableAssets++;
      else if (r.status === 'ASSIGNED') assignedAssets++;
      else if (r.status === 'MAINTENANCE') maintenanceAssets++;
      else if (r.status === 'TESTING') testingAssets++;
      else if (r.status === 'RETIRED' || r.status === 'DISPOSED') retiredAssets++;

      const val = r.currentValueETB || 0;
      totalValueETB += val;
      categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1;
      categoryValues[r.category] = (categoryValues[r.category] || 0) + val;
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    }

    const utilizationRate = totalAssets > 0 ? Number(((assignedAssets / totalAssets) * 100).toFixed(1)) : 0;

    const categoryPercentages: Record<string, number> = {};
    for (const cat of Object.keys(categoryValues)) {
      categoryPercentages[cat] = totalValueETB > 0
        ? Number(((categoryValues[cat] / totalValueETB) * 100).toFixed(1))
        : 0;
    }

    return res.status(200).json({
      success: true,
      metrics: {
        scope: isDepartmentScoped ? 'DEPARTMENT' : 'CORPORATION',
        departmentId: isDepartmentScoped ? userDeptId : (whereClause.departmentId || null),
        departmentName: isDepartmentScoped ? (req.user!.departmentName || null) : null,
        departmentCode: isDepartmentScoped ? (req.user!.departmentCode || null) : null,
        totalAssets,
        availableAssets,
        assignedAssets,
        maintenanceAssets,
        testingAssets,
        retiredAssets,
        totalValueETB,
        utilizationRate,
        categoryCounts,
        categoryValues,
        categoryPercentages,
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
    const limitNum = Math.max(1, Math.min(500, parseInt(limit || '50', 10)));
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

/**
 * GET /api/resources/return-eligible
 * Return only resources that have genuine active custody.
 */
router.get('/return-eligible', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const userRole = req.user!.role;
    const userDeptId = req.user!.departmentId;
    const { search, departmentId } = req.query || {};

    let filter: any = {
      isCurrent: true,
      status: 'ACTIVE',
      resource: {
        status: 'ASSIGNED',
      },
    };

    if (userRole === 'DEPARTMENT_MANAGER') {
      if (!userDeptId) {
        return res.status(200).json({
          success: true,
          resources: [],
          total: 0,
        });
      }
      filter.departmentId = userDeptId;
    } else if (departmentId && departmentId !== 'ALL') {
      filter.departmentId = departmentId;
    }

    const rawActive = await prisma.resourceAssignment.findMany({
      where: filter,
      include: {
        resource: {
          include: {
            department: true,
            currentAssignee: true,
          },
        },
        employee: true,
        department: true,
      },
      orderBy: [{ assignedAt: 'desc' }],
    });

    const genuineHoldings = rawActive.filter(
      (a) => a.resource && a.resource.status === 'ASSIGNED' && a.resource.currentAssigneeId === a.employeeId
    );

    let eligibleResources = genuineHoldings.map((a) => {
      const formatted = formatResource(a.resource);
      return {
        ...formatted,
        currentDepartmentId: a.departmentId,
        currentDepartmentName: a.department?.name || formatted.currentDepartmentName,
        currentAssigneeId: a.employee.id,
        currentAssigneeName: a.employee.name,
        currentAssigneeEmployeeId: a.employee.employeeId,
        activeAssignmentId: a.id,
        activeAssignmentNumber: a.assignmentNumber,
      };
    });

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      eligibleResources = eligibleResources.filter((r) => {
        const itemCode = (r.itemCode || '').toLowerCase();
        const name = (r.name || '').toLowerCase();
        const serial = (r.serialNumber || '').toLowerCase();
        const custodian = (r.currentAssigneeName || '').toLowerCase();
        const empId = (r.currentAssigneeEmployeeId || '').toLowerCase();
        const dept = (r.currentDepartmentName || '').toLowerCase();

        return (
          itemCode.includes(q) ||
          name.includes(q) ||
          serial.includes(q) ||
          custodian.includes(q) ||
          empId.includes(q) ||
          dept.includes(q)
        );
      });
    }

    return res.status(200).json({
      success: true,
      resources: eligibleResources,
      total: eligibleResources.length,
    });
  } catch (err) {
    console.error('[GET /api/resources/return-eligible Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve return-eligible assigned resources',
    });
  }
});

/**
 * GET /api/resources/my-assets
 * Retrieve physical assets currently assigned to the logged-in employee
 */
router.get('/my-assets', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const user = req.user!;
    let employee = null;
    if (user.employeeRecordId) {
      employee = await prisma.employee.findUnique({
        where: { id: user.employeeRecordId },
      });
    }
    if (!employee) {
      employee = await prisma.employee.findFirst({
        where: {
          OR: [{ userId: user.id }, { email: user.email }],
        },
      });
    }

    if (!employee) {
      return res.status(200).json({
        success: true,
        resources: [],
        total: 0,
      });
    }

    const resources = await prisma.resource.findMany({
      where: {
        currentAssigneeId: employee.id,
        status: 'ASSIGNED',
      },
      include: {
        department: true,
        currentAssignee: true,
      },
      orderBy: { assignedAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      resources: resources.map(formatResource),
      total: resources.length,
    });
  } catch (err) {
    console.error('[GET /api/resources/my-assets Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve personal assigned assets',
    });
  }
});

router.get('/:id', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const targetId = req.params!.id;
    const user = req.user!;
    const userRole = user.role;
    const userDeptId = user.departmentId;

    // 1. Find by ID or itemCode
    let resource = await prisma.resource.findFirst({
      where: {
        OR: [{ id: targetId }, { itemCode: targetId }],
      },
      include: {
        department: true,
        currentAssignee: true,
      },
    });

    // 2. If not found directly, check if targetId was an assignment ID
    if (!resource) {
      const asgn = await prisma.resourceAssignment.findUnique({
        where: { id: targetId },
        include: {
          resource: {
            include: {
              department: true,
              currentAssignee: true,
            },
          },
        },
      });
      if (asgn?.resource) {
        resource = asgn.resource;
      }
    }

    if (!resource) {
      return res.status(404).json({
        success: false,
        message: `Resource '${targetId}' not found in corporate registry`,
      });
    }

    let isHistoricalAccess = false;
    let historicalAssignment: any = null;

    // Enforce department boundary access control
    if (userRole === 'DEPARTMENT_MANAGER' || userRole === 'EMPLOYEE') {
      if (resource.departmentId !== userDeptId) {
        // Check if the authenticated user has legitimate historical custody on this resource
        let empRecordId = user.employeeRecordId;
        if (!empRecordId) {
          const emp = await prisma.employee.findFirst({
            where: { OR: [{ userId: user.id }, { email: user.email }] },
          });
          empRecordId = emp?.id;
        }

        if (empRecordId) {
          historicalAssignment = await prisma.resourceAssignment.findFirst({
            where: {
              resourceId: resource.id,
              employeeId: empRecordId,
            },
            include: {
              department: true,
              employee: true,
            },
            orderBy: { assignedAt: 'desc' },
          });
        }

        if (historicalAssignment) {
          isHistoricalAccess = true;
        } else {
          return res.status(403).json({
            success: false,
            message: 'Forbidden: Department boundary access denied. You may only view resources within your assigned directorate or those previously in your custody.',
          });
        }
      }
    }

    const formatted = formatResource(resource);
    if (isHistoricalAccess && historicalAssignment) {
      formatted.historicalContext = {
        isHistoricalAccess: true,
        assignmentNumber: historicalAssignment.assignmentNumber,
        historicalAssigneeId: historicalAssignment.employeeId,
        historicalAssigneeName: historicalAssignment.employee?.name,
        assignmentDepartmentId: historicalAssignment.departmentId,
        assignmentDepartmentName: historicalAssignment.department?.name,
        assignedAt: historicalAssignment.assignedAt ? historicalAssignment.assignedAt.toISOString() : undefined,
        returnedAt: historicalAssignment.returnedAt ? historicalAssignment.returnedAt.toISOString() : undefined,
        expectedReturnDate: historicalAssignment.expectedReturnDate ? historicalAssignment.expectedReturnDate.toISOString().split('T')[0] : undefined,
        purpose: historicalAssignment.purpose,
        conclusionStatus: historicalAssignment.status,
        conditionOnAssignment: historicalAssignment.conditionOnAssignment,
        conditionOnReturn: historicalAssignment.returnCondition,
        returnLocation: historicalAssignment.returnLocation,
        returnNotes: historicalAssignment.returnNotes,
        returnReceivedByName: historicalAssignment.returnReceivedByName,
        isCurrentCustodian: false,
      };
    }

    return res.status(200).json({
      success: true,
      resource: formatted,
    });
  } catch (err) {
    console.error('[GET /api/resources/:id Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve resource details',
    });
  }
});



const CATEGORY_CODE_PREFIX: Record<string, string> = {
  IT_EQUIPMENT: 'EEC-IT',
  VEHICLES: 'EEC-VEHC',
  HEAVY_MACHINERY: 'EEC-MACH',
  SURVEYING_GEOTECHNICAL: 'EEC-SURV',
  CAMP_FACILITY_FURNITURE: 'EEC-FURN',
  OTHER: 'EEC-RES',
};

async function generateNextItemCode(category: string): Promise<string> {
  const prefix = CATEGORY_CODE_PREFIX[category] || 'EEC-RES';
  const year = new Date().getFullYear();
  const prefixYear = `${prefix}-${year}`;

  const existing = await prisma.resource.findMany({
    where: {
      itemCode: { startsWith: `${prefixYear}-` },
    },
    select: { itemCode: true },
  });

  const existingCodes = new Set(existing.map((r) => r.itemCode.toUpperCase()));
  let maxSeq = 0;
  for (const r of existing) {
    const parts = r.itemCode.split('-');
    const lastPart = parts[parts.length - 1];
    const num = parseInt(lastPart, 10);
    if (!isNaN(num) && num > maxSeq) {
      maxSeq = num;
    }
  }

  let candidateSeq = Math.max(maxSeq + 1, 1);
  let candidateCode = `${prefixYear}-${String(candidateSeq).padStart(3, '0')}`;
  while (existingCodes.has(candidateCode)) {
    candidateSeq++;
    candidateCode = `${prefixYear}-${String(candidateSeq).padStart(3, '0')}`;
  }

  return candidateCode;
}

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
      furnitureSpecs,
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

    // Protect Custody and Status: New resources must ALWAYS start as AVAILABLE
    const reqHighStatus = req.body.status;
    if (reqHighStatus && reqHighStatus !== 'AVAILABLE') {
      return res.status(400).json({
        success: false,
        message: 'New resources must always be registered with AVAILABLE status. Custody assignment and maintenance must follow their respective corporate workflows.',
      });
    }

    // Validate Cost Values
    const rawCost = purchaseCostETB !== undefined ? purchaseCostETB : req.body.purchaseCost;
    let parsedCost = 0;
    if (rawCost !== undefined && rawCost !== null && rawCost !== '') {
      parsedCost = Number(rawCost);
      if (isNaN(parsedCost) || parsedCost < 0) {
        return res.status(400).json({
          success: false,
          message: 'Purchase cost must be a valid non-negative number',
        });
      }
    }

    const rawCurrentValue = currentValueETB !== undefined ? currentValueETB : req.body.currentValue;
    let parsedCurrentValue = parsedCost;
    if (rawCurrentValue !== undefined && rawCurrentValue !== null && rawCurrentValue !== '') {
      parsedCurrentValue = Number(rawCurrentValue);
      if (isNaN(parsedCurrentValue) || parsedCurrentValue < 0) {
        return res.status(400).json({
          success: false,
          message: 'Current asset value must be a valid non-negative number',
        });
      }
    }

    // Validate Dates
    let parsedPurchaseDate: Date = new Date();
    if (purchaseDate) {
      const parsed = new Date(purchaseDate);
      if (isNaN(parsed.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid purchase date format',
        });
      }
      parsedPurchaseDate = parsed;
    }

    let parsedWarrantyExpiry: Date | null = null;
    if (warrantyExpiry) {
      const parsed = new Date(warrantyExpiry);
      if (isNaN(parsed.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid warranty expiry date format',
        });
      }
      parsedWarrantyExpiry = parsed;
    }

    // Determine Effective Serial Number
    const rawSerial = serialNumber !== undefined && serialNumber !== null ? String(serialNumber).trim() : '';
    const specsSerial = specs?.serialNumber || itSpecs?.serialNumber || machinerySpecs?.serialNumber || surveyingSpecs?.serialNumber;
    const rawSpecsSerial = specsSerial !== undefined && specsSerial !== null ? String(specsSerial).trim() : '';
    const specsChassis = specs?.chassisNumber || vehicleSpecs?.chassisNumber;
    const rawChassis = specsChassis !== undefined && specsChassis !== null ? String(specsChassis).trim() : '';

    const effectiveSerial = rawSerial || rawSpecsSerial || rawChassis || null;

    // Prevent duplicate serial numbers when provided
    if (effectiveSerial) {
      const existingWithSerial = await prisma.resource.findFirst({
        where: {
          status: { not: 'DISPOSED' },
          serialNumber: { equals: effectiveSerial, mode: 'insensitive' },
        },
        select: { id: true, itemCode: true, name: true, serialNumber: true },
      });

      if (existingWithSerial) {
        return res.status(409).json({
          success: false,
          message: `A resource with serial number '${effectiveSerial}' already exists in registry (${existingWithSerial.itemCode} - ${existingWithSerial.name})`,
        });
      }
    }

    if (rawChassis && effectiveSerial && rawChassis.toLowerCase() !== effectiveSerial.toLowerCase()) {
      const existingWithChassis = await prisma.resource.findFirst({
        where: {
          status: { not: 'DISPOSED' },
          serialNumber: { equals: rawChassis, mode: 'insensitive' },
        },
        select: { id: true, itemCode: true, name: true, serialNumber: true },
      });

      if (existingWithChassis) {
        return res.status(409).json({
          success: false,
          message: `A resource with chassis number '${rawChassis}' already exists in registry (${existingWithChassis.itemCode} - ${existingWithChassis.name})`,
        });
      }
    }

    const finalCondition = condition && VALID_CONDITIONS.includes(condition) ? condition : 'EXCELLENT';
    const combinedSpecs = specs || itSpecs || vehicleSpecs || machinerySpecs || surveyingSpecs || furnitureSpecs || null;

    // Auto Item Code Generation with retry loop to guarantee uniqueness under concurrency
    const MAX_CREATION_ATTEMPTS = 10;
    let created: any = null;

    for (let attempt = 0; attempt < MAX_CREATION_ATTEMPTS; attempt++) {
      try {
        let finalCode = itemCode && attempt === 0 ? String(itemCode).trim().toUpperCase() : '';
        if (!finalCode) {
          finalCode = await generateNextItemCode(category);
        }

        const existingCode = await prisma.resource.findUnique({ where: { itemCode: finalCode } });
        if (existingCode) {
          if (itemCode && attempt === 0) {
            return res.status(409).json({
              success: false,
              message: `Resource with asset code '${finalCode}' already exists in registry`,
            });
          }
          // Collision on auto-generated code; retry with next sequence
          continue;
        }

        created = await prisma.resource.create({
          data: {
            itemCode: finalCode,
            name: name.trim(),
            category,
            subcategory: subcategory ? subcategory.trim() : null,
            description: description ? description.trim() : null,
            manufacturer: manufacturer ? manufacturer.trim() : null,
            model: model ? model.trim() : null,
            serialNumber: effectiveSerial,
            status: 'AVAILABLE',
            condition: finalCondition,
            location: location && typeof location === 'string' && location.trim() ? location.trim() : 'Central Store - Kersa',
            departmentId: targetDeptId,
            currentAssigneeId: null, // New resources never have an initial custodian
            purchaseDate: parsedPurchaseDate,
            purchaseCostETB: parsedCost,
            currentValueETB: parsedCurrentValue,
            warrantyExpiry: parsedWarrantyExpiry,
            supplier: supplier ? supplier.trim() : null,
            notes: notes ? notes.trim() : null,
            specs: combinedSpecs,
          },
          include: {
            department: true,
            currentAssignee: true,
          },
        });
        break;
      } catch (createErr: any) {
        if (createErr?.code === 'P2002' && attempt < MAX_CREATION_ATTEMPTS - 1) {
          // Unique constraint collision on itemCode under concurrency; retry next sequence
          continue;
        }
        throw createErr;
      }
    }

    if (!created) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate a unique asset code after multiple attempts. Please retry.',
      });
    }

    await recordAuditEvent(prisma, {
      actionType: 'RESOURCE_REGISTERED',
      resourceId: created.id,
      resourceName: created.name,
      resourceCode: created.itemCode,
      resourceCategory: created.category,
      departmentId: created.departmentId,
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      actorRole: userRole,
      referenceId: created.itemCode,
      details: `Resource ${created.name} (${created.itemCode}) registered in ${created.department?.name || 'department'}`,
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

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Resource name must be at least 2 characters',
        });
      }
    }

    if (category !== undefined) {
      if (!VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({
          success: false,
          message: `Invalid category '${category}'. Must be one of: [${VALID_CATEGORIES.join(', ')}]`,
        });
      }
    }

    const rawSerial = serialNumber !== undefined && serialNumber !== null ? String(serialNumber).trim() : '';
    const specsSerial = specs?.serialNumber || itSpecs?.serialNumber || machinerySpecs?.serialNumber || surveyingSpecs?.serialNumber;
    const rawSpecsSerial = specsSerial !== undefined && specsSerial !== null ? String(specsSerial).trim() : '';
    const specsChassis = specs?.chassisNumber || vehicleSpecs?.chassisNumber;
    const rawChassis = specsChassis !== undefined && specsChassis !== null ? String(specsChassis).trim() : '';

    const effectiveSerial = rawSerial || rawSpecsSerial || rawChassis || (serialNumber === null ? null : undefined);

    if (effectiveSerial && effectiveSerial !== existing.serialNumber) {
      const dupSerial = await prisma.resource.findFirst({
        where: {
          id: { not: existing.id },
          status: { not: 'DISPOSED' },
          serialNumber: { equals: effectiveSerial, mode: 'insensitive' },
        },
        select: { id: true, itemCode: true, name: true },
      });
      if (dupSerial) {
        return res.status(409).json({
          success: false,
          message: `A resource with serial number '${effectiveSerial}' already exists in registry (${dupSerial.itemCode} - ${dupSerial.name})`,
        });
      }
    }

    const combinedSpecs = specs || itSpecs || vehicleSpecs || machinerySpecs || surveyingSpecs || req.body.furnitureSpecs || undefined;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (itemCode !== undefined) updateData.itemCode = itemCode.trim().toUpperCase();
    if (category !== undefined) updateData.category = category;
    if (subcategory !== undefined) updateData.subcategory = subcategory ? subcategory.trim() : null;
    if (description !== undefined) updateData.description = description ? description.trim() : null;
    if (manufacturer !== undefined) updateData.manufacturer = manufacturer ? manufacturer.trim() : null;
    if (model !== undefined) updateData.model = model ? model.trim() : null;
    if (effectiveSerial !== undefined) updateData.serialNumber = effectiveSerial ? effectiveSerial.trim() : null;
    if (status !== undefined) updateData.status = status;
    if (condition !== undefined && VALID_CONDITIONS.includes(condition)) updateData.condition = condition;
    if (location !== undefined) updateData.location = location ? location.trim() : existing.location;
    if (departmentId !== undefined) updateData.departmentId = departmentId;
    if (supplier !== undefined) updateData.supplier = supplier ? supplier.trim() : null;
    if (notes !== undefined) updateData.notes = notes ? notes.trim() : null;
    if (combinedSpecs !== undefined) {
      if (category !== undefined && category !== existing.category) {
        updateData.specs = combinedSpecs;
      } else {
        updateData.specs = typeof existing.specs === 'object' && existing.specs !== null && typeof combinedSpecs === 'object' && combinedSpecs !== null
          ? { ...(existing.specs as any), ...combinedSpecs }
          : combinedSpecs;
      }
    }

    const costInput = purchaseCostETB !== undefined ? purchaseCostETB : req.body.purchaseCost;
    if (costInput !== undefined && costInput !== null && costInput !== '') {
      const numCost = Number(costInput);
      if (isNaN(numCost) || numCost < 0) {
        return res.status(400).json({
          success: false,
          message: 'Purchase cost must be a valid non-negative number',
        });
      }
      updateData.purchaseCostETB = numCost;
    }

    const currentValInput = currentValueETB !== undefined ? currentValueETB : req.body.currentValue;
    if (currentValInput !== undefined && currentValInput !== null && currentValInput !== '') {
      const numVal = Number(currentValInput);
      if (isNaN(numVal) || numVal < 0) {
        return res.status(400).json({
          success: false,
          message: 'Current value must be a valid non-negative number',
        });
      }
      updateData.currentValueETB = numVal;
    }

    if (purchaseDate !== undefined && purchaseDate !== null && purchaseDate !== '') {
      const pDate = new Date(purchaseDate);
      if (isNaN(pDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid purchase date format',
        });
      }
      updateData.purchaseDate = pDate;
    } else if (purchaseDate === null) {
      updateData.purchaseDate = null;
    }

    if (warrantyExpiry !== undefined && warrantyExpiry !== null && warrantyExpiry !== '') {
      const wDate = new Date(warrantyExpiry);
      if (isNaN(wDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid warranty expiry date format',
        });
      }
      updateData.warrantyExpiry = wDate;
    } else if (warrantyExpiry === null) {
      updateData.warrantyExpiry = null;
    }

    const updated = await prisma.resource.update({
      where: { id: existing.id },
      data: updateData,
      include: {
        department: true,
        currentAssignee: true,
      },
    });

    let updateAction = 'RESOURCE_UPDATED';
    if (status !== undefined && status !== existing.status) {
      if (status === 'RETIRED') updateAction = 'RESOURCE_RETIRED';
      else if (status === 'DISPOSED') updateAction = 'RESOURCE_DISPOSED';
      else updateAction = 'RESOURCE_STATUS_CHANGED';
    } else if (condition !== undefined && condition !== existing.condition) {
      updateAction = 'CONDITION_CHANGED';
    }

    await recordAuditEvent(prisma, {
      actionType: updateAction,
      resourceId: updated.id,
      resourceName: updated.name,
      resourceCode: updated.itemCode,
      resourceCategory: updated.category,
      departmentId: updated.departmentId,
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      actorRole: userRole,
      referenceId: updated.itemCode,
      details: `Resource ${updated.name} (${updated.itemCode}) updated: ${updateAction.replace(/_/g, ' ')}`,
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
        message: `Cannot delete resource '${existing.itemCode}' while it is currently assigned to personnel. A return workflow must be completed first.`,
      });
    }

    const OPERATIONAL_AUDIT_ACTIONS = [
      'RESOURCE_ASSIGNED',
      'CUSTODY_TRANSFERRED',
      'RESOURCE_RETURNED',
      'MAINTENANCE_SUBMITTED',
      'MAINTENANCE_APPROVED',
      'MAINTENANCE_REJECTED',
      'MAINTENANCE_STARTED',
      'MAINTENANCE_COMPLETED',
      'MAINTENANCE_CANCELLED',
      'INSPECTION_RECORDED',
    ];

    // Safe deletion policy: check all historical operational dependencies
    const [
      assignmentCount,
      transferCount,
      requisitionCount,
      maintenanceCount,
      inspectionCount,
      operationalAuditCount,
    ] = await Promise.all([
      prisma.resourceAssignment.count({ where: { resourceId: existing.id } }),
      prisma.custodyTransfer.count({ where: { resourceId: existing.id } }),
      prisma.resourceRequisition.count({ where: { fulfilledResourceId: existing.id } }),
      prisma.maintenanceRequest.count({ where: { resourceId: existing.id } }),
      prisma.maintenanceInspection.count({ where: { resourceId: existing.id } }),
      prisma.auditEvent.count({
        where: {
          resourceId: existing.id,
          actionType: { in: OPERATIONAL_AUDIT_ACTIONS },
        },
      }),
    ]);

    const historyReasons: string[] = [];
    if (assignmentCount > 0) historyReasons.push(`${assignmentCount} assignment record(s)`);
    if (transferCount > 0) historyReasons.push(`${transferCount} custody transfer(s)`);
    if (requisitionCount > 0) historyReasons.push(`${requisitionCount} fulfillment requisition(s)`);
    if (maintenanceCount > 0) historyReasons.push(`${maintenanceCount} maintenance request(s)`);
    if (inspectionCount > 0) historyReasons.push(`${inspectionCount} inspection record(s)`);
    if (operationalAuditCount > 0) historyReasons.push(`${operationalAuditCount} operational audit log(s)`);

    if (historyReasons.length > 0) {
      return res.status(409).json({
        success: false,
        hasHistory: true,
        historyReasons,
        message: `Permanent deletion blocked: Resource '${existing.itemCode}' (${existing.name}) cannot be deleted because it has active historical operational records (${historyReasons.join(', ')}). Corporate policy requires preserving complete operational custody and maintenance history. To retire or take this asset out of service, please use the 'Update Status' action to set its status to RETIRED or DISPOSED instead.`,
      });
    }

    // SEC-06: Preserve all historical audit events.
    // The foreign key constraint onDelete: SetNull automatically disassociates existing.id
    // while keeping the complete audit history (registration, metadata) intact in the database.
    await prisma.resource.delete({ where: { id: existing.id } });

    await recordAuditEvent(prisma, {
      actionType: 'RESOURCE_DELETED',
      resourceId: null,
      resourceName: existing.name,
      resourceCode: existing.itemCode,
      resourceCategory: existing.category,
      departmentId: existing.departmentId,
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      actorRole: userRole,
      referenceId: existing.itemCode,
      details: `Resource ${existing.name} (${existing.itemCode}) permanently deleted from registry (no operational history)`,
    });

    return res.status(200).json({
      success: true,
      message: `Resource ${existing.itemCode} deleted from registry successfully`,
    });
  } catch (err: any) {
    console.error('[DELETE /api/resources/:id Error]', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to delete resource',
    });
  }
});

export default router;
