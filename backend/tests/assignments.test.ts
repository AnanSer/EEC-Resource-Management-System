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
  console.log('EEC RMS: Assignments & Custody Transfers Integration Tests');
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
    // 1. Unauthenticated Security Boundaries
    console.log('\n--- 1. Unauthenticated Security Boundaries ---');
    const unauthList = await request('GET', '/api/assignments');
    assert(unauthList.status === 401, 'GET /api/assignments requires authentication');

    const unauthHistory = await request('GET', '/api/assignments/history/invalid-id');
    assert(unauthHistory.status === 401, 'GET /api/assignments/history/:id requires authentication');

    const unauthAssign = await request('POST', '/api/assignments', { body: {} });
    assert(unauthAssign.status === 401, 'POST /api/assignments requires authentication');

    const unauthTransfer = await request('POST', '/api/assignments/transfer', { body: {} });
    assert(unauthTransfer.status === 401, 'POST /api/assignments/transfer requires authentication');

    const unauthReturn = await request('POST', '/api/assignments/return', { body: {} });
    assert(unauthReturn.status === 401, 'POST /api/assignments/return requires authentication');

    // 2. Login All Roles
    console.log('\n--- 2. Authenticating User Sessions ---');
    const adminCookie = await loginUser('admin@eec.gov.et');
    assert(!!adminCookie, 'ADMIN logged in');

    const storeKeeperCookie = await loginUser('storekeeper@eec.gov.et');
    assert(!!storeKeeperCookie, 'STORE_KEEPER logged in');

    const managerCookie = await loginUser('manager@eec.gov.et');
    assert(!!managerCookie, 'DEPARTMENT_MANAGER logged in');

    const techCookie = await loginUser('technician@eec.gov.et');
    assert(!!techCookie, 'IT_TECHNICIAN logged in');

    const employeeCookie = await loginUser('employee@eec.gov.et');
    assert(!!employeeCookie, 'EMPLOYEE logged in');

    // Fetch existing test departments, resources, and employees
    const [deptTid, deptIct] = await Promise.all([
      prisma.department.findUnique({ where: { code: 'TID' } }),
      prisma.department.findUnique({ where: { code: 'ICT' } }),
    ]);

    assert(!!deptTid, 'TID department exists');
    assert(!!deptIct, 'ICT department exists');

    const [empTid, empIct] = await Promise.all([
      prisma.employee.findFirst({ where: { departmentId: deptTid!.id, isActive: true } }),
      prisma.employee.findFirst({ where: { departmentId: deptIct!.id, isActive: true } }),
    ]);

    assert(!!empTid, 'Active employee in TID exists');
    assert(!!empIct, 'Active employee in ICT exists');

    // Create an inactive test employee to verify inactive checks
    const inactiveEmp = await prisma.employee.create({
      data: {
        employeeId: `TEST-INACT-${Date.now()}`,
        name: 'Inactive Test Staff',
        email: `inactive-${Date.now()}@eec.gov.et`,
        departmentId: deptTid!.id,
        designation: 'Former Engineer',
        isActive: false,
      },
    });

    // Create a dedicated test resource in TID
    const testResTid = await prisma.resource.create({
      data: {
        itemCode: `TEST-RES-TID-${Date.now()}`,
        name: 'Test Trimble GPS Receiver',
        category: 'SURVEYING_GEOTECHNICAL',
        status: 'AVAILABLE',
        condition: 'GOOD',
        location: 'TID Equipment Room',
        departmentId: deptTid!.id,
        purchaseCostETB: 350000,
        currentValueETB: 350000,
      },
    });

    // Create a dedicated test resource in ICT
    const testResIct = await prisma.resource.create({
      data: {
        itemCode: `TEST-RES-ICT-${Date.now()}`,
        name: 'Test Dell Precision Laptop',
        category: 'IT_EQUIPMENT',
        status: 'AVAILABLE',
        condition: 'EXCELLENT',
        location: 'Central Store - Kersa',
        departmentId: deptIct!.id,
        purchaseCostETB: 120000,
        currentValueETB: 120000,
      },
    });

    // 3. Unauthorized Roles Cannot Assign
    console.log('\n--- 3. Role Authorization on Assignment Creation ---');
    const empAssignAttempt = await request('POST', '/api/assignments', {
      cookie: employeeCookie,
      body: {
        resourceId: testResTid.id,
        employeeId: empTid!.id,
        purpose: 'Unauthorized attempt',
      },
    });
    assert(empAssignAttempt.status === 403, 'EMPLOYEE role forbidden from creating assignments (403)');

    const techAssignAttempt = await request('POST', '/api/assignments', {
      cookie: techCookie,
      body: {
        resourceId: testResTid.id,
        employeeId: empTid!.id,
        purpose: 'Technician attempt',
      },
    });
    assert(techAssignAttempt.status === 403, 'IT_TECHNICIAN role forbidden from creating assignments (403)');

    // 4. Inactive Employee & Validation Checks
    console.log('\n--- 4. Inactive Employee and Data Validation ---');
    const inactAttempt = await request('POST', '/api/assignments', {
      cookie: adminCookie,
      body: {
        resourceId: testResTid.id,
        employeeId: inactiveEmp.id,
        purpose: 'Attempting assignment to inactive employee',
      },
    });
    assert(inactAttempt.status === 400, 'Assigning to inactive employee fails with 400');
    assert(inactAttempt.body.message.includes('inactive'), 'Error message specifies employee is inactive');

    const missingFieldsAttempt = await request('POST', '/api/assignments', {
      cookie: adminCookie,
      body: {
        resourceId: testResTid.id,
      },
    });
    assert(missingFieldsAttempt.status === 400, 'Missing employeeId or purpose fails with 400');

    // 5. Department Manager Department Scoping & Cross-Department Protection
    console.log('\n--- 5. Department Manager Boundary Enforcement ---');
    // Manager tries to assign ICT resource (outside their department)
    const mgrCrossResourceAttempt = await request('POST', '/api/assignments', {
      cookie: managerCookie,
      body: {
        resourceId: testResIct.id,
        employeeId: empTid!.id,
        purpose: 'Cross-dept resource assignment',
      },
    });
    assert(mgrCrossResourceAttempt.status === 403, 'Manager forbidden from assigning resource belonging to another department (403)');

    // Manager tries to assign department resource to employee outside their department
    const mgrCrossEmpAttempt = await request('POST', '/api/assignments', {
      cookie: managerCookie,
      body: {
        resourceId: testResTid.id,
        employeeId: empIct!.id,
        purpose: 'Cross-dept employee assignment',
      },
    });
    assert(mgrCrossEmpAttempt.status === 403, 'Manager forbidden from assigning to employee in another department (403)');

    // 6. Direct Assignment by Department Manager (Within Department)
    console.log('\n--- 6. Successful Direct Assignment (Department Manager) ---');
    const mgrAssignRes = await request('POST', '/api/assignments', {
      cookie: managerCookie,
      body: {
        resourceId: testResTid.id,
        employeeId: empTid!.id,
        purpose: 'Modjo-Hawassa expressway alignment survey',
        expectedReturnDate: '2026-12-31',
        notes: 'Includes prism pole and bipod tripod',
      },
    });
    assert(mgrAssignRes.status === 201, 'Manager successfully assigned department resource to department employee (201)');
    assert(mgrAssignRes.body.assignment.status === 'ACTIVE', 'Assignment status is ACTIVE');
    assert(mgrAssignRes.body.assignment.isCurrent === true, 'Assignment is marked as isCurrent: true');
    assert(mgrAssignRes.body.resource.status === 'ASSIGNED', 'Resource status updated to ASSIGNED');

    // Verify DB state
    const assignedDbRes = await prisma.resource.findUnique({ where: { id: testResTid.id } });
    assert(assignedDbRes?.status === 'ASSIGNED', 'Database confirms resource status is ASSIGNED');
    assert(assignedDbRes?.currentAssigneeId === empTid!.id, 'Database confirms currentAssigneeId matches employee');

    // 7. Duplicate Assignment Prevention
    console.log('\n--- 7. Duplicate Active Assignment Prevention ---');
    const duplicateAttempt = await request('POST', '/api/assignments', {
      cookie: adminCookie,
      body: {
        resourceId: testResTid.id,
        employeeId: empTid!.id,
        purpose: 'Duplicate assignment attempt',
      },
    });
    assert(duplicateAttempt.status === 400 || duplicateAttempt.status === 409, 'Duplicate assignment on already assigned resource rejected');

    // 8. Custody Transfer Workflow
    console.log('\n--- 8. Custody Transfer Workflow ---');
    // Cannot transfer to same custodian
    const transferSameAttempt = await request('POST', '/api/assignments/transfer', {
      cookie: adminCookie,
      body: {
        resourceId: testResTid.id,
        toEmployeeId: empTid!.id,
        reason: 'Transfer to self',
      },
    });
    assert(transferSameAttempt.status === 400, 'Transferring to same custodian fails with 400');

    // Manager cannot transfer to another department
    const mgrCrossTransferAttempt = await request('POST', '/api/assignments/transfer', {
      cookie: managerCookie,
      body: {
        resourceId: testResTid.id,
        toEmployeeId: empIct!.id,
        reason: 'Manager transferring to ICT',
      },
    });
    assert(mgrCrossTransferAttempt.status === 403, 'Manager forbidden from inter-department transfer (403)');

    // Store Keeper / Admin transfers resource to empIct
    const validTransfer = await request('POST', '/api/assignments/transfer', {
      cookie: storeKeeperCookie,
      body: {
        resourceId: testResTid.id,
        toEmployeeId: empIct!.id,
        reason: 'Inter-departmental allocation for bridge design',
        notes: 'Transferred via Chief Store Keeper inspection',
      },
    });
    assert(validTransfer.status === 200, 'Store Keeper successfully transferred custody across departments (200)');
    assert(validTransfer.body.assignment.employeeId === empIct!.id, 'New assignment employee is empIct');
    assert(validTransfer.body.assignment.status === 'ACTIVE', 'New assignment is ACTIVE');
    assert(validTransfer.body.transfer.fromEmployeeId === empTid!.id, 'Transfer log records fromEmployee');
    assert(validTransfer.body.transfer.toEmployeeId === empIct!.id, 'Transfer log records toEmployee');

    // Verify DB state after transfer
    const pastAssignments = await prisma.resourceAssignment.findMany({
      where: { resourceId: testResTid.id },
      orderBy: { createdAt: 'asc' },
    });
    assert(pastAssignments.length === 2, 'Two assignment records exist for this resource');
    assert(pastAssignments[0].status === 'TRANSFERRED' && !pastAssignments[0].isCurrent, 'Previous assignment marked TRANSFERRED and isCurrent: false');
    assert(pastAssignments[1].status === 'ACTIVE' && pastAssignments[1].isCurrent, 'Current assignment marked ACTIVE and isCurrent: true');

    const transferRecords = await prisma.custodyTransfer.findMany({ where: { resourceId: testResTid.id } });
    assert(transferRecords.length === 1, 'CustodyTransfer record successfully created');

    // 9. Return Workflow
    console.log('\n--- 9. Asset Return Workflow ---');
    // Cannot return an unassigned resource
    const invalidReturn = await request('POST', '/api/assignments/return', {
      cookie: adminCookie,
      body: {
        resourceId: testResIct.id, // currently AVAILABLE
      },
    });
    assert(invalidReturn.status === 400, 'Returning unassigned resource fails with 400');

    // Return the assigned test resource
    const validReturn = await request('POST', '/api/assignments/return', {
      cookie: storeKeeperCookie,
      body: {
        resourceId: testResTid.id,
        condition: 'GOOD',
        returnLocation: 'Central Store - Kersa',
        notes: 'Inspection verified clean and functional',
      },
    });
    assert(validReturn.status === 200, 'Asset return processed successfully (200)');
    assert(validReturn.body.resource.status === 'AVAILABLE', 'Resource status reset to AVAILABLE');
    assert(validReturn.body.assignment.status === 'RETURNED', 'Active assignment marked RETURNED');
    assert(validReturn.body.assignment.isCurrent === false, 'Assignment marked isCurrent: false');

    // Verify DB state after return
    const returnedDbRes = await prisma.resource.findUnique({ where: { id: testResTid.id } });
    assert(returnedDbRes?.status === 'AVAILABLE', 'DB confirms status is AVAILABLE');
    assert(returnedDbRes?.currentAssigneeId === null, 'DB confirms currentAssigneeId cleared to null');

    // 10. History Timeline Inspection
    console.log('\n--- 10. Custody History and Timeline ---');
    const historyRes = await request('GET', `/api/assignments/history/${testResTid.id}`, {
      cookie: adminCookie,
    });
    assert(historyRes.status === 200, 'GET /api/assignments/history/:id returns 200');
    assert(historyRes.body.assignments.length === 2, 'History contains 2 assignment records');
    assert(historyRes.body.transfers.length === 1, 'History contains 1 transfer record');
    assert(historyRes.body.timeline.length >= 4, 'Timeline contains chronological events (Intake, Assign, Transfer, Return)');

    // Cross-department history access for department manager
    const mgrHistoryRes = await request('GET', `/api/assignments/history/${testResIct.id}`, {
      cookie: managerCookie,
    });
    assert(mgrHistoryRes.status === 403, 'Manager forbidden from viewing history of another department asset (403)');

    // 11. Assignment List Scoping
    console.log('\n--- 11. Assignment List Scoping ---');
    const adminList = await request('GET', '/api/assignments', { cookie: adminCookie });
    assert(adminList.status === 200, 'Admin can list assignments');

    const mgrList = await request('GET', '/api/assignments', { cookie: managerCookie });
    assert(mgrList.status === 200, 'Manager can list assignments');
    const mgrDepts = new Set(mgrList.body.assignments.map((a: any) => a.departmentId));
    assert(mgrDepts.size <= 1 && (!mgrDepts.size || mgrDepts.has(deptTid!.id)), 'Manager sees only their own department assignments');

    // Cleanup test records
    console.log('\n--- Cleanup Test Records ---');
    await prisma.custodyTransfer.deleteMany({ where: { resourceId: testResTid.id } });
    await prisma.resourceAssignment.deleteMany({ where: { resourceId: testResTid.id } });
    await prisma.resource.delete({ where: { id: testResTid.id } });
    await prisma.resource.delete({ where: { id: testResIct.id } });
    await prisma.employee.delete({ where: { id: inactiveEmp.id } });
    console.log('  ✓ Test resources and assignments safely cleaned up');

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

