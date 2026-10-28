import http from 'node:http';
import { AddressInfo } from 'node:net';
import prisma from '../src/lib/prisma.js';

process.env.RMS_TEST_MODE = '1';

interface HttpResponse<T = any> {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: T;
}

let baseUrl = '';
let testServer: http.Server;

function request<T = any>(
  method: string,
  path: string,
  options: {
    headers?: Record<string, string>;
    body?: any;
    cookie?: string;
  } = {}
): Promise<HttpResponse<T>> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    if (options.cookie) {
      headers['Cookie'] = options.cookie;
    }

    const req = http.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          let parsed: any = null;
          try {
            parsed = rawData ? JSON.parse(rawData) : null;
          } catch {
            parsed = rawData;
          }
          resolve({
            status: res.statusCode || 500,
            headers: res.headers,
            body: parsed,
          });
        });
      }
    );

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

function extractCookie(headers: http.IncomingHttpHeaders): string {
  const setCookie = headers['set-cookie'];
  if (!setCookie || setCookie.length === 0) return '';
  const first = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return first ? first.split(';')[0] : '';
}

async function loginUser(email: string, password = 'EEC-Secure2026!'): Promise<string> {
  const res = await request('POST', '/api/auth/login', {
    body: { email, password },
  });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: status ${res.status} ${JSON.stringify(res.body)}`);
  }
  return extractCookie(res.headers);
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

async function runTests() {
  console.log('======================================================');
  console.log('EEC RMS: Resource Registry Integration Tests');
  console.log('======================================================');

  const { server } = await import('../src/index.js');
  await new Promise<void>((resolve) => {
    testServer = server.listen(0, () => {
      const addr = testServer.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      console.log(`Test server listening on ${baseUrl}`);
      resolve();
    });
  });

  try {
    // 1. Unauthenticated Access Protection
    console.log('\n--- 1. Unauthenticated Access Protection ---');
    const unauthList = await request('GET', '/api/resources');
    assert(unauthList.status === 401, 'GET /api/resources without session returns 401');

    const unauthMetrics = await request('GET', '/api/resources/metrics');
    assert(unauthMetrics.status === 401, 'GET /api/resources/metrics without session returns 401');

    const unauthGet = await request('GET', '/api/resources/res-surv-001');
    assert(unauthGet.status === 401, 'GET /api/resources/:id without session returns 401');

    const unauthCreate = await request('POST', '/api/resources', {
      body: { name: 'Unauthorized Asset' },
    });
    assert(unauthCreate.status === 401, 'POST /api/resources without session returns 401');

    // 2. Admin Operations & Querying
    console.log('\n--- 2. Admin Operations & Querying ---');
    const adminCookie = await loginUser('admin@eec.gov.et');

    const metricsRes = await request('GET', '/api/resources/metrics', { cookie: adminCookie });
    assert(metricsRes.status === 200, 'Admin can fetch resource metrics');
    assert(
      typeof metricsRes.body?.metrics?.totalAssets === 'number' && metricsRes.body.metrics.totalAssets >= 8,
      `Metrics contain totalAssets >= 8 (${metricsRes.body?.metrics?.totalAssets})`
    );
    assert(typeof metricsRes.body?.metrics?.totalValueETB === 'number', 'Metrics contain totalValueETB');

    const listRes = await request('GET', '/api/resources', { cookie: adminCookie });
    assert(listRes.status === 200, 'Admin can list resources');
    assert(Array.isArray(listRes.body?.resources) && listRes.body.resources.length >= 8, 'List returns at least 8 seeded resources');
    assert(listRes.body?.pagination?.total >= 8, 'Pagination total reflects count');

    // Filter by Category
    const catRes = await request('GET', '/api/resources?category=SURVEYING_GEOTECHNICAL', { cookie: adminCookie });
    assert(catRes.status === 200, 'Filter by category succeeds');
    assert(catRes.body?.resources?.every((r: any) => r.category === 'SURVEYING_GEOTECHNICAL'), 'All items match category SURVEYING_GEOTECHNICAL');

    // Filter by Status
    const statusRes = await request('GET', '/api/resources?status=AVAILABLE', { cookie: adminCookie });
    assert(statusRes.status === 200, 'Filter by status succeeds');
    assert(statusRes.body?.resources?.every((r: any) => r.status === 'AVAILABLE'), 'All items match status AVAILABLE');

    // Search query
    const searchRes = await request('GET', '/api/resources?search=Hilux', { cookie: adminCookie });
    assert(searchRes.status === 200, 'Search query succeeds');
    assert(searchRes.body?.resources?.some((r: any) => r.name.includes('Hilux') || r.itemCode.includes('Hilux')), 'Search finds matching Hilux vehicle');

    // Get single resource by ID and by itemCode
    const getById = await request('GET', '/api/resources/res-surv-001', { cookie: adminCookie });
    assert(getById.status === 200, 'Get resource by ID returns 200');
    assert(getById.body?.resource?.itemCode === 'EEC-SURV-2023-004', 'Resource has correct itemCode');
    assert(getById.body?.resource?.department?.name === 'Geotechnical & Surveying Engineering', 'Resource includes department relation');

    const getByCode = await request('GET', '/api/resources/EEC-SURV-2023-004', { cookie: adminCookie });
    assert(getByCode.status === 200, 'Get resource by itemCode returns 200');
    assert(getByCode.body?.resource?.id === 'res-surv-001', 'Lookup by itemCode resolves identical resource ID');

    // 3. Department Boundary Enforcement for Department Manager
    console.log('\n--- 3. Department Boundary Enforcement ---');
    // Manager of Water Works & Infrastructure (dept-101)
    const mgrCookie = await loginUser('manager@eec.gov.et');

    const mgrList = await request('GET', '/api/resources', { cookie: mgrCookie });
    assert(mgrList.status === 200, 'Department Manager can list resources');
    assert(mgrList.body?.resources?.every((r: any) => r.departmentId === 'dept-101'), 'Manager only sees resources within dept-101');

    // Manager accessing resource in dept-103 (res-surv-001)
    const mgrCrossView = await request('GET', '/api/resources/res-surv-001', { cookie: mgrCookie });
    assert(mgrCrossView.status === 403, 'Manager blocked with 403 when viewing resource in another department (dept-103)');

    // Manager creating resource targeted to another department
    const mgrCrossCreate = await request('POST', '/api/resources', {
      cookie: mgrCookie,
      body: {
        name: 'Manager Cross Dept Asset',
        category: 'SURVEYING_GEOTECHNICAL',
        departmentId: 'dept-103',
      },
    });
    assert(mgrCrossCreate.status === 403, 'Manager blocked with 403 when registering resource outside own department');

    // Manager updating resource in another department
    const mgrCrossUpdate = await request('PUT', '/api/resources/res-surv-001', {
      cookie: mgrCookie,
      body: { name: 'Unauthorized Name Change' },
    });
    assert(mgrCrossUpdate.status === 403, 'Manager blocked with 403 when updating foreign resource');

    // 4. Employee Permissions Restrictions
    console.log('\n--- 4. Employee Permissions Restrictions ---');
    const empCookie = await loginUser('employee@eec.gov.et');

    // Employee can view resources within their department
    const empList = await request('GET', '/api/resources', { cookie: empCookie });
    assert(empList.status === 200, 'Employee can view resources within own department');
    assert(empList.body?.resources?.every((r: any) => r.departmentId === 'dept-101'), 'Employee resources are scoped to own department (dept-101)');

    // Employee cannot create, edit, or delete
    const empCreate = await request('POST', '/api/resources', {
      cookie: empCookie,
      body: { name: 'Unauthorized Employee Asset', category: 'SURVEYING_GEOTECHNICAL' },
    });
    assert(empCreate.status === 403, 'Employee blocked with 403 from creating resource');

    const empUpdate = await request('PUT', '/api/resources/res-veh-001', {
      cookie: empCookie,
      body: { condition: 'FAIR' },
    });
    assert(empUpdate.status === 403, 'Employee blocked with 403 from editing resource');

    const empDelete = await request('DELETE', '/api/resources/res-veh-001', {
      cookie: empCookie,
    });
    assert(empDelete.status === 403, 'Employee blocked with 403 from deleting resource');

    // 5. Operational Role Scopes (Store Keeper & IT Tech)
    console.log('\n--- 5. Operational Role Scopes (Store Keeper & IT Tech) ---');
    const storeCookie = await loginUser('storekeeper@eec.gov.et');

    const newAssetCode = 'EEC-TEST-' + Date.now().toString().slice(-4);
    const storeCreate = await request('POST', '/api/resources', {
      cookie: storeCookie,
      body: {
        itemCode: newAssetCode,
        name: 'Warehouse High-Accuracy Leveller',
        category: 'SURVEYING_GEOTECHNICAL',
        departmentId: 'dept-101',
        manufacturer: 'Leica',
        model: 'NA730 Plus',
        serialNumber: 'SN-TEST-8899',
        condition: 'NEW',
        location: 'Central Storehouse Shelf C-12',
        purchaseCost: 85000,
        currency: 'ETB',
        specs: { magnification: '30x', standardDeviation: '0.7mm' },
      },
    });
    assert(storeCreate.status === 201, 'Store Keeper can register physical resource');
    assert(storeCreate.body?.resource?.itemCode === newAssetCode, 'Asset code matches registered code');
    assert(storeCreate.body?.resource?.status === 'AVAILABLE', 'Initial lifecycle status is AVAILABLE');
    const createdId = storeCreate.body?.resource?.id;

    const storeDelete = await request('DELETE', `/api/resources/${createdId}`, {
      cookie: storeCookie,
    });
    assert(storeDelete.status === 403, 'Store Keeper blocked with 403 from deleting resource');

    const itCookie = await loginUser('technician@eec.gov.et');
    const itCreate = await request('POST', '/api/resources', {
      cookie: itCookie,
      body: { name: 'Tech Created Item', category: 'IT_EQUIPMENT', departmentId: 'dept-107' },
    });
    assert(itCreate.status === 403, 'IT Technician cannot register new assets in registry');

    const itUpdateCondition = await request('PUT', `/api/resources/${createdId}`, {
      cookie: itCookie,
      body: { condition: 'GOOD', location: 'Calibrated and moved to Rack 4' },
    });
    assert(itUpdateCondition.status === 200, 'IT Technician can update condition and location');

    // 6. Validation & Controlled Status Transitions
    console.log('\n--- 6. Validation & Controlled Status Transitions ---');
    const dupRes = await request('POST', '/api/resources', {
      cookie: adminCookie,
      body: {
        itemCode: newAssetCode,
        name: 'Duplicate Item Code Test',
        category: 'IT_EQUIPMENT',
        departmentId: 'dept-107',
      },
    });
    assert(dupRes.status === 409, 'Duplicate asset code rejected with 409 Conflict');

    const invDeptRes = await request('POST', '/api/resources', {
      cookie: adminCookie,
      body: {
        name: 'Invalid Dept Asset',
        category: 'IT_EQUIPMENT',
        departmentId: 'dept-non-existent-999',
      },
    });
    assert(invDeptRes.status === 400, 'Invalid departmentId rejected with 400 Bad Request');

    const badAssignedTransition = await request('PUT', `/api/resources/${createdId}`, {
      cookie: adminCookie,
      body: { status: 'ASSIGNED' },
    });
    assert(badAssignedTransition.status === 400, 'Direct status transition to ASSIGNED is blocked with 400');

    const badMaintTransition = await request('PUT', `/api/resources/${createdId}`, {
      cookie: adminCookie,
      body: { status: 'MAINTENANCE' },
    });
    assert(badMaintTransition.status === 400, 'Direct status transition to MAINTENANCE is blocked with 400');

    const retireRes = await request('PUT', `/api/resources/${createdId}`, {
      cookie: adminCookie,
      body: { status: 'RETIRED' },
    });
    assert(retireRes.status === 200, 'Controlled decommissioning to RETIRED succeeds');
    assert(retireRes.body?.resource?.status === 'RETIRED', 'Resource status is now RETIRED');

    const reactivateRes = await request('PUT', `/api/resources/${createdId}`, {
      cookie: adminCookie,
      body: { status: 'AVAILABLE' },
    });
    assert(reactivateRes.status === 200, 'Reactivating RETIRED asset to AVAILABLE succeeds');

    // 7. Deletion Rules
    console.log('\n--- 7. Deletion Rules ---');
    // Set createdId to ASSIGNED via Prisma to test deletion guard
    await prisma.resource.update({
      where: { id: createdId },
      data: { status: 'ASSIGNED' },
    });

    const deleteAssigned = await request('DELETE', `/api/resources/${createdId}`, {
      cookie: adminCookie,
    });
    assert(deleteAssigned.status === 400, 'Admin blocked from deleting currently ASSIGNED resource (400 Bad Request)');

    // Reset back to AVAILABLE via Prisma
    await prisma.resource.update({
      where: { id: createdId },
      data: { status: 'AVAILABLE' },
    });

    const adminDelete = await request('DELETE', `/api/resources/${createdId}`, {
      cookie: adminCookie,
    });
    assert(adminDelete.status === 200, 'Admin successfully deletes unassigned test resource');

    const verifyDeleted = await request('GET', `/api/resources/${createdId}`, {
      cookie: adminCookie,
    });
    assert(verifyDeleted.status === 404, 'Deleted resource returns 404 Not Found');

    // 8. Dashboard Metrics & Department Visibility Regression Tests
    console.log('\n--- 8. Dashboard Metrics & Department Visibility Regression Tests ---');
    
    // 8.1 Metrics scoping for Corporate roles vs Department roles
    const adminMetricsRes = await request('GET', '/api/resources/metrics', { cookie: adminCookie });
    assert(adminMetricsRes.status === 200, 'Admin can fetch metrics (200)');
    assert(adminMetricsRes.body?.metrics?.scope === 'CORPORATION', 'Admin metrics scope is CORPORATION');
    assert(adminMetricsRes.body?.metrics?.totalAssets >= 9, 'Admin metrics totalAssets reflects all corporate assets (>= 9)');
    assert(typeof adminMetricsRes.body?.metrics?.utilizationRate === 'number', 'Metrics contain numeric utilizationRate');
    assert(typeof adminMetricsRes.body?.metrics?.categoryValues === 'object', 'Metrics contain categoryValues object');
    assert(typeof adminMetricsRes.body?.metrics?.categoryPercentages === 'object', 'Metrics contain categoryPercentages object');

    const storeMetricsRes = await request('GET', '/api/resources/metrics', { cookie: storeCookie });
    assert(storeMetricsRes.body?.metrics?.scope === 'CORPORATION', 'Store Keeper metrics scope is CORPORATION');
    assert(storeMetricsRes.body?.metrics?.totalAssets === adminMetricsRes.body?.metrics?.totalAssets, 'Store Keeper sees corporate-wide total assets');

    const itMetricsRes = await request('GET', '/api/resources/metrics', { cookie: itCookie });
    assert(itMetricsRes.body?.metrics?.scope === 'CORPORATION', 'IT Technician metrics scope is CORPORATION');
    assert(itMetricsRes.body?.metrics?.totalAssets === adminMetricsRes.body?.metrics?.totalAssets, 'IT Technician sees corporate-wide total assets');

    const mgrMetricsRes = await request('GET', '/api/resources/metrics', { cookie: mgrCookie });
    assert(mgrMetricsRes.status === 200, 'Department Manager can fetch metrics (200)');
    assert(mgrMetricsRes.body?.metrics?.scope === 'DEPARTMENT', 'Manager metrics scope is strictly DEPARTMENT');
    assert(mgrMetricsRes.body?.metrics?.departmentId === 'dept-101', 'Manager metrics departmentId is dept-101');
    assert(mgrMetricsRes.body?.metrics?.departmentName === 'Transport & Infrastructure Design', 'Manager metrics contains correct departmentName');
    assert(mgrMetricsRes.body?.metrics?.totalAssets === 3, 'Manager sees exactly 3 assets for dept-101 (3-versus-9 scoping confirmed)');
    assert(mgrMetricsRes.body?.metrics?.availableAssets === 3, 'Manager sees exactly 3 available assets for dept-101');
    assert(mgrMetricsRes.body?.metrics?.totalValueETB === 6040000, 'Manager metrics valuation reflects only dept-101 assets (6,040,000 ETB)');
    assert(mgrMetricsRes.body?.metrics?.categoryCounts?.VEHICLES === 1, 'Manager category counts reflect dept-101 vehicles (1)');
    assert(mgrMetricsRes.body?.metrics?.categoryCounts?.SURVEYING_GEOTECHNICAL === undefined, 'Manager category counts exclude other departments');

    const empMetricsRes = await request('GET', '/api/resources/metrics', { cookie: empCookie });
    assert(empMetricsRes.body?.metrics?.scope === 'DEPARTMENT', 'Employee metrics scope is strictly DEPARTMENT');
    assert(empMetricsRes.body?.metrics?.totalAssets === 3, 'Employee sees exactly 3 department assets');

    // 8.2 Resource visibility check for the new resource EEC-IT-2026-7508 (in dept-107)
    const adminAllRes = await request('GET', '/api/resources', { cookie: adminCookie });
    const hasNewAdmin = adminAllRes.body?.resources?.some((r: any) => r.itemCode === 'EEC-IT-2026-7508');
    assert(hasNewAdmin, 'Admin can see newly registered resource EEC-IT-2026-7508 in registry');

    const storeAllRes = await request('GET', '/api/resources', { cookie: storeCookie });
    const hasNewStore = storeAllRes.body?.resources?.some((r: any) => r.itemCode === 'EEC-IT-2026-7508');
    assert(hasNewStore, 'Store Keeper can see newly registered resource EEC-IT-2026-7508 in registry');

    const itAllRes = await request('GET', '/api/resources', { cookie: itCookie });
    const hasNewIT = itAllRes.body?.resources?.some((r: any) => r.itemCode === 'EEC-IT-2026-7508');
    assert(hasNewIT, 'IT Technician can see newly registered resource EEC-IT-2026-7508 in registry');

    const mgrAllRes = await request('GET', '/api/resources', { cookie: mgrCookie });
    const hasNewMgr = mgrAllRes.body?.resources?.some((r: any) => r.itemCode === 'EEC-IT-2026-7508');
    assert(!hasNewMgr, 'Manager in dept-101 CANNOT see EEC-IT-2026-7508 (belongs to dept-107, department boundary enforced)');

    const empAllRes = await request('GET', '/api/resources', { cookie: empCookie });
    const hasNewEmp = empAllRes.body?.resources?.some((r: any) => r.itemCode === 'EEC-IT-2026-7508');
    assert(!hasNewEmp, 'Employee in dept-101 CANNOT see EEC-IT-2026-7508 (belongs to dept-107, department boundary enforced)');

    const mgrDirectGet = await request('GET', '/api/resources/EEC-IT-2026-7508', { cookie: mgrCookie });
    assert(mgrDirectGet.status === 403, 'Manager direct lookup of foreign resource EEC-IT-2026-7508 returns 403 Forbidden');

    const empDirectGet = await request('GET', '/api/resources/EEC-IT-2026-7508', { cookie: empCookie });
    assert(empDirectGet.status === 403, 'Employee direct lookup of foreign resource EEC-IT-2026-7508 returns 403 Forbidden');

    // 8.3 Verify authorized manager CAN see and manage resources belonging to their own department
    const mgrOwnGet = await request('GET', '/api/resources/EEC-VEHC-2022-081', { cookie: mgrCookie });
    assert(mgrOwnGet.status === 200, 'Manager can view resource EEC-VEHC-2022-081 belonging to own department (dept-101)');
    assert(mgrOwnGet.body?.resource?.name?.includes('Land Cruiser'), 'Resource details correctly retrieved by department manager');

    // Test registering a new resource inside manager's own department
    const dept101AssetCode = 'EEC-IT-TEST-' + Date.now().toString().slice(-4);
    const mgrRegOwn = await request('POST', '/api/resources', {
      cookie: mgrCookie,
      body: {
        itemCode: dept101AssetCode,
        name: 'TID Highway CAD Station',
        category: 'IT_EQUIPMENT',
        departmentId: 'dept-101',
        condition: 'EXCELLENT',
        location: 'HQ Floor 4 - Room 408',
        purchaseCostETB: 120000,
      },
    });
    assert(mgrRegOwn.status === 201, 'Manager can successfully register new resource in own department (dept-101)');
    const mgrRegId = mgrRegOwn.body?.resource?.id;

    // Verify manager's metrics and list now reflect 4 assets
    const mgrUpdatedMetrics = await request('GET', '/api/resources/metrics', { cookie: mgrCookie });
    assert(mgrUpdatedMetrics.body?.metrics?.totalAssets === 4, 'Manager metrics immediately increment to 4 for own department');

    const mgrUpdatedList = await request('GET', '/api/resources', { cookie: mgrCookie });
    const hasNewlyAddedInDept = mgrUpdatedList.body?.resources?.some((r: any) => r.itemCode === dept101AssetCode);
    assert(hasNewlyAddedInDept, 'Newly registered resource in dept-101 is immediately visible to manager');

    // Clean up temporary test resource
    await request('DELETE', `/api/resources/${mgrRegId}`, { cookie: adminCookie });
    const postCleanupMetrics = await request('GET', '/api/resources/metrics', { cookie: mgrCookie });
    assert(postCleanupMetrics.body?.metrics?.totalAssets === 3, 'Post-cleanup manager metrics reset to 3, existing records preserved');

  } catch (err) {
    console.error('Test suite uncaught error:', err);
    failed++;
  } finally {
    if (testServer) {
      testServer.close();
    }
    await prisma.$disconnect();
    console.log('\n======================================================');
    console.log(`Tests Completed: ${passed} Passed, ${failed} Failed`);
    console.log('======================================================');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
