process.env.RMS_TEST_MODE = '1';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import prisma from '../src/lib/prisma';

let server: http.Server;
let baseUrl: string;

async function createTestServer(): Promise<string> {
  const indexMod = await import('../src/index');
  server = indexMod.server;
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve(baseUrl);
    });
  });
}

async function request(method: string, path: string, options: { body?: any; cookie?: string } = {}) {
  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.cookie) {
    headers['Cookie'] = options.cookie;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const cookieHeader = res.headers.get('set-cookie');
  let body: any = null;
  const text = await res.text();
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  return {
    status: res.status,
    headers: res.headers,
    cookie: cookieHeader ? cookieHeader.split(';')[0] : null,
    body,
  };
}

async function loginUser(email: string, password = 'EEC-Secure2026!'): Promise<string> {
  const res = await request('POST', '/api/auth/login', {
    body: { email, password },
  });
  if (res.status !== 200 || !res.cookie) {
    throw new Error(`Login failed for ${email}: status ${res.status}`);
  }
  return res.cookie;
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`, detail || '');
    failed++;
  }
}

// Extraction & filtering logic identical to HandoverAssetCombobox
function getAssetSerialNumber(r: any): string {
  if (r.serialNumber && r.serialNumber.trim()) return r.serialNumber.trim();
  if (r.itSpecs?.serialNumber && r.itSpecs.serialNumber.trim()) return r.itSpecs.serialNumber.trim();
  if (r.vehicleSpecs?.chassisNumber && r.vehicleSpecs.chassisNumber.trim()) return r.vehicleSpecs.chassisNumber.trim();
  if (r.surveyingSpecs?.serialNumber && r.surveyingSpecs.serialNumber.trim()) return r.surveyingSpecs.serialNumber.trim();
  return '';
}

function getAssetModel(r: any): string {
  if (r.model && typeof r.model === 'string' && r.model.trim()) return r.model.trim();
  if (r.itSpecs?.model && r.itSpecs.model.trim()) return r.itSpecs.model.trim();
  if (r.vehicleSpecs?.model && r.vehicleSpecs.model.trim()) return r.vehicleSpecs.model.trim();
  if (r.machinerySpecs?.model && r.machinerySpecs.model.trim()) return r.machinerySpecs.model.trim();
  if (r.surveyingSpecs?.model && r.surveyingSpecs.model.trim()) return r.surveyingSpecs.model.trim();
  return '';
}

const CATEGORY_NAMES: Record<string, string> = {
  IT_EQUIPMENT: 'IT Equipment',
  VEHICLES: 'Vehicles & Transport',
  HEAVY_MACHINERY: 'Heavy Machinery',
  SURVEYING_GEOTECHNICAL: 'Surveying & Geotechnical',
  CAMP_FACILITY_FURNITURE: 'Furniture & Facilities',
  OTHER: 'Other Equipment',
};

function formatCategoryName(cat?: string): string {
  if (!cat) return 'Uncategorized';
  return CATEGORY_NAMES[cat] || cat.replace(/_/g, ' ');
}

function getHandoverEmptyStateMessage(
  requiredCategory?: string,
  otherAvailableCount = 0,
  otherCategoriesText = ''
): { title: string; message: string } {
  const catLabel = formatCategoryName(requiredCategory);
  if (otherAvailableCount > 0) {
    const countText = `${otherAvailableCount} available ${otherAvailableCount === 1 ? 'resource' : 'resources'}`;
    const categoriesPart = otherCategoriesText ? ` (${otherCategoriesText})` : '';
    const pronoun = otherAvailableCount === 1 ? 'it' : 'they';
    const verb = otherAvailableCount === 1 ? 'is' : 'are';
    const catNoun = (otherAvailableCount > 1 && otherCategoriesText.includes(',')) ? 'other categories' : (otherAvailableCount === 1 ? 'another category' : 'other categories');
    return {
      title: `No ${catLabel} Available for Handover`,
      message: `No ${catLabel} is currently available for handover. There ${verb} ${countText} in ${catNoun}${categoriesPart}, but ${pronoun} cannot fulfill this request.`,
    };
  }

  return {
    title: 'No Available Inventory in Store',
    message: 'The warehouse store currently has no available resources across any category. Please intake or return equipment before completing handover.',
  };
}

function filterHandoverAssets(resources: any[], requiredCategory?: string, searchQuery = ''): any[] {
  // 1. Strictly AVAILABLE and matching requiredCategory
  const eligible = resources.filter((r) => {
    const isAvailable = r.status === 'AVAILABLE';
    const matchesCategory = !requiredCategory || r.category === requiredCategory;
    return isAvailable && matchesCategory;
  });

  const q = searchQuery.trim().toLowerCase();
  if (!q) return eligible;

  return eligible.filter((r) => {
    const itemCode = (r.itemCode || '').toLowerCase();
    const name = (r.name || '').toLowerCase();
    const serial = getAssetSerialNumber(r).toLowerCase();
    const model = getAssetModel(r).toLowerCase();
    const subcategory = (r.subcategory || '').toLowerCase();
    const location = (r.location || '').toLowerCase();

    return (
      itemCode.includes(q) ||
      name.includes(q) ||
      serial.includes(q) ||
      model.includes(q) ||
      subcategory.includes(q) ||
      location.includes(q)
    );
  });
}

async function runTests() {
  console.log('====================================================================');
  console.log('EEC RMS: Store Keeper Handover Resource Selection & Revalidation');
  console.log('====================================================================');

  await createTestServer();
  console.log(`Test server running at ${baseUrl}`);

  const createdResourceIds: string[] = [];
  const createdRequisitionIds: string[] = [];

  try {
    // 1. Authenticate Roles
    console.log('\n--- 1. Authenticating System Roles ---');
    const adminCookie = await loginUser('admin@eec.gov.et');
    assert(!!adminCookie, 'Admin session authenticated');

    const storeKeeperCookie = await loginUser('storekeeper@eec.gov.et');
    assert(!!storeKeeperCookie, 'Store Keeper session authenticated');

    const employeeCookie = await loginUser('employee@eec.gov.et');
    assert(!!employeeCookie, 'Employee session authenticated');

    // Retrieve departments and employee
    const dept = await prisma.department.findFirst({ where: { code: 'ICT' } });
    const emp = await prisma.employee.findFirst({ where: { email: 'employee@eec.gov.et' } });
    assert(!!dept, 'ICT department exists');
    assert(!!emp, 'Employee exists');

    // 2. Setup Resources for Testing
    console.log('\n--- 2. Setting Up Test Resources Across States & Categories ---');
    const timestamp = Date.now();

    // A. Matching Category & AVAILABLE
    const validItAsset = await prisma.resource.create({
      data: {
        itemCode: `IT-CAD-${timestamp}`,
        name: 'Lenovo ThinkPad P16 Gen 2',
        category: 'IT_EQUIPMENT',
        subcategory: 'Mobile Workstation',
        status: 'AVAILABLE',
        condition: 'NEW',
        location: 'Central Store - Kersa Shelf A-4',
        departmentId: dept!.id,
        purchaseCostETB: 195000,
        currentValueETB: 195000,
        serialNumber: `SN-LEN-${timestamp}`,
        model: 'ThinkPad P16 Gen 2',
      },
    });
    createdResourceIds.push(validItAsset.id);

    // B. Mismatched Category & AVAILABLE (SURVEYING_GEOTECHNICAL)
    const surveyingAsset = await prisma.resource.create({
      data: {
        itemCode: `SURV-TS-${timestamp}`,
        name: 'Trimble S7 Robotic Total Station',
        category: 'SURVEYING_GEOTECHNICAL',
        subcategory: 'Total Station',
        status: 'AVAILABLE',
        condition: 'EXCELLENT',
        location: 'Central Store - Kersa Vault 2',
        departmentId: dept!.id,
        purchaseCostETB: 540000,
        currentValueETB: 540000,
        serialNumber: `SN-TRIM-${timestamp}`,
        model: 'Trimble S7 1" Sec',
      },
    });
    createdResourceIds.push(surveyingAsset.id);

    // C. Mismatched Category & AVAILABLE (VEHICLES)
    const vehicleAsset = await prisma.resource.create({
      data: {
        itemCode: `VEH-PUP-${timestamp}`,
        name: 'Toyota Hilux Double Cab 4x4',
        category: 'VEHICLES',
        subcategory: 'Pickup Truck',
        status: 'AVAILABLE',
        condition: 'GOOD',
        location: 'Central Motorpool - Yard 1',
        departmentId: dept!.id,
        purchaseCostETB: 4800000,
        currentValueETB: 4800000,
        serialNumber: `CHASSIS-HILUX-${timestamp}`,
        model: 'Hilux D-4D 2.8L',
      },
    });
    createdResourceIds.push(vehicleAsset.id);

    // D. Matching Category but in MAINTENANCE
    const maintenanceAsset = await prisma.resource.create({
      data: {
        itemCode: `IT-MAINT-${timestamp}`,
        name: 'Dell Precision 7770',
        category: 'IT_EQUIPMENT',
        subcategory: 'Mobile Workstation',
        status: 'MAINTENANCE',
        condition: 'FAIR',
        location: 'ICT Workshop - Bench 2',
        departmentId: dept!.id,
        purchaseCostETB: 210000,
        currentValueETB: 210000,
      },
    });
    createdResourceIds.push(maintenanceAsset.id);

    // E. Matching Category but ASSIGNED
    const assignedAsset = await prisma.resource.create({
      data: {
        itemCode: `IT-ASGN-${timestamp}`,
        name: 'Apple MacBook Pro 16 M3 Max',
        category: 'IT_EQUIPMENT',
        subcategory: 'Laptop',
        status: 'ASSIGNED',
        condition: 'EXCELLENT',
        location: 'TID Design Office',
        departmentId: dept!.id,
        currentAssigneeId: emp!.id,
        purchaseCostETB: 320000,
        currentValueETB: 320000,
      },
    });
    createdResourceIds.push(assignedAsset.id);

    // F. Matching Category but RETIRED
    const retiredAsset = await prisma.resource.create({
      data: {
        itemCode: `IT-RET-${timestamp}`,
        name: 'HP EliteBook 840 G5 (Decommissioned)',
        category: 'IT_EQUIPMENT',
        subcategory: 'Laptop',
        status: 'RETIRED',
        condition: 'POOR',
        location: 'Salvage Storage',
        departmentId: dept!.id,
        purchaseCostETB: 45000,
        currentValueETB: 5000,
      },
    });
    createdResourceIds.push(retiredAsset.id);

    // G. Matching Category but DISPOSED
    const disposedAsset = await prisma.resource.create({
      data: {
        itemCode: `IT-DISP-${timestamp}`,
        name: 'Dell OptiPlex 7050 (Scrapped)',
        category: 'IT_EQUIPMENT',
        subcategory: 'Desktop',
        status: 'DISPOSED',
        condition: 'SCRAP',
        location: 'Disposal Yard',
        departmentId: dept!.id,
        purchaseCostETB: 35000,
        currentValueETB: 0,
      },
    });
    createdResourceIds.push(disposedAsset.id);

    // 3. Create Approved Requisition (IT_EQUIPMENT)
    console.log('\n--- 3. Create Approved Requisition for IT_EQUIPMENT ---');
    const reqRes = await request('POST', '/api/requisitions', {
      cookie: employeeCookie,
      body: {
        category: 'IT_EQUIPMENT',
        itemDescription: 'High-end workstation for GIS and CAD photogrammetry',
        justification: 'Required for Dire Dawa Urban Road structural modeling',
        urgency: 'URGENT',
      },
    });
    assert(reqRes.status === 201, 'Requisition created (201)');
    const requisition = reqRes.body.requisition;
    createdRequisitionIds.push(requisition.id);

    // Approve requisition by Admin
    const approveRes = await request('POST', `/api/requisitions/${requisition.id}/approve`, {
      cookie: adminCookie,
      body: { comments: 'Approved for Store Keeper hardware allocation' },
    });
    assert(approveRes.status === 200, 'Requisition APPROVED by Admin');

    // 4. Backend Revalidation Tests
    console.log('\n--- 4. Backend Revalidation: Category Mismatch Rejection ---');
    // Attempt with SURVEYING_GEOTECHNICAL
    const failCatSurvey = await request('POST', `/api/requisitions/${requisition.id}/fulfill`, {
      cookie: storeKeeperCookie,
      body: { resourceId: surveyingAsset.id },
    });
    assert(failCatSurvey.status === 400, 'Fulfill with SURVEYING asset rejected (400)');
    assert(failCatSurvey.body.message.includes('Category mismatch'), 'Explains category mismatch');

    // Attempt with VEHICLES
    const failCatVehicle = await request('POST', `/api/requisitions/${requisition.id}/fulfill`, {
      cookie: storeKeeperCookie,
      body: { resourceId: vehicleAsset.id },
    });
    assert(failCatVehicle.status === 400, 'Fulfill with VEHICLE asset rejected (400)');
    assert(failCatVehicle.body.message.includes('Category mismatch'), 'Explains category mismatch');

    console.log('\n--- 5. Backend Revalidation: Non-AVAILABLE Status Rejections ---');
    // MAINTENANCE
    const failMaint = await request('POST', `/api/requisitions/${requisition.id}/fulfill`, {
      cookie: storeKeeperCookie,
      body: { resourceId: maintenanceAsset.id },
    });
    assert(failMaint.status === 400, 'Fulfill with MAINTENANCE asset rejected (400)');
    assert(
      failMaint.body.message.includes('cannot be assigned because its status is') ||
      failMaint.body.message.includes('Only AVAILABLE resources can be allocated'),
      'Explains MAINTENANCE status non-allocatable'
    );

    // ASSIGNED
    const failAssigned = await request('POST', `/api/requisitions/${requisition.id}/fulfill`, {
      cookie: storeKeeperCookie,
      body: { resourceId: assignedAsset.id },
    });
    assert(failAssigned.status === 400, 'Fulfill with ASSIGNED asset rejected (400)');
    assert(
      failAssigned.body.message.includes('cannot be assigned because its status is') ||
      failAssigned.body.message.includes('Only AVAILABLE resources can be allocated'),
      'Explains ASSIGNED status non-allocatable'
    );

    // RETIRED
    const failRetired = await request('POST', `/api/requisitions/${requisition.id}/fulfill`, {
      cookie: storeKeeperCookie,
      body: { resourceId: retiredAsset.id },
    });
    assert(failRetired.status === 400, 'Fulfill with RETIRED asset rejected (400)');
    assert(
      failRetired.body.message.includes('cannot be assigned because its status is') ||
      failRetired.body.message.includes('Only AVAILABLE resources can be allocated'),
      'Explains RETIRED status non-allocatable'
    );

    // DISPOSED
    const failDisposed = await request('POST', `/api/requisitions/${requisition.id}/fulfill`, {
      cookie: storeKeeperCookie,
      body: { resourceId: disposedAsset.id },
    });
    assert(failDisposed.status === 400, 'Fulfill with DISPOSED asset rejected (400)');
    assert(
      failDisposed.body.message.includes('cannot be assigned because its status is') ||
      failDisposed.body.message.includes('Only AVAILABLE resources can be allocated'),
      'Explains DISPOSED status non-allocatable'
    );

    // Nonexistent Resource ID
    const failNotFound = await request('POST', `/api/requisitions/${requisition.id}/fulfill`, {
      cookie: storeKeeperCookie,
      body: { resourceId: '00000000-0000-0000-0000-000000000000' },
    });
    assert(failNotFound.status === 404, 'Fulfill with nonexistent resource returns 404');

    console.log('\n--- 6. Backend Handover Fulfillment: Valid Allocation ---');
    const fulfillSuccess = await request('POST', `/api/requisitions/${requisition.id}/fulfill`, {
      cookie: storeKeeperCookie,
      body: {
        resourceId: validItAsset.id,
        handoverNotes: 'Handed over with 230W power brick and docking hub',
        location: 'Central Store - Kersa Handover Counter',
      },
    });
    assert(fulfillSuccess.status === 200, 'Store Keeper successfully fulfilled requisition (200)');
    assert(fulfillSuccess.body.requisition.status === 'FULFILLED', 'Requisition status is FULFILLED');
    assert(fulfillSuccess.body.resource.status === 'ASSIGNED', 'Resource status updated to ASSIGNED');

    // Verify DB state
    const dbAssetAfter = await prisma.resource.findUnique({ where: { id: validItAsset.id } });
    assert(dbAssetAfter?.status === 'ASSIGNED', 'Database confirms asset status ASSIGNED');
    assert(dbAssetAfter?.currentAssigneeId === emp!.id, 'Database confirms currentAssigneeId is requesting employee');

    // Verify duplicate fulfillment on same requisition fails
    const failDupFulfill = await request('POST', `/api/requisitions/${requisition.id}/fulfill`, {
      cookie: storeKeeperCookie,
      body: { resourceId: validItAsset.id },
    });
    assert(failDupFulfill.status === 400, 'Re-fulfilling already FULFILLED requisition rejected (400)');

    console.log('\n--- 7. Frontend HandoverAssetCombobox Filtering & Search Logic ---');
    // Fetch all resources to test frontend combobox filter logic
    const allResources = await prisma.resource.findMany({
      where: { id: { in: createdResourceIds } },
    });

    // 7.1 Only genuinely AVAILABLE and matching requiredCategory are eligible
    const itEligible = filterHandoverAssets(allResources, 'IT_EQUIPMENT');
    // validItAsset was assigned, so only 0 available IT assets remain among test assets
    // Let's create an available one to test
    const mockAvailableIT = {
      id: 'mock-1',
      itemCode: 'EEC-IT-0042',
      name: 'Dell Precision 5570',
      category: 'IT_EQUIPMENT',
      status: 'AVAILABLE',
      location: 'Central Store - Kersa',
      itSpecs: {
        serialNumber: 'SN-DELL-99881',
        model: 'Precision 5570 Mobile Workstation',
      },
    };

    const mockSurveyAvailable = {
      id: 'mock-2',
      itemCode: 'EEC-SURV-0019',
      name: 'Leica DNA03 Digital Level',
      category: 'SURVEYING_GEOTECHNICAL',
      status: 'AVAILABLE',
      location: 'Central Store - Kersa Vault 1',
      surveyingSpecs: {
        serialNumber: 'SN-LEICA-77331',
        model: 'DNA03 High Precision',
      },
    };

    const mockMaintenanceIT = {
      id: 'mock-3',
      itemCode: 'EEC-IT-0099',
      name: 'HP ZBook Firefly',
      category: 'IT_EQUIPMENT',
      status: 'MAINTENANCE',
      location: 'Workshop',
      itSpecs: {
        serialNumber: 'SN-HP-11223',
        model: 'ZBook Firefly 14 G10',
      },
    };

    const testPool = [mockAvailableIT, mockSurveyAvailable, mockMaintenanceIT];

    // Filter by IT_EQUIPMENT: excludes mockSurveyAvailable (wrong category) and mockMaintenanceIT (status MAINTENANCE)
    const itFiltered = filterHandoverAssets(testPool, 'IT_EQUIPMENT');
    assert(itFiltered.length === 1, 'Only AVAILABLE IT assets are returned');
    assert(itFiltered[0].id === 'mock-1', 'Correct available asset included');

    // 7.2 Search by Item Code
    const searchCode = filterHandoverAssets(testPool, 'IT_EQUIPMENT', '0042');
    assert(searchCode.length === 1 && searchCode[0].id === 'mock-1', 'Search by item code finds asset');

    // 7.3 Search by Resource Name (case-insensitive)
    const searchName = filterHandoverAssets(testPool, 'IT_EQUIPMENT', 'precision');
    assert(searchName.length === 1 && searchName[0].id === 'mock-1', 'Search by resource name finds asset');

    // 7.4 Search by Serial Number (from itSpecs)
    const searchSerial = filterHandoverAssets(testPool, 'IT_EQUIPMENT', '99881');
    assert(searchSerial.length === 1 && searchSerial[0].id === 'mock-1', 'Search by serial number (itSpecs) finds asset');

    // 7.5 Search by Model (from itSpecs)
    const searchModel = filterHandoverAssets(testPool, 'IT_EQUIPMENT', 'Workstation');
    assert(searchModel.length === 1 && searchModel[0].id === 'mock-1', 'Search by model finds asset');

    // 7.6 Search query matching unavailable asset returns empty array
    const searchUnavail = filterHandoverAssets(testPool, 'IT_EQUIPMENT', 'Firefly');
    assert(searchUnavail.length === 0, 'Unavailable assets are excluded even if search matches their name');

    // 7.7 Search query matching cross-category asset returns empty array
    const searchWrongCat = filterHandoverAssets(testPool, 'IT_EQUIPMENT', 'DNA03');
    assert(searchWrongCat.length === 0, 'Cross-category assets are excluded even if search matches');

    // 7.8 No matching query returns empty array
    const searchNoMatch = filterHandoverAssets(testPool, 'IT_EQUIPMENT', 'XYZNONEXISTENT999');
    assert(searchNoMatch.length === 0, 'Non-matching query returns empty array');

    // 7.9 Empty search returns all eligible available assets
    const searchEmpty = filterHandoverAssets(testPool, 'IT_EQUIPMENT', '');
    assert(searchEmpty.length === 1, 'Empty search returns all eligible category assets');

    // 7.10 Empty state message when resources exist in other categories
    const msgWithOther = getHandoverEmptyStateMessage('IT_EQUIPMENT', 3, 'Surveying & Geotechnical');
    assert(
      msgWithOther.message === 'No IT Equipment is currently available for handover. There are 3 available resources in other categories (Surveying & Geotechnical), but they cannot fulfill this request.',
      'Generates correct category-specific explanation with other available categories and counts'
    );
    assert(msgWithOther.title === 'No IT Equipment Available for Handover', 'Title identifies missing category');

    // 7.11 Empty state message when 1 resource exists in another category
    const msgSingleOther = getHandoverEmptyStateMessage('IT_EQUIPMENT', 1, 'Surveying & Geotechnical');
    assert(
      msgSingleOther.message === 'No IT Equipment is currently available for handover. There is 1 available resource in another category (Surveying & Geotechnical), but it cannot fulfill this request.',
      'Handles singular grammar correctly for 1 available resource in another category'
    );

    // 7.12 Empty state message when zero resources are available anywhere in store
    const msgTotalZero = getHandoverEmptyStateMessage('IT_EQUIPMENT', 0, '');
    assert(
      msgTotalZero.message.includes('The warehouse store currently has no available resources across any category'),
      'Explains complete store exhaustion when 0 resources available enterprise-wide'
    );
    assert(msgTotalZero.title === 'No Available Inventory in Store', 'Identifies total inventory exhaustion in store');

    console.log('\n--- 8. Cleaning Up Test Records ---');
    await prisma.resourceAssignment.deleteMany({
      where: { resourceId: { in: createdResourceIds } },
    });
    await prisma.resourceRequisition.deleteMany({
      where: { id: { in: createdRequisitionIds } },
    });
    await prisma.resource.deleteMany({
      where: { id: { in: createdResourceIds } },
    });
    console.log('  ✓ Test resources, requisitions, and assignments cleaned up');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n====================================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('====================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
