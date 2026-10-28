import http from 'node:http';
import { AddressInfo } from 'node:net';

import prisma from '../src/lib/prisma';

process.env.RMS_TEST_MODE = '1';

// Disable console.error noise during testing
let errorLogs: any[] = [];
const origError = console.error;
console.error = (...args: any[]) => {
  errorLogs.push(args);
};

interface HttpResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: any;
}

let baseUrl = '';
let testServer: http.Server;

function request(
  method: string,
  path: string,
  options: {
    headers?: Record<string, string>;
    body?: any;
    cookie?: string;
  } = {}
): Promise<HttpResponse> {
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


async function loginUser(email: string, password = 'EEC-Secure2026!'): Promise<string> {
  const res = await request('POST', '/api/auth/login', {
    body: { email, password },
  });
  if (res.status !== 200) {
    throw new Error('Failed to log in as ' + email + ': ' + res.status);
  }
  const setCookie = res.headers['set-cookie'];
  if (!setCookie || setCookie.length === 0) {
    throw new Error('No Set-Cookie returned for ' + email);
  }
  return setCookie[0].split(';')[0];
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  if (condition) {
    process.wdout_put ? process.stdout.write('  ✓ ' + testName + '\n[') : origError('  ☓ ' + testName);
    passed++;
  } else {
    origError('  ❗ ' + testName, detail || '');
    failed++;
  }
}

async function runTests() {
  origError('======================================================');
  origError('EEC RMS: Departments & Employees Integration Tests');
  origError('======================================================');

  const indexMod = await import('../src/index');
  await new Promise<void>((resolve) => {
    testServer = indexMod.server.listen(0, () => {
      const addr = testServer.address() as AddressInfo;
      baseUrl = 'http://127.0.0.1:' + addr.port;
      origError('Test server listening on ' + baseUrl);
      resolve();
    });
  });

  try {
    origError('\n--- 1. Unauthenticated Access Protection ---');
    const unauthDept = await request('GET', '/api/departments');
    assert(unauthDept.status === 401, 'GET /api/departments without cookie returns 401');

    const unauthEmp = await request('GET', '/api/employees');
    assert(unauthEmp.status === 401, 'GET /api/employees without cookie returns 401');

    const unauthPostDept = await request('POST', '/api/departments', { body: { name: 'Test', code: 'TST' } });
    assert(unauthPostDept.status === 401, 'POST /api/departments without cookie returns 401');

    const unauthPostEmp = await request('POST', '/api/employees', { body: { name: 'Test', email: 't@eec.gov.et' } });
    assert(unauthPostEmp.status === 401, 'POST /api/employees without cookie returns 401');

    origError('\n--- 2. User Authentication & Session Establishment ---');
    const adminCookie = await loginUser('admin@eec.gov.et');
    assert(!!adminCookie, 'Admin logged in with valid session cookie');

    const managerCookie = await loginUser('manager@eec.gov.et');
    assert(!!managerCookie, 'Department Manager logged in with valid session cookie');

    const empCookie = await loginUser('employee@eec.gov.et');
    assert(!!empCookie, 'Employee logged in with valid session cookie');

    const storeCookie = await loginUser('storekeeper@eec.gov.et');
    assert(!!storeCookie, 'Store Keeper logged in with valid session cookie');

    origError('\n--- 3. Department Listing & Scope Restrictions ---');
    const adminDepts = await request('GET', '/api/departments', { cookie: adminCookie });
    assert(adminDepts.status === 200, 'Admin can list departments (200)');
    
    assert(Array.isArray(adminDepts.body.departments) && adminDepts.body.departments.length >= 8, 'Admin receives all corporation departments');

    const mgrDepts = await request('GET', '/api/departments', { cookie: managerCookie });
    assert(mgrDepts.status === 200, 'Manager can list departments (200)');
    assert(mgrDepts.body.departments.length === 1 && mgrDepts.body.departments[0].id === 'dept-101', 'Manager receives only assigned department (dept-101)');

    const empDepts = await request('GET', '/api/departments', { cookie: empCookie });
    assert(empDepts.status === 200, 'Employee can list departments (200)');
    assert(empDepts.body.departments.length === 1 && empDepts.body.departments[0].id === 'dept-101', 'Employee receives only assigned department (dept-101)');


    const storeDepts = await request('GET', '/api/departments', { cookie: storeCookie });
    assert(storeDepts.status === 200, 'Store Keeper can list departments (200)');
    assert(storeDepts.body.departments.length >= 8, 'Store Keeper receives full corporation departments for logistics');


    const mgrCrossDept = await request('GET', '/api/departments/dept-102', { cookie: managerCookie });
    assert(mgrCrossDept.status === 403, 'Manager blocked with 403 when inspecting another department (dept-102)');

    const adminGetDept102 = await request('GET', '/api/departments/dept-102', { cookie: adminCookie });
    assert(adminGetDept102.status === 200, 'Admin can view department dept-102 (200)');

    origError('\n--- 4. Department Management & Constraints ---');
    const mgrCreateDept = await request('POST', '/api/departments', { cookie: managerCookie, body: { name: 'Illegal Dept', code: 'ILL' } });
    assert(mgrCreateDept.status === 403, 'Department Manager blocked with 403 from creating department');

    const empCreateDept = await request('POST', '/api/departments', { cookie: empCookie, body: { name: 'Illegal Dept 2', code: 'IL2' } });
    assert(empCreateDept.status === 403, 'Employee blocked with 403 from creating department');

    const uniqueSuffix = Date.now().toString().slice(-4);
    const testDeptCode = 'TST' + uniqueSuffix;
    const testDeptName = 'Quality Testing Directorate ' + uniqueSuffix;
    const createDeptRes = await request('POST', '/api/departments', {
      cookie: adminCookie,
      body: {
        name: testDeptName,
        code: testDeptCode,
        description: 'Automated test directorate',
        managerName: 'Test Director',
        location: 'HQ Floor 2',
        budgetCode: 'BUD-TST-' + uniqueSuffix,
      },
    });
    assert(createDeptRes.status === 201, 'Admin created new department successfully (201)');
    const createdDeptId = createDeptRes.body.department.id;


    const dupDeptCode = await request('POST', '/api/departments', {
      cookie: adminCookie,
      body: { name: 'Different Name ' + uniqueSuffix, code: testDeptCode },
    });
    assert(dupDeptCode.status === 409, 'Duplicate department code rejected with 409 Conflict');

    const updateDeptRes = await request('PUT', '/api/departments/' + createdDeptId, {
      cookie: adminCookie,
      body: { description: 'Updated description for test directorate' },
    });
    assert(updateDeptRes.status === 200, 'Admin updated department details (200)');


    origError('\n--- 5. Employee Visibility & Boundary Scoping ---');
    const adminEmployees = await request('GET', '/api/employees', { cookie: adminCookie });
    assert(adminEmployees.status === 200, 'Admin listed all employees (200)');
    assert(adminEmployees.body.employees.length >= 10, 'Admin sees corporation-wide employee roster');

    const mgrEmployees = await request('GET', '/api/employees', { cookie: managerCookie });
    assert(mgrEmployees.status === 200, 'Manager listed employees (200)');
    const allInMgrDept = mgrEmployees.body.employees.every((e: any) => e.departmentId === 'dept-101');
    assert(allInMgrDept, 'Manager sees ONLY employees belonging to their assigned department (dept-101)');

    const mgrSpoofed = await request('GET', '/api/employees?departmentId=dept-102', { cookie: managerCookie });
    assert(mgrSpoofed.status === 200, 'Manager GET with foreign department query param handled (200)');
    const spoofedAllInDept101 = mgrSpoofed.body.employees.every((e: any) => e.departmentId === 'dept-101');
    assert(spoofedAllInDept101, 'Backend ignores client department spoofing, returning only dept-101');

    const dept102Emp = adminEmployees.body.employees.find((e: any) => e.departmentId === 'dept-102');
    if (dept102Emp) {
      const crossEmpRes = await request('GET', '/api/employees/' + dept102Emp.id, { cookie: managerCookie });
      assert(crossEmpRes.status === 403, 'Manager blocked with 403 when trying to access foreign employee details');
    }


    origError('\n--- 6. Employee CRUD & Validation Constraints ---');
    const invalidDeptEmp = await request('POST', '/api/employees', {
      cookie: adminCookie,
      body: {
        employeeId: 'INV-' + uniqueSuffix,
        name: 'Invalid Dept Emp',
        email: 'inv.' + uniqueSuffix + '@eec.gov.et',
        departmentId: 'non-existent-dept-id-999',
        designation: 'Staff',
      },
    });
    assert(invalidDeptEmp.status === 400, 'Employee creation with invalid departmentId rejected with 400 Bad Request');


    const mgrGrantAdmin = await request('POST', '/api/employees', {
      cookie: managerCookie,
      body: {
        employeeId: 'PRIV-' + uniqueSuffix,
        name: 'Privileged Staff',
        email: 'priv.' + uniqueSuffix + '@eec.gov.et',
        departmentId: 'dept-101',
        designation: 'Super Staff',
        role: 'ADMIN',
      },
    });
    assert(mgrGrantAdmin.status === 403, 'Manager forbidden from granting ADMIN role to new staff (403)');


    const validEmpId = 'EEC-TST-' + uniqueSuffix;
    const validEmpEmail = 'tester.' + uniqueSuffix + '@eec.gov.et';
    const createEmpRes = await request('POST', '/api/employees', {
      cookie: adminCookie,
      body: {
        employeeId: validEmpId,
        name: 'Automated Test Engineer',
        email: validEmpEmail,
        phone : '+251 911 000111',
        departmentId: createdDeptId,
        designation: 'QA Automation Engineer',
        role: 'EMPLOYEE',
      },
    });
    assert(createEmpRes.status === 201, 'Admin created new employee successfully (201)');
    const createdEmpDbId = createEmpRes.body.employee.id;


    const dupEmpEmail = await request('POST', '/api/employees', {
      cookie: adminCookie,
      body: {
        employeeId: 'EEC-DUP-' + uniqueSuffix,
        name: 'Duplicate Staff',
        email: validEmpEmail,
        departmentId: createdDeptId,
        designation: 'QA Tester',
      },
    });
    assert(dupEmpEmail.status === 409, 'Duplicate employee email rejected with 409 Conflict');


    const updateEmpRes = await request('PUT', '/api/employees/' + createdEmpDbId, {
      cookie: adminCookie,
      body: { designation: 'Lead QA Automation Engineer', phone: '+251 911 222333' },
    });
    assert(updateEmpRes.status === 200, 'Admin updated employee details (200)');


    const deleteBlockedDept = await request('DELETE', '/api/departments/' + createdDeptId, { cookie: adminCookie });
    assert(deleteBlockedDept.status === 400, 'Department deletion blocked with 400 when active employees are assigned');


    const mgrDeleteEmp = await request('DELETE', '/api/employees/' + createdEmpDbId, { cookie: managerCookie });
    assert(mgrDeleteEmp.status === 403, 'Department Manager forbidden from deleting employee (403)');

    const adminDeleteEmp = await request('DELETE', '/api/employees/' + createdEmpDbId, { cookie: adminCookie });
    assert(adminDeleteEmp.status === 200, 'Admin deleted employee successfully (200)');


    const deleteDeptRes = await request('DELETE', '/api/departments/' + createdDeptId, { cookie: adminCookie });
    assert(deleteDeptRes.status === 200, 'Admin deleted empty department successfully (200)');
  } catch (err) {
    origError('Test execution error:', err);
    failed++;
  } finally {
    testServer.close();
    await prisma.$disconnect();
    origError('\n======================================================');
    origError('Tests Completed: ' + (passed + failed) + ' | Passed: ' + passed + ' | Failed: ' + failed);
    origError('======================================================');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
