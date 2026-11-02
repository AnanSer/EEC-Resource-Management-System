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

// Logic mirror of getAssetSerialNumber & getAssetModel from AssetSearchCombobox
function getAssetSerialNumber(r: any): string {
  if (r.serialNumber && r.serialNumber.trim()) return r.serialNumber.trim();
  if (r.itSpecs?.serialNumber && r.itSpecs.serialNumber.trim()) return r.itSpecs.serialNumber.trim();
  if (r.vehicleSpecs?.chassisNumber && r.vehicleSpecs.chassisNumber.trim()) return r.vehicleSpecs.chassisNumber.trim();
  if (r.surveyingSpecs?.serialNumber && r.surveyingSpecs.serialNumber.trim()) return r.surveyingSpecs.serialNumber.trim();
  if (r.machinerySpecs?.serialNumber && r.machinerySpecs.serialNumber.trim()) return r.machinerySpecs.serialNumber.trim();
  return '';
}

function getAssetModel(r: any): string {
  if (r.model && typeof r.model === 'string' && r.model.trim()) return r.model.trim();
  if (r.itSpecs?.model && r.itSpecs.model.trim()) return r.itSpecs.model.trim();
  if (r.vehicleSpecs?.model && r.vehicleSpecs.model.trim()) return r.vehicleSpecs.model.trim();
  if (r.machinerySpecs?.model && r.machinerySpecs.model.trim()) return r.machinerySpecs.model.trim();
  if (r.surveyingSpecs?.model && r.surveyingSpecs.model.trim()) return r.surveyingSpecs.model.trim();
  return '';
}

function filterAssets(resources: any[], mode: 'AVAILABLE' | 'ASSIGNED', query = ''): any[] {
  const eligible = resources.filter((r) => {
    if (mode === 'AVAILABLE') {
      return r.status === 'AVAILABLE';
    }
    return r.status === 'ASSIGNED';
  });

  const q = query.trim().toLowerCase();
  if (!q) return eligible;

  return eligible.filter((r) => {
    const itemCode = (r.itemCode || '').toLowerCase();
    const name = (r.name || '').toLowerCase();
    const serial = getAssetSerialNumber(r).toLowerCase();
    const model = getAssetModel(r).toLowerCase();
    const category = (r.category || '').toLowerCase();
    const custodian = (r.currentAssigneeName || '').toLowerCase();
    const empId = (r.currentAssigneeEmployeeId || '').toLowerCase();

    return (
      itemCode.includes(q) ||
      name.includes(q) ||
      serial.includes(q) ||
      model.includes(q) ||
      category.includes(q) ||
      custodian.includes(q) ||
      empId.includes(q)
    );
  });
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

function filterEmployees(
  employees: any[],
  options: {
    selectedDepartmentId?: string;
    excludeEmployeeId?: string;
    query?: string;
  } = {}
): any[] {
  const eligible = employees.filter((e) => {
    if (options.excludeEmployeeId && e.id === options.excludeEmployeeId) return false;
    return isEligibleEmployee(e, options.selectedDepartmentId);
  });

  const q = (options.query || '').trim().toLowerCase();
  if (!q) return eligible;

  return eligible.filter((e) => {
    const name = (e.name || '').toLowerCase();
    const empId = (e.employeeId || '').toLowerCase();
    const designation = (e.designation || '').toLowerCase();
    const deptName = (e.departmentName || '').toLowerCase();
    return (
      name.includes(q) ||
      empId.includes(q) ||
      designation.includes(q) ||
      deptName.includes(q)
    );
  });
}

async function runAllTests() {
  console.log('========================================================================');
  console.log('EEC RMS: Assignment & Transfer Selectors, Search, and Backend Validation');
  console.log('========================================================================');

  await createTestServer();

  let adminCookie = '';
  let deptTid: any = null;
  let testAvailAsset: any = null;
  let testAssignedAsset: any = null;
  let testMaintAsset: any = null;
  let testRetAsset: any = null;

  let empApproved1: any = null;
  let empApproved2: any = null;
  let empPending: any = null;
  let empSuspended: any = null;

  try {
    // 1. Authenticate Admin
    console.log('\n--- 1. Authenticate Administrator ---');
    adminCookie = await loginUser('admin@eec.gov.et');
    assert(!!adminCookie, 'Admin session established');

    deptTid = await prisma.department.findFirst({ where: { code: 'TID' } });
    assert(!!deptTid, 'TID department located');

    // 2. Setup Test Resources
    console.log('\n--- 2. Setting Up Test Resources for Selectors ---');
    const ts = Date.now();

    // AVAILABLE resource
    testAvailAsset = await prisma.resource.create({
      data: {
        itemCode: `EEC-TEST-AVL-${ts}`,
        name: 'Trimble S7 Total Station',
        category: 'SURVEYING_GEOTECHNICAL',
        subcategory: 'Total Station',
        status: 'AVAILABLE',
        condition: 'GOOD',
        location: 'Central Store - Kersa Shelf B3',
        departmentId: deptTid.id,
        purchaseDate: new Date('2025-02-10'),
        purchaseCostETB: 850000,
        currentValueETB: 800000,
        specs: {
          serialNumber: `SN-TRIMBLE-${ts}`,
          model: 'Trimble S7 Robotic',
        },
      },
    });

    // MAINTENANCE resource
    testMaintAsset = await prisma.resource.create({
      data: {
        itemCode: `EEC-TEST-MNT-${ts}`,
        name: 'Leica TS16 In Repair',
        category: 'SURVEYING_GEOTECHNICAL',
        subcategory: 'Total Station',
        status: 'MAINTENANCE',
        condition: 'NEEDS_REPAIR',
        location: 'Workshop Calibration Lab',
        departmentId: deptTid.id,
        purchaseDate: new Date('2025-01-15'),
        purchaseCostETB: 750000,
        currentValueETB: 700000,
        specs: {
          serialNumber: `SN-LEICA-${ts}`,
          model: 'Leica TS16',
        },
      },
    });

    // RETIRED resource
    testRetAsset = await prisma.resource.create({
      data: {
        itemCode: `EEC-TEST-RET-${ts}`,
        name: 'Decommissioned Level',
        category: 'SURVEYING_GEOTECHNICAL',
        subcategory: 'Optical Level',
        status: 'RETIRED',
        condition: 'RETIRED',
        location: 'Salvage Yard',
        departmentId: deptTid.id,
        purchaseDate: new Date('2018-05-10'),
        purchaseCostETB: 45000,
        currentValueETB: 0,
      },
    });

    // 3. Setup Test Employees
    console.log('\n--- 3. Setting Up Test Employees with Diverse Account Statuses ---');
    const userApp1 = await prisma.user.create({
      data: {
        email: `app1.${ts}@eec.gov.et`,
        fullName: `Abebe Approved TID ${ts}`,
        passwordHash: 'dummy',
        role: 'EMPLOYEE',
        status: 'APPROVED',
        departmentId: deptTid.id,
      },
    });
    empApproved1 = await prisma.employee.create({
      data: {
        employeeId: `EMP-APP1-${ts}`,
        name: `Abebe Approved TID ${ts}`,
        email: userApp1.email,
        departmentId: deptTid.id,
        designation: 'Lead Highway Engineer',
        role: 'EMPLOYEE',
        isActive: true,
        userId: userApp1.id,
      },
    });

    const userApp2 = await prisma.user.create({
      data: {
        email: `app2.${ts}@eec.gov.et`,
        fullName: `Chala Approved TID ${ts}`,
        passwordHash: 'dummy',
        role: 'EMPLOYEE',
        status: 'APPROVED',
        departmentId: deptTid.id,
      },
    });
    empApproved2 = await prisma.employee.create({
      data: {
        employeeId: `EMP-APP2-${ts}`,
        name: `Chala Approved TID ${ts}`,
        email: userApp2.email,
        departmentId: deptTid.id,
        designation: 'Senior Bridge Engineer',
        role: 'EMPLOYEE',
        isActive: true,
        userId: userApp2.id,
      },
    });

    const userPend = await prisma.user.create({
      data: {
        email: `pend.${ts}@eec.gov.et`,
        fullName: `Girma Pending ${ts}`,
        passwordHash: 'dummy',
        role: 'EMPLOYEE',
        status: 'PENDING',
        departmentId: deptTid.id,
      },
    });
    empPending = await prisma.employee.create({
      data: {
        employeeId: `EMP-PND-${ts}`,
        name: `Girma Pending ${ts}`,
        email: userPend.email,
        departmentId: deptTid.id,
        designation: 'Junior Surveyor',
        role: 'EMPLOYEE',
        isActive: true,
        userId: userPend.id,
      },
    });

    const userSusp = await prisma.user.create({
      data: {
        email: `susp.${ts}@eec.gov.et`,
        fullName: `Kassahun Suspended ${ts}`,
        passwordHash: 'dummy',
        role: 'EMPLOYEE',
        status: 'SUSPENDED',
        departmentId: deptTid.id,
      },
    });
    empSuspended = await prisma.employee.create({
      data: {
        employeeId: `EMP-SUS-${ts}`,
        name: `Kassahun Suspended ${ts}`,
        email: userSusp.email,
        departmentId: deptTid.id,
        designation: 'Site Inspector',
        role: 'EMPLOYEE',
        isActive: true,
        userId: userSusp.id,
      },
    });

    // Create ASSIGNED asset in custody of empApproved1
    testAssignedAsset = await prisma.resource.create({
      data: {
        itemCode: `EEC-TEST-ASG-${ts}`,
        name: 'Dell Latitude Field Workstation',
        category: 'IT_EQUIPMENT',
        subcategory: 'Laptop',
        status: 'ASSIGNED',
        condition: 'GOOD',
        location: 'Field Office - Mojo',
        departmentId: deptTid.id,
        currentAssigneeId: empApproved1.id,
        purchaseDate: new Date('2025-03-01'),
        purchaseCostETB: 120000,
        currentValueETB: 110000,
        specs: {
          serialNumber: `SN-DELL-${ts}`,
          model: 'Latitude 5440 Rugged',
        },
      },
    });

    const initAssignment = await prisma.resourceAssignment.create({
      data: {
        assignmentNumber: `ASGN-INIT-${ts}`,
        resourceId: testAssignedAsset.id,
        employeeId: empApproved1.id,
        departmentId: deptTid.id,
        assignedByName: 'Admin Officer',
        assignedById: userApp1.id,
        purpose: 'Field surveying computation',
        isCurrent: true,
        status: 'ACTIVE',
      },
    });

    // 4. Asset Combobox Unit Tests: Mode Separation & Search
    console.log('\n--- 4. Asset Combobox Unit Tests: Mode Separation & Search ---');
    const allSampleAssets = [
      {
        id: testAvailAsset.id,
        itemCode: testAvailAsset.itemCode,
        name: testAvailAsset.name,
        category: testAvailAsset.category,
        status: 'AVAILABLE',
        serialNumber: `SN-TRIMBLE-${ts}`,
        itSpecs: { model: 'Trimble S7 Robotic' },
      },
      {
        id: testAssignedAsset.id,
        itemCode: testAssignedAsset.itemCode,
        name: testAssignedAsset.name,
        category: testAssignedAsset.category,
        status: 'ASSIGNED',
        currentAssigneeName: empApproved1.name,
        currentAssigneeEmployeeId: empApproved1.employeeId,
        serialNumber: `SN-DELL-${ts}`,
        itSpecs: { model: 'Latitude 5440 Rugged' },
      },
      {
        id: testMaintAsset.id,
        itemCode: testMaintAsset.itemCode,
        name: testMaintAsset.name,
        category: testMaintAsset.category,
        status: 'MAINTENANCE',
        serialNumber: `SN-LEICA-${ts}`,
      },
      {
        id: testRetAsset.id,
        itemCode: testRetAsset.itemCode,
        name: testRetAsset.name,
        category: testRetAsset.category,
        status: 'RETIRED',
      },
    ];

    // AVAILABLE mode filtering
    const availFiltered = filterAssets(allSampleAssets, 'AVAILABLE');
    assert(availFiltered.length === 1, 'AVAILABLE mode returns only 1 available asset');
    assert(availFiltered[0].id === testAvailAsset.id, 'Returns the available asset');
    assert(!availFiltered.some((r) => r.status !== 'AVAILABLE'), 'Excludes assigned, maintenance, retired');

    // ASSIGNED mode filtering
    const assignedFiltered = filterAssets(allSampleAssets, 'ASSIGNED');
    assert(assignedFiltered.length === 1, 'ASSIGNED mode returns only 1 assigned asset');
    assert(assignedFiltered[0].id === testAssignedAsset.id, 'Returns the assigned asset');
    assert(!assignedFiltered.some((r) => r.status !== 'ASSIGNED'), 'Excludes available, maintenance, retired');

    // Search by item code
    const searchCode = filterAssets(allSampleAssets, 'AVAILABLE', testAvailAsset.itemCode);
    assert(searchCode.length === 1 && searchCode[0].id === testAvailAsset.id, 'Search by itemCode matches');

    // Search by name
    const searchName = filterAssets(allSampleAssets, 'AVAILABLE', 'Trimble S7');
    assert(searchName.length === 1, 'Search by asset name matches');

    // Search by serial number
    const searchSerial = filterAssets(allSampleAssets, 'AVAILABLE', `SN-TRIMBLE-${ts}`);
    assert(searchSerial.length === 1, 'Search by serial number matches');

    // Search by model
    const searchModel = filterAssets(allSampleAssets, 'AVAILABLE', 'Robotic');
    assert(searchModel.length === 1, 'Search by model matches');

    // Search by custodian (in ASSIGNED mode)
    const searchCust = filterAssets(allSampleAssets, 'ASSIGNED', empApproved1.name);
    assert(searchCust.length === 1, 'Search by current custodian name matches in ASSIGNED mode');

    // 5. Employee Combobox Unit Tests: Eligibility & Exclude Custodian
    console.log('\n--- 5. Employee Combobox Unit Tests: Eligibility & Exclude Custodian ---');
    const allSampleEmployees = [
      {
        id: empApproved1.id,
        employeeId: empApproved1.employeeId,
        name: empApproved1.name,
        departmentId: deptTid.id,
        departmentName: 'Transport Infrastructure',
        designation: empApproved1.designation,
        isActive: true,
        accountStatus: 'APPROVED',
      },
      {
        id: empApproved2.id,
        employeeId: empApproved2.employeeId,
        name: empApproved2.name,
        departmentId: deptTid.id,
        departmentName: 'Transport Infrastructure',
        designation: empApproved2.designation,
        isActive: true,
        accountStatus: 'APPROVED',
      },
      {
        id: empPending.id,
        employeeId: empPending.employeeId,
        name: empPending.name,
        departmentId: deptTid.id,
        departmentName: 'Transport Infrastructure',
        designation: empPending.designation,
        isActive: true,
        accountStatus: 'PENDING',
      },
      {
        id: empSuspended.id,
        employeeId: empSuspended.employeeId,
        name: empSuspended.name,
        departmentId: deptTid.id,
        departmentName: 'Transport Infrastructure',
        designation: empSuspended.designation,
        isActive: true,
        accountStatus: 'SUSPENDED',
      },
    ];

    // For Direct Assignment: both approved employees eligible, pending/suspended excluded
    const directEligibleEmps = filterEmployees(allSampleEmployees);
    assert(directEligibleEmps.length === 2, 'Only 2 approved employees are eligible for direct assignment');
    assert(!directEligibleEmps.some((e) => e.accountStatus !== 'APPROVED'), 'Pending and suspended employees excluded');

    // For Custody Transfer: exclude current custodian (empApproved1)
    const transferEligibleEmps = filterEmployees(allSampleEmployees, {
      excludeEmployeeId: empApproved1.id,
    });
    assert(transferEligibleEmps.length === 1, 'Transfer excludes current custodian, leaving 1 eligible recipient');
    assert(transferEligibleEmps[0].id === empApproved2.id, 'Eligible transfer recipient is Chala (empApproved2)');

    // Search by full name, ID, designation
    const searchEmpName = filterEmployees(allSampleEmployees, { query: 'Chala' });
    assert(searchEmpName.length === 1 && searchEmpName[0].id === empApproved2.id, 'Search employee by name matches');

    const searchEmpId = filterEmployees(allSampleEmployees, { query: empApproved2.employeeId });
    assert(searchEmpId.length === 1, 'Search employee by employeeId matches');

    const searchEmpDesig = filterEmployees(allSampleEmployees, { query: 'Bridge Engineer' });
    assert(searchEmpDesig.length === 1, 'Search employee by designation matches');

    // 6. Backend Validation: Direct Equipment Assignment (POST /api/assignments)
    console.log('\n--- 6. Backend Validation: Direct Equipment Assignment ---');

    // Reject non-AVAILABLE resource (testAssignedAsset is ASSIGNED)
    const directAssignedFail = await request('POST', '/api/assignments', {
      cookie: adminCookie,
      body: {
        resourceId: testAssignedAsset.id,
        employeeId: empApproved2.id,
        purpose: 'Direct assign attempt with assigned asset',
      },
    });
    assert(directAssignedFail.status === 400, 'Direct assignment rejects non-AVAILABLE resource (400)');
    assert(
      (directAssignedFail.body.message || '').includes('cannot be assigned'),
      'Clarifies resource is not available'
    );

    // Reject MAINTENANCE resource
    const directMaintFail = await request('POST', '/api/assignments', {
      cookie: adminCookie,
      body: {
        resourceId: testMaintAsset.id,
        employeeId: empApproved2.id,
        purpose: 'Direct assign attempt with maintenance asset',
      },
    });
    assert(directMaintFail.status === 400, 'Direct assignment rejects resource in MAINTENANCE (400)');

    // Reject RETIRED resource
    const directRetFail = await request('POST', '/api/assignments', {
      cookie: adminCookie,
      body: {
        resourceId: testRetAsset.id,
        employeeId: empApproved2.id,
        purpose: 'Direct assign attempt with retired asset',
      },
    });
    assert(directRetFail.status === 400, 'Direct assignment rejects RETIRED resource (400)');

    // Reject PENDING employee account
    const directPendFail = await request('POST', '/api/assignments', {
      cookie: adminCookie,
      body: {
        resourceId: testAvailAsset.id,
        employeeId: empPending.id,
        purpose: 'Direct assign attempt with pending employee',
      },
    });
    assert(directPendFail.status === 400, 'Direct assignment rejects PENDING employee account (400)');
    assert(
      (directPendFail.body.message || '').includes('PENDING'),
      'Error message clarifies PENDING account status'
    );

    // Reject SUSPENDED employee account
    const directSuspFail = await request('POST', '/api/assignments', {
      cookie: adminCookie,
      body: {
        resourceId: testAvailAsset.id,
        employeeId: empSuspended.id,
        purpose: 'Direct assign attempt with suspended employee',
      },
    });
    assert(directSuspFail.status === 400, 'Direct assignment rejects SUSPENDED employee account (400)');
    assert(
      (directSuspFail.body.message || '').includes('SUSPENDED'),
      'Error message clarifies SUSPENDED account status'
    );

    // Successful Direct Equipment Assignment
    const directSuccess = await request('POST', '/api/assignments', {
      cookie: adminCookie,
      body: {
        resourceId: testAvailAsset.id,
        employeeId: empApproved2.id,
        purpose: 'Highway topography survey Modjo',
        expectedReturnDate: '2026-12-15',
        notes: 'Calibrated with certificate',
      },
    });
    assert(directSuccess.status === 201, 'Direct assignment succeeds with AVAILABLE asset & APPROVED employee (201)');
    assert(directSuccess.body.assignment.status === 'ACTIVE', 'New assignment is ACTIVE');
    assert(directSuccess.body.assignment.isCurrent === true, 'New assignment is marked isCurrent: true');
    assert(directSuccess.body.assignment.employeeId === empApproved2.id, 'Assigned to Chala');

    // Confirm DB state
    const dbAssetAfterAssign = await prisma.resource.findUnique({ where: { id: testAvailAsset.id } });
    assert(dbAssetAfterAssign?.status === 'ASSIGNED', 'Database confirms asset status changed to ASSIGNED');
    assert(dbAssetAfterAssign?.currentAssigneeId === empApproved2.id, 'Database confirms currentAssigneeId is Chala');

    // 7. Backend Validation: Custody Transfer (POST /api/assignments/transfer)
    console.log('\n--- 7. Backend Validation: Custody Transfer ---');

    // Reject transferring to the same custodian (empApproved1 already holds testAssignedAsset)
    const trfSameFail = await request('POST', '/api/assignments/transfer', {
      cookie: adminCookie,
      body: {
        resourceId: testAssignedAsset.id,
        toEmployeeId: empApproved1.id,
        reason: 'Same custodian transfer attempt',
        transferNotes: 'Should be rejected',
      },
    });
    assert(trfSameFail.status === 400, 'Transfer rejects assigning to current custodian (400)');
    assert(
      (trfSameFail.body.message || '').includes('already the current custodian'),
      'Clarifies target employee is already the current custodian'
    );

    // Reject transferring to PENDING employee
    const trfPendFail = await request('POST', '/api/assignments/transfer', {
      cookie: adminCookie,
      body: {
        resourceId: testAssignedAsset.id,
        toEmployeeId: empPending.id,
        reason: 'Pending transfer',
        transferNotes: 'Should be rejected',
      },
    });
    assert(trfPendFail.status === 400, 'Transfer rejects target employee with PENDING account (400)');
    assert(
      (trfPendFail.body.message || '').includes('PENDING'),
      'Clarifies PENDING account status rejection'
    );

    // Reject transferring to SUSPENDED employee
    const trfSuspFail = await request('POST', '/api/assignments/transfer', {
      cookie: adminCookie,
      body: {
        resourceId: testAssignedAsset.id,
        toEmployeeId: empSuspended.id,
        reason: 'Suspended transfer',
        transferNotes: 'Should be rejected',
      },
    });
    assert(trfSuspFail.status === 400, 'Transfer rejects target employee with SUSPENDED account (400)');
    assert(
      (trfSuspFail.body.message || '').includes('SUSPENDED'),
      'Clarifies SUSPENDED account status rejection'
    );

    // Reject transferring non-ASSIGNED resource (e.g. testMaintAsset)
    const trfNonAssignedFail = await request('POST', '/api/assignments/transfer', {
      cookie: adminCookie,
      body: {
        resourceId: testMaintAsset.id,
        toEmployeeId: empApproved2.id,
        reason: 'Transfer unassigned maintenance asset',
        transferNotes: 'Should be rejected',
      },
    });
    assert(trfNonAssignedFail.status === 400, 'Transfer rejects non-ASSIGNED resource (400)');

    // Successful Custody Transfer: transfer testAssignedAsset from empApproved1 to empApproved2
    const trfSuccess = await request('POST', '/api/assignments/transfer', {
      cookie: adminCookie,
      body: {
        resourceId: testAssignedAsset.id,
        toEmployeeId: empApproved2.id,
        reason: 'Project handover',
        transferNotes: 'Transferred laptop for field processing',
      },
    });
    assert(trfSuccess.status === 200, 'Custody transfer succeeds to eligible APPROVED employee (200)');
    assert(trfSuccess.body.assignment.status === 'ACTIVE', 'New assignment is ACTIVE');
    assert(trfSuccess.body.assignment.employeeId === empApproved2.id, 'Assigned to empApproved2');
    assert(trfSuccess.body.transfer.fromEmployeeId === empApproved1.id, 'Transfer records fromEmployee');
    assert(trfSuccess.body.transfer.toEmployeeId === empApproved2.id, 'Transfer records toEmployee');

    // Confirm DB state after transfer
    const dbTransferredAsset = await prisma.resource.findUnique({ where: { id: testAssignedAsset.id } });
    assert(dbTransferredAsset?.status === 'ASSIGNED', 'Transferred asset remains ASSIGNED');
    assert(dbTransferredAsset?.currentAssigneeId === empApproved2.id, 'Current assignee updated to empApproved2');

    const prevAssignment = await prisma.resourceAssignment.findUnique({ where: { id: initAssignment.id } });
    assert(prevAssignment?.status === 'TRANSFERRED', 'Previous assignment marked TRANSFERRED');
    assert(prevAssignment?.isCurrent === false, 'Previous assignment isCurrent is false');

    // 8. Clean up test records
    console.log('\n--- 8. Cleaning Up Test Records ---');
    await prisma.custodyTransfer.deleteMany({ where: { resourceId: testAssignedAsset.id } });
    await prisma.resourceAssignment.deleteMany({
      where: { resourceId: { in: [testAvailAsset.id, testAssignedAsset.id] } },
    });
    await prisma.resource.deleteMany({
      where: { id: { in: [testAvailAsset.id, testAssignedAsset.id, testMaintAsset.id, testRetAsset.id] } },
    });
    await prisma.employee.deleteMany({
      where: { id: { in: [empApproved1.id, empApproved2.id, empPending.id, empSuspended.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userApp1.id, userApp2.id, userPend.id, userSusp.id] } },
    });
    console.log('  ✓ Test resources, assignments, employees, and users safely cleaned up');

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

runAllTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
