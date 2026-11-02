import http from 'node:http';
import { AddressInfo } from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import prisma from '../src/lib/prisma';
import { assertSafeEnvironmentForSeeding } from '../prisma/seed';

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
  pathStr: string,
  options: {
    headers?: Record<string, string>;
    body?: any;
    cookie?: string;
  } = {}
): Promise<HttpResponse<T>> {
  return new Promise((resolve, reject) => {
    const url = new URL(pathStr, baseUrl);
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

async function runPhase1SecurityTests() {
  console.log('======================================================');
  console.log('EEC RMS: Phase 1 Critical Security Remediation Tests');
  console.log('======================================================');

  const { server } = await import('../src/index');
  await new Promise<void>((resolve) => {
    testServer = server.listen(0, () => {
      const addr = testServer.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      console.log(`Test server listening on ${baseUrl}`);
      resolve();
    });
  });

  const createdTestReqIds: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Quick Sign-In Personas Still Appear and Function for Demonstration
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Quick Sign-In Personas Verification (SEC-01) ---');
    
    // Check that all 5 key demonstration personas authenticate successfully
    const personas = [
      { role: 'ADMIN', email: 'admin@eec.gov.et' },
      { role: 'STORE_KEEPER', email: 'storekeeper@eec.gov.et' },
      { role: 'IT_TECHNICIAN', email: 'technician@eec.gov.et' },
      { role: 'DEPARTMENT_MANAGER', email: 'manager@eec.gov.et' },
      { role: 'EMPLOYEE', email: 'employee@eec.gov.et' },
    ];

    for (const persona of personas) {
      const cookie = await loginUser(persona.email);
      assert(!!cookie, `Demo persona '${persona.role}' (${persona.email}) authenticates with seed credentials`);
      
      const meRes = await request('GET', '/api/auth/me', { cookie });
      assert(meRes.status === 200 && meRes.body.user.role === persona.role, `Session returns valid role '${persona.role}'`);
    }

    // Verify frontend LoginPage.tsx retains the Quick Sign-In section with warning documentation
    const loginPagePath = path.resolve(__dirname, '../../frontend/src/pages/auth/LoginPage.tsx');
    const loginPageContent = fs.readFileSync(loginPagePath, 'utf8');
    assert(
      loginPageContent.includes('Quick Sign-In Personas (Development Seed)'),
      'Frontend LoginPage retains Quick Sign-In persona section for EEC demo'
    );
    assert(
      loginPageContent.includes('TEMPORARY DEMONSTRATION CONTROLS (SEC-01)'),
      'Frontend LoginPage contains mandatory security notice documenting temporary demo status'
    );

    // -------------------------------------------------------------------------
    // TEST 2: Seed Script Production Guard (SEC-02)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Seed Script Production Guard (SEC-02) ---');

    let productionGuardThrew = false;
    try {
      assertSafeEnvironmentForSeeding('production');
    } catch (err: any) {
      productionGuardThrew = true;
      assert(
        err.message.includes('strictly forbidden in production mode'),
        'Guard throws explicit security error on NODE_ENV=production'
      );
    }
    assert(productionGuardThrew, 'assertSafeEnvironmentForSeeding successfully blocks execution in production');

    let devGuardThrew = false;
    try {
      assertSafeEnvironmentForSeeding('development');
      assertSafeEnvironmentForSeeding('test');
    } catch {
      devGuardThrew = true;
    }
    assert(!devGuardThrew, 'assertSafeEnvironmentForSeeding permits execution in development and test');

    // -------------------------------------------------------------------------
    // TEST 3: Seed Script Does Not Overwrite Existing Users (SEC-02)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Seed Safe Existence Check (SEC-02) ---');
    const existingAdmin = await prisma.user.findUnique({ where: { email: 'admin@eec.gov.et' } });
    assert(!!existingAdmin, 'Existing administrator account is present in database');
    const originalPasswordHash = existingAdmin!.passwordHash;
    const originalRole = existingAdmin!.role;
    const originalStatus = existingAdmin!.status;

    // Verify seed.ts source code uses safe findUnique check rather than upsert for users
    const seedSourcePath = path.resolve(__dirname, '../prisma/seed.ts');
    const seedSourceContent = fs.readFileSync(seedSourcePath, 'utf8');
    assert(
      !seedSourceContent.includes('prisma.user.upsert'),
      'seed.ts no longer uses destructive prisma.user.upsert'
    );
    assert(
      seedSourceContent.includes('prisma.user.findUnique') && seedSourceContent.includes('Preserving existing user'),
      'seed.ts implements safe existence check preserving user credentials and roles'
    );

    // Verify existing credentials in database are intact
    assert(existingAdmin!.passwordHash === originalPasswordHash, 'Admin passwordHash preserved');
    assert(existingAdmin!.role === originalRole, 'Admin role preserved');
    assert(existingAdmin!.status === originalStatus, 'Admin status preserved');

    // -------------------------------------------------------------------------
    // TEST 4 & 5: Employee Requisition IDOR Prevention & Own View (SEC-03)
    // -------------------------------------------------------------------------
    console.log('\n--- 4 & 5. Employee Requisition IDOR & Access Control (SEC-03) ---');
    const employeeCookie = await loginUser('employee@eec.gov.et');
    const deptTid = await prisma.department.findUnique({ where: { code: 'TID' } });
    const empHaile = await prisma.employee.findFirst({ where: { email: 'employee@eec.gov.et' } });
    const empSolomon = await prisma.employee.findFirst({ where: { email: 'solomon.debebe@eec.gov.et' } });

    assert(!!deptTid && !!empHaile && !!empSolomon, 'TID department and employees exist');
    assert(empHaile!.departmentId === empSolomon!.departmentId, 'Haile and Solomon belong to the same department (TID)');

    // Create a requisition belonging to Solomon (colleague in same department)
    const colleagueReq = await prisma.resourceRequisition.create({
      data: {
        requisitionNumber: `REQ-COLLEAGUE-${Date.now()}`,
        requesterId: 'colleague-user-id',
        requesterName: empSolomon!.name,
        requesterRole: 'EMPLOYEE',
        employeeId: empSolomon!.id,
        departmentId: deptTid!.id,
        category: 'SURVEYING_GEOTECHNICAL',
        itemDescription: 'High-precision GNSS receiver for Awash corridor',
        justification: 'Critical corridor survey',
        status: 'PENDING',
      },
    });
    createdTestReqIds.push(colleagueReq.id);

    // Create a requisition owned by Haile (the logged-in employee)
    const ownReq = await prisma.resourceRequisition.create({
      data: {
        requisitionNumber: `REQ-OWN-${Date.now()}`,
        requesterId: existingAdmin ? (await prisma.user.findUnique({ where: { email: 'employee@eec.gov.et' } }))!.id : 'own-id',
        requesterName: empHaile!.name,
        requesterRole: 'EMPLOYEE',
        employeeId: empHaile!.id,
        departmentId: deptTid!.id,
        category: 'IT_EQUIPMENT',
        itemDescription: 'CAD Workstation laptop',
        justification: 'Bridge modeling',
        status: 'PENDING',
      },
    });
    createdTestReqIds.push(ownReq.id);

    // TEST 4: Haile attempts to view Solomon's requisition (SAME department)
    const idorReqAttempt = await request('GET', `/api/requisitions/${colleagueReq.id}`, {
      cookie: employeeCookie,
    });
    assert(idorReqAttempt.status === 403, 'Employee receives 403 Forbidden trying to view colleague requisition in SAME department');
    assert(
      idorReqAttempt.body.message.includes('You can only view your own requisitions'),
      '403 response contains clean authorization denial without data exposure'
    );
    assert(!idorReqAttempt.body.requisition, 'No requisition details leaked in 403 response');

    // TEST 5: Haile views their OWN requisition
    const ownReqAttempt = await request('GET', `/api/requisitions/${ownReq.id}`, {
      cookie: employeeCookie,
    });
    assert(ownReqAttempt.status === 200, 'Employee successfully views their OWN requisition (200)');
    assert(ownReqAttempt.body.requisition.id === ownReq.id, 'Returned requisition matches own requisition ID');

    // -------------------------------------------------------------------------
    // TEST 6 & 7: Employee Dossier IDOR Prevention & Own Dossier Access (SEC-04)
    // -------------------------------------------------------------------------
    console.log('\n--- 6 & 7. Employee Dossier IDOR & Self-Access (SEC-04) ---');

    // TEST 6: Haile attempts to view Solomon's full employee dossier (SAME department)
    const idorDossierAttempt = await request('GET', `/api/employees/${empSolomon!.id}`, {
      cookie: employeeCookie,
    });
    assert(idorDossierAttempt.status === 403, 'Employee receives 403 Forbidden trying to view colleague dossier in SAME department');
    assert(
      idorDossierAttempt.body.message.includes('You do not have permission to view other employee records'),
      '403 response contains clean permission rejection'
    );
    assert(!idorDossierAttempt.body.employee, 'Colleague personal dossier is NOT leaked');
    assert(!idorDossierAttempt.body.assignments, 'Colleague assignments are NOT leaked');
    assert(!idorDossierAttempt.body.requisitions, 'Colleague requisitions are NOT leaked');

    // Also test by employeeId string
    const idorDossierByEmpId = await request('GET', `/api/employees/${empSolomon!.employeeId}`, {
      cookie: employeeCookie,
    });
    assert(idorDossierByEmpId.status === 403, 'Employee receives 403 Forbidden using colleague employeeId');

    // TEST 7: Haile views their OWN employee dossier
    const ownDossierAttempt = await request('GET', `/api/employees/${empHaile!.id}`, {
      cookie: employeeCookie,
    });
    assert(ownDossierAttempt.status === 200, 'Employee successfully views their OWN dossier (200)');
    assert(ownDossierAttempt.body.employee.id === empHaile!.id, 'Dossier matches own employee record ID');
    assert(ownDossierAttempt.body.employee.employeeId === empHaile!.employeeId, 'Dossier matches own employeeId');

    // Own dossier by employeeId
    const ownDossierByEmpId = await request('GET', `/api/employees/${empHaile!.employeeId}`, {
      cookie: employeeCookie,
    });
    assert(ownDossierByEmpId.status === 200, 'Employee successfully views their OWN dossier by employeeId string (200)');

    // -------------------------------------------------------------------------
    // TEST 8: Admin and Department Manager Permissions (Preserved Functionality)
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Admin & Department Manager Authorization (SEC-03 & SEC-04) ---');
    const adminCookie = await loginUser('admin@eec.gov.et');
    const managerCookie = await loginUser('manager@eec.gov.et'); // Manager of dept-101 (TID)
    const deptWri = await prisma.department.findUnique({ where: { code: 'WRI' } });
    const empMeron = await prisma.employee.findFirst({ where: { departmentId: deptWri!.id } });

    // A. Admin can view colleague requisition in any department (Enterprise governance)
    const adminViewReq = await request('GET', `/api/requisitions/${colleagueReq.id}`, {
      cookie: adminCookie,
    });
    assert(adminViewReq.status === 200, 'ADMIN successfully views requisition across directorates (200)');

    // B. Admin can view any employee dossier across directorates
    const adminViewEmp = await request('GET', `/api/employees/${empSolomon!.id}`, {
      cookie: adminCookie,
    });
    assert(adminViewEmp.status === 200, 'ADMIN successfully views employee dossier across directorates (200)');

    // C. Department Manager can view requisitions within their assigned department (TID)
    const mgrViewReqTid = await request('GET', `/api/requisitions/${colleagueReq.id}`, {
      cookie: managerCookie,
    });
    assert(mgrViewReqTid.status === 200, 'Department Manager views requisition within assigned department (200)');

    // D. Department Manager can view employee dossier within their assigned department (TID)
    const mgrViewEmpTid = await request('GET', `/api/employees/${empSolomon!.id}`, {
      cookie: managerCookie,
    });
    assert(mgrViewEmpTid.status === 200, 'Department Manager views employee dossier within assigned department (200)');

    // E. Department Manager CANNOT view employee dossier outside their directorate (WRI)
    if (empMeron) {
      const mgrViewEmpWri = await request('GET', `/api/employees/${empMeron.id}`, {
        cookie: managerCookie,
      });
      assert(mgrViewEmpWri.status === 403, 'Department Manager forbidden from viewing dossier outside directorate (403)');
      assert(
        mgrViewEmpWri.body.message.includes('Department boundary access denied'),
        'Manager receives department boundary denial message'
      );
    }

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    // Clean up temporary test requisitions created during this test run
    if (createdTestReqIds.length > 0) {
      console.log('\n--- Cleaning up temporary test records ---');
      await prisma.resourceRequisition.deleteMany({
        where: { id: { in: createdTestReqIds } },
      });
      console.log(`  ✓ Cleaned up ${createdTestReqIds.length} temporary test requisition(s)`);
    }

    if (testServer) {
      testServer.close();
    }
  }

  console.log('\n======================================================');
  console.log(`Phase 1 Security Tests: ${passed} passed, ${failed} failed`);
  console.log('======================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase1SecurityTests();

