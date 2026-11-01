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
  console.log('EEC RMS: Genuine Active Custody & Direct Return Verification');
  console.log('================================================================');

  await createTestServer();
  console.log(`Test server running at ${baseUrl}`);

  let testResourceId: string | null = null;
  let testAssignmentId: string | null = null;
  let staleResourceId: string | null = null;

  try {
    // 1. Authenticate Store Keeper & Admin
    console.log('\n--- 1. Authenticating Roles ---');
    const storeKeeperLogin = await request('POST', '/api/auth/login', {
      body: { email: 'storekeeper@eec.gov.et', password: 'EEC-Secure2026!' },
    });
    assert(storeKeeperLogin.status === 200, 'Store Keeper login succeeded (200)');
    const storeKeeperCookie = storeKeeperLogin.cookie!;

    const adminLogin = await request('POST', '/api/auth/login', {
      body: { email: 'admin@eec.gov.et', password: 'EEC-Secure2026!' },
    });
    assert(adminLogin.status === 200, 'Admin login succeeded (200)');
    const adminCookie = adminLogin.cookie!;

    // 2. Fetch Authoritative Return-Eligible Resources (/api/assignments/return-eligible)
    console.log('\n--- 2. Fetching Return-Eligible Resources ---');
    const eligibleRes = await request('GET', '/api/assignments/return-eligible', {
      cookie: storeKeeperCookie,
    });
    assert(eligibleRes.status === 200, 'GET /api/assignments/return-eligible returns 200');
    assert(Array.isArray(eligibleRes.body.resources), 'Returns an array of resources');
    assert(eligibleRes.body.resources.length > 0, 'Found return-eligible assigned resources');

    // Also verify /api/resources/return-eligible returns 200
    const resEligible = await request('GET', '/api/resources/return-eligible', {
      cookie: storeKeeperCookie,
    });
    assert(resEligible.status === 200, 'GET /api/resources/return-eligible returns 200');
    assert(resEligible.body.resources.length === eligibleRes.body.resources.length, 'Both endpoints return identical count');

    // 3. Strict Verification: Haile Gebrselassie Custody (Exact 2 Active Assets)
    console.log('\n--- 3. Verifying Haile Gebrselassie Active Custody ---');
    const haileSearchRes = await request('GET', '/api/assignments/return-eligible?search=Haile', {
      cookie: storeKeeperCookie,
    });
    assert(haileSearchRes.status === 200, 'Search for "Haile" returns 200');
    const haileResources = haileSearchRes.body.resources;
    console.log('    Returned assets for "Haile":', haileResources.map((r: any) => `${r.itemCode} - ${r.name}`));

    assert(haileResources.length === 2, `Searching "Haile" returns EXACTLY 2 resources (got ${haileResources.length})`);

    const haileCodes = haileResources.map((r: any) => r.itemCode).sort();
    assert(haileCodes.includes('EEC-CUSTODY-TEST-01'), 'Haile active asset 1 is EEC-CUSTODY-TEST-01');
    assert(haileCodes.includes('EEC-VEHC-2023-044'), 'Haile active asset 2 is EEC-VEHC-2023-044');

    // Verify all returned Haile assets have correct custodian fields
    for (const hr of haileResources) {
      assert(hr.currentAssigneeName === 'Haile Gebrselassie', `Asset ${hr.itemCode} custodian is Haile Gebrselassie`);
      assert(hr.currentAssigneeEmployeeId === 'EEC-EMP-045', `Asset ${hr.itemCode} employee ID is EEC-EMP-045`);
      assert(hr.status === 'ASSIGNED', `Asset ${hr.itemCode} status is ASSIGNED`);
    }

    // 4. Verify Returned, Transferred, and Unassigned Resources NEVER appear
    console.log('\n--- 4. Negative Verification: Ineligible Resources Never Appear ---');
    const allEligibleCodes = eligibleRes.body.resources.map((r: any) => r.itemCode);

    // Returned resources
    assert(!allEligibleCodes.includes('EEC-CUSTODY-TEST-04'), 'Returned asset EEC-CUSTODY-TEST-04 is NOT in eligible list');
    const returnedSearch = await request('GET', '/api/assignments/return-eligible?search=EEC-CUSTODY-TEST-04', {
      cookie: storeKeeperCookie,
    });
    assert(returnedSearch.body.resources.length === 0, 'Direct search for returned asset EEC-CUSTODY-TEST-04 returns 0 results');

    // Transferred resources
    assert(!allEligibleCodes.includes('EEC-VEHC-2026-3557'), 'Transferred asset EEC-VEHC-2026-3557 is NOT in eligible list');
    assert(!allEligibleCodes.includes('EEC-VEHC-2022-081'), 'Transferred asset EEC-VEHC-2022-081 is NOT in eligible list');

    // Unassigned resources
    assert(!allEligibleCodes.includes('EEC-CUSTODY-TEST-02'), 'Unassigned asset EEC-CUSTODY-TEST-02 is NOT in eligible list');
    assert(!allEligibleCodes.includes('EEC-CUSTODY-TEST-05'), 'Unassigned asset EEC-CUSTODY-TEST-05 is NOT in eligible list');

    // 5. Verification: Stale currentAssigneeId Resource Never Appears
    console.log('\n--- 5. Synthetic Stale Record Test (Inconsistent Custody Rejection) ---');
    const dept = await prisma.department.findFirst();
    const haile = await prisma.employee.findFirst({ where: { employeeId: 'EEC-EMP-045' } });

    // Create a resource with status ASSIGNED and currentAssigneeId = Haile, BUT NO active assignment
    const staleRes = await prisma.resource.create({
      data: {
        itemCode: `TEST-STALE-${Date.now()}`,
        name: 'Synthetic Stale Test Asset',
        category: 'IT_EQUIPMENT',
        status: 'ASSIGNED',
        condition: 'GOOD',
        departmentId: dept!.id,
        currentAssigneeId: haile!.id,
        purchaseDate: new Date(),
        purchaseCostETB: 10000,
        currentValueETB: 10000,
      },
    });
    staleResourceId = staleRes.id;

    // Check return-eligible query
    const checkStaleRes = await request('GET', `/api/assignments/return-eligible?search=${staleRes.itemCode}`, {
      cookie: storeKeeperCookie,
    });
    assert(
      checkStaleRes.body.resources.length === 0,
      'Resource with status=ASSIGNED but NO active assignment is REJECTED by /return-eligible'
    );

    // Also attempt POST /api/assignments/return on this stale resource
    const returnStaleRes = await request('POST', '/api/assignments/return', {
      cookie: storeKeeperCookie,
      body: {
        resourceId: staleRes.id,
        condition: 'GOOD',
        returnLocation: 'Central Store - Kersa',
        notes: 'Attempting to return stale resource',
      },
    });
    assert(returnStaleRes.status === 400, 'POST /return rejected stale resource with 400 Bad Request');
    console.log('    Stale return rejection message:', returnStaleRes.body.message);

    // 6. Other Employees Active Custody
    console.log('\n--- 6. Other Employees Active Custody Search ---');
    const solomonSearch = await request('GET', '/api/assignments/return-eligible?search=Solomon', {
      cookie: storeKeeperCookie,
    });
    assert(solomonSearch.status === 200, 'Search for Solomon returns 200');
    assert(solomonSearch.body.resources.length === 4, `Solomon active holdings count is 4 (got ${solomonSearch.body.resources.length})`);

    const abebeSearch = await request('GET', '/api/assignments/return-eligible?search=Abebe', {
      cookie: storeKeeperCookie,
    });
    assert(abebeSearch.status === 200, 'Search for Abebe returns 200');
    assert(abebeSearch.body.resources.length === 1, `Abebe active holdings count is 1 (got ${abebeSearch.body.resources.length})`);
    assert(abebeSearch.body.resources[0].itemCode === 'EEC-IT-2024-0012', 'Abebe active asset is EEC-IT-2024-0012');

    // 7. Legitimate Direct Return Lifecycle
    console.log('\n--- 7. Legitimate Direct Return Lifecycle ---');
    const testItemCode = `TEST-LEGIT-${Date.now()}`;
    const legitResource = await prisma.resource.create({
      data: {
        itemCode: testItemCode,
        name: 'Legitimate Direct Return Test Rig',
        category: 'IT_EQUIPMENT',
        serialNumber: 'SN-LEGIT-9921',
        status: 'ASSIGNED',
        condition: 'GOOD',
        departmentId: dept!.id,
        currentAssigneeId: haile!.id,
        purchaseDate: new Date(),
        purchaseCostETB: 35000,
        currentValueETB: 35000,
      },
    });
    testResourceId = legitResource.id;

    const legitAssignment = await prisma.resourceAssignment.create({
      data: {
        assignmentNumber: `ASGN-LEGIT-${Date.now()}`,
        resourceId: legitResource.id,
        employeeId: haile!.id,
        departmentId: dept!.id,
        assignedByName: 'Store Keeper Supervisor',
        isCurrent: true,
        status: 'ACTIVE',
        purpose: 'Direct Return Verification',
      },
    });
    testAssignmentId = legitAssignment.id;

    // Verify it appears in return-eligible list
    const beforeReturnSearch = await request('GET', `/api/assignments/return-eligible?search=${testItemCode}`, {
      cookie: storeKeeperCookie,
    });
    assert(beforeReturnSearch.body.resources.length === 1, 'Legitimate active asset appears in /return-eligible');

    // Execute direct return
    const directReturnRes = await request('POST', '/api/assignments/return', {
      cookie: storeKeeperCookie,
      body: {
        resourceId: legitResource.id,
        condition: 'GOOD',
        returnLocation: 'Central Store - Kersa, Room 12',
        notes: 'Legitimate direct walk-in return completed',
      },
    });
    assert(directReturnRes.status === 200, 'Direct return returned 200 OK');
    assert(directReturnRes.body.success === true, 'Direct return response indicates success');

    // Verify DB state
    const postDbResource = await prisma.resource.findUnique({ where: { id: legitResource.id } });
    assert(postDbResource?.status === 'AVAILABLE', 'Resource transitioned to AVAILABLE');
    assert(postDbResource?.currentAssigneeId === null, 'Resource currentAssigneeId nullified');

    const postDbAssignment = await prisma.resourceAssignment.findUnique({ where: { id: legitAssignment.id } });
    assert(postDbAssignment?.status === 'RETURNED', 'Assignment status is RETURNED');
    assert(postDbAssignment?.isCurrent === false, 'Assignment isCurrent is false');

    // Verify immediately drops from return-eligible list
    const afterReturnSearch = await request('GET', `/api/assignments/return-eligible?search=${testItemCode}`, {
      cookie: storeKeeperCookie,
    });
    assert(afterReturnSearch.body.resources.length === 0, 'Returned asset immediately disappears from /return-eligible');

    // 8. Reject Duplicate Return
    console.log('\n--- 8. Duplicate Return Rejection ---');
    const duplicateReturnRes = await request('POST', '/api/assignments/return', {
      cookie: storeKeeperCookie,
      body: {
        resourceId: legitResource.id,
        condition: 'GOOD',
        returnLocation: 'Central Store - Kersa',
        notes: 'Attempting duplicate return',
      },
    });
    assert(duplicateReturnRes.status === 400, 'Duplicate return of AVAILABLE resource rejected with 400 Bad Request');
    console.log('    Duplicate return message:', duplicateReturnRes.body.message);

    console.log('\n================================================================');
    console.log(`ALL TESTS PASSED: ${passed}/${passed + failed}`);
    console.log('================================================================');
  } finally {
    // Clean up test records
    if (testAssignmentId) {
      await prisma.resourceAssignment.deleteMany({ where: { id: testAssignmentId } });
    }
    if (testResourceId) {
      await prisma.auditEvent.deleteMany({ where: { resourceId: testResourceId } });
      await prisma.notification.deleteMany({ where: { relatedEntityId: testResourceId } });
      await prisma.resource.deleteMany({ where: { id: testResourceId } });
    }
    if (staleResourceId) {
      await prisma.resource.deleteMany({ where: { id: staleResourceId } });
    }
    if (server) {
      server.close();
    }
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
