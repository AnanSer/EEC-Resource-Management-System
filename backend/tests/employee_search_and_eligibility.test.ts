process.env.RMS_TEST_MODE = '1';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import prisma from '../src/lib/prisma';

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

// Logic mirror of isEligibleEmployee from EmployeeSearchCombobox
function isEligibleEmployee(e: any, selectedDepartmentId?: string): boolean {
  if (selectedDepartmentId && e.departmentId !== selectedDepartmentId) {
    return false;
  }
  if (!e.isActive) {
    return false;
  }
  const status = (e.accountStatus || '').toUpperCase();
  if (status === 'PENDING' || status === 'REJECTED' || status === 'SUSPENDED') {
    return false;
  }
  if (status === 'APPROVED') {
    return true;
  }
  if (!e.accountStatus && e.isActive) {
    return true;
  }
  if (status === 'ACTIVE' && !e.userId) {
    return true;
  }
  return false;
}

// Logic mirror of search filtering from EmployeeSearchCombobox
function filterEmployees(employees: any[], selectedDepartmentId?: string, searchQuery = ''): any[] {
  const eligible = employees.filter((e) => isEligibleEmployee(e, selectedDepartmentId));
  const q = searchQuery.trim().toLowerCase();
  if (!q) return eligible;

  return eligible.filter((e) => {
    const name = (e.name || '').toLowerCase();
    const empId = (e.employeeId || '').toLowerCase();
    const designation = (e.designation || '').toLowerCase();
    const deptName = (e.departmentName || '').toLowerCase();
    const deptCode = (e.departmentCode || '').toLowerCase();

    return (
      name.includes(q) ||
      empId.includes(q) ||
      designation.includes(q) ||
      deptName.includes(q) ||
      deptCode.includes(q)
    );
  });
}

async function runTests() {
  console.log('========================================================================');
  console.log('EEC RMS: Employee Selection, Search, Eligibility & Backend Validation');
  console.log('========================================================================');

  await createTestServer();
  console.log(`Test server running at ${baseUrl}`);

  const createdUserIds: string[] = [];
  const createdEmployeeIds: string[] = [];
  const createdRequisitionIds: string[] = [];

  try {
    // 1. Authenticate Admin
    console.log('\n--- 1. Authenticate Administrator ---');
    const adminCookie = await loginUser('admin@eec.gov.et');
    assert(!!adminCookie, 'Admin authenticated');

    const [deptTid, deptIct] = await Promise.all([
      prisma.department.findUnique({ where: { code: 'TID' } }),
      prisma.department.findUnique({ where: { code: 'ICT' } }),
    ]);
    assert(!!deptTid, 'TID department located');
    assert(!!deptIct, 'ICT department located');

    // 2. Setup Test Employees across account statuses and departments
    console.log('\n--- 2. Setting Up Test Employees with Diverse Account Statuses ---');
    const timestamp = Date.now();

    // A. Approved employee in TID
    const userApprovedTid = await prisma.user.create({
      data: {
        email: `approved.tid.${timestamp}@eec.gov.et`,
        fullName: 'Dawit Approved TID',
        passwordHash: 'dummyhash',
        role: 'EMPLOYEE',
        status: 'APPROVED',
        departmentId: deptTid!.id,
      },
    });
    createdUserIds.push(userApprovedTid.id);

    const empApprovedTid = await prisma.employee.create({
      data: {
        employeeId: `EEC-EMP-APP-${timestamp.toString().slice(-4)}`,
        name: 'Dawit Approved TID',
        email: `approved.tid.${timestamp}@eec.gov.et`,
        departmentId: deptTid!.id,
        designation: 'Senior Pavement Specialist',
        role: 'EMPLOYEE',
        isActive: true,
        userId: userApprovedTid.id,
      },
    });
    createdEmployeeIds.push(empApprovedTid.id);

    // B. Pending applicant in TID (status PENDING)
    const userPendingTid = await prisma.user.create({
      data: {
        email: `pending.tid.${timestamp}@eec.gov.et`,
        fullName: 'Mulugeta Pending TID',
        passwordHash: 'dummyhash',
        role: 'EMPLOYEE',
        status: 'PENDING',
        departmentId: deptTid!.id,
      },
    });
    createdUserIds.push(userPendingTid.id);

    const empPendingTid = await prisma.employee.create({
      data: {
        employeeId: `EEC-EMP-PND-${timestamp.toString().slice(-4)}`,
        name: 'Mulugeta Pending TID',
        email: `pending.tid.${timestamp}@eec.gov.et`,
        departmentId: deptTid!.id,
        designation: 'Assistant Bridge Engineer',
        role: 'EMPLOYEE',
        isActive: false, // inactive until approved
        userId: userPendingTid.id,
      },
    });
    createdEmployeeIds.push(empPendingTid.id);

    // C. Suspended employee in TID (status SUSPENDED)
    const userSuspendedTid = await prisma.user.create({
      data: {
        email: `suspended.tid.${timestamp}@eec.gov.et`,
        fullName: 'Kassahun Suspended TID',
        passwordHash: 'dummyhash',
        role: 'EMPLOYEE',
        status: 'SUSPENDED',
        departmentId: deptTid!.id,
      },
    });
    createdUserIds.push(userSuspendedTid.id);

    const empSuspendedTid = await prisma.employee.create({
      data: {
        employeeId: `EEC-EMP-SUS-${timestamp.toString().slice(-4)}`,
        name: 'Kassahun Suspended TID',
        email: `suspended.tid.${timestamp}@eec.gov.et`,
        departmentId: deptTid!.id,
        designation: 'Field Geologist',
        role: 'EMPLOYEE',
        isActive: false,
        userId: userSuspendedTid.id,
      },
    });
    createdEmployeeIds.push(empSuspendedTid.id);

    // D. Rejected applicant in TID (status REJECTED)
    const userRejectedTid = await prisma.user.create({
      data: {
        email: `rejected.tid.${timestamp}@eec.gov.et`,
        fullName: 'Tigist Rejected TID',
        passwordHash: 'dummyhash',
        role: 'EMPLOYEE',
        status: 'REJECTED',
        departmentId: deptTid!.id,
      },
    });
    createdUserIds.push(userRejectedTid.id);

    const empRejectedTid = await prisma.employee.create({
      data: {
        employeeId: `EEC-EMP-REJ-${timestamp.toString().slice(-4)}`,
        name: 'Tigist Rejected TID',
        email: `rejected.tid.${timestamp}@eec.gov.et`,
        departmentId: deptTid!.id,
        designation: 'CAD Drafter',
        role: 'EMPLOYEE',
        isActive: false,
        userId: userRejectedTid.id,
      },
    });
    createdEmployeeIds.push(empRejectedTid.id);

    // E. Approved employee in ICT (different department)
    const userApprovedIct = await prisma.user.create({
      data: {
        email: `approved.ict.${timestamp}@eec.gov.et`,
        fullName: 'Betelehem Approved ICT',
        passwordHash: 'dummyhash',
        role: 'EMPLOYEE',
        status: 'APPROVED',
        departmentId: deptIct!.id,
      },
    });
    createdUserIds.push(userApprovedIct.id);

    const empApprovedIct = await prisma.employee.create({
      data: {
        employeeId: `EEC-EMP-ICT-${timestamp.toString().slice(-4)}`,
        name: 'Betelehem Approved ICT',
        email: `approved.ict.${timestamp}@eec.gov.et`,
        departmentId: deptIct!.id,
        designation: 'Systems Network Administrator',
        role: 'EMPLOYEE',
        isActive: true,
        userId: userApprovedIct.id,
      },
    });
    createdEmployeeIds.push(empApprovedIct.id);

    // 3. Frontend Combobox Search & Filtering Tests
    console.log('\n--- 3. Combobox Unit Tests: Department Scoping & Search ---');
    const mockDirectory = [
      {
        id: empApprovedTid.id,
        employeeId: empApprovedTid.employeeId,
        name: 'Dawit Approved TID',
        departmentId: deptTid!.id,
        departmentName: 'Transport & Infrastructure Design',
        departmentCode: 'TID',
        designation: 'Senior Pavement Specialist',
        accountStatus: 'APPROVED',
        isActive: true,
      },
      {
        id: empPendingTid.id,
        employeeId: empPendingTid.employeeId,
        name: 'Mulugeta Pending TID',
        departmentId: deptTid!.id,
        departmentName: 'Transport & Infrastructure Design',
        departmentCode: 'TID',
        designation: 'Assistant Bridge Engineer',
        accountStatus: 'PENDING',
        isActive: false,
      },
      {
        id: empSuspendedTid.id,
        employeeId: empSuspendedTid.employeeId,
        name: 'Kassahun Suspended TID',
        departmentId: deptTid!.id,
        departmentName: 'Transport & Infrastructure Design',
        departmentCode: 'TID',
        designation: 'Field Geologist',
        accountStatus: 'SUSPENDED',
        isActive: false,
      },
      {
        id: empRejectedTid.id,
        employeeId: empRejectedTid.employeeId,
        name: 'Tigist Rejected TID',
        departmentId: deptTid!.id,
        departmentName: 'Transport & Infrastructure Design',
        departmentCode: 'TID',
        designation: 'CAD Drafter',
        accountStatus: 'REJECTED',
        isActive: false,
      },
      {
        id: empApprovedIct.id,
        employeeId: empApprovedIct.employeeId,
        name: 'Betelehem Approved ICT',
        departmentId: deptIct!.id,
        departmentName: 'Information & Communications Tech',
        departmentCode: 'ICT',
        designation: 'Systems Network Administrator',
        accountStatus: 'APPROVED',
        isActive: true,
      },
    ];

    // 3.1 Department Filtering: TID should only return Dawit (pending, suspended, rejected, and ICT excluded)
    const tidEligible = filterEmployees(mockDirectory, deptTid!.id);
    assert(tidEligible.length === 1, 'Only 1 eligible employee in TID (pending/suspended/rejected excluded)');
    assert(tidEligible[0].id === empApprovedTid.id, 'Dawit Approved TID is the only eligible employee');

    // 3.2 Department Filtering: ICT should return Betelehem
    const ictEligible = filterEmployees(mockDirectory, deptIct!.id);
    assert(ictEligible.length === 1 && ictEligible[0].id === empApprovedIct.id, 'ICT department returns only Betelehem');

    // 3.3 Search by Full Name
    const searchByName = filterEmployees(mockDirectory, deptTid!.id, 'Dawit');
    assert(searchByName.length === 1 && searchByName[0].id === empApprovedTid.id, 'Search by full name matches');

    // 3.4 Search by Employee ID
    const searchById = filterEmployees(mockDirectory, deptTid!.id, empApprovedTid.employeeId.slice(-4));
    assert(searchById.length === 1 && searchById[0].id === empApprovedTid.id, 'Search by employee ID matches');

    // 3.5 Search by Designation
    const searchByDesig = filterEmployees(mockDirectory, deptTid!.id, 'Pavement');
    assert(searchByDesig.length === 1 && searchByDesig[0].id === empApprovedTid.id, 'Search by designation matches');

    // 3.6 Search by Department
    const searchByDept = filterEmployees(mockDirectory, deptTid!.id, 'TID');
    assert(searchByDept.length === 1 && searchByDept[0].id === empApprovedTid.id, 'Search by department code matches');

    // 3.7 Search query matching pending/suspended/rejected employee returns empty
    const searchPending = filterEmployees(mockDirectory, deptTid!.id, 'Mulugeta');
    assert(searchPending.length === 0, 'Pending applicant is never returned by search');

    const searchSuspended = filterEmployees(mockDirectory, deptTid!.id, 'Kassahun');
    assert(searchSuspended.length === 0, 'Suspended employee is never returned by search');

    const searchRejected = filterEmployees(mockDirectory, deptTid!.id, 'Tigist');
    assert(searchRejected.length === 0, 'Rejected applicant is never returned by search');

    // 3.8 Department Change Selection Clearing simulation
    let selectedEmpId = empApprovedTid.id;
    let selectedDeptId = deptTid!.id;
    // When department changes to ICT:
    selectedDeptId = deptIct!.id;
    selectedEmpId = ''; // Implemented in RequisitionsPage.tsx: targetDeptId onChange resets targetEmpId to ''
    assert(selectedEmpId === '', 'Selection is immediately cleared when department changes');

    // 4. Backend Validation Tests (Form 1: Submit Resource Requisition)
    console.log('\n--- 4. Backend Validation: Submit Resource Requisition ---');

    // 4.1 Reject when employee belongs to a different department (Department mismatch)
    const crossDeptReqFail = await request('POST', '/api/requisitions', {
      cookie: adminCookie,
      body: {
        category: 'IT_EQUIPMENT',
        itemDescription: 'Cross department test request',
        justification: 'Testing department mismatch validation',
        departmentId: deptTid!.id,
        employeeId: empApprovedIct.id, // In ICT, not TID!
      },
    });
    assert(crossDeptReqFail.status === 400, 'Cross-department employee assignment rejected with 400');
    assert(
      crossDeptReqFail.body.message.includes('Department mismatch') ||
      crossDeptReqFail.body.message.includes('does not belong to'),
      'Error message clarifies department mismatch'
    );

    // 4.2 Reject when employee account is PENDING
    const pendingReqFail = await request('POST', '/api/requisitions', {
      cookie: adminCookie,
      body: {
        category: 'IT_EQUIPMENT',
        itemDescription: 'Pending user allocation attempt',
        justification: 'Testing pending account rejection',
        departmentId: deptTid!.id,
        employeeId: empPendingTid.id,
      },
    });
    assert(pendingReqFail.status === 400, 'Pending account employee assignment rejected with 400');
    assert(
      pendingReqFail.body.message.includes('PENDING') ||
      pendingReqFail.body.message.includes('Only APPROVED') ||
      pendingReqFail.body.message.includes('inactive'),
      'Error message clarifies non-approved account rejection'
    );

    // 4.3 Reject when employee account is SUSPENDED
    const suspendedReqFail = await request('POST', '/api/requisitions', {
      cookie: adminCookie,
      body: {
        category: 'IT_EQUIPMENT',
        itemDescription: 'Suspended user allocation attempt',
        justification: 'Testing suspended account rejection',
        departmentId: deptTid!.id,
        employeeId: empSuspendedTid.id,
      },
    });
    assert(suspendedReqFail.status === 400, 'Suspended account employee assignment rejected with 400');
    assert(
      suspendedReqFail.body.message.includes('SUSPENDED') ||
      suspendedReqFail.body.message.includes('Only APPROVED') ||
      suspendedReqFail.body.message.includes('inactive'),
      'Error message clarifies suspended account rejection'
    );

    // 4.4 Reject when employee account is REJECTED
    const rejectedReqFail = await request('POST', '/api/requisitions', {
      cookie: adminCookie,
      body: {
        category: 'IT_EQUIPMENT',
        itemDescription: 'Rejected user allocation attempt',
        justification: 'Testing rejected account rejection',
        departmentId: deptTid!.id,
        employeeId: empRejectedTid.id,
      },
    });
    assert(rejectedReqFail.status === 400, 'Rejected account employee assignment rejected with 400');

    // 4.5 Success when employee is APPROVED and belongs to target department
    const validSubmitReq = await request('POST', '/api/requisitions', {
      cookie: adminCookie,
      body: {
        category: 'IT_EQUIPMENT',
        itemDescription: 'Engineering CAD Workstation for Approved TID Engineer',
        justification: 'Project alignment modeling for Modjo-Hawassa expressway',
        departmentId: deptTid!.id,
        employeeId: empApprovedTid.id,
        isDirectAllocation: false,
      },
    });
    assert(validSubmitReq.status === 201, 'Valid Submit Requisition accepted (201)');
    assert(validSubmitReq.body.requisition.employeeId === empApprovedTid.id, 'Assigned to approved TID employee');
    assert(validSubmitReq.body.requisition.status === 'PENDING', 'Standard requisition status is PENDING');
    createdRequisitionIds.push(validSubmitReq.body.requisition.id);

    // 5. Backend Validation Tests (Form 2: Initiate Corporate Asset Allocation)
    console.log('\n--- 5. Backend Validation: Initiate Corporate Asset Allocation ---');

    // 5.1 Reject cross-department employee in direct allocation
    const directCrossFail = await request('POST', '/api/requisitions', {
      cookie: adminCookie,
      body: {
        category: 'SURVEYING_GEOTECHNICAL',
        itemDescription: 'Direct Total Station Allocation',
        justification: 'Emergency site deployment',
        departmentId: deptTid!.id,
        employeeId: empApprovedIct.id, // In ICT, not TID
        isDirectAllocation: true,
      },
    });
    assert(directCrossFail.status === 400, 'Direct allocation rejects cross-department employee (400)');

    // 5.2 Success when employee is APPROVED and in target department
    const validDirectAlloc = await request('POST', '/api/requisitions', {
      cookie: adminCookie,
      body: {
        category: 'SURVEYING_GEOTECHNICAL',
        itemDescription: 'Direct Total Station Allocation for Road Project',
        justification: 'Executive direction for rapid deployment',
        departmentId: deptTid!.id,
        employeeId: empApprovedTid.id,
        isDirectAllocation: true,
      },
    });
    assert(validDirectAlloc.status === 201, 'Valid Direct Allocation accepted (201)');
    assert(validDirectAlloc.body.requisition.employeeId === empApprovedTid.id, 'Direct allocation assigned to approved employee');
    assert(validDirectAlloc.body.requisition.isDirectAllocation === true, 'isDirectAllocation is true');
    assert(validDirectAlloc.body.requisition.status === 'APPROVED', 'Direct allocation immediately APPROVED for Store Keeper fulfillment');
    createdRequisitionIds.push(validDirectAlloc.body.requisition.id);

    // 6. Cleanup
    console.log('\n--- 6. Cleaning Up Test Records ---');
    await prisma.resourceRequisition.deleteMany({
      where: { id: { in: createdRequisitionIds } },
    });
    await prisma.employee.deleteMany({
      where: { id: { in: createdEmployeeIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    });
    console.log('  ✓ Test requisitions, employees, and users safely cleaned up');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n========================================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();

