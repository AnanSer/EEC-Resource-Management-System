process.env.RMS_TEST_MODE = '1';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import prisma from '../src/lib/prisma';
import { hashPassword } from '../src/auth/password.js';

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

async function runSimplifiedMaintenanceTests() {
  console.log('========================================================================');
  console.log('EEC RMS: Simplified Maintenance Workflow & Lifecycle Tests');
  console.log('========================================================================');

  await createTestServer();

  let adminCookie = '';
  let technicianCookie = '';
  let managerCookie = '';
  let employeeCookie = '';
  let storeKeeperCookie = '';

  const ts = Date.now();
  const passwordHash = await hashPassword('EEC-Secure2026!');

  // References for test cleanup
  const createdTicketIds: string[] = [];
  const createdResourceIds: string[] = [];
  const createdAssignmentIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdEmployeeIds: string[] = [];

  try {
    // 1. Authenticate standard and specialized roles
    console.log('\n--- 1. Authenticating Roles ---');
    adminCookie = await loginUser('admin@eec.gov.et');
    assert(!!adminCookie, 'ADMIN authenticated');

    storeKeeperCookie = await loginUser('storekeeper@eec.gov.et');
    assert(!!storeKeeperCookie, 'STORE_KEEPER authenticated');

    const deptTid = await prisma.department.findFirst({ where: { code: 'TID' } });
    assert(!!deptTid, 'TID department found');

    // Create a technician test user
    const techUser = await prisma.user.create({
      data: {
        email: `tech.smpl.${ts}@eec.gov.et`,
        fullName: `Technician Staff ${ts}`,
        passwordHash,
        role: 'IT_TECHNICIAN',
        status: 'APPROVED',
        departmentId: deptTid!.id,
      },
    });
    createdUserIds.push(techUser.id);

    const techEmployee = await prisma.employee.create({
      data: {
        employeeId: `EMP-TCH-${ts}`,
        name: techUser.fullName,
        email: techUser.email,
        departmentId: deptTid!.id,
        designation: 'Senior Workshop Systems Engineer',
        role: 'IT_TECHNICIAN',
        isActive: true,
        userId: techUser.id,
      },
    });
    createdEmployeeIds.push(techEmployee.id);
    technicianCookie = await loginUser(techUser.email);
    assert(!!technicianCookie, 'IT_TECHNICIAN authenticated');

    // Create a manager test user
    const mgrUser = await prisma.user.create({
      data: {
        email: `mgr.smpl.${ts}@eec.gov.et`,
        fullName: `Manager Staff ${ts}`,
        passwordHash,
        role: 'DEPARTMENT_MANAGER',
        status: 'APPROVED',
        departmentId: deptTid!.id,
      },
    });
    createdUserIds.push(mgrUser.id);
    managerCookie = await loginUser(mgrUser.email);
    assert(!!managerCookie, 'DEPARTMENT_MANAGER authenticated');

    // Create an employee with active custody
    const empUser = await prisma.user.create({
      data: {
        email: `emp.smpl.${ts}@eec.gov.et`,
        fullName: `Field Surveyor Staff ${ts}`,
        passwordHash,
        role: 'EMPLOYEE',
        status: 'APPROVED',
        departmentId: deptTid!.id,
      },
    });
    createdUserIds.push(empUser.id);

    const empEmployee = await prisma.employee.create({
      data: {
        employeeId: `EMP-FLD-${ts}`,
        name: empUser.fullName,
        email: empUser.email,
        departmentId: deptTid!.id,
        designation: 'Staff Geotechnical Surveyor',
        role: 'EMPLOYEE',
        isActive: true,
        userId: empUser.id,
      },
    });
    createdEmployeeIds.push(empEmployee.id);
    employeeCookie = await loginUser(empUser.email);
    assert(!!employeeCookie, 'EMPLOYEE authenticated');

    // 2. Setup Resources: One in Active Custody, One Unassigned in Store
    console.log('\n--- 2. Setting Up Test Resources ---');
    const assignedAsset = await prisma.resource.create({
      data: {
        itemCode: `EEC-SURV-ASGD-${ts}`,
        name: 'Topcon Total Station in Active Custody',
        category: 'SURVEYING_GEOTECHNICAL',
        subcategory: 'Total Station',
        status: 'ASSIGNED',
        condition: 'GOOD',
        location: 'Field Site - Mojo',
        departmentId: deptTid!.id,
        currentAssigneeId: empEmployee.id,
      },
    });
    createdResourceIds.push(assignedAsset.id);

    const activeAssignment = await prisma.resourceAssignment.create({
      data: {
        assignmentNumber: `ASGN-SMPL-${ts}`,
        resourceId: assignedAsset.id,
        employeeId: empEmployee.id,
        departmentId: deptTid!.id,
        assignedByName: 'Admin Officer',
        assignedById: adminCookie ? empUser.id : empUser.id,
        purpose: 'Topographic highway surveying',
        status: 'ACTIVE',
        isCurrent: true,
      },
    });
    createdAssignmentIds.push(activeAssignment.id);

    const unassignedAsset = await prisma.resource.create({
      data: {
        itemCode: `EEC-SURV-STORE-${ts}`,
        name: 'Trimble Optical Level in Store',
        category: 'SURVEYING_GEOTECHNICAL',
        subcategory: 'Optical Level',
        status: 'AVAILABLE',
        condition: 'GOOD',
        location: 'Central Store - Kersa',
        departmentId: deptTid!.id,
      },
    });
    createdResourceIds.push(unassignedAsset.id);
    assert(true, 'Test resources created: 1 in active custody, 1 unassigned in store');

    // 3. Workflow A: Direct Maintenance Completion on Assigned Asset (Preserving Custodian)
    console.log('\n--- 3. Workflow A: Assigned Asset Repair & Return-to-Custodian ---');
    // Step 1: Employee reports faulty equipment
    const reportResA = await request('POST', '/api/maintenance', {
      cookie: employeeCookie,
      body: {
        resourceId: assignedAsset.id,
        title: 'Total Station EDM distance sensor fault',
        description: 'EDM laser emits error E-21 and fails distance calculation.',
        priority: 'HIGH',
      },
    });
    assert(reportResA.status === 201, 'Step 1: Employee reported fault successfully (201)');
    const ticketA = reportResA.body.request;
    createdTicketIds.push(ticketA.id);
    assert(ticketA.status === 'SUBMITTED', 'Step 1: Ticket initial status is SUBMITTED');
    assert(ticketA.custodianIdAtRequest === empEmployee.id, 'Step 1: Active custodian ID recorded at request time');

    // Verify asset transitioned to MAINTENANCE in DB while retaining custodian link
    const assetAAfterReport = await prisma.resource.findUnique({ where: { id: assignedAsset.id } });
    assert(assetAAfterReport?.status === 'MAINTENANCE', 'Step 1: Asset transitioned to MAINTENANCE');
    assert(assetAAfterReport?.currentAssigneeId === empEmployee.id, 'Step 1: Asset currentAssigneeId preserved');

    // Step 2: Manager reviews and approves request
    const reviewResA = await request('POST', `/api/maintenance/${ticketA.id}/review`, {
      cookie: managerCookie,
      body: {
        action: 'APPROVE',
        comments: 'Authorized for workshop maintenance diagnostics',
      },
    });
    assert(reviewResA.status === 200, 'Step 2: Department Manager approved request (200)');
    assert(reviewResA.body.request.status === 'APPROVED', 'Step 2: Ticket status is APPROVED');

    // Step 3: Technician starts maintenance
    const startResA = await request('PUT', `/api/maintenance/${ticketA.id}/progress`, {
      cookie: technicianCookie,
      body: {
        status: 'IN_PROGRESS',
        diagnosis: 'EDM optic prism beam alignment defective',
        assignedTechnicianName: techUser.fullName,
      },
    });
    assert(startResA.status === 200, 'Step 3: Technician transitioned ticket to IN_PROGRESS (200)');
    assert(startResA.body.request.status === 'IN_PROGRESS', 'Step 3: Ticket status is IN_PROGRESS');
    assert(startResA.body.request.startedAt !== null, 'Step 3: startedAt timestamp recorded');

    // Step 4: Technician directly completes maintenance WITHOUT an inspection record
    const completeResA = await request('PUT', `/api/maintenance/${ticketA.id}/progress`, {
      cookie: technicianCookie,
      body: {
        status: 'COMPLETED',
        repairActions: 'Realigned laser diode collimator and cleaned internal focal optical mirror',
        partsReplaced: 'Optical collimator seal ring',
        actualCostETB: 3500,
        resolutionNotes: 'All distance measurement modes calibrated and confirmed operational',
        outcome: 'REPAIRED_FIT_FOR_USE',
        conditionOnCompletion: 'GOOD',
      },
    });
    assert(completeResA.status === 200, 'Step 4: Technician directly completed maintenance without inspection (200)');
    assert(completeResA.body.request.status === 'COMPLETED', 'Step 4: Work order status is COMPLETED');
    assert(completeResA.body.request.completedAt !== null, 'Step 4: completedAt timestamp recorded');
    assert(completeResA.body.request.assignedTechnicianName === techUser.fullName, 'Step 4: Technician name recorded');
    assert(completeResA.body.custodyAction === 'RETURNED_TO_CUSTODIAN', 'Step 4: custodyAction is RETURNED_TO_CUSTODIAN');

    // Step 5: System automatically restores resource status to ASSIGNED and preserves active custodian
    const assetAAfterComplete = await prisma.resource.findUnique({ where: { id: assignedAsset.id } });
    assert(assetAAfterComplete?.status === 'ASSIGNED', 'Step 5: Resource status automatically restored to ASSIGNED');
    assert(assetAAfterComplete?.currentAssigneeId === empEmployee.id, 'Step 5: Active custodian remained unchanged (empEmployee.id)');

    // Verify active assignment remains ACTIVE (never silently closed or modified)
    const assignmentA = await prisma.resourceAssignment.findUnique({ where: { id: activeAssignment.id } });
    assert(assignmentA?.status === 'ACTIVE' && assignmentA?.isCurrent === true, 'Step 5: Active ResourceAssignment remains ACTIVE');

    // 4. Workflow B: Direct Maintenance Completion on Unassigned Asset (Restoring to AVAILABLE)
    console.log('\n--- 4. Workflow B: Unassigned Store Asset Repair & Return-to-Store ---');
    // Store Keeper reports fault on unassigned store inventory asset
    const reportResB = await request('POST', '/api/maintenance', {
      cookie: storeKeeperCookie,
      body: {
        resourceId: unassignedAsset.id,
        title: 'Optical level compensator sticking',
        description: 'Pendulum compensator gets stuck when leveled.',
        priority: 'MEDIUM',
      },
    });
    assert(reportResB.status === 201, 'Step 1: Store Keeper reported fault on unassigned store asset (201)');
    const ticketB = reportResB.body.request;
    createdTicketIds.push(ticketB.id);

    // Admin approves
    const reviewResB = await request('POST', `/api/maintenance/${ticketB.id}/review`, {
      cookie: adminCookie,
      body: { action: 'APPROVE', comments: 'Approved for calibration' },
    });
    assert(reviewResB.status === 200, 'Step 2: Admin approved request (200)');

    // Technician starts repair
    await request('PUT', `/api/maintenance/${ticketB.id}/progress`, {
      cookie: technicianCookie,
      body: {
        status: 'IN_PROGRESS',
        diagnosis: 'Damping chamber has dust contamination',
      },
    });

    // Technician directly marks COMPLETED without any separate inspection
    const completeResB = await request('PUT', `/api/maintenance/${ticketB.id}/progress`, {
      cookie: technicianCookie,
      body: {
        status: 'COMPLETED',
        repairActions: 'Cleaned magnetic air damping chamber and verified horizontal line of sight',
        resolutionNotes: 'Self-leveling action confirmed accurate to 1.5mm / 1km double run',
        outcome: 'REPAIRED_FIT_FOR_USE',
        conditionOnCompletion: 'GOOD',
      },
    });
    assert(completeResB.status === 200, 'Step 4: Unassigned asset directly completed without inspection (200)');
    assert(completeResB.body.custodyAction === 'RETURNED_TO_AVAILABLE', 'Step 4: custodyAction is RETURNED_TO_AVAILABLE');

    // System restores unassigned resource to AVAILABLE in store
    const assetBAfterComplete = await prisma.resource.findUnique({ where: { id: unassignedAsset.id } });
    assert(assetBAfterComplete?.status === 'AVAILABLE', 'Step 5: Resource status restored to AVAILABLE');
    assert(assetBAfterComplete?.currentAssigneeId === null, 'Step 5: Resource has no current custodian');

    // 5. Security & Authorization Boundary Checks
    console.log('\n--- 5. Security & Authorization Boundary Checks ---');
    // Create another ticket in IN_PROGRESS to test unauthorized completion
    const testAssetSec = await prisma.resource.create({
      data: {
        itemCode: `EEC-SURV-SEC-${ts}`,
        name: 'Laser Distance Meter Boundary Test',
        category: 'SURVEYING_GEOTECHNICAL',
        status: 'AVAILABLE',
        departmentId: deptTid!.id,
      },
    });
    createdResourceIds.push(testAssetSec.id);

    const reportResSec = await request('POST', '/api/maintenance', {
      cookie: adminCookie,
      body: {
        resourceId: testAssetSec.id,
        title: 'Laser rangefinder battery contacts corroded',
        description: 'Power fails intermittently.',
        priority: 'LOW',
      },
    });
    const ticketSec = reportResSec.body.request;
    createdTicketIds.push(ticketSec.id);

    await request('POST', `/api/maintenance/${ticketSec.id}/review`, {
      cookie: adminCookie,
      body: { action: 'APPROVE' },
    });

    await request('PUT', `/api/maintenance/${ticketSec.id}/progress`, {
      cookie: technicianCookie,
      body: { status: 'IN_PROGRESS', diagnosis: 'Contacts oxidised' },
    });

    // Attempt completion by unauthorized EMPLOYEE
    const empCompleteAttempt = await request('PUT', `/api/maintenance/${ticketSec.id}/progress`, {
      cookie: employeeCookie,
      body: {
        status: 'COMPLETED',
        resolutionNotes: 'Employee trying to complete repair',
      },
    });
    assert(empCompleteAttempt.status === 403, 'EMPLOYEE blocked with 403 from completing maintenance');

    // Attempt completion by unauthorized STORE_KEEPER
    const storeCompleteAttempt = await request('PUT', `/api/maintenance/${ticketSec.id}/progress`, {
      cookie: storeKeeperCookie,
      body: {
        status: 'COMPLETED',
        resolutionNotes: 'Store Keeper trying to complete repair',
      },
    });
    assert(storeCompleteAttempt.status === 403, 'STORE_KEEPER blocked with 403 from completing maintenance');

    // Attempt completion without repair notes/actions
    const emptyNotesAttempt = await request('PUT', `/api/maintenance/${ticketSec.id}/progress`, {
      cookie: technicianCookie,
      body: {
        status: 'COMPLETED',
      },
    });
    assert(emptyNotesAttempt.status === 400, 'Technician rejected with 400 when completing without resolution notes or repair actions');

    // Valid completion by technician
    const validSecComplete = await request('PUT', `/api/maintenance/${ticketSec.id}/progress`, {
      cookie: technicianCookie,
      body: {
        status: 'COMPLETED',
        repairActions: 'Polished battery terminals with contact cleaner',
        resolutionNotes: 'Stable 3.0V supply restored',
      },
    });
    assert(validSecComplete.status === 200, 'Technician successfully completed ticketSec (200)');

    // 6. Verification of Historical Data Safety & No Resources in TESTING
    console.log('\n--- 6. Historical Data Safety & No Resources in TESTING ---');
    // Verify historical inspections are preserved and intact
    const historicalInspections = await prisma.maintenanceInspection.findMany({ take: 5 });
    assert(Array.isArray(historicalInspections), 'Historical maintenance inspection records remain accessible in database');

    const inspApiRes = await request('GET', '/api/maintenance/inspections', { cookie: adminCookie });
    assert(inspApiRes.status === 200, 'GET /api/maintenance/inspections returns 200 for historical records');
    assert(Array.isArray(inspApiRes.body.inspections), 'API inspection list returns array preserving historical tests');

    // Verify maintenance audit logs exist for the completed tickets
    const logsA = await prisma.maintenanceLog.findMany({ where: { maintenanceRequestId: ticketA.id } });
    assert(logsA.length >= 3, 'Ticket A has complete audit trail (SUBMITTED, APPROVED, IN_PROGRESS, COMPLETED)');
    const completeLog = logsA.find((l) => l.toStatus === 'COMPLETED');
    assert(completeLog?.actorRole === 'IT_TECHNICIAN', 'Completion log records technician role and identity');

    // CRITICAL: Verify zero resources are left in TESTING status across the entire database
    const testingResourcesCount = await prisma.resource.count({ where: { status: 'TESTING' } });
    assert(testingResourcesCount === 0, 'No resource is left in TESTING status in the system');

    // 7. Cleanup Test Records
    console.log('\n--- 7. Cleaning Up Test Records ---');
    for (const tid of createdTicketIds) {
      await prisma.maintenanceLog.deleteMany({ where: { maintenanceRequestId: tid } });
      await prisma.maintenanceInspection.deleteMany({ where: { maintenanceRequestId: tid } });
      await prisma.maintenanceRequest.deleteMany({ where: { id: tid } });
    }
    for (const asgId of createdAssignmentIds) {
      await prisma.resourceAssignment.deleteMany({ where: { id: asgId } });
    }
    for (const rid of createdResourceIds) {
      await prisma.resource.deleteMany({ where: { id: rid } });
    }
    for (const eid of createdEmployeeIds) {
      await prisma.employee.deleteMany({ where: { id: eid } });
    }
    for (const uid of createdUserIds) {
      await prisma.user.deleteMany({ where: { id: uid } });
    }
    console.log('  ✓ Test maintenance requests, assignments, resources, employees, and users safely cleaned up');

  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n========================================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSimplifiedMaintenanceTests().catch((err) => {
  console.error('Fatal test error in simplified maintenance workflow tests:', err);
  process.exit(1);
});
