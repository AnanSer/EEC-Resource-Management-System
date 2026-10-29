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
  console.log('EEC RMS: Requisition Workflow & My Assets Profile Tests');
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
    // 1. Authenticate All System Roles
    console.log('\n--- 1. Authenticating Roles ---');
    const adminCookie = await loginUser('admin@eec.gov.et');
    assert(!!adminCookie, 'ADMIN logged in');

    const storeKeeperCookie = await loginUser('storekeeper@eec.gov.et');
    assert(!!storeKeeperCookie, 'STORE_KEEPER logged in');

    const managerCookie = await loginUser('manager@eec.gov.et');
    assert(!!managerCookie, 'DEPARTMENT_MANAGER logged in');

    const employeeCookie = await loginUser('employee@eec.gov.et');
    assert(!!employeeCookie, 'EMPLOYEE logged in');

    // Verify session user details
    const meRes = await request('GET', '/api/auth/me', { cookie: employeeCookie });
    assert(meRes.status === 200, 'GET /api/auth/me returns 200');
    assert(!!meRes.body.user.employeeRecordId, 'Session user contains employeeRecordId');
    assert(meRes.body.user.employeeId === 'EEC-EMP-045', 'Session user has employeeId EEC-EMP-045');

    // 2. Fetch Departments and Employees
    const [deptTid, deptIct] = await Promise.all([
      prisma.department.findUnique({ where: { code: 'TID' } }),
      prisma.department.findUnique({ where: { code: 'ICT' } }),
    ]);

    const [empTid, empIct] = await Promise.all([
      prisma.employee.findFirst({ where: { departmentId: deptTid!.id, email: 'employee@eec.gov.et' } }),
      prisma.employee.findFirst({ where: { departmentId: deptIct!.id, email: 'technician@eec.gov.et' } }),
    ]);

    assert(!!empTid, 'Employee Haile Gebrselassie exists in TID');
    assert(!!empIct, 'Employee Kenenisa Bekele exists in ICT');

    // Create a dedicated AVAILABLE test resource
    const testAsset = await prisma.resource.create({
      data: {
        itemCode: `TEST-CAD-${Date.now()}`,
        name: 'HP ZBook Workstation G10',
        category: 'IT_EQUIPMENT',
        subcategory: 'Mobile CAD Station',
        status: 'AVAILABLE',
        condition: 'EXCELLENT',
        location: 'Central Store - Kersa',
        departmentId: deptIct!.id,
        purchaseCostETB: 185000,
        currentValueETB: 185000,
      },
    });

    // 3. Employee Submits Requisition
    console.log('\n--- 2. Employee Requisition Submission ---');
    const empReqRes = await request('POST', '/api/requisitions', {
      cookie: employeeCookie,
      body: {
        category: 'IT_EQUIPMENT',
        itemDescription: 'High-performance laptop for Modjo Highway CAD modeling',
        justification: 'Required for 3D bridge alignment and soil profile computation',
        urgency: 'URGENT',
        requiredDate: '2026-11-15',
      },
    });
    assert(empReqRes.status === 201, 'Employee successfully submitted requisition (201)');
    const req1 = empReqRes.body.requisition;
    assert(req1.status === 'PENDING', 'Requisition initial status is PENDING');
    assert(req1.departmentId === deptTid!.id, 'Requisition department correctly bound to employee department');
    assert(req1.employeeId === empTid!.id, 'Requisition employeeId correctly bound to employee record');

    // 4. Admin Approval & Rejection Gates
    console.log('\n--- 3. Admin Approval & Rejection Gates ---');
    // Store Keeper cannot approve
    const storeApproveFail = await request('POST', `/api/requisitions/${req1.id}/approve`, {
      cookie: storeKeeperCookie,
      body: { approvalComments: 'Unauthorized approval attempt' },
    });
    assert(storeApproveFail.status === 403, 'Store Keeper forbidden from approving requisition (403)');

    // Manager cannot approve (only Admin has approval authority)
    const mgrApproveFail = await request('POST', `/api/requisitions/${req1.id}/approve`, {
      cookie: managerCookie,
      body: { approvalComments: 'Manager approval attempt' },
    });
    assert(mgrApproveFail.status === 403, 'Department Manager forbidden from approving requisition (403)');

    // Admin approves requisition
    const adminApprove = await request('POST', `/api/requisitions/${req1.id}/approve`, {
      cookie: adminCookie,
      body: { approvalComments: 'Approved under TID expressway capital procurement budget' },
    });
    assert(adminApprove.status === 200, 'Admin successfully approved requisition (200)');
    assert(adminApprove.body.requisition.status === 'APPROVED', 'Requisition status transitioned to APPROVED');
    assert(adminApprove.body.requisition.approvalComments.includes('expressway capital'), 'Approval comments saved');

    // Test rejection flow with a second requisition
    const reqToReject = await prisma.resourceRequisition.create({
      data: {
        requisitionNumber: `REQ-REJ-${Date.now()}`,
        requesterId: 'test-user-id',
        requesterName: 'Test Staff',
        employeeId: empTid!.id,
        departmentId: deptTid!.id,
        category: 'VEHICLES',
        itemDescription: 'Sedan vehicle request',
        justification: 'City commute',
        status: 'PENDING',
      },
    });

    const adminReject = await request('POST', `/api/requisitions/${reqToReject.id}/reject`, {
      cookie: adminCookie,
      body: { reason: 'Vehicles must be pool-shared; individual sedan allocation not permitted' },
    });
    assert(adminReject.status === 200, 'Admin successfully rejected requisition (200)');
    assert(adminReject.body.requisition.status === 'REJECTED', 'Requisition status is REJECTED');

    // 5. Store Keeper Fulfillment (Admin & Others Forbidden)
    console.log('\n--- 4. Store Keeper Physical Fulfillment & Role Enforcement ---');
    // Employee cannot fulfill
    const empFulfillFail = await request('POST', `/api/requisitions/${req1.id}/fulfill`, {
      cookie: employeeCookie,
      body: { resourceId: testAsset.id },
    });
    assert(empFulfillFail.status === 403, 'Employee forbidden from fulfilling requisition (403)');

    // Admin cannot fulfill physical asset (must be Store Keeper)
    const adminFulfillFail = await request('POST', `/api/requisitions/${req1.id}/fulfill`, {
      cookie: adminCookie,
      body: { resourceId: testAsset.id },
    });
    assert(adminFulfillFail.status === 403, 'Admin forbidden from fulfilling physical asset (403)');

    // Department Manager cannot fulfill
    const mgrFulfillFail = await request('POST', `/api/requisitions/${req1.id}/fulfill`, {
      cookie: managerCookie,
      body: { resourceId: testAsset.id },
    });
    assert(mgrFulfillFail.status === 403, 'Department Manager forbidden from fulfilling requisition (403)');

    // Store Keeper fulfills approved requisition
    const storeFulfill = await request('POST', `/api/requisitions/${req1.id}/fulfill`, {
      cookie: storeKeeperCookie,
      body: {
        resourceId: testAsset.id,
        handoverNotes: 'Issued with AC adapter, laptop bag, and USB security key',
        location: 'TID Engineering Office - Room 302',
      },
    });
    assert(storeFulfill.status === 200, 'Store Keeper successfully fulfilled requisition (200)');
    assert(storeFulfill.body.requisition.status === 'FULFILLED', 'Requisition status updated to FULFILLED');
    assert(storeFulfill.body.resource.status === 'ASSIGNED', 'Physical resource status updated to ASSIGNED');

    // Verify DB state after fulfillment
    const fulfilledDbAsset = await prisma.resource.findUnique({ where: { id: testAsset.id } });
    assert(fulfilledDbAsset?.status === 'ASSIGNED', 'Database confirms asset status is ASSIGNED');
    assert(fulfilledDbAsset?.currentAssigneeId === empTid!.id, 'Database confirms currentAssigneeId is Haile Gebrselassie');

    const activeDbAssignment = await prisma.resourceAssignment.findFirst({
      where: { resourceId: testAsset.id, isCurrent: true, status: 'ACTIVE' },
    });
    assert(!!activeDbAssignment, 'Active ResourceAssignment created atomically');
    assert(activeDbAssignment?.employeeId === empTid!.id, 'Assignment linked to employee');

    // 6. Admin Direct Allocation Without Requisition
    console.log('\n--- 5. Admin Direct Allocation Workflow ---');
    const adminAllocRes = await request('POST', '/api/requisitions', {
      cookie: adminCookie,
      body: {
        category: 'SURVEYING_GEOTECHNICAL',
        itemDescription: 'Direct Total Station Allocation for Road Project',
        justification: 'Executive direction for rapid deployment',
        urgency: 'EMERGENCY_PROJECT',
        requiredDate: '2026-11-01',
        departmentId: deptTid!.id,
        employeeId: empTid!.id,
        isDirectAllocation: true,
      },
    });
    assert(adminAllocRes.status === 201, 'Admin initiated direct allocation (201)');
    assert(adminAllocRes.body.requisition.isDirectAllocation === true, 'isDirectAllocation is true');
    assert(adminAllocRes.body.requisition.status === 'APPROVED', 'Direct allocation is immediately APPROVED for Store Keeper fulfillment');

    // Admin CANNOT fulfill the direct allocation (Backend 403 check)
    const adminDirectFulfillFail = await request('POST', `/api/requisitions/${adminAllocRes.body.requisition.id}/fulfill`, {
      cookie: adminCookie,
      body: { resourceId: testAsset.id },
    });
    assert(adminDirectFulfillFail.status === 403, 'Admin receives 403 when trying to fulfill direct allocation');

    // 7. Employee "My Assets" & "My Custody" Verification
    console.log('\n--- 6. Employee My Assets Profile Verification ---');
    const myCustodyRes = await request('GET', '/api/assignments/my-custody', { cookie: employeeCookie });
    assert(myCustodyRes.status === 200, 'GET /api/assignments/my-custody returns 200');
    assert(myCustodyRes.body.totalActive >= 1, 'Employee has at least 1 active holding');
    const foundMyAsset = myCustodyRes.body.activeHoldings.find((a: any) => a.resourceId === testAsset.id);
    assert(!!foundMyAsset, 'Newly allocated asset appears in employee active custody');
    assert(foundMyAsset.resourceCode === testAsset.itemCode, 'Asset item code matches');
    assert(foundMyAsset.resourceName === testAsset.name, 'Asset name matches');
    assert(foundMyAsset.status === 'ACTIVE', 'Holding status is ACTIVE');

    const myAssetsRes = await request('GET', '/api/resources/my-assets', { cookie: employeeCookie });
    assert(myAssetsRes.status === 200, 'GET /api/resources/my-assets returns 200');
    const foundResource = myAssetsRes.body.resources.find((r: any) => r.id === testAsset.id);
    assert(!!foundResource, 'Asset found in GET /api/resources/my-assets');
    assert(foundResource.itemCode === testAsset.itemCode, 'Item code matches');
    assert(foundResource.status === 'ASSIGNED', 'Status is ASSIGNED');

    // 8. Custody Transfer Between Employees
    console.log('\n--- 7. Custody Transfer Updates My Assets ---');
    const transferRes = await request('POST', '/api/assignments/transfer', {
      cookie: storeKeeperCookie,
      body: {
        resourceId: testAsset.id,
        toEmployeeId: empIct!.id,
        reason: 'Relocated to ICT technician for diagnostic testing',
      },
    });
    assert(transferRes.status === 200, 'Custody transferred to empIct (200)');

    // After transfer: Employee Haile NO LONGER has it in active custody
    const myCustodyAfterTransfer = await request('GET', '/api/assignments/my-custody', { cookie: employeeCookie });
    const stillInCustody = myCustodyAfterTransfer.body.activeHoldings.some((a: any) => a.resourceId === testAsset.id);
    assert(!stillInCustody, 'Transferred asset is NO LONGER in employee active holdings');

    const inHistory = myCustodyAfterTransfer.body.historicalHoldings.some((a: any) => a.resourceId === testAsset.id);
    assert(inHistory, 'Transferred asset now preserved in employee past assignments history');

    // 9. Asset Return Workflow & Validation Edge Cases
    console.log('\n--- 8. Asset Return Workflow & Security Validations ---');
    // A. Attempting to return with mismatched employeeId fails with 400
    const mismatchEmpReturn = await request('POST', '/api/assignments/return', {
      cookie: storeKeeperCookie,
      body: {
        resourceId: testAsset.id,
        employeeId: empTid!.id, // currently assigned to empIct!
        condition: 'GOOD',
      },
    });
    assert(mismatchEmpReturn.status === 400, 'Return rejected when specifying incorrect employeeId (400)');
    assert(mismatchEmpReturn.body.message.includes('currently assigned to'), 'Error explains employee mismatch');

    // B. Store Keeper returns resource successfully using resourceId
    const returnRes = await request('POST', '/api/assignments/return', {
      cookie: storeKeeperCookie,
      body: {
        resourceId: testAsset.id,
        condition: 'NEEDS_REPAIR',
        returnLocation: 'Central Store - Kersa Repair Bay',
        notes: 'Testing complete, requires minor servicing',
      },
    });
    assert(returnRes.status === 200, 'Store Keeper successfully returned asset using resourceId (200)');
    assert(returnRes.body.resource.status === 'MAINTENANCE', 'Condition NEEDS_REPAIR routes resource to MAINTENANCE');
    assert(returnRes.body.assignment.status === 'RETURNED', 'Assignment status is RETURNED');
    assert(returnRes.body.assignment.isCurrent === false, 'Assignment isCurrent is false');

    const dbReturnedAsset = await prisma.resource.findUnique({ where: { id: testAsset.id } });
    assert(dbReturnedAsset?.currentAssigneeId === null, 'currentAssigneeId cleared to null');

    // C. Duplicate return on already returned asset rejected with 400
    const dupReturn = await request('POST', '/api/assignments/return', {
      cookie: storeKeeperCookie,
      body: { resourceId: testAsset.id },
    });
    assert(dupReturn.status === 400, 'Duplicate return on already returned asset rejected with 400');
    assert(dupReturn.body.message.includes('Only ASSIGNED resources can be returned'), 'Error validates ASSIGNED status requirement');

    // D. Test Return using assignmentId identifier resolution
    console.log('\n--- 9. Return by Assignment ID & Unassigned Rejection ---');
    // Create another asset and assign it
    const testAsset2 = await prisma.resource.create({
      data: {
        itemCode: `TEST-RET-${Date.now()}`,
        name: 'Trimble Field Collector TSC7',
        category: 'SURVEYING_GEOTECHNICAL',
        status: 'AVAILABLE',
        condition: 'EXCELLENT',
        location: 'Central Store - Kersa',
        departmentId: deptTid!.id,
        purchaseCostETB: 95000,
        currentValueETB: 95000,
      },
    });

    // Unassigned return attempt fails immediately with 400
    const unassignedReturnFail = await request('POST', '/api/assignments/return', {
      cookie: storeKeeperCookie,
      body: { resourceId: testAsset2.id },
    });
    assert(unassignedReturnFail.status === 400, 'Return rejected for unassigned AVAILABLE resource (400)');
    assert(unassignedReturnFail.body.message.includes('Only ASSIGNED resources can be returned'), 'Validates ASSIGNED state');

    // Assign testAsset2 to employee
    const directAsgn2 = await request('POST', '/api/assignments', {
      cookie: storeKeeperCookie,
      body: {
        resourceId: testAsset2.id,
        employeeId: empTid!.id,
        purpose: 'Field surveying assignment',
      },
    });
    assert(directAsgn2.status === 201, 'testAsset2 assigned successfully (201)');
    const asgn2Id = directAsgn2.body.assignment.id;

    // Return testAsset2 using assignmentId instead of resourceId
    const returnByAsgnId = await request('POST', '/api/assignments/return', {
      cookie: storeKeeperCookie,
      body: {
        assignmentId: asgn2Id,
        condition: 'GOOD',
        returnLocation: 'Central Store - Kersa',
        notes: 'Returned in good working order',
      },
    });
    assert(returnByAsgnId.status === 200, 'Store Keeper successfully returned asset using assignmentId (200)');
    assert(returnByAsgnId.body.resource.status === 'AVAILABLE', 'Resource status updated to AVAILABLE');
    assert(returnByAsgnId.body.assignment.id === asgn2Id, 'Closed assignment matches requested assignmentId');

    // Clean up testAsset2
    await prisma.resourceAssignment.deleteMany({ where: { resourceId: testAsset2.id } });
    await prisma.resource.delete({ where: { id: testAsset2.id } });
    console.log('  ✓ testAsset2 cleaned up');

    // Cleanup test records
    console.log('\n--- Cleanup Test Records ---');
    await prisma.custodyTransfer.deleteMany({ where: { resourceId: testAsset.id } });
    await prisma.resourceAssignment.deleteMany({ where: { resourceId: testAsset.id } });
    await prisma.resourceRequisition.deleteMany({
      where: {
        OR: [
          { id: req1.id },
          { id: reqToReject.id },
          { id: adminAllocRes.body.requisition.id },
        ],
      },
    });
    await prisma.resource.delete({ where: { id: testAsset.id } });
    console.log('  ✓ Test requisition records and asset safely cleaned up');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    if (testServer) {
      testServer.close();
    }
  }

  console.log('\n======================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('======================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();

