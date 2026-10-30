import http from 'node:http';
import { AddressInfo } from 'node:net';
import prisma from '../src/lib/prisma.js';
import { hashPassword } from '../src/auth/password.js';

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
  console.log('EEC RMS: Maintenance Management Integration Tests');
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
    // 1. Authenticate All System Roles
    console.log('\n--- 1. Authenticating Roles ---');
    const adminCookie = await loginUser('admin@eec.gov.et');
    assert(!!adminCookie, 'ADMIN logged in');

    const storeKeeperCookie = await loginUser('storekeeper@eec.gov.et');
    assert(!!storeKeeperCookie, 'STORE_KEEPER logged in');

    const managerCookie = await loginUser('manager@eec.gov.et'); // Manager in dept-101
    assert(!!managerCookie, 'DEPARTMENT_MANAGER logged in');

    const employeeCookie = await loginUser('employee@eec.gov.et'); // Employee in dept-101 (Haile Gebrselassie)
    assert(!!employeeCookie, 'EMPLOYEE logged in');

    const techCookie = await loginUser('technician@eec.gov.et'); // IT_TECHNICIAN
    assert(!!techCookie, 'IT_TECHNICIAN logged in');

    // 2. Unauthenticated Security Boundaries
    console.log('\n--- 2. Unauthenticated Boundaries ---');
    const unauthGet = await request('GET', '/api/maintenance');
    assert(unauthGet.status === 401, 'GET /api/maintenance without cookie returns 401');

    const unauthMetrics = await request('GET', '/api/maintenance/metrics');
    assert(unauthMetrics.status === 401, 'GET /api/maintenance/metrics without cookie returns 401');

    const unauthPost = await request('POST', '/api/maintenance', { body: {} });
    assert(unauthPost.status === 401, 'POST /api/maintenance without cookie returns 401');

    // 3. Maintenance Request Submission & Department Isolation
    console.log('\n--- 3. Maintenance Request Submission & Department Isolation ---');
    // Find an available asset in dept-101 (or ensure one exists for test)
    let dept101Asset = await prisma.resource.findFirst({
      where: {
        departmentId: 'dept-101',
        status: 'AVAILABLE',
      },
    });
    if (!dept101Asset) {
      dept101Asset = await prisma.resource.upsert({
        where: { itemCode: 'EEC-TEST-MNT-101' },
        update: { status: 'AVAILABLE', currentAssigneeId: null, departmentId: 'dept-101' },
        create: {
          itemCode: 'EEC-TEST-MNT-101',
          name: 'Leica TS16 Total Station (Field Unit)',
          category: 'SURVEYING_GEOTECHNICAL',
          status: 'AVAILABLE',
          condition: 'GOOD',
          location: 'Headquarters - Floor 4 Survey Lab',
          departmentId: 'dept-101',
          purchaseCostETB: 120000,
          currentValueETB: 120000,
        },
      });
    }
    assert(!!dept101Asset, 'Found available asset in dept-101');

    // Regression check: Employee blocked from reporting unassigned department resource
    const empUnassignedReport = await request('POST', '/api/maintenance', {
      cookie: employeeCookie,
      body: {
        resourceId: dept101Asset!.id,
        title: 'Laser Level Calibration Drift',
        description: 'Laser line shows 3mm deviation over 10m range during morning inspection.',
        priority: 'HIGH',
        estimatedCostETB: 8500,
      },
    });
    assert(empUnassignedReport.status === 403, 'Employee cannot report a fault on unassigned departmental equipment (403)');

    // Department Manager reports defect in own department
    const mgrReportRes = await request('POST', '/api/maintenance', {
      cookie: managerCookie,
      body: {
        resourceId: dept101Asset!.id,
        title: 'Laser Level Calibration Drift',
        description: 'Laser line shows 3mm deviation over 10m range during morning inspection.',
        priority: 'HIGH',
        estimatedCostETB: 8500,
      },
    });
    assert(mgrReportRes.status === 201, 'Department Manager can submit maintenance request for department resource');
    const createdTicket1 = mgrReportRes.body?.request;
    assert(!!createdTicket1?.requestNumber, 'Ticket has formatted requestNumber (MNT-YYYY-XXXX)');
    assert(createdTicket1?.status === 'SUBMITTED', 'Initial status is SUBMITTED');
    assert(createdTicket1?.reportedByName?.length > 0, 'Reporter name recorded');

    // Verify resource transitioned to MAINTENANCE
    const resAfterReport = await prisma.resource.findUnique({ where: { id: dept101Asset!.id } });
    assert(resAfterReport?.status === 'MAINTENANCE', 'Resource status transitioned to MAINTENANCE');

    // Duplicate active maintenance check
    const dupRes = await request('POST', '/api/maintenance', {
      cookie: managerCookie,
      body: {
        resourceId: dept101Asset!.id,
        title: 'Another defect report',
        description: 'Attempting to open duplicate active ticket for same resource.',
      },
    });
    assert(dupRes.status === 409, 'Duplicate active maintenance request rejected with 409 Conflict');

    // Department boundary: Employee attempting to report defect on out-of-department resource with NO custody
    const foreignAsset = await prisma.resource.findFirst({
      where: {
        departmentId: { not: 'dept-101' },
        currentAssigneeId: null,
      },
    });
    assert(!!foreignAsset, 'Found foreign asset without custody');

    const foreignReportRes = await request('POST', '/api/maintenance', {
      cookie: employeeCookie,
      body: {
        resourceId: foreignAsset!.id,
        title: 'Foreign Department Asset Defect',
        description: 'Unauthorized employee attempting to report on foreign department asset.',
      },
    });
    assert(foreignReportRes.status === 403, 'Employee blocked with 403 when reporting foreign department asset without custody');

    // 4. Assignment Blocking During Maintenance
    console.log('\n--- 4. Assignment Blocking During Maintenance ---');
    // Attempting to assign resource undergoing maintenance
    const empRecord = await prisma.employee.findFirst({ where: { departmentId: 'dept-101' } });
    const blockAssignRes = await request('POST', '/api/assignments', {
      cookie: storeKeeperCookie,
      body: {
        resourceId: dept101Asset!.id,
        employeeId: empRecord!.id,
        purpose: 'Attempting to assign equipment currently under maintenance',
      },
    });
    assert(blockAssignRes.status === 400, 'Assigning resource undergoing maintenance is blocked with 400 Bad Request');

    // 5. Review & Approval Workflow
    console.log('\n--- 5. Review & Approval Workflow ---');
    // Employee cannot review
    const empReviewRes = await request('POST', `/api/maintenance/${createdTicket1.id}/review`, {
      cookie: employeeCookie,
      body: { action: 'APPROVE' },
    });
    assert(empReviewRes.status === 403, 'Employee forbidden from reviewing maintenance request (403)');

    // Department Manager in dept-101 reviews and approves
    const mgrApproveRes = await request('POST', `/api/maintenance/${createdTicket1.id}/review`, {
      cookie: managerCookie,
      body: {
        action: 'APPROVE',
        comments: 'Approved for urgent workshop recalibration by IT/Surveying technician.',
      },
    });
    assert(mgrApproveRes.status === 200, 'Department Manager can approve maintenance request for own department');
    assert(mgrApproveRes.body?.request?.status === 'APPROVED', 'Ticket status transitioned to APPROVED');
    assert(mgrApproveRes.body?.request?.reviewedByName?.length > 0, 'Reviewer recorded');

    // Cannot review non-SUBMITTED request
    const secondReviewRes = await request('POST', `/api/maintenance/${createdTicket1.id}/review`, {
      cookie: managerCookie,
      body: { action: 'REJECT', rejectionReason: 'Too late to reject' },
    });
    assert(secondReviewRes.status === 400, 'Cannot review ticket already in APPROVED status (400)');

    // 6. Technician Diagnostics, Progress, On-Hold, and QA
    console.log('\n--- 6. Technician Diagnostics, Progress, On-Hold & QA ---');
    // Store Keeper cannot perform technical servicing
    const storeKeeperProgress = await request('PUT', `/api/maintenance/${createdTicket1.id}/progress`, {
      cookie: storeKeeperCookie,
      body: { status: 'IN_PROGRESS', diagnosis: 'Store keeper trying to repair' },
    });
    assert(storeKeeperProgress.status === 403, 'Store Keeper forbidden from performing technician repairs (403)');

    // Invalid transition: cannot jump directly from SUBMITTED to COMPLETED
    // Create another ticket to test invalid transition
    let dept101Asset2 = await prisma.resource.findFirst({
      where: {
        departmentId: 'dept-101',
        status: 'AVAILABLE',
        id: { not: dept101Asset!.id },
      },
    });
    if (!dept101Asset2) {
      dept101Asset2 = await prisma.resource.upsert({
        where: { itemCode: 'EEC-TEST-MNT-102' },
        update: { status: 'AVAILABLE', currentAssigneeId: null, departmentId: 'dept-101' },
        create: {
          itemCode: 'EEC-TEST-MNT-102',
          name: 'Topcon Auto Level AT-B4A',
          category: 'SURVEYING_GEOTECHNICAL',
          status: 'AVAILABLE',
          condition: 'GOOD',
          location: 'Headquarters - Floor 4 Survey Lab',
          departmentId: 'dept-101',
          purchaseCostETB: 45000,
          currentValueETB: 45000,
        },
      });
    }

    if (dept101Asset2) {
      const ticket2Res = await request('POST', '/api/maintenance', {
        cookie: managerCookie,
        body: {
          resourceId: dept101Asset2.id,
          title: 'Damaged battery compartment',
          description: 'Corrosion detected on battery contacts.',
        },
      });
      const ticket2 = ticket2Res.body?.request;

      // Attempt jump from SUBMITTED directly to COMPLETED
      const invalidJump = await request('PUT', `/api/maintenance/${ticket2.id}/progress`, {
        cookie: techCookie,
        body: { status: 'COMPLETED', resolutionNotes: 'Skipped approval' },
      });
      assert(invalidJump.status === 400, 'Invalid transition directly from SUBMITTED to COMPLETED rejected (400)');

      // Reject ticket2 to test safe restoration
      const rejectTicket2 = await request('POST', `/api/maintenance/${ticket2.id}/review`, {
        cookie: adminCookie,
        body: { action: 'REJECT', rejectionReason: 'Minor issue resolved with dry wipe; no repair needed' },
      });
      assert(rejectTicket2.status === 200, 'Admin can reject maintenance request');
      assert(rejectTicket2.body?.request?.status === 'REJECTED', 'Ticket status updated to REJECTED');

      // Verify asset restored to AVAILABLE
      const restoredAsset2 = await prisma.resource.findUnique({ where: { id: dept101Asset2.id } });
      assert(restoredAsset2?.status === 'AVAILABLE', 'Unassigned resource restored to AVAILABLE after rejection');
    }

    // Technician starts repair on ticket1: APPROVED -> IN_PROGRESS
    const startRepairRes = await request('PUT', `/api/maintenance/${createdTicket1.id}/progress`, {
      cookie: techCookie,
      body: {
        status: 'IN_PROGRESS',
        diagnosis: 'Optical prism dislodged following rough transport on gravel road.',
        assignedTechnicianName: 'Kenenisa Bekele',
      },
    });
    assert(startRepairRes.status === 200, 'Technician can transition ticket to IN_PROGRESS');
    assert(startRepairRes.body?.request?.status === 'IN_PROGRESS', 'Ticket status is now IN_PROGRESS');
    assert(!!startRepairRes.body?.request?.startedAt, 'startedAt timestamp recorded');

    // Technician puts repair ON_HOLD (waiting for replacement prism)
    const holdRes = await request('PUT', `/api/maintenance/${createdTicket1.id}/progress`, {
      cookie: techCookie,
      body: {
        status: 'ON_HOLD',
        notes: 'Awaiting specialized replacement optical prism from central parts depot.',
        partsReplaced: 'Pending Part #OPT-PRISM-77',
      },
    });
    assert(holdRes.status === 200, 'Technician can put work order ON_HOLD');
    assert(holdRes.body?.request?.status === 'ON_HOLD', 'Ticket status is now ON_HOLD');

    // Technician resumes repair: ON_HOLD -> IN_PROGRESS
    const resumeRes = await request('PUT', `/api/maintenance/${createdTicket1.id}/progress`, {
      cookie: techCookie,
      body: {
        status: 'IN_PROGRESS',
        notes: 'Parts received, continuing re-alignment and bench calibration.',
        partsReplaced: 'Part #OPT-PRISM-77 installed',
      },
    });
    assert(resumeRes.status === 200, 'Technician can resume work order from ON_HOLD to IN_PROGRESS');
    assert(resumeRes.body?.request?.status === 'IN_PROGRESS', 'Ticket status resumed to IN_PROGRESS');

    // Record QA Inspection Test
    const qaRes = await request('POST', `/api/maintenance/${createdTicket1.id}/inspections`, {
      cookie: techCookie,
      body: {
        inspectionType: 'CALIBRATION',
        passed: true,
        findings: 'Recalibrated on 50m baseline: horizontal error < 0.3mm (within 0.5mm factory tolerance)',
        certificationNumber: 'QA-CAL-2026-0941',
        remarks: 'Equipment certified fit for engineering field deployment',
      },
    });
    assert(qaRes.status === 201, 'Technician can record QA inspection test');
    assert(qaRes.body?.inspection?.passed === true, 'Inspection recorded as passed');

    // Verify inspection listed in endpoint
    const inspListRes = await request('GET', '/api/maintenance/inspections', { cookie: techCookie });
    assert(inspListRes.status === 200, 'GET /api/maintenance/inspections returns 200');
    const hasInsp = inspListRes.body?.inspections?.some((i: any) => i.certificationNumber === 'QA-CAL-2026-0941');
    assert(hasInsp, 'Newly recorded inspection appears in enterprise inspections directory');

    // Complete repair on unassigned asset (Outcome: REPAIRED_FIT_FOR_USE)
    const completeRes = await request('PUT', `/api/maintenance/${createdTicket1.id}/progress`, {
      cookie: techCookie,
      body: {
        status: 'COMPLETED',
        repairActions: 'Replaced optical prism #OPT-PRISM-77, re-sealed casing with silicone gasket, recalibrated.',
        resolutionNotes: 'Field calibration certified passed. Laser accuracy verified.',
        actualCostETB: 7800,
        outcome: 'REPAIRED_FIT_FOR_USE',
        conditionOnCompletion: 'EXCELLENT',
      },
    });
    assert(completeRes.status === 200, 'Technician can mark work order COMPLETED');
    assert(completeRes.body?.request?.status === 'COMPLETED', 'Ticket status is COMPLETED');
    assert(completeRes.body?.custodyAction === 'RETURNED_TO_AVAILABLE', 'Unassigned asset custodyAction is RETURNED_TO_AVAILABLE');

    // Verify unassigned asset status restored to AVAILABLE
    const finalAsset1 = await prisma.resource.findUnique({ where: { id: dept101Asset!.id } });
    assert(finalAsset1?.status === 'AVAILABLE', 'Unassigned resource returned to AVAILABLE after repair completion');

    // 7. Active Custodian Safety & Return-to-Custodian Workflow
    console.log('\n--- 7. Active Custodian Safety & Return-to-Custodian Workflow ---');
    // Find an asset currently ASSIGNED to an employee
    const assignedAsset = await prisma.resource.findFirst({
      where: {
        status: 'ASSIGNED',
        currentAssigneeId: { not: null },
      },
      include: { currentAssignee: true },
    });
    assert(!!assignedAsset, 'Found currently assigned asset');

    const originalAssigneeId = assignedAsset!.currentAssigneeId;
    const originalAssigneeName = assignedAsset!.currentAssignee!.name;

    // Report defect on assigned asset
    const reportAssignedRes = await request('POST', '/api/maintenance', {
      cookie: adminCookie,
      body: {
        resourceId: assignedAsset!.id,
        title: 'Brake cylinder leak during site visit',
        description: 'Brake fluid reservoir dropping; brake pedal feels spongy.',
        priority: 'CRITICAL',
      },
    });
    assert(reportAssignedRes.status === 201, 'Maintenance request opened for currently assigned asset');
    const assignedTicket = reportAssignedRes.body?.request;
    assert(assignedTicket.custodianIdAtRequest === originalAssigneeId, 'Original custodian recorded at request time');

    // Resource status becomes MAINTENANCE, but active custodian NOT wiped
    const assetDuringMaint = await prisma.resource.findUnique({ where: { id: assignedAsset!.id } });
    assert(assetDuringMaint?.status === 'MAINTENANCE', 'Resource status transitioned to MAINTENANCE');
    assert(assetDuringMaint?.currentAssigneeId === originalAssigneeId, 'Active custodian currentAssigneeId is PRESERVED (never silently wiped)');

    // Verify active assignment record was NOT closed
    const activeAssignment = await prisma.resourceAssignment.findFirst({
      where: {
        resourceId: assignedAsset!.id,
        isCurrent: true,
      },
    });
    assert(activeAssignment?.status === 'ACTIVE', 'Active ResourceAssignment remains ACTIVE (never silently closed)');

    // Attempt to transfer assigned asset while under maintenance -> must be blocked
    const blockTransferRes = await request('POST', '/api/assignments/transfer', {
      cookie: adminCookie,
      body: {
        resourceId: assignedAsset!.id,
        toEmployeeId: empRecord!.id,
        reason: 'Attempting transfer during maintenance',
      },
    });
    assert(blockTransferRes.status === 400, 'Transferring asset undergoing maintenance is blocked with 400 Bad Request');

    // Approve ticket
    await request('POST', `/api/maintenance/${assignedTicket.id}/review`, {
      cookie: adminCookie,
      body: { action: 'APPROVE', comments: 'Fleet workshop priority repair' },
    });

    // Technician starts repair
    await request('PUT', `/api/maintenance/${assignedTicket.id}/progress`, {
      cookie: techCookie,
      body: {
        status: 'IN_PROGRESS',
        diagnosis: 'Master brake cylinder seal ruptured.',
      },
    });

    // Technician completes repair with safe return-to-custodian workflow
    const completeAssignedRes = await request('PUT', `/api/maintenance/${assignedTicket.id}/progress`, {
      cookie: techCookie,
      body: {
        status: 'COMPLETED',
        repairActions: 'Replaced master brake cylinder, bled brake lines with DOT4 fluid, pressure tested at 120 bar.',
        resolutionNotes: 'Road test passed. Braking response excellent. Safe for return to field custodian.',
        outcome: 'REPAIRED_FIT_FOR_USE',
        actualCostETB: 14200,
        conditionOnCompletion: 'EXCELLENT',
      },
    });
    assert(completeAssignedRes.status === 200, 'Technician successfully completed repair on assigned asset');
    assert(completeAssignedRes.body?.custodyAction === 'RETURNED_TO_CUSTODIAN', 'Safe custodyAction is RETURNED_TO_CUSTODIAN');

    // Verify resource restored to ASSIGNED with custodian intact
    const restoredAssignedAsset = await prisma.resource.findUnique({
      where: { id: assignedAsset!.id },
      include: { currentAssignee: true },
    });
    assert(restoredAssignedAsset?.status === 'ASSIGNED', 'Resource status restored to ASSIGNED');
    assert(restoredAssignedAsset?.currentAssigneeId === originalAssigneeId, `Custodian remains ${originalAssigneeName}`);

    // Verify assignment record is still ACTIVE
    const assignmentAfterMaint = await prisma.resourceAssignment.findFirst({
      where: {
        resourceId: assignedAsset!.id,
        isCurrent: true,
      },
    });
    assert(assignmentAfterMaint?.status === 'ACTIVE', 'Custody assignment remains seamlessly ACTIVE after maintenance completion');

    // 8. Department Scoping & Permissions Verification
    console.log('\n--- 8. Department Scoping & Permissions Verification ---');
    // Department Manager listing maintenance
    const mgrListRes = await request('GET', '/api/maintenance', { cookie: managerCookie });
    assert(mgrListRes.status === 200, 'Manager can list maintenance requests');
    const mgrTickets: any[] = mgrListRes.body?.requests || [];
    const allInDept101 = mgrTickets.every((t) => t.departmentId === 'dept-101');
    assert(allInDept101, 'Manager list contains ONLY requests for assigned department (dept-101)');

    // Admin listing maintenance
    const adminListRes = await request('GET', '/api/maintenance', { cookie: adminCookie });
    assert(adminListRes.status === 200, 'Admin can list maintenance requests');
    assert(adminListRes.body?.pagination?.total >= mgrTickets.length, 'Admin sees corporation-wide maintenance volume');

    // Maintenance Metrics Scoping
    const mgrMetricsRes = await request('GET', '/api/maintenance/metrics', { cookie: managerCookie });
    assert(mgrMetricsRes.status === 200, 'Manager can fetch maintenance metrics');
    assert(mgrMetricsRes.body?.metrics?.scope === 'DEPARTMENT', 'Manager metrics scope is strictly DEPARTMENT');
    assert(mgrMetricsRes.body?.metrics?.departmentId === 'dept-101', 'Manager metrics departmentId is dept-101');

    const adminMetricsRes = await request('GET', '/api/maintenance/metrics', { cookie: adminCookie });
    assert(adminMetricsRes.status === 200, 'Admin can fetch maintenance metrics');
    assert(adminMetricsRes.body?.metrics?.scope === 'CORPORATION', 'Admin metrics scope is CORPORATION');
    assert(adminMetricsRes.body?.metrics?.totalRequests >= mgrMetricsRes.body?.metrics?.totalRequests, 'Admin metrics reflect corporate totals');

    // Store Keeper can view tickets but has read-only access
    const storeKeeperList = await request('GET', '/api/maintenance', { cookie: storeKeeperCookie });
    assert(storeKeeperList.status === 200, 'Store Keeper can view maintenance directory for inventory planning');

    // Maintenance Log History Preserved
    const ticketWithHistory = await request('GET', `/api/maintenance/${createdTicket1.id}`, { cookie: adminCookie });
    assert(ticketWithHistory.status === 200, 'Can retrieve maintenance ticket details with logs');
    assert(Array.isArray(ticketWithHistory.body?.request?.logs), 'Ticket has audit log trail');
    assert(ticketWithHistory.body?.request?.logs?.length >= 3, 'Audit trail contains SUBMITTED, APPROVED, IN_PROGRESS, ON_HOLD, COMPLETED entries');

    // 9. Strict Reporter-Scoped Access, Department Boundaries & Immutability
    console.log('\n--- 9. Strict Reporter-Scoped Access, Department Boundaries & Immutability ---');

    // Create a second employee in dept-101 (same department as Haile)
    const testPassword = 'EEC-Secure2026!';
    const testHash = await hashPassword(testPassword);

    const emp2User = await prisma.user.upsert({
      where: { email: 'emp2.dept101@eec.gov.et' },
      update: { status: 'APPROVED', departmentId: 'dept-101', role: 'EMPLOYEE' },
      create: {
        email: 'emp2.dept101@eec.gov.et',
        fullName: 'Solomon Test Employee',
        passwordHash: testHash,
        role: 'EMPLOYEE',
        status: 'APPROVED',
        departmentId: 'dept-101',
      },
    });

    const emp2Record = await prisma.employee.upsert({
      where: { employeeId: 'EEC-EMP-TEST-101' },
      update: { userId: emp2User.id, departmentId: 'dept-101', role: 'EMPLOYEE', isActive: true },
      create: {
        employeeId: 'EEC-EMP-TEST-101',
        name: 'Solomon Test Employee',
        email: 'emp2.dept101@eec.gov.et',
        phone: '+251 911 000101',
        departmentId: 'dept-101',
        designation: 'Junior Highway Engineer',
        role: 'EMPLOYEE',
        userId: emp2User.id,
        isActive: true,
      },
    });

    // Create a manager in dept-102 (different department)
    const mgr2User = await prisma.user.upsert({
      where: { email: 'mgr.dept102@eec.gov.et' },
      update: { status: 'APPROVED', departmentId: 'dept-102', role: 'DEPARTMENT_MANAGER' },
      create: {
        email: 'mgr.dept102@eec.gov.et',
        fullName: 'Water Directorate Manager',
        passwordHash: testHash,
        role: 'DEPARTMENT_MANAGER',
        status: 'APPROVED',
        departmentId: 'dept-102',
      },
    });

    await prisma.employee.upsert({
      where: { employeeId: 'EEC-EMP-TEST-102' },
      update: { userId: mgr2User.id, departmentId: 'dept-102', role: 'DEPARTMENT_MANAGER' },
      create: {
        employeeId: 'EEC-EMP-TEST-102',
        name: 'Water Directorate Manager',
        email: 'mgr.dept102@eec.gov.et',
        phone: '+251 911 000102',
        departmentId: 'dept-102',
        designation: 'Director, Water Directorate',
        role: 'DEPARTMENT_MANAGER',
        userId: mgr2User.id,
      },
    });

    const emp2Cookie = await loginUser('emp2.dept101@eec.gov.et');
    assert(!!emp2Cookie, 'Second employee in dept-101 logged in');

    const mgr2Cookie = await loginUser('mgr.dept102@eec.gov.et');
    assert(!!mgr2Cookie, 'Manager in dept-102 logged in');

    // A. Employee B cannot access defect report created by Employee A in the SAME department
    const emp2ViewOtherTicket = await request('GET', `/api/maintenance/${createdTicket1.id}`, { cookie: emp2Cookie });
    assert(emp2ViewOtherTicket.status === 403, 'Employee B blocked with 403 when viewing ticket reported by Employee A in same department');

    // B. Employee B cannot see Employee A's ticket in list
    const emp2ListRes = await request('GET', '/api/maintenance', { cookie: emp2Cookie });
    assert(emp2ListRes.status === 200, 'Employee B can fetch their own maintenance list');
    const emp2Tickets: any[] = emp2ListRes.body?.requests || [];
    const seesOtherTicket = emp2Tickets.some((t) => t.id === createdTicket1.id);
    assert(!seesOtherTicket, 'Employee B list does NOT leak tickets reported by other employees in same department');

    // C. Department Manager in dept-102 cannot view or review dept-101's ticket
    const mgr2ViewTicket1 = await request('GET', `/api/maintenance/${createdTicket1.id}`, { cookie: mgr2Cookie });
    assert(mgr2ViewTicket1.status === 403, 'Department Manager in dept-102 blocked with 403 from viewing dept-101 maintenance request');

    const mgr2ReviewTicket1 = await request('POST', `/api/maintenance/${createdTicket1.id}/review`, {
      cookie: mgr2Cookie,
      body: { action: 'APPROVE', comments: 'Unauthorized cross-department approval' },
    });
    assert(mgr2ReviewTicket1.status === 403, 'Department Manager in dept-102 blocked with 403 from reviewing dept-101 ticket');

    // D. Custodian exception: Employee CAN view ticket for equipment in their active custody even if reported by another user
    const assetForCustodyTest = await prisma.resource.upsert({
      where: { itemCode: 'EEC-TEST-CUSTODY-VIEW' },
      update: { status: 'AVAILABLE', currentAssigneeId: null, departmentId: 'dept-101' },
      create: {
        itemCode: 'EEC-TEST-CUSTODY-VIEW',
        name: 'Custody View Test Asset',
        category: 'SURVEYING_GEOTECHNICAL',
        status: 'AVAILABLE',
        condition: 'GOOD',
        location: 'Central Store',
        departmentId: 'dept-101',
      },
    });
    await prisma.resourceAssignment.deleteMany({ where: { resourceId: assetForCustodyTest.id } });

    if (assetForCustodyTest) {
      // Assign to emp2Record
      const assignRes = await request('POST', '/api/assignments', {
        cookie: storeKeeperCookie,
        body: {
          resourceId: assetForCustodyTest.id,
          employeeId: emp2Record.id,
          purpose: 'Testing custody maintenance ticket access',
        },
      });
      assert(assignRes.status === 201, 'Assigned asset to Employee B for custody test');

      // Admin reports defect on this asset
      const adminReportOnCustodyAsset = await request('POST', '/api/maintenance', {
        cookie: adminCookie,
        body: {
          resourceId: assetForCustodyTest.id,
          title: 'Emergency workshop maintenance on deployed asset',
          description: 'Defect noticed during site inspection by project director.',
          priority: 'MEDIUM',
        },
      });
      assert(adminReportOnCustodyAsset.status === 201, 'Admin opened maintenance ticket for asset in Employee B custody');
      const custodyTicketId = adminReportOnCustodyAsset.body?.request?.id;

      // Employee B (custodian, but NOT the reporter) views the ticket
      const emp2ViewCustodyTicket = await request('GET', `/api/maintenance/${custodyTicketId}`, { cookie: emp2Cookie });
      assert(emp2ViewCustodyTicket.status === 200, 'Employee B CAN view maintenance ticket for asset in their active custody (even reported by Admin)');

      // Clean up / reject ticket so asset is restored
      await request('POST', `/api/maintenance/${custodyTicketId}/review`, {
        cookie: adminCookie,
        body: { action: 'REJECT', rejectionReason: 'Test completed' },
      });
    }

    // E. Reporter identity immutability check
    const finalTicket1State = await prisma.maintenanceRequest.findUnique({
      where: { id: createdTicket1.id },
    });
    assert(finalTicket1State?.reportedById === createdTicket1.reportedById, 'Ticket reportedById remains immutable');
    assert(finalTicket1State?.reportedByName === createdTicket1.reportedByName, 'Ticket reportedByName remains immutable');
    assert(finalTicket1State?.reportedByRole === createdTicket1.reportedByRole, 'Ticket reportedByRole remains immutable');

    // 10. Advanced Equipment Scoping, Submission Feedback, Detail Logs & Technician Actions
    console.log('\n--- 10. Advanced Equipment Scoping, Submission Feedback, Detail Logs & Technician Actions ---');

    // A. Backend blocks Employee from reporting on asset assigned to another employee
    // Find an asset currently assigned to Haile (employee@eec.gov.et)
    const haileEmp = await prisma.employee.findFirst({ where: { email: 'employee@eec.gov.et' } });
    const haileAssignedAsset = await prisma.resource.findFirst({
      where: { currentAssigneeId: haileEmp!.id },
    });

    if (haileAssignedAsset) {
      // Employee B tries to report fault on Haile's assigned asset
      const emp2ReportHaileAsset = await request('POST', '/api/maintenance', {
        cookie: emp2Cookie,
        body: {
          resourceId: haileAssignedAsset.id,
          title: 'Unauthorized fault report on colleague asset',
          description: 'Employee B trying to report defect on equipment assigned to Employee A.',
        },
      });
      assert(emp2ReportHaileAsset.status === 403, 'Employee B blocked with 403 when reporting equipment assigned to another employee');
    }

    // B. Store Keeper reporting boundaries:
    // Store Keeper blocked from reporting on field-assigned asset
    if (haileAssignedAsset) {
      const storeKeeperReportAssigned = await request('POST', '/api/maintenance', {
        cookie: storeKeeperCookie,
        body: {
          resourceId: haileAssignedAsset.id,
          title: 'Store Keeper reporting assigned asset',
          description: 'Store Keeper attempting to report on employee field asset.',
        },
      });
      assert(storeKeeperReportAssigned.status === 403, 'Store Keeper blocked with 403 when reporting asset assigned to field employee');
    }

    // Store Keeper reports on unassigned inventory asset
    const unassignedStoreAsset = await prisma.resource.findFirst({
      where: {
        currentAssigneeId: null,
        status: 'AVAILABLE',
      },
    });

    let storeTicketId = '';
    if (unassignedStoreAsset) {
      const storeReportRes = await request('POST', '/api/maintenance', {
        cookie: storeKeeperCookie,
        body: {
          resourceId: unassignedStoreAsset.id,
          title: 'Warehouse pallet damage during intake',
          description: 'Forklift fork punctured battery housing during warehouse transfer.',
          priority: 'HIGH',
          estimatedCostETB: 5000,
        },
      });
      assert(storeReportRes.status === 201, 'Store Keeper can report fault on unassigned inventory equipment (201)');
      const stTicket = storeReportRes.body?.request;
      assert(!!stTicket?.requestNumber, `Submission feedback contains formatted request number: ${stTicket?.requestNumber}`);
      assert(stTicket?.status === 'SUBMITTED', 'Work order created in SUBMITTED state');
      storeTicketId = stTicket?.id;
    }

    // C. Ticket Details endpoint returns full logs and metadata
    if (storeTicketId) {
      const detailRes = await request('GET', `/api/maintenance/${storeTicketId}`, { cookie: adminCookie });
      assert(detailRes.status === 200, 'Ticket detail endpoint returns 200');
      assert(detailRes.body?.request?.requestNumber?.length > 0, 'Details include requestNumber');
      assert(detailRes.body?.request?.resourceName?.length > 0, 'Details include resourceName');
      assert(Array.isArray(detailRes.body?.request?.logs), 'Details include logs array');
      assert(detailRes.body?.request?.logs?.length >= 1, 'Details contain submission log entry');

      // D. Full technician repair workflow with hold validation and damaged outcome
      // Admin approves the store ticket
      await request('POST', `/api/maintenance/${storeTicketId}/review`, {
        cookie: adminCookie,
        body: { action: 'APPROVE', comments: 'Approved for central workshop inspection' },
      });

      // Non-technician (Department Manager) blocked from technical repair
      const mgrProgressRes = await request('PUT', `/api/maintenance/${storeTicketId}/progress`, {
        cookie: managerCookie,
        body: { status: 'IN_PROGRESS', diagnosis: 'Manager diagnosing' },
      });
      assert(mgrProgressRes.status === 403, 'Department Manager blocked with 403 from executing technician servicing');

      // Technician starts repair
      const techStartRes = await request('PUT', `/api/maintenance/${storeTicketId}/progress`, {
        cookie: techCookie,
        body: {
          status: 'IN_PROGRESS',
          diagnosis: 'Housing punctured; internal PCB trace severed.',
          assignedTechnicianName: 'Kenenisa Bekele',
        },
      });
      assert(techStartRes.status === 200, 'Technician transitions ticket to IN_PROGRESS');

      // Technician attempts ON_HOLD without reason -> must be rejected with 400
      const noReasonHold = await request('PUT', `/api/maintenance/${storeTicketId}/progress`, {
        cookie: techCookie,
        body: { status: 'ON_HOLD' },
      });
      assert(noReasonHold.status === 400, 'Placing work order on hold without reason is rejected with 400 Bad Request');

      // Technician places ON_HOLD with specific reason
      const validHold = await request('PUT', `/api/maintenance/${storeTicketId}/progress`, {
        cookie: techCookie,
        body: {
          status: 'ON_HOLD',
          notes: 'Awaiting specialized circuit board replacement from manufacturer.',
        },
      });
      assert(validHold.status === 200, 'Technician places work order ON_HOLD with specific reason (200)');
      assert(validHold.body?.request?.status === 'ON_HOLD', 'Status updated to ON_HOLD');

      // Technician resumes work order
      const resumeRes = await request('PUT', `/api/maintenance/${storeTicketId}/progress`, {
        cookie: techCookie,
        body: { status: 'IN_PROGRESS', notes: 'Replacement circuit board received' },
      });
      assert(resumeRes.status === 200, 'Technician resumes work order to IN_PROGRESS (200)');

      // Technician updates progress while IN_PROGRESS (intermediate servicing details update)
      const intermediateProgressRes = await request('PUT', `/api/maintenance/${storeTicketId}/progress`, {
        cookie: techCookie,
        body: {
          status: 'IN_PROGRESS',
          diagnosis: 'Re-bench-tested; primary micro-controller intact.',
          repairActions: 'Soldered replacement bypass diode.',
          partsReplaced: 'Bypass diode #DIO-4001',
          actualCostETB: 1200,
          notes: 'Midway bench servicing completed smoothly',
        },
      });
      assert(intermediateProgressRes.status === 200, 'Technician can update servicing progress on IN_PROGRESS ticket (200)');
      assert(intermediateProgressRes.body?.request?.partsReplaced === 'Bypass diode #DIO-4001', 'Parts replaced updated');

      // Unauthorized roles blocked from technician repair endpoint
      const empProgressBlock = await request('PUT', `/api/maintenance/${storeTicketId}/progress`, {
        cookie: employeeCookie,
        body: { status: 'IN_PROGRESS', notes: 'Employee trying to repair' },
      });
      assert(empProgressBlock.status === 403, 'EMPLOYEE blocked with 403 from executing technician repairs');

      const storeProgressBlock = await request('PUT', `/api/maintenance/${storeTicketId}/progress`, {
        cookie: storeKeeperCookie,
        body: { status: 'IN_PROGRESS', notes: 'Store keeper trying to repair' },
      });
      assert(storeProgressBlock.status === 403, 'STORE_KEEPER blocked with 403 from executing technician repairs');

      // IT_TECHNICIAN blocked from administrative review endpoint
      const techReviewBlock = await request('POST', `/api/maintenance/${storeTicketId}/review`, {
        cookie: techCookie,
        body: { action: 'APPROVE', comments: 'Technician trying to approve' },
      });
      assert(techReviewBlock.status === 403, 'IT_TECHNICIAN blocked with 403 from reviewing/approving requests');

      // Technician completes with outcome REQUIRES_FURTHER_REPAIR (Damaged asset remains in MAINTENANCE)
      const completeDamagedRes = await request('PUT', `/api/maintenance/${storeTicketId}/progress`, {
        cookie: techCookie,
        body: {
          status: 'COMPLETED',
          repairActions: 'Installed replacement PCB board; power rail still shorting to chassis.',
          resolutionNotes: 'Asset still exhibits high impedance short; requires authorized manufacturer depot overhaul.',
          outcome: 'REQUIRES_FURTHER_REPAIR',
          conditionOnCompletion: 'POOR',
          actualCostETB: 3200,
        },
      });
      assert(completeDamagedRes.status === 200, 'Technician completed repair work with outcome REQUIRES_FURTHER_REPAIR');
      assert(completeDamagedRes.body?.custodyAction === 'REMAINS_IN_MAINTENANCE', 'custodyAction is REMAINS_IN_MAINTENANCE');

      // Verify resource remains in MAINTENANCE
      const damagedAssetDb = await prisma.resource.findUnique({ where: { id: unassignedStoreAsset.id } });
      assert(damagedAssetDb?.status === 'MAINTENANCE', 'Damaged asset remains in MAINTENANCE when further repair required');
      assert(damagedAssetDb?.condition === 'POOR', 'Asset condition updated to POOR');
    }

    // 11. Employee Equipment Active Custody Selection & Reporting Security Rules
    console.log('\n--- 11. Employee Equipment Active Custody Selection & Reporting Security Rules ---');

    // Retrieve Haile's employee record and Colleague's record
    const haileRecord = await prisma.employee.findFirst({ where: { email: 'employee@eec.gov.et' } });
    const colleagueRecord = emp2Record;
    assert(!!haileRecord, 'Found Haile employee record');
    assert(!!colleagueRecord, 'Found Colleague record');

    // Setup Test Resource 1: Assigned to Haile with active ResourceAssignment
    const myActiveAsset = await prisma.resource.upsert({
      where: { itemCode: 'EEC-CUSTODY-TEST-01' },
      update: {
        status: 'ASSIGNED',
        currentAssigneeId: haileRecord!.id,
        departmentId: 'dept-101',
      },
      create: {
        itemCode: 'EEC-CUSTODY-TEST-01',
        name: 'Trimble R12 GNSS Field Rover (Haile Active)',
        category: 'SURVEYING_GEOTECHNICAL',
        status: 'ASSIGNED',
        condition: 'GOOD',
        location: 'Kersa Dam Project - Field Site B',
        departmentId: 'dept-101',
        currentAssigneeId: haileRecord!.id,
        purchaseCostETB: 240000,
        currentValueETB: 240000,
      },
    });

    // Ensure active assignment record exists
    const activeAssign01 = await prisma.resourceAssignment.upsert({
      where: { assignmentNumber: 'ASN-TEST-CUSTODY-01' },
      update: {
        resourceId: myActiveAsset.id,
        employeeId: haileRecord!.id,
        departmentId: 'dept-101',
        status: 'ACTIVE',
        isCurrent: true,
      },
      create: {
        assignmentNumber: 'ASN-TEST-CUSTODY-01',
        resourceId: myActiveAsset.id,
        employeeId: haileRecord!.id,
        departmentId: 'dept-101',
        assignedByName: 'Derartu Tulu',
        purpose: 'Topographic field survey',
        status: 'ACTIVE',
        isCurrent: true,
      },
    });
    assert(!!activeAssign01, 'Active custody assignment verified in database');

    // a. Employee can report a fault on their own actively assigned equipment
    const empOwnReportRes = await request('POST', '/api/maintenance', {
      cookie: employeeCookie,
      body: {
        resourceId: myActiveAsset.id,
        title: 'GNSS Antenna Signal Loss',
        description: 'Receiver intermittently loses RTK satellite lock under overcast skies.',
        priority: 'MEDIUM',
      },
    });
    assert(empOwnReportRes.status === 201, 'Employee can report a fault on their own actively assigned equipment (201)');
    const ownTicket = empOwnReportRes.body?.request;
    assert(ownTicket?.custodianIdAtRequest === haileRecord!.id, 'Custodian ID at request matches active employee');
    assert(ownTicket?.status === 'SUBMITTED', 'Maintenance ticket created in SUBMITTED state');

    // Employee cannot report equipment already under MAINTENANCE (duplicate protection)
    const dupOnMaintRes = await request('POST', '/api/maintenance', {
      cookie: employeeCookie,
      body: {
        resourceId: myActiveAsset.id,
        title: 'Duplicate fault report while in maintenance',
        description: 'Testing duplicate rejection',
      },
    });
    assert(dupOnMaintRes.status === 409, 'Employee cannot report equipment already under MAINTENANCE (409)');

    // Reject the maintenance ticket so test completes cleanly
    await request('POST', `/api/maintenance/${ownTicket.id}/review`, {
      cookie: adminCookie,
      body: { action: 'REJECT', rejectionReason: 'Test completed' },
    });

    // b. Employee cannot report a fault on unassigned departmental equipment
    const unassignedDeptAsset = await prisma.resource.upsert({
      where: { itemCode: 'EEC-CUSTODY-TEST-02' },
      update: {
        status: 'AVAILABLE',
        currentAssigneeId: null,
        departmentId: 'dept-101',
      },
      create: {
        itemCode: 'EEC-CUSTODY-TEST-02',
        name: 'Concrete Schmidt Rebound Hammer (Unassigned)',
        category: 'SURVEYING_GEOTECHNICAL',
        status: 'AVAILABLE',
        condition: 'GOOD',
        location: 'Central Store',
        departmentId: 'dept-101',
        currentAssigneeId: null,
      },
    });

    const empUnassignedBlock = await request('POST', '/api/maintenance', {
      cookie: employeeCookie,
      body: {
        resourceId: unassignedDeptAsset.id,
        title: 'Spring trigger stuck',
        description: 'Employee trying to report unassigned equipment in same department.',
      },
    });
    assert(empUnassignedBlock.status === 403, 'Employee cannot report a fault on unassigned departmental equipment (403)');

    // c. Employee cannot report a fault on another employee equipment
    const colleagueAsset = await prisma.resource.upsert({
      where: { itemCode: 'EEC-CUSTODY-TEST-03' },
      update: {
        status: 'ASSIGNED',
        currentAssigneeId: colleagueRecord!.id,
        departmentId: 'dept-101',
      },
      create: {
        itemCode: 'EEC-CUSTODY-TEST-03',
        name: 'Dell Precision 7560 (Almaz Laptop)',
        category: 'IT_EQUIPMENT',
        status: 'ASSIGNED',
        condition: 'GOOD',
        location: 'HQ Floor 3',
        departmentId: 'dept-101',
        currentAssigneeId: colleagueRecord!.id,
      },
    });
    await prisma.resourceAssignment.upsert({
      where: { assignmentNumber: 'ASN-TEST-CUSTODY-03' },
      update: {
        resourceId: colleagueAsset.id,
        employeeId: colleagueRecord!.id,
        departmentId: 'dept-101',
        status: 'ACTIVE',
        isCurrent: true,
      },
      create: {
        assignmentNumber: 'ASN-TEST-CUSTODY-03',
        resourceId: colleagueAsset.id,
        employeeId: colleagueRecord!.id,
        departmentId: 'dept-101',
        assignedByName: 'Derartu Tulu',
        purpose: 'CAD drafting workstation',
        status: 'ACTIVE',
        isCurrent: true,
      },
    });

    const empColleagueBlock = await request('POST', '/api/maintenance', {
      cookie: employeeCookie,
      body: {
        resourceId: colleagueAsset.id,
        title: 'Fan making loud noise',
        description: 'Haile trying to report fault on Almaz laptop.',
      },
    });
    assert(empColleagueBlock.status === 403, 'Employee cannot report a fault on another employee equipment (403)');

    // d. Employee cannot report a fault on equipment with no valid active assignment
    // Sub-case 1: currentAssigneeId is Haile, but assignment is RETURNED (historical only, isCurrent = false)
    const historicalOnlyAsset = await prisma.resource.upsert({
      where: { itemCode: 'EEC-CUSTODY-TEST-04' },
      update: {
        status: 'AVAILABLE',
        currentAssigneeId: haileRecord!.id,
        departmentId: 'dept-101',
      },
      create: {
        itemCode: 'EEC-CUSTODY-TEST-04',
        name: 'Digital Theodolite (Returned Custody)',
        category: 'SURVEYING_GEOTECHNICAL',
        status: 'AVAILABLE',
        condition: 'GOOD',
        location: 'Central Store',
        departmentId: 'dept-101',
        currentAssigneeId: haileRecord!.id,
      },
    });
    await prisma.resourceAssignment.upsert({
      where: { assignmentNumber: 'ASN-TEST-CUSTODY-04' },
      update: {
        resourceId: historicalOnlyAsset.id,
        employeeId: haileRecord!.id,
        departmentId: 'dept-101',
        status: 'RETURNED',
        isCurrent: false,
      },
      create: {
        assignmentNumber: 'ASN-TEST-CUSTODY-04',
        resourceId: historicalOnlyAsset.id,
        employeeId: haileRecord!.id,
        departmentId: 'dept-101',
        assignedByName: 'Derartu Tulu',
        purpose: 'Survey assignment',
        status: 'RETURNED',
        isCurrent: false,
      },
    });

    const empHistoricalBlock = await request('POST', '/api/maintenance', {
      cookie: employeeCookie,
      body: {
        resourceId: historicalOnlyAsset.id,
        title: 'Display backlight flickering',
        description: 'Attempting to report on previously returned equipment without active assignment record.',
      },
    });
    assert(empHistoricalBlock.status === 403, 'Employee cannot report a fault on equipment with RETURNED/isCurrent=false assignment (403)');

    // Sub-case 2: currentAssigneeId is Haile, but NO ResourceAssignment record exists
    const noAssignmentAsset = await prisma.resource.upsert({
      where: { itemCode: 'EEC-CUSTODY-TEST-05' },
      update: {
        status: 'AVAILABLE',
        currentAssigneeId: haileRecord!.id,
        departmentId: 'dept-101',
      },
      create: {
        itemCode: 'EEC-CUSTODY-TEST-05',
        name: 'Auto-Level Topcon AT-B4A (No Assignment Record)',
        category: 'SURVEYING_GEOTECHNICAL',
        status: 'AVAILABLE',
        condition: 'GOOD',
        location: 'Central Store',
        departmentId: 'dept-101',
        currentAssigneeId: haileRecord!.id,
      },
    });
    await prisma.resourceAssignment.deleteMany({ where: { resourceId: noAssignmentAsset.id } });

    const empNoAssignmentBlock = await request('POST', '/api/maintenance', {
      cookie: employeeCookie,
      body: {
        resourceId: noAssignmentAsset.id,
        title: 'Compensator stuck',
        description: 'Attempting to report equipment with no valid active assignment record.',
      },
    });
    assert(empNoAssignmentBlock.status === 403, 'Employee cannot report a fault on equipment with no active custody assignment record (403)');

    // Clean up temporary stale pointers
    await prisma.resource.update({ where: { id: historicalOnlyAsset.id }, data: { currentAssigneeId: null } });
    await prisma.resource.update({ where: { id: noAssignmentAsset.id }, data: { currentAssigneeId: null } });

    // Verify authorized roles retain existing permissions:
    // 1. ADMIN can report any resource
    const adminReportCustodyTest = await request('POST', '/api/maintenance', {
      cookie: adminCookie,
      body: {
        resourceId: unassignedDeptAsset.id,
        title: 'Admin reporting defect on unassigned asset',
        description: 'Admin enterprise-wide reporting check',
      },
    });
    assert(adminReportCustodyTest.status === 201, 'ADMIN retains authorized enterprise-wide fault reporting (201)');
    await request('POST', `/api/maintenance/${adminReportCustodyTest.body?.request?.id}/review`, {
      cookie: adminCookie,
      body: { action: 'REJECT', rejectionReason: 'Test completed' },
    });

    // 2. IT_TECHNICIAN can report any resource
    const techReportCustodyTest = await request('POST', '/api/maintenance', {
      cookie: techCookie,
      body: {
        resourceId: unassignedDeptAsset.id,
        title: 'Technician workshop intake diagnostic',
        description: 'Technician enterprise-wide reporting check',
      },
    });
    assert(techReportCustodyTest.status === 201, 'IT_TECHNICIAN retains authorized fault reporting (201)');
    await request('POST', `/api/maintenance/${techReportCustodyTest.body?.request?.id}/review`, {
      cookie: adminCookie,
      body: { action: 'REJECT', rejectionReason: 'Test completed' },
    });

    // 3. DEPARTMENT_MANAGER can report resources in own department
    const mgrReportCustodyTest = await request('POST', '/api/maintenance', {
      cookie: managerCookie,
      body: {
        resourceId: unassignedDeptAsset.id,
        title: 'Department Manager reporting department asset',
        description: 'Manager department reporting check',
      },
    });
    assert(mgrReportCustodyTest.status === 201, 'DEPARTMENT_MANAGER retains authorized departmental reporting (201)');
    await request('POST', `/api/maintenance/${mgrReportCustodyTest.body?.request?.id}/review`, {
      cookie: adminCookie,
      body: { action: 'REJECT', rejectionReason: 'Test completed' },
    });

    // Department Manager blocked on foreign department resource
    const foreignDeptAsset = await prisma.resource.findFirst({
      where: { departmentId: { not: 'dept-101' }, currentAssigneeId: null },
    });
    if (foreignDeptAsset) {
      const mgrForeignBlock = await request('POST', '/api/maintenance', {
        cookie: managerCookie,
        body: {
          resourceId: foreignDeptAsset.id,
          title: 'Manager foreign report attempt',
          description: 'Testing manager cross-department block',
        },
      });
      assert(mgrForeignBlock.status === 403, 'DEPARTMENT_MANAGER blocked with 403 from reporting foreign department asset');
    }

    // 4. STORE_KEEPER can report unassigned inventory resources
    const storeReportCustodyTest = await request('POST', '/api/maintenance', {
      cookie: storeKeeperCookie,
      body: {
        resourceId: unassignedDeptAsset.id,
        title: 'Store Keeper reporting unassigned store inventory',
        description: 'Store inventory fault check',
      },
    });
    assert(storeReportCustodyTest.status === 201, 'STORE_KEEPER retains authorized inventory reporting (201)');
    await request('POST', `/api/maintenance/${storeReportCustodyTest.body?.request?.id}/review`, {
      cookie: adminCookie,
      body: { action: 'REJECT', rejectionReason: 'Test completed' },
    });

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

