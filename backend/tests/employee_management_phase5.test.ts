process.env.RMS_TEST_MODE = '1';
import http from 'node:http';
import prisma from '../src/lib/prisma';
import { decorateResponse } from '../src/http/response';
import { parseCookies } from '../src/http/cookies';
import { parseRequestBody } from '../src/http/bodyParser';
import { handleCors } from '../src/http/cors';
import { sessionMiddleware } from '../src/auth/auth.middleware';
import { AppRequest, AppResponse } from '../src/http/types';

let server: http.Server;
let baseUrl: string;

async function createTestServer(): Promise<string> {
  const indexMod = await import('../src/index');
  server = indexMod.server;
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      const url = `http://127.0.0.1:${addr.port}`;
      resolve(url);
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

  const setCookie = res.headers.get('set-cookie');
  let body: any = null;
  const text = await res.text();
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  return {
    status: res.status,
    body,
    cookie: setCookie ? setCookie.split(';')[0] : undefined,
  };
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${msg}`);
    throw new Error(msg);
  }
  console.log(`  ✓ ${msg}`);
}

async function runTests() {
  console.log('================================================================');
  console.log('EEC RMS: Employee Management Phase 5 Integration Tests');
  console.log('================================================================');

  baseUrl = await createTestServer();
  console.log(`Test server running at ${baseUrl}`);

  let adminCookie = '';
  let managerCookie = '';
  let employeeCookie = '';
  let adminId = '';
  let managerId = '';

  const cleanupUserIds: string[] = [];
  const cleanupEmployeeIds: string[] = [];

  try {
    // 1. Authenticate Roles
    console.log('\n--- 1. Authenticating Roles ---');
    const adminLogin = await request('POST', '/api/auth/login', {
      body: { email: 'admin@eec.gov.et', password: 'EEC-Secure2026!' },
    });
    assert(adminLogin.status === 200, 'Admin login succeeded (200)');
    adminCookie = adminLogin.cookie!;
    adminId = adminLogin.body.user.id;

    const mgrLogin = await request('POST', '/api/auth/login', {
      body: { email: 'manager@eec.gov.et', password: 'EEC-Secure2026!' },
    });
    assert(mgrLogin.status === 200, 'Department Manager login succeeded (200)');
    managerCookie = mgrLogin.cookie!;
    managerId = mgrLogin.body.user.id;

    const empLogin = await request('POST', '/api/auth/login', {
      body: { email: 'employee@eec.gov.et', password: 'EEC-Secure2026!' },
    });
    assert(empLogin.status === 200, 'Employee login succeeded (200)');
    employeeCookie = empLogin.cookie!;

    // 2. Public Registration & Validation
    console.log('\n--- 2. Public Registration Endpoint & Validation ---');
    const publicDepts = await request('GET', '/api/auth/departments');
    assert(publicDepts.status === 200, 'Public departments list accessible without auth (200)');
    assert(Array.isArray(publicDepts.body.departments), 'Departments returned as array');
    assert(publicDepts.body.departments.length > 0, 'Departments contains active directorates');
    const tidDept = publicDepts.body.departments.find((d: any) => d.code === 'TID');
    assert(!!tidDept, 'Found Transport & Infrastructure Design (TID) department');

    const testEmpId = `EEC-EMP-${Math.floor(1000 + Math.random() * 9000)}`;
    const testRegEmail = `new.engineer.${Date.now()}@eec.gov.et`;

    const regRes = await request('POST', '/api/auth/register', {
      body: {
        fullName: 'Dawit Tsige',
        email: testRegEmail,
        employeeId: testEmpId,
        departmentId: tidDept.id,
        phone: '+251 911 554433',
        password: 'ValidPassword123!',
      },
    });
    assert(regRes.status === 201, 'Public employee registration succeeded (201)');
    assert(regRes.body.user.role === 'EMPLOYEE', 'Public registration forced role to EMPLOYEE');
    assert(regRes.body.user.status === 'PENDING', 'Public registration set status to PENDING');
    assert(regRes.body.user.departmentId === tidDept.id, 'Stored requested department safely');
    assert(regRes.body.user.employeeId === testEmpId, 'Stored requested employee ID safely');
    assert(regRes.body.user.phone === '+251 911 554433', 'Stored phone number safely');

    const registeredUserId = regRes.body.user.id;
    cleanupUserIds.push(registeredUserId);

    // Verify duplicate email is rejected
    const dupEmailRes = await request('POST', '/api/auth/register', {
      body: {
        fullName: 'Imposter Dawit',
        email: testRegEmail,
        departmentId: tidDept.id,
        password: 'ValidPassword123!',
      },
    });
    assert(dupEmailRes.status === 409, 'Duplicate institutional email rejected with 409 Conflict');

    // Verify duplicate employee ID is rejected
    const dupEmpIdRes = await request('POST', '/api/auth/register', {
      body: {
        fullName: 'Another Engineer',
        email: `another.${Date.now()}@eec.gov.et`,
        employeeId: testEmpId,
        departmentId: tidDept.id,
        password: 'ValidPassword123!',
      },
    });
    assert(dupEmpIdRes.status === 409, 'Duplicate Employee ID rejected with 409 Conflict');

    // 3. Employee Directory Completeness & Scoping
    console.log('\n--- 3. Employee Directory Completeness & Scoping ---');
    const adminDirectory = await request('GET', '/api/employees', { cookie: adminCookie });
    assert(adminDirectory.status === 200, 'Admin fetched employee directory (200)');
    assert(Array.isArray(adminDirectory.body.employees), 'Directory returned array of employees');
    assert(adminDirectory.body.employees.length >= 14, `Admin receives full corporate roster (found: ${adminDirectory.body.employees.length}, expected >= 14)`);
    assert(adminDirectory.body.counts.total >= 14, 'Accurate total personnel count reported');

    // Verify newly registered pending user appears in directory with status PENDING
    const pendingInDir = adminDirectory.body.employees.find((e: any) => e.email === testRegEmail);
    assert(!!pendingInDir, 'Newly registered personnel appears in employee directory');
    assert(pendingInDir.accountStatus === 'PENDING', 'Personnel correctly displays accountStatus = PENDING');
    assert(pendingInDir.isActive === false, 'Pending personnel isActive is false');

    // Search by name
    const searchRes = await request('GET', `/api/employees?search=${encodeURIComponent('Dawit Tsige')}`, { cookie: adminCookie });
    assert(searchRes.status === 200, 'Search by name returns 200');
    assert(searchRes.body.employees.some((e: any) => e.name === 'Dawit Tsige'), 'Search finds matching personnel');

    // Search by employeeId
    const searchIdRes = await request('GET', `/api/employees?search=${encodeURIComponent(testEmpId)}`, { cookie: adminCookie });
    assert(searchIdRes.status === 200, 'Search by employeeId returns 200');
    assert(searchIdRes.body.employees.some((e: any) => e.employeeId === testEmpId), 'Search finds matching employeeId');

    // Filter by status=PENDING
    const pendingFilterRes = await request('GET', '/api/employees?status=PENDING', { cookie: adminCookie });
    assert(pendingFilterRes.status === 200, 'Filter status=PENDING returns 200');
    assert(pendingFilterRes.body.employees.every((e: any) => e.accountStatus === 'PENDING'), 'All returned employees have status PENDING');

    // Department Manager Scoping
    const mgrDirectory = await request('GET', '/api/employees', { cookie: managerCookie });
    assert(mgrDirectory.status === 200, 'Department Manager fetched employee directory (200)');
    assert(mgrDirectory.body.employees.every((e: any) => e.departmentId === 'dept-101'), 'Manager receives strictly department-scoped personnel (dept-101)');

    // Spoofed department param by Department Manager is ignored
    const spoofedRes = await request('GET', '/api/employees?departmentId=dept-102', { cookie: managerCookie });
    assert(spoofedRes.status === 200, 'Manager GET with foreign department handled');
    assert(spoofedRes.body.employees.every((e: any) => e.departmentId === 'dept-101'), 'Manager cannot bypass department boundary by spoofing departmentId');

    // 4. Clickable Detailed Employee Profile
    console.log('\n--- 4. Detailed Employee Profile Dossier ---');
    const haileEmp = adminDirectory.body.employees.find((e: any) => e.name === 'Haile Gebrselassie');
    assert(!!haileEmp, 'Found seeded employee Haile Gebrselassie');

    const profileRes = await request('GET', `/api/employees/${haileEmp.id}`, { cookie: adminCookie });
    assert(profileRes.status === 200, 'Admin fetched detailed employee profile (200)');
    assert(profileRes.body.employee.id === haileEmp.id, 'Employee details match requested ID');
    assert(!!profileRes.body.profile, 'Profile contains operational dossier');
    assert(Array.isArray(profileRes.body.profile.assignedResources), 'Profile contains assignedResources array');
    assert(Array.isArray(profileRes.body.profile.assignments), 'Profile contains assignments history array');
    assert(Array.isArray(profileRes.body.profile.transfers), 'Profile contains transfers history array');
    assert(Array.isArray(profileRes.body.profile.requisitions), 'Profile contains requisitions array');
    assert(Array.isArray(profileRes.body.profile.maintenanceRequests), 'Profile contains maintenanceRequests array');
    assert(Array.isArray(profileRes.body.profile.auditEvents), 'Profile contains auditEvents array');

    // Foreign profile access by Department Manager
    const foreignEmp = adminDirectory.body.employees.find((e: any) => e.departmentId === 'dept-102');
    if (foreignEmp) {
      const foreignAccessRes = await request('GET', `/api/employees/${foreignEmp.id}`, { cookie: managerCookie });
      assert(foreignAccessRes.status === 403, 'Department Manager blocked with 403 from viewing foreign department profile');
    }

    // 5. Admin Approval & Role Assignment Lifecycle
    console.log('\n--- 5. Admin Approval & Role Assignment Lifecycle ---');
    // Department Manager blocked from approving account
    const mgrApproveRes = await request('POST', `/api/employees/${pendingInDir.id}/approve`, {
      cookie: managerCookie,
      body: { role: 'EMPLOYEE' },
    });
    assert(mgrApproveRes.status === 403, 'Department Manager forbidden with 403 from approving accounts');

    // Admin approves applicant and elevates to IT_TECHNICIAN in ICT department
    const ictDept = publicDepts.body.departments.find((d: any) => d.code === 'ICT');
    const approveRes = await request('POST', `/api/employees/${pendingInDir.id}/approve`, {
      cookie: adminCookie,
      body: {
        role: 'IT_TECHNICIAN',
        departmentId: ictDept ? ictDept.id : undefined,
        designation: 'Infrastructure & Support Specialist',
      },
    });
    assert(approveRes.status === 200, 'Admin approved pending employee account (200)');
    assert(approveRes.body.employee.role === 'IT_TECHNICIAN', 'Assigned role correctly elevated to IT_TECHNICIAN');
    assert(approveRes.body.employee.accountStatus === 'APPROVED', 'Employee account status transitioned to APPROVED');
    assert(approveRes.body.employee.isActive === true, 'Employee isActive transitioned to true');

    // Verify DB synchronization between Employee and User
    const updatedUserInDb = await prisma.user.findUnique({ where: { id: registeredUserId } });
    assert(updatedUserInDb?.status === 'APPROVED', 'Database User status synchronized to APPROVED');
    assert(updatedUserInDb?.role === 'IT_TECHNICIAN', 'Database User role synchronized to IT_TECHNICIAN');
    if (ictDept) {
      assert(updatedUserInDb?.departmentId === ictDept.id, 'Database User department synchronized to ICT');
    }

    // Verify Audit Event created
    const approveAuditEvent = await prisma.auditEvent.findFirst({
      where: {
        actionType: 'USER_APPROVED',
        referenceId: testEmpId,
      },
      orderBy: { timestamp: 'desc' },
    });
    assert(!!approveAuditEvent, 'Audit event recorded for USER_APPROVED');

    // 6. Admin Account Suspension and Reactivation
    console.log('\n--- 6. Admin Account Suspension & Reactivation ---');
    const suspendRes = await request('POST', `/api/employees/${pendingInDir.id}/suspend`, {
      cookie: adminCookie,
      body: { reason: 'Security audit review' },
    });
    assert(suspendRes.status === 200, 'Admin suspended employee account (200)');

    const suspendedUser = await prisma.user.findUnique({ where: { id: registeredUserId } });
    assert(suspendedUser?.status === 'SUSPENDED', 'Database User status updated to SUSPENDED');
    const suspendedEmp = await prisma.employee.findUnique({ where: { id: pendingInDir.id } });
    assert(suspendedEmp?.isActive === false, 'Database Employee isActive updated to false');

    const suspendAuditEvent = await prisma.auditEvent.findFirst({
      where: {
        actionType: 'USER_SUSPENDED',
        referenceId: testEmpId,
      },
      orderBy: { timestamp: 'desc' },
    });
    assert(!!suspendAuditEvent, 'Audit event recorded for USER_SUSPENDED');

    // Reactivate
    const reactivateRes = await request('POST', `/api/employees/${pendingInDir.id}/reactivate`, {
      cookie: adminCookie,
    });
    assert(reactivateRes.status === 200, 'Admin reactivated employee account (200)');

    const reactivatedUser = await prisma.user.findUnique({ where: { id: registeredUserId } });
    assert(reactivatedUser?.status === 'APPROVED', 'Database User status updated to APPROVED on reactivation');
    const reactivatedEmp = await prisma.employee.findUnique({ where: { id: pendingInDir.id } });
    assert(reactivatedEmp?.isActive === true, 'Database Employee isActive updated to true on reactivation');

    // 7. Admin Profile Editing & Audit Trail
    console.log('\n--- 7. Admin Profile Editing & Audit Trail ---');
    const editRes = await request('PUT', `/api/employees/${pendingInDir.id}`, {
      cookie: adminCookie,
      body: {
        designation: 'Senior Infrastructure Specialist',
        phone: '+251 922 998877',
      },
    });
    assert(editRes.status === 200, 'Admin updated employee information (200)');
    assert(editRes.body.employee.designation === 'Senior Infrastructure Specialist', 'Designation updated');
    assert(editRes.body.employee.phone === '+251 922 998877', 'Phone number updated');

    const editAuditEvent = await prisma.auditEvent.findFirst({
      where: {
        actionType: 'EMPLOYEE_UPDATED',
        referenceId: testEmpId,
      },
      orderBy: { timestamp: 'desc' },
    });
    assert(!!editAuditEvent, 'Audit event recorded for EMPLOYEE_UPDATED');

    console.log('\n================================================================');
    console.log('Employee Management Phase 5 Tests Completed: ALL PASSED!');
    console.log('================================================================');
  } finally {
    // Clean up test records
    for (const uid of cleanupUserIds) {
      await prisma.session.deleteMany({ where: { userId: uid } }).catch(() => {});
      await prisma.notification.deleteMany({ where: { recipientId: uid } }).catch(() => {});
      await prisma.employee.deleteMany({ where: { userId: uid } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: uid } }).catch(() => {});
    }
    server.close();
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
