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
  console.log('================================================================');
  console.log('EEC RMS: Reports and Operational Intelligence Integration Tests');
  console.log('================================================================');

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
    // 1. Unauthenticated Security Boundaries
    console.log('\n--- 1. Unauthenticated Boundaries ---');
    const unauthGet = await request('GET', '/api/reports/overview');
    assert(unauthGet.status === 401, 'GET /api/reports/overview without cookie returns 401');

    // 2. User Authentication
    console.log('\n--- 2. Authenticating System Roles ---');
    const adminCookie = await loginUser('admin@eec.gov.et');
    assert(!!adminCookie, 'Admin session established');

    const managerCookie = await loginUser('manager@eec.gov.et');
    assert(!!managerCookie, 'Department Manager (dept-101) session established');

    const employeeCookie = await loginUser('employee@eec.gov.et');
    assert(!!employeeCookie, 'Employee session established');

    const storeKeeperCookie = await loginUser('storekeeper@eec.gov.et');
    assert(!!storeKeeperCookie, 'Store Keeper session established');

    const techCookie = await loginUser('technician@eec.gov.et');
    assert(!!techCookie, 'IT Technician session established');

    // 3. Admin Corporation-Wide Report & Aggregation Accuracy
    console.log('\n--- 3. Admin Corporation-Wide Report & Aggregations ---');
    const adminReportRes = await request('GET', '/api/reports/overview', { cookie: adminCookie });
    assert(adminReportRes.status === 200, 'Admin can fetch corporate reports overview (200)');
    const adminData = adminReportRes.body;
    assert(adminData?.success === true, 'Response success flag is true');
    assert(adminData?.metadata?.scope === 'CORPORATION', 'Admin scope is CORPORATION');
    assert(adminData?.metadata?.scopeLabel?.includes('Corporation-wide'), 'Scope label indicates corporation-wide');

    // Overview numbers
    const ov = adminData?.overview;
    assert(typeof ov?.totalResources === 'number' && ov.totalResources > 0, 'Total resources is positive number');
    assert(
      ov.available + ov.assigned + ov.underMaintenance + ov.retired + ov.disposed === ov.totalResources,
      'Resource status components sum exactly to totalResources'
    );
    assert(typeof ov?.totalPurchaseCostETB === 'number' && ov.totalPurchaseCostETB > 0, 'Total purchase cost is calculated in ETB');
    assert(typeof ov?.totalCurrentValueETB === 'number', 'Total current book value is calculated in ETB');

    // Distributions
    const dist = adminData?.distribution;
    assert(Array.isArray(dist?.byCategory), 'Distribution by category is array');
    assert(dist.byCategory.length > 0, 'Category breakdown contains active categories');
    const catSum = dist.byCategory.reduce((s: number, c: any) => s + c.count, 0);
    assert(catSum === ov.totalResources, 'Sum of category items matches total resources');

    assert(Array.isArray(dist?.byDepartment), 'Distribution by directorate is array');
    assert(dist.byDepartment.length > 0, 'Directorate breakdown contains entries');

    // Custody
    const custody = adminData?.custody;
    assert(typeof custody?.totalActiveAssignments === 'number', 'Active assignments count is calculated');
    assert(typeof custody?.totalUnassigned === 'number', 'Unassigned resources count is calculated');
    assert(Array.isArray(custody?.byDepartment), 'Custody by department is array');
    assert(Array.isArray(custody?.byEmployee), 'Custody by employee (top custodians) is array');

    // Maintenance Metrics & Real Costs
    const maint = adminData?.maintenance;
    assert(typeof maint?.byStatus?.total === 'number', 'Maintenance total tickets is calculated');
    assert(typeof maint?.totalActualCostETB === 'number', 'Actual recorded maintenance cost in ETB is calculated');
    assert(typeof maint?.totalEstimatedCostETB === 'number', 'Estimated maintenance cost in ETB is calculated');
    assert(Array.isArray(maint?.byCategory), 'Maintenance costs by category is array');

    // Recent Activities Feed
    const recents = adminData?.recentActivities;
    assert(Array.isArray(recents), 'Recent activities feed is array');
    assert(recents.length > 0, 'Recent activities contains entries');
    const firstAct = recents[0];
    assert(!!firstAct?.referenceCode, 'Activity item contains reference code');
    assert(!!firstAct?.resourceName, 'Activity item contains resource name');
    assert(!!firstAct?.timestamp, 'Activity item contains ISO timestamp');

    // 4. Department Manager Department-Level Isolation & Security Guard
    console.log('\n--- 4. Department Manager Directorate Boundary Scoping ---');
    const mgrReportRes = await request('GET', '/api/reports/overview', { cookie: managerCookie });
    assert(mgrReportRes.status === 200, 'Department Manager can fetch department reports overview (200)');
    const mgrData = mgrReportRes.body;
    assert(mgrData?.metadata?.scope === 'DEPARTMENT', 'Manager scope is strictly DEPARTMENT');
    assert(mgrData?.metadata?.departmentId === 'dept-101', 'Manager report scoped to dept-101');

    // All departments in breakdown should only be dept-101
    const mgrDepts = mgrData?.distribution?.byDepartment || [];
    const onlyDept101 = mgrDepts.every((d: any) => d.departmentId === 'dept-101');
    assert(onlyDept101, 'Manager distribution contains ONLY assigned directorate (dept-101)');

    // Manager counts must not exceed corporation-wide counts
    assert(mgrData?.overview?.totalResources <= ov.totalResources, 'Manager resource count is subset of corporation total');

    // Cross-department access attempt: Manager specifies dept-102
    const crossDeptAttempt = await request('GET', '/api/reports/overview?departmentId=dept-102', { cookie: managerCookie });
    assert(crossDeptAttempt.status === 403, 'Department Manager blocked with 403 when requesting foreign department reports');
    assert(crossDeptAttempt.body?.message?.includes('Forbidden'), 'Rejection message explains department restriction');

    // Manager requesting their own department explicitly succeeds
    const ownDeptAttempt = await request('GET', '/api/reports/overview?departmentId=dept-101', { cookie: managerCookie });
    assert(ownDeptAttempt.status === 200, 'Department Manager querying own department ID succeeds (200)');

    // 5. Employee Personal Scoping
    console.log('\n--- 5. Employee Personal Custody & Activity Scoping ---');
    const empReportRes = await request('GET', '/api/reports/overview', { cookie: employeeCookie });
    assert(empReportRes.status === 200, 'Employee can fetch reports overview (200)');
    const empData = empReportRes.body;
    assert(empData?.metadata?.scope === 'EMPLOYEE', 'Employee scope is strictly EMPLOYEE');
    assert(empData?.metadata?.scopeLabel?.includes('Personal Custody'), 'Scope label indicates personal custody');

    // Employee resource count reflects only their custody
    assert(empData?.overview?.totalResources <= mgrData?.overview?.totalResources, 'Employee resource count is subset of department resources');

    // Employee custody by employee contains only the employee themselves
    const empCustodyList = empData?.custody?.byEmployee || [];
    const haileOnly = empCustodyList.every((e: any) => e.employeeName?.includes('Haile'));
    assert(haileOnly, 'Employee custody report does not leak colleagues custody data');

    // 6. Store Keeper & IT Technician Scope
    console.log('\n--- 6. Store Keeper & IT Technician Scopes ---');
    const storeReportRes = await request('GET', '/api/reports/overview', { cookie: storeKeeperCookie });
    assert(storeReportRes.status === 200, 'Store Keeper can fetch reports overview (200)');
    assert(storeReportRes.body?.metadata?.scope === 'STORE', 'Store Keeper scope is STORE');
    assert(storeReportRes.body?.custody?.totalUnassigned >= 0, 'Store Keeper sees inventory storage counts');

    const techReportRes = await request('GET', '/api/reports/overview', { cookie: techCookie });
    assert(techReportRes.status === 200, 'IT Technician can fetch reports overview (200)');
    assert(techReportRes.body?.metadata?.scope === 'TECHNICAL', 'IT Technician scope is TECHNICAL');
    assert(techReportRes.body?.maintenance?.byStatus?.total >= 0, 'IT Technician sees maintenance work orders');

    // 7. Filtering Capabilities
    console.log('\n--- 7. Filters: Category, Status, Maintenance Status, and Date ---');
    // Filter by Category: VEHICLES
    const vehicleFilterRes = await request('GET', '/api/reports/overview?category=VEHICLES', { cookie: adminCookie });
    assert(vehicleFilterRes.status === 200, 'Filter by category=VEHICLES returns 200');
    const vehCats = vehicleFilterRes.body?.distribution?.byCategory || [];
    const allVehicles = vehCats.every((c: any) => c.category === 'VEHICLES');
    assert(allVehicles, 'Category filter results contain ONLY category VEHICLES');

    // Filter by Status: AVAILABLE
    const availFilterRes = await request('GET', '/api/reports/overview?status=AVAILABLE', { cookie: adminCookie });
    assert(availFilterRes.status === 200, 'Filter by status=AVAILABLE returns 200');
    assert(availFilterRes.body?.overview?.assigned === 0, 'Status=AVAILABLE filter has 0 assigned in overview');
    assert(availFilterRes.body?.overview?.underMaintenance === 0, 'Status=AVAILABLE filter has 0 maintenance in overview');
    assert(
      availFilterRes.body?.overview?.available === availFilterRes.body?.overview?.totalResources,
      'Status=AVAILABLE matches total filtered resources'
    );

    // Filter by Maintenance Status: COMPLETED
    const completedMaintRes = await request('GET', '/api/reports/overview?maintenanceStatus=COMPLETED', { cookie: adminCookie });
    assert(completedMaintRes.status === 200, 'Filter by maintenanceStatus=COMPLETED returns 200');
    const mStatus = completedMaintRes.body?.maintenance?.byStatus;
    assert(mStatus?.SUBMITTED === 0, 'Completed maintenance filter has 0 SUBMITTED');
    assert(mStatus?.APPROVED === 0, 'Completed maintenance filter has 0 APPROVED');

    // Date Range Filter
    const dateRangeRes = await request('GET', '/api/reports/overview?startDate=2020-01-01&endDate=2030-12-31', { cookie: adminCookie });
    assert(dateRangeRes.status === 200, 'Date range filter (2020 to 2030) returns 200');
    assert(dateRangeRes.body?.metadata?.filtersApplied?.startDate === '2020-01-01', 'FiltersApplied records startDate');
    assert(dateRangeRes.body?.metadata?.filtersApplied?.endDate === '2030-12-31', 'FiltersApplied records endDate');

    // 8. Empty Dataset & Missing Financials Handling
    console.log('\n--- 8. Empty Dataset & Robustness ---');
    const emptyFilterRes = await request('GET', '/api/reports/overview?category=NON_EXISTENT_CAT_XYZ', { cookie: adminCookie });
    assert(emptyFilterRes.status === 200, 'Empty filter result returns 200 without throwing');
    const emptyData = emptyFilterRes.body;
    assert(emptyData?.overview?.totalResources === 0, 'Empty filter total resources is 0');
    assert(emptyData?.overview?.totalPurchaseCostETB === 0, 'Empty filter total purchase cost is 0 ETB');
    assert(emptyData?.overview?.totalCurrentValueETB === 0, 'Empty filter total current value is 0 ETB');
    assert(Array.isArray(emptyData?.distribution?.byCategory) && emptyData.distribution.byCategory.length === 0, 'Empty category distribution is empty array');
    assert(Array.isArray(emptyData?.recentActivities), 'Empty recent activities is empty array');

    console.log(`\nTests Completed: ${passed} passed, ${failed} failed.`);
    if (failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    if (testServer) {
      testServer.close();
    }
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('Test run error:', err);
  process.exit(1);
});
