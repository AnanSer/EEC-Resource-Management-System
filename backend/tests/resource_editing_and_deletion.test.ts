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
  console.log('========================================================================');
  console.log('EEC RMS: Resource Editing Details & Safe Deletion Policy Tests');
  console.log('========================================================================');

  const { server } = await import('../src/index.js');
  await new Promise<void>((resolve) => {
    testServer = server.listen(0, () => {
      const addr = testServer.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      console.log(`Test server listening on ${baseUrl}`);
      resolve();
    });
  });

  const createdResourceIds: string[] = [];
  const createdAssignmentIds: string[] = [];
  const createdMaintenanceIds: string[] = [];

  try {
    console.log('\n--- 1. Authenticating Roles ---');
    const adminCookie = await loginUser('admin@eec.gov.et');
    assert(Boolean(adminCookie), 'ADMIN authenticated successfully');

    const storeKeeperCookie = await loginUser('storekeeper@eec.gov.et');
    assert(Boolean(storeKeeperCookie), 'STORE_KEEPER authenticated successfully');

    const empCookie = await loginUser('employee@eec.gov.et');
    assert(Boolean(empCookie), 'EMPLOYEE authenticated successfully');

    const depts = await prisma.department.findMany({ take: 2 });
    assert(depts.length >= 2, 'Found at least 2 corporate departments');
    const dept1 = depts[0].id;
    const dept2 = depts[1].id;

    const employees = await prisma.employee.findMany({ take: 1 });
    assert(employees.length > 0, 'Found employee for assignment tests');
    const testEmp = employees[0];

    // --- 2. Admin Resource Details Editing ---
    console.log('\n--- 2. Admin Resource Details Editing ---');

    const serialA = `EDIT-TEST-SN-A-${Date.now()}`;
    const createRes = await request('POST', '/api/resources', {
      cookie: adminCookie,
      body: {
        name: 'HP ZBook Studio G9 Mobile Workstation',
        category: 'IT_EQUIPMENT',
        subcategory: 'Mobile Workstation',
        departmentId: dept1,
        location: 'Central Store - Kersa, Bay 1',
        manufacturer: 'HP Inc.',
        model: 'ZBook Studio G9',
        serialNumber: serialA,
        condition: 'GOOD',
        purchaseCostETB: 125000,
        purchaseDate: '2026-02-01',
        warrantyExpiry: '2029-02-01',
        supplier: 'HP Enterprise East Africa',
        description: 'Initial engineering workstation configuration',
        notes: 'Assigned for initial testing',
        itSpecs: {
          computerType: 'Laptop',
          os: 'Windows 11 Pro',
          processor: 'Intel Core i9-12900H',
          ramGb: 32,
          storageGb: 1000,
        },
      },
    });

    assert(createRes.status === 201, 'Test resource created successfully for edit tests');
    const resA = createRes.body?.resource;
    assert(Boolean(resA?.id), 'Resource has valid ID');
    createdResourceIds.push(resA.id);

    // Edit full resource details
    const editPayload = {
      name: 'HP ZBook Studio G9 Mobile Workstation (Advanced Edition)',
      category: 'IT_EQUIPMENT',
      subcategory: 'High-Performance Workstation',
      departmentId: dept2, // transfer owning department
      location: 'Kersa Annex Building - Tech Lab',
      condition: 'EXCELLENT',
      manufacturer: 'HP Technologies Inc.',
      model: 'ZBook Studio G9 Max',
      serialNumber: `${serialA}-REV1`,
      purchaseCostETB: 140000,
      warrantyExpiry: '2030-02-01',
      supplier: 'HP East Africa Direct',
      description: 'Upgraded high-performance workstation for advanced geotechnical simulation',
      notes: 'RAM and NVMe expanded under corporate service contract',
      itSpecs: {
        computerType: 'Workstation',
        os: 'Windows 11 Pro Enterprise',
        processor: 'Intel Core i9-12900H vPro',
        ramGb: 64,
        storageGb: 2000,
        storage: '2TB NVMe Gen4 SSD',
      },
    };

    const editRes = await request('PUT', `/api/resources/${resA.id}`, {
      cookie: adminCookie,
      body: editPayload,
    });

    assert(editRes.status === 200, 'Admin can edit existing resource details (200 OK)');
    assert(
      editRes.body?.resource?.name === 'HP ZBook Studio G9 Mobile Workstation (Advanced Edition)',
      'Resource name updated'
    );
    assert(editRes.body?.resource?.departmentId === dept2, 'Department ownership updated to dept2');
    assert(editRes.body?.resource?.location === 'Kersa Annex Building - Tech Lab', 'Storage location updated');
    assert(editRes.body?.resource?.condition === 'EXCELLENT', 'Condition updated');
    assert(editRes.body?.resource?.purchaseCostETB === 140000, 'Purchase cost updated');
    assert(editRes.body?.resource?.serialNumber === `${serialA}-REV1`, 'Serial number updated');
    assert(editRes.body?.resource?.specs?.ramGb === 64, 'Category-specific IT specs updated (RAM 64GB)');
    assert(
      editRes.body?.resource?.itemCode === resA.itemCode,
      'Original corporate itemCode preserved intact'
    );

    // Verify GET /api/resources/:id reflects all updated fields
    const getFreshRes = await request('GET', `/api/resources/${resA.id}`, {
      cookie: adminCookie,
    });
    assert(getFreshRes.status === 200, 'GET /api/resources/:id returns 200 OK');
    assert(
      getFreshRes.body?.resource?.name === editPayload.name,
      'Fetched resource confirms updated name'
    );
    assert(
      getFreshRes.body?.resource?.specs?.os === 'Windows 11 Pro Enterprise',
      'Fetched resource confirms updated OS'
    );

    // --- 3. Preserving Optional Fields on Partial Update ---
    console.log('\n--- 3. Preserving Optional Fields on Partial Update ---');

    const partialUpdateRes = await request('PUT', `/api/resources/${resA.id}`, {
      cookie: adminCookie,
      body: {
        notes: 'Routine inventory verification complete. Everything functional.',
      },
    });

    assert(partialUpdateRes.status === 200, 'Partial update succeeds with 200 OK');
    assert(
      partialUpdateRes.body?.resource?.notes === 'Routine inventory verification complete. Everything functional.',
      'Notes updated successfully'
    );
    assert(
      partialUpdateRes.body?.resource?.name === editPayload.name,
      'Previous resource name preserved'
    );
    assert(
      partialUpdateRes.body?.resource?.serialNumber === `${serialA}-REV1`,
      'Previous serial number preserved'
    );
    assert(
      partialUpdateRes.body?.resource?.manufacturer === editPayload.manufacturer,
      'Previous manufacturer preserved'
    );
    assert(
      partialUpdateRes.body?.resource?.specs?.ramGb === 64,
      'Category-specific specs preserved on partial update'
    );

    // --- 4. Duplicate Serial Number Validation (Excluding Self) ---
    console.log('\n--- 4. Duplicate Serial Number Validation (Excluding Self) ---');

    // Create a second resource B with a distinct serial number
    const serialB = `EDIT-TEST-SN-B-${Date.now()}`;
    const createBRes = await request('POST', '/api/resources', {
      cookie: adminCookie,
      body: {
        name: 'Lenovo ThinkPad P16 Workstation',
        category: 'IT_EQUIPMENT',
        departmentId: dept1,
        serialNumber: serialB,
      },
    });
    assert(createBRes.status === 201, 'Resource B created with distinct serial number');
    const resB = createBRes.body?.resource;
    createdResourceIds.push(resB.id);

    // Updating Resource A to have Resource B's serial number must be rejected
    const dupSerialAttempt = await request('PUT', `/api/resources/${resA.id}`, {
      cookie: adminCookie,
      body: {
        serialNumber: serialB,
      },
    });

    assert(dupSerialAttempt.status === 409, 'Updating to duplicate serial number rejected with 409 Conflict');
    assert(
      dupSerialAttempt.body?.message?.includes(serialB),
      'Error message clearly identifies the conflicting serial number'
    );

    // Updating Resource A keeping its OWN current serial number must succeed
    const selfSerialAttempt = await request('PUT', `/api/resources/${resA.id}`, {
      cookie: adminCookie,
      body: {
        name: 'HP ZBook Studio G9 Mobile Workstation (Confirmed)',
        serialNumber: `${serialA}-REV1`, // its own current serial number
      },
    });

    assert(
      selfSerialAttempt.status === 200,
      'Updating resource while keeping its own serial number succeeds without conflict'
    );

    // --- 5. Custody & Status Protection on Details Edit ---
    console.log('\n--- 5. Custody & Status Protection on Details Edit ---');

    // Attempting to inject currentAssigneeId directly through details update
    const assigneeInjectionAttempt = await request('PUT', `/api/resources/${resA.id}`, {
      cookie: adminCookie,
      body: {
        currentAssigneeId: testEmp.id,
      },
    });

    assert(assigneeInjectionAttempt.status === 200, 'Details update request processed');
    const checkCustodyDb = await prisma.resource.findUnique({
      where: { id: resA.id },
      select: { currentAssigneeId: true, status: true },
    });
    assert(
      checkCustodyDb?.currentAssigneeId === null,
      'currentAssigneeId cannot be modified through the details edit endpoint (strictly protected)'
    );

    // Attempting to set status directly to ASSIGNED or MAINTENANCE
    const directAssignedAttempt = await request('PUT', `/api/resources/${resA.id}`, {
      cookie: adminCookie,
      body: {
        status: 'ASSIGNED',
      },
    });
    assert(
      directAssignedAttempt.status === 400,
      'Direct transition to ASSIGNED rejected with 400 Bad Request'
    );

    const directMaintAttempt = await request('PUT', `/api/resources/${resA.id}`, {
      cookie: adminCookie,
      body: {
        status: 'MAINTENANCE',
      },
    });
    assert(
      directMaintAttempt.status === 400,
      'Direct transition to MAINTENANCE rejected with 400 Bad Request'
    );

    // Permitted direct status updates: RETIRED and AVAILABLE
    const retireAttempt = await request('PUT', `/api/resources/${resA.id}`, {
      cookie: adminCookie,
      body: {
        status: 'RETIRED',
      },
    });
    assert(retireAttempt.status === 200, 'Direct transition to RETIRED allowed for decommission (200 OK)');
    assert(retireAttempt.body?.resource?.status === 'RETIRED', 'Resource status is now RETIRED');

    // Restore back to AVAILABLE
    const restoreAvailable = await request('PUT', `/api/resources/${resA.id}`, {
      cookie: adminCookie,
      body: {
        status: 'AVAILABLE',
      },
    });
    assert(restoreAvailable.status === 200, 'Direct transition back to AVAILABLE allowed (200 OK)');

    // --- 6. Safe Deletion of Resources Without Operational History ---
    console.log('\n--- 6. Safe Deletion of Resources Without Operational History ---');

    const cleanRes = await request('POST', '/api/resources', {
      cookie: adminCookie,
      body: {
        name: 'Mistakenly Registered Monitor Unit',
        category: 'IT_EQUIPMENT',
        departmentId: dept1,
        location: 'Central Store - Kersa',
        serialNumber: `SAFE-DELETE-SN-${Date.now()}`,
      },
    });
    assert(cleanRes.status === 201, 'Clean resource without history created successfully');
    const safeDeleteId = cleanRes.body?.resource?.id;
    const safeDeleteItemCode = cleanRes.body?.resource?.itemCode;

    // Admin permanently deletes the clean resource
    const deleteCleanRes = await request('DELETE', `/api/resources/${safeDeleteId}`, {
      cookie: adminCookie,
    });

    assert(deleteCleanRes.status === 200, 'Resource without history safely deleted with 200 OK');
    assert(
      deleteCleanRes.body?.message?.includes(safeDeleteItemCode),
      'Success message confirms deletion of the specific itemCode'
    );

    // Verify it no longer exists
    const verify404 = await request('GET', `/api/resources/${safeDeleteId}`, {
      cookie: adminCookie,
    });
    assert(verify404.status === 404, 'Deleted resource returns 404 Not Found');

    // --- 7. Deletion Blocked for Resources With Assignment History ---
    console.log('\n--- 7. Deletion Blocked for Resources With Assignment History ---');

    const histResCreate = await request('POST', '/api/resources', {
      cookie: adminCookie,
      body: {
        name: 'Dell Latitude Field Laptop (Historical Test)',
        category: 'IT_EQUIPMENT',
        departmentId: dept1,
        serialNumber: `HIST-ASSIGN-SN-${Date.now()}`,
      },
    });
    assert(histResCreate.status === 201, 'Resource for assignment history test created');
    const histRes = histResCreate.body?.resource;
    createdResourceIds.push(histRes.id);

    // Create a completed/returned assignment in the database for histRes
    const assignmentNumber = `ASN-TEST-${Date.now()}`;
    const pastAssignment = await prisma.resourceAssignment.create({
      data: {
        assignmentNumber,
        resourceId: histRes.id,
        employeeId: testEmp.id,
        departmentId: dept1,
        assignedByName: 'System Administrator',
        purpose: 'Completed railway survey project field work',
        status: 'RETURNED',
        isCurrent: false,
        returnedAt: new Date(),
        returnCondition: 'GOOD',
        returnLocation: 'Central Store - Kersa',
      },
    });
    createdAssignmentIds.push(pastAssignment.id);

    // Verify the asset itself is currently unassigned (AVAILABLE)
    const checkAvailable = await prisma.resource.findUnique({
      where: { id: histRes.id },
      select: { status: true, currentAssigneeId: true },
    });
    assert(checkAvailable?.status === 'AVAILABLE', 'Resource is currently AVAILABLE in store');
    assert(checkAvailable?.currentAssigneeId === null, 'Resource is currently not assigned to anyone');

    // Admin attempts to delete this resource that has past assignment history
    const deleteBlockedRes = await request('DELETE', `/api/resources/${histRes.id}`, {
      cookie: adminCookie,
    });

    assert(
      deleteBlockedRes.status === 409,
      'Deletion of resource with assignment history blocked with 409 Conflict'
    );
    assert(
      deleteBlockedRes.body?.hasHistory === true,
      'Response hasHistory flag is true'
    );
    assert(
      deleteBlockedRes.body?.message?.includes('historical operational records'),
      'Error message explains deletion blocked due to historical records'
    );
    assert(
      deleteBlockedRes.body?.message?.includes('RETIRED or DISPOSED'),
      'Error message directs Admin to use RETIRED or DISPOSED status instead'
    );

    // Verify historical records and resource remain intact
    const verifyIntactRes = await prisma.resource.findUnique({
      where: { id: histRes.id },
    });
    assert(Boolean(verifyIntactRes), 'Resource remains intact in database');

    const verifyIntactAssignment = await prisma.resourceAssignment.findUnique({
      where: { id: pastAssignment.id },
    });
    assert(Boolean(verifyIntactAssignment), 'Historical assignment record remains intact in database');

    // --- 8. Deletion Blocked for Resources With Maintenance History ---
    console.log('\n--- 8. Deletion Blocked for Resources With Maintenance History ---');

    const maintResCreate = await request('POST', '/api/resources', {
      cookie: adminCookie,
      body: {
        name: 'Surveying Total Station (Maintenance History Test)',
        category: 'SURVEYING_GEOTECHNICAL',
        departmentId: dept1,
        serialNumber: `HIST-MAINT-SN-${Date.now()}`,
      },
    });
    assert(maintResCreate.status === 201, 'Resource for maintenance history test created');
    const maintRes = maintResCreate.body?.resource;
    createdResourceIds.push(maintRes.id);

    // Create a completed maintenance request in the database for maintRes
    const maintTicketNumber = `MNT-TEST-${Date.now()}`;
    const completedTicket = await prisma.maintenanceRequest.create({
      data: {
        requestNumber: maintTicketNumber,
        resourceId: maintRes.id,
        departmentId: dept1,
        reportedById: testEmp.id,
        reportedByName: testEmp.name,
        title: 'Optical Axis Calibration',
        description: 'Routine 6-month geodetic calibration and cleaning',
        priority: 'MEDIUM',
        status: 'COMPLETED',
        outcome: 'REPAIRED_FIT_FOR_USE',
        custodyAction: 'RETURNED_TO_AVAILABLE',
        completedAt: new Date(),
      },
    });
    createdMaintenanceIds.push(completedTicket.id);

    // Admin attempts to delete this resource that has past maintenance history
    const deleteMaintBlocked = await request('DELETE', `/api/resources/${maintRes.id}`, {
      cookie: adminCookie,
    });

    assert(
      deleteMaintBlocked.status === 409,
      'Deletion of resource with maintenance history blocked with 409 Conflict'
    );
    assert(
      deleteMaintBlocked.body?.historyReasons?.some((r: string) => r.includes('maintenance request')),
      'History reasons specifically identify maintenance request dependency'
    );

    // Verify maintenance ticket remains intact
    const verifyIntactMaint = await prisma.maintenanceRequest.findUnique({
      where: { id: completedTicket.id },
    });
    assert(Boolean(verifyIntactMaint), 'Maintenance record remains intact in database');

    // --- 9. Unauthorized Role Deletion Attempts ---
    console.log('\n--- 9. Unauthorized Role Deletion Attempts ---');

    const unauthRes = await request('POST', '/api/resources', {
      cookie: adminCookie,
      body: {
        name: 'Unauthorized Role Deletion Target',
        category: 'IT_EQUIPMENT',
        departmentId: dept1,
      },
    });
    const targetId = unauthRes.body?.resource?.id;
    createdResourceIds.push(targetId);

    const empDeleteRes = await request('DELETE', `/api/resources/${targetId}`, {
      cookie: empCookie,
    });
    assert(empDeleteRes.status === 403, 'EMPLOYEE blocked from deleting resource with 403 Forbidden');

    const storeDeleteRes = await request('DELETE', `/api/resources/${targetId}`, {
      cookie: storeKeeperCookie,
    });
    assert(storeDeleteRes.status === 403, 'STORE_KEEPER blocked from deleting resource with 403 Forbidden');
  } catch (err) {
    console.error('Unexpected error during test execution:', err);
    failed++;
  } finally {
    console.log('\n--- 10. Cleaning Up Test Records ---');
    try {
      if (createdMaintenanceIds.length > 0) {
        await prisma.maintenanceRequest.deleteMany({
          where: { id: { in: createdMaintenanceIds } },
        });
      }
      if (createdAssignmentIds.length > 0) {
        await prisma.resourceAssignment.deleteMany({
          where: { id: { in: createdAssignmentIds } },
        });
      }
      if (createdResourceIds.length > 0) {
        await prisma.auditEvent.deleteMany({
          where: { resourceId: { in: createdResourceIds } },
        });
        await prisma.resource.deleteMany({
          where: { id: { in: createdResourceIds } },
        });
      }
      console.log('  ✓ Test resources, assignments, and maintenance records safely cleaned up');
    } catch (cleanupErr) {
      console.error('Error during test cleanup:', cleanupErr);
    }

    if (testServer) {
      testServer.close();
    }

    console.log('\n========================================================================');
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log('========================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  }
}

runTests();

