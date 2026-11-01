process.env.RMS_TEST_MODE = '1';
import http from 'node:http';
import prisma from '../src/lib/prisma';
import { AddressInfo } from 'node:net';

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

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`, detail || '');
    failed++;
    throw new Error(testName);
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('EEC RMS: Employee Dossier & My Profile Consistency Tests');
  console.log('================================================================');

  await createTestServer();
  console.log(`Test server running at ${baseUrl}`);

  try {
    // 1. Authenticate Roles
    console.log('\n--- 1. Authenticating Roles ---');
    const adminLogin = await request('POST', '/api/auth/login', {
      body: { email: 'admin@eec.gov.et', password: 'EEC-Secure2026!' },
    });
    assert(adminLogin.status === 200, 'Admin login succeeded (200)');
    const adminCookie = adminLogin.cookie!;

    const haileLogin = await request('POST', '/api/auth/login', {
      body: { email: 'employee@eec.gov.et', password: 'EEC-Secure2026!' },
    });
    assert(haileLogin.status === 200, 'Haile Gebrselassie (employee) login succeeded (200)');
    const haileCookie = haileLogin.cookie!;

    const mgrLogin = await request('POST', '/api/auth/login', {
      body: { email: 'manager@eec.gov.et', password: 'EEC-Secure2026!' },
    });
    assert(mgrLogin.status === 200, 'Department Manager login succeeded (200)');
    const managerCookie = mgrLogin.cookie!;

    // 2. Query Haile's Personal Account View (/api/assignments/my-custody & /api/requisitions)
    console.log('\n--- 2. Employee Personal Account View (Haile Gebrselassie) ---');
    const myCustodyRes = await request('GET', '/api/assignments/my-custody', { cookie: haileCookie });
    assert(myCustodyRes.status === 200, 'GET /api/assignments/my-custody returns 200');
    assert(myCustodyRes.body.activeHoldings.length === 2, 'Employee account displays exactly 2 active holdings');
    assert(myCustodyRes.body.historicalHoldings.length === 4, 'Employee account displays exactly 4 past assignments');
    assert(myCustodyRes.body.totalActive === 2, 'Employee totalActive count is 2');

    const activeItemCodes = myCustodyRes.body.activeHoldings.map((h: any) => h.resourceCode || h.resource?.itemCode).sort();
    console.log('    Active Holding Codes (Employee):', activeItemCodes);

    const myReqsRes = await request('GET', '/api/requisitions', { cookie: haileCookie });
    assert(myReqsRes.status === 200, 'GET /api/requisitions returns 200');
    assert(myReqsRes.body.requisitions.length === 4, 'Employee account displays exactly 4 requisitions');

    // 3. Query Admin Employee Dossier View (/api/employees/:id)
    console.log('\n--- 3. Admin Employee Dossier View (Haile Gebrselassie) ---');
    const dossierRes = await request('GET', '/api/employees/EEC-EMP-045', { cookie: adminCookie });
    assert(dossierRes.status === 200, 'Admin GET /api/employees/EEC-EMP-045 returns 200');

    // Verify contract has both top-level and profile/dossier objects
    const assignedResources = dossierRes.body.assignedResources || dossierRes.body.profile?.assignedResources;
    const assignments = dossierRes.body.assignments || dossierRes.body.profile?.assignments;
    const requisitions = dossierRes.body.requisitions || dossierRes.body.profile?.requisitions;
    const maintenanceRequests = dossierRes.body.maintenanceRequests || dossierRes.body.profile?.maintenanceRequests;
    const transfers = dossierRes.body.transfers || dossierRes.body.profile?.transfers;

    assert(Array.isArray(assignedResources), 'Dossier contains assignedResources array');
    assert(Array.isArray(assignments), 'Dossier contains assignments array');
    assert(Array.isArray(requisitions), 'Dossier contains requisitions array');
    assert(Array.isArray(maintenanceRequests), 'Dossier contains maintenanceRequests array');
    assert(Array.isArray(transfers), 'Dossier contains transfers array');

    // Active Equipment Held Consistency
    assert(assignedResources.length === 2, `Admin dossier reflects exactly 2 active assets (got ${assignedResources.length})`);
    const dossierItemCodes = assignedResources.map((r: any) => r.itemCode).sort();
    console.log('    Active Holding Codes (Admin):', dossierItemCodes);
    assert(JSON.stringify(activeItemCodes) === JSON.stringify(dossierItemCodes), 'Admin dossier and Employee view show the identical 2 current assets');

    // Assignment History Consistency
    assert(assignments.length === 6, `Admin dossier reflects all 6 lifetime assignments (got ${assignments.length})`);
    const activeInDossier = assignments.filter((a: any) => a.isCurrent && a.status === 'ACTIVE');
    const pastInDossier = assignments.filter((a: any) => !a.isCurrent || a.status !== 'ACTIVE');
    assert(activeInDossier.length === 2, 'Admin dossier assignments contains exactly 2 active assignments');
    assert(pastInDossier.length === 4, 'Admin dossier assignments contains exactly 4 historical assignments');

    // Requisitions Consistency
    assert(requisitions.length === 4, `Admin dossier reflects exactly 4 requisitions (got ${requisitions.length})`);
    const reqNumbersEmployee = myReqsRes.body.requisitions.map((r: any) => r.requisitionNumber).sort();
    const reqNumbersAdmin = requisitions.map((r: any) => r.requisitionNumber).sort();
    assert(JSON.stringify(reqNumbersEmployee) === JSON.stringify(reqNumbersAdmin), 'Admin dossier and Employee view show identical 4 requisitions');

    // Maintenance & Transfers
    assert(maintenanceRequests.length === 36, `Admin dossier reflects 36 maintenance reports (got ${maintenanceRequests.length})`);
    assert(transfers.length === 2, `Admin dossier reflects 2 custody transfers (got ${transfers.length})`);

    // 4. Employee Directory Listing Counts Consistency (/api/employees)
    console.log('\n--- 4. Employee Directory Card Metrics Consistency ---');
    const directoryRes = await request('GET', '/api/employees?search=Haile', { cookie: adminCookie });
    assert(directoryRes.status === 200, 'GET /api/employees directory returns 200');
    const haileCard = directoryRes.body.employees.find((e: any) => e.employeeId === 'EEC-EMP-045');
    assert(!!haileCard, 'Found Haile card in employee directory');
    assert(haileCard.assignedResourcesCount === 2, `Directory card assignedResourcesCount is 2 (got ${haileCard.assignedResourcesCount})`);
    assert(haileCard.assignmentsCount === 6, `Directory card assignmentsCount is 6 (got ${haileCard.assignmentsCount})`);
    assert(haileCard.requisitionsCount === 4, `Directory card requisitionsCount is 4 (got ${haileCard.requisitionsCount})`);

    // 5. Department Manager Authorization & Boundaries
    console.log('\n--- 5. Department Manager Scoping & Boundary Verification ---');
    // Manager is in dept-101 (Haile's department) -> Allowed
    const mgrHaileRes = await request('GET', '/api/employees/EEC-EMP-045', { cookie: managerCookie });
    assert(mgrHaileRes.status === 200, 'Department Manager can view dossier of employee in their own department (dept-101)');
    assert(mgrHaileRes.body.assignedResources.length === 2, 'Manager sees accurate 2 active assets');

    // Manager viewing employee in dept-107 (Abebe Bikila or Kenenisa Bekele) -> 403 Forbidden
    const abebeInDb = await prisma.employee.findFirst({ where: { departmentId: 'dept-107' } });
    if (abebeInDb) {
      const foreignRes = await request('GET', `/api/employees/${abebeInDb.id}`, { cookie: managerCookie });
      assert(foreignRes.status === 403, 'Department Manager blocked with 403 when attempting to view foreign department employee');
    }

    // 6. Unrelated Employees Are Not Affected
    console.log('\n--- 6. Unrelated Employees Verification ---');
    if (abebeInDb) {
      const adminAbebeRes = await request('GET', `/api/employees/${abebeInDb.id}`, { cookie: adminCookie });
      assert(adminAbebeRes.status === 200, 'Admin can view other employees (Abebe Bikila) normally');
      assert(adminAbebeRes.body.employee.id === abebeInDb.id, 'Employee record matches requested ID');
    }

    console.log('\n================================================================');
    console.log(`Dossier Consistency Tests Completed: ${passed} passed, ${failed} failed!`);
    console.log('================================================================');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

