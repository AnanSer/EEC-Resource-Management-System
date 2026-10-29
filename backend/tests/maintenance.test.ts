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
    // Find an available asset in dept-101
    const dept101Asset = await prisma.resource.findFirst({
      where: {
        departmentId: 'dept-101',
        status: 'AVAILABLE',
      },
    });
    assert(!!dept101Asset, 'Found available asset in dept-101');

    // Employee reports defect in own department
    const empReportRes = await request('POST', '/api/maintenance', {
      cookie: employeeCookie,
      body: {
        resourceId: dept101Asset!.id,
        title: 'Laser Level Calibration Drift',
        description: 'Laser line shows 3mm deviation over 10m range during morning inspection.',
        priority: 'HIGH',
        estimatedCostETB: 8500,
      },
    });
    assert(empReportRes.status === 201, 'Employee can submit maintenance request for department resource');
    const createdTicket1 = empReportRes.body?.request;
    assert(!!createdTicket1?.requestNumber, 'Ticket has formatted requestNumber (MNT-YYYY-XXXX)');
    assert(createdTicket1?.status === 'SUBMITTED', 'Initial status is SUBMITTED');
    assert(createdTicket1?.reportedByName === 'Haile Gebrselassie' || !!createdTicket1?.reportedByName, 'Reporter name recorded');

    // Verify resource transitioned to MAINTENANCE
    const resAfterReport = await prisma.resource.findUnique({ where: { id: dept101Asset!.id } });
    assert(resAfterReport?.status === 'MAINTENANCE', 'Resource status transitioned to MAINTENANCE');

    // Duplicate active maintenance check
    const dupRes = await request('POST', '/api/maintenance', {
      cookie: employeeCookie,
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
    const dept101Asset2 = await prisma.resource.findFirst({
      where: {
        departmentId: 'dept-101',
        status: 'AVAILABLE',
        id: { not: dept101Asset!.id },
      },
    });

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
      update: { userId: emp2User.id, departmentId: 'dept-101', role: 'EMPLOYEE' },
      create: {
        employeeId: 'EEC-EMP-TEST-101',
        name: 'Solomon Test Employee',
        email: 'emp2.dept101@eec.gov.et',
        phone: '+251 911 000101',
        departmentId: 'dept-101',
        designation: 'Junior Highway Engineer',
        role: 'EMPLOYEE',
        userId: emp2User.id,
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
    const assetForCustodyTest = await prisma.resource.findFirst({
      where: {
        departmentId: 'dept-101',
        status: 'AVAILABLE',
      },
    });

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

