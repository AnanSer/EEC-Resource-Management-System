import http from 'node:http';
import { AddressInfo } from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import prisma from '../src/lib/prisma';
import { escapeCSV, sanitizeCSVValue } from '../src/reports/csvSanitizer';
import { validatePasswordPolicy, MIN_PASSWORD_LENGTH } from '../src/auth/password';

process.env.RMS_TEST_MODE = '1';

interface HttpResponse<T = any> {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: T;
  rawText: string;
}

let baseUrl = '';
let testServer: http.Server;

function request<T = any>(
  method: string,
  pathStr: string,
  options: {
    headers?: Record<string, string>;
    body?: any;
    rawBody?: string;
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
            rawText: rawData,
          });
        });
      }
    );

    req.on('error', reject);

    if (options.rawBody !== undefined) {
      req.write(options.rawBody);
    } else if (options.body !== undefined) {
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
  console.log('\n======================================================');
  console.log('EEC RMS — Phase 3 Medium-Priority Security Verification');
  console.log('======================================================\n');

  // Start in-memory test HTTP server
  const { requestListener } = await import('../src/index');
  testServer = http.createServer(requestListener);

  await new Promise<void>((resolve) => {
    testServer.listen(0, '127.0.0.1', () => {
      const address = testServer.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });

  try {
    let adminCookie = '';
    try {
      adminCookie = await loginUser('admin@eec.gov.et');
    } catch (e: any) {
      console.warn('Could not log in as admin:', e.message);
    }

    // =========================================================================
    // SEC-10: Prevent Internal Error Information Leakage
    // =========================================================================
    console.log('\n[SEC-10] Prevent Internal Error Information Leakage:');

    // 1. Invalid JSON body should return 400 Bad Request, not 500
    const malformedJsonRes = await request('POST', '/api/auth/login', {
      headers: { 'Content-Type': 'application/json' },
      rawBody: '{ invalid json payload',
    });
    assert(
      malformedJsonRes.status === 400,
      'Malformed JSON payload returns 400 Bad Request (not 500)'
    );
    assert(
      malformedJsonRes.body.message === 'Invalid JSON format in request body',
      'Malformed JSON returns clean user-facing validation message'
    );
    assert(
      malformedJsonRes.rawText.includes('SyntaxError') === false,
      'Internal JavaScript SyntaxError is NOT leaked in the response'
    );

    // 2. Nonexistent route returns clean 404
    const notFoundRes = await request('GET', '/api/nonexistent-route-path');
    assert(notFoundRes.status === 404, 'Nonexistent route returns 404');
    assert(
      notFoundRes.body.error === 'Not Found',
      'Nonexistent route returns structured Not Found error'
    );

    // 3. Unauthenticated request returns clean 401 without stack trace
    const unauthRes = await request('GET', '/api/departments');
    assert(unauthRes.status === 401, 'Protected route returns 401 Unauthorized');
    assert(
      !unauthRes.rawText.includes('at ') && !unauthRes.rawText.includes('node:'),
      '401 response contains no Node stack traces'
    );

    // 4. Forbidden request returns clean 403 without data exposure
    const employeeCookie = await loginUser('employee@eec.gov.et');
    const forbiddenRes = await request('POST', '/api/departments', {
      cookie: employeeCookie,
      body: { name: 'Unauthorized Dept', code: 'UNAUTH' },
    });
    assert(forbiddenRes.status === 403, 'Forbidden role operation returns 403');
    assert(
      forbiddenRes.body.message?.includes('Forbidden') || forbiddenRes.body.message?.includes('Access denied'),
      '403 response contains clean permission denial'
    );

    // 5. Test global unhandled error handler masking internal errors with errorId
    // Mount a temporary route that throws an internal database error
    const { router } = await import('../src/index');
    router.get('/api/test-internal-error-leak', () => {
      const err = new Error('PrismaClientKnownRequestError: relation "secret_table" does not exist at /app/prisma/client.js:123');
      (err as any).code = 'P2002';
      throw err;
    });

    const leakCheckRes = await request('GET', '/api/test-internal-error-leak');
    assert(leakCheckRes.status === 500, 'Internal exception triggers 500 Internal Server Error');
    assert(
      leakCheckRes.body.message === 'An unexpected internal server error occurred. Please contact IT support.',
      'Internal exception message is masked with generic, safe client guidance'
    );
    assert(
      !leakCheckRes.rawText.includes('PrismaClientKnownRequestError') &&
      !leakCheckRes.rawText.includes('secret_table') &&
      !leakCheckRes.rawText.includes('/app/prisma/client.js'),
      'Internal exception details, table names, and filesystem paths are completely hidden'
    );
    assert(
      typeof leakCheckRes.body.errorId === 'string' && leakCheckRes.body.errorId.startsWith('ERR-'),
      'Internal error response includes unique correlation errorId (e.g. ERR-...)'
    );

    // =========================================================================
    // SEC-11: Prevent CSV Formula Injection
    // =========================================================================
    console.log('\n[SEC-11] Prevent CSV Formula Injection:');

    // 1. Dangerous formula payloads are neutralized with a leading single quote (')
    assert(
      escapeCSV('=1+1') === `"'=1+1"`,
      'Formula payload starting with = is neutralized with prepended single quote'
    );
    assert(
      escapeCSV("=cmd|' /C calc'!A0") === `"'=cmd|' /C calc'!A0"`,
      'Dangerous DDE execution payload (=cmd) is neutralized'
    );
    assert(
      escapeCSV('@SUM(1,2)') === `"'@SUM(1,2)"`,
      'Formula payload starting with @ is neutralized'
    );
    assert(
      escapeCSV("+cmd|' /C calc'!A0") === `\"'+cmd|' /C calc'!A0\"`,
      'Formula payload starting with + is neutralized'
    );
    assert(
      escapeCSV("-cmd|' /C calc'!A0") === `\"'-cmd|' /C calc'!A0\"`,
      'Formula payload starting with - is neutralized'
    );
    assert(
      escapeCSV('  =SUM(A1:B10)') === `"'  =SUM(A1:B10)"`,
      'Formula with leading whitespace is neutralized'
    );
    assert(
      escapeCSV('  -cmd') === `"\'  -cmd\"`,
      'Leading whitespace preceding -cmd is neutralized'
    );
    assert(
      escapeCSV('  +calc') === `"\'  +calc\"`,
      'Leading whitespace preceding +calc is neutralized'
    );
    assert(
      escapeCSV('\t=2+2') === `"'\t=2+2"`,
      'Formula with leading tab character is neutralized'
    );
    assert(
      escapeCSV('\tTextPayload') === `"'\tTextPayload"`,
      'Leading tab character in text is neutralized'
    );
    assert(
      escapeCSV('\r-payload') === `"'\r-payload"`,
      'Formula with leading carriage return is neutralized'
    );
    assert(
      escapeCSV('-2+3*cmd') === `"'-2+3*cmd"`,
      'Non-numeric expression with minus is neutralized'
    );

    // 2. Legitimate numbers, dates, codes, and text are preserved without single quote prefix
    assert(
      escapeCSV(-100) === '"-100"',
      'Legitimate negative number (-100) is preserved as numeric'
    );
    assert(
      escapeCSV('-50.25') === '"-50.25"',
      'Legitimate negative decimal string ("-50.25") is preserved as numeric'
    );
    assert(
      escapeCSV('+42') === '"+42"',
      'Legitimate positive number string ("+42") is preserved as numeric'
    );
    assert(
      escapeCSV('-1.5e3') === '"-1.5e3"',
      'Legitimate scientific notation number ("-1.5e3") is preserved as numeric'
    );
    assert(
      escapeCSV(0) === '"0"',
      'Numeric zero is preserved'
    );
    assert(
      escapeCSV('EEC-IT-2026-001') === '"EEC-IT-2026-001"',
      'Standard corporate asset code is preserved'
    );
    assert(
      escapeCSV('2026-11-03T10:00:00.000Z') === '"2026-11-03T10:00:00.000Z"',
      'ISO Date string is preserved'
    );
    assert(
      escapeCSV('Laptop with 15" screen, 16GB RAM\nOffice Yard') === '"Laptop with 15"" screen, 16GB RAM\nOffice Yard"',
      'Text with quotes, commas, and newlines is correctly escaped per RFC 4180'
    );

    // 3. API CSV Export Endpoint produces sanitized CSV with UTF-8 BOM
    const csvExportRes = await request('GET', '/api/reports/audit/export/csv', {
      cookie: adminCookie,
    });
    assert(
      csvExportRes.status === 200,
      'Audit CSV export endpoint returns 200 OK'
    );
    assert(
      csvExportRes.headers['content-type']?.includes('text/csv'),
      'Audit CSV export returns text/csv Content-Type'
    );
    assert(
      csvExportRes.rawText.charCodeAt(0) === 0xFEFF,
      'Audit CSV export starts with UTF-8 Byte Order Mark (BOM) for Excel compatibility'
    );
    assert(
      csvExportRes.rawText.includes('Timestamp (UTC)') && csvExportRes.rawText.includes('Action Type'),
      'Audit CSV export contains standard column headers'
    );

    // =========================================================================
    // SEC-12: Remove or Secure Prototype Mock-Reset Controls
    // =========================================================================
    console.log('\n[SEC-12] Remove or Secure Prototype Mock-Reset Controls:');

    // 1. SettingsPage source inspection: verify mock store and reset controls removed
    const settingsPath = path.resolve(__dirname, '../../frontend/src/pages/settings/SettingsPage.tsx');
    const settingsContent = fs.readFileSync(settingsPath, 'utf8');

    assert(
      !settingsContent.includes('mockStore'),
      'SettingsPage does not import or reference mockStore'
    );
    assert(
      !settingsContent.includes('resetToInitial'),
      'SettingsPage does not contain resetToInitial method call'
    );
    assert(
      !settingsContent.includes('Reset In-Memory State'),
      'SettingsPage does not render "Reset In-Memory State" button'
    );
    assert(
      !settingsContent.includes('prototype test controls'),
      'SettingsPage subtitle does not advertise prototype test controls'
    );
    assert(
      settingsContent.includes('Asset Numbering Rules') &&
      settingsContent.includes('Regulatory Notification Thresholds') &&
      settingsContent.includes('Corporation Facilities & Depots'),
      'SettingsPage preserves all legitimate corporate operational configuration sections'
    );
    assert(
      settingsContent.includes('Platform & System Architecture'),
      'SettingsPage displays production Platform & System Architecture diagnostics'
    );

    // 2. Backend verification: verify no mock/reset endpoint exists
    const mockResetRes = await request('POST', '/api/settings/reset', {
      cookie: adminCookie,
    });
    assert(
      mockResetRes.status === 404,
      'Calling non-existent prototype reset endpoint /api/settings/reset returns 404 Not Found'
    );

    // =========================================================================
    // SEC-13: Strengthen Password Policy Consistently (Min 8 Characters)
    // =========================================================================
    console.log('\n[SEC-13] Strengthen Password Policy Consistently (Min 8 Characters):');

    // 0. Unit tests for centralized validatePasswordPolicy utility
    assert(MIN_PASSWORD_LENGTH === 8, 'MIN_PASSWORD_LENGTH constant is 8');
    assert(validatePasswordPolicy('').valid === false, 'Empty string is rejected by validatePasswordPolicy');
    assert(validatePasswordPolicy(null).valid === false, 'null is rejected by validatePasswordPolicy');
    assert(validatePasswordPolicy('1234567').valid === false, '7-character password is rejected by validatePasswordPolicy');
    assert(validatePasswordPolicy('12345678').valid === true, '8-character password is accepted by validatePasswordPolicy');
    assert(validatePasswordPolicy('EEC-Secure2026!').valid === true, '15-character seed password is accepted by validatePasswordPolicy');

    // 1. Registration rejects passwords shorter than 8 characters
    const emptyPasswordReg = await request('POST', '/api/auth/register', {
      body: {
        fullName: 'Missing Password Tester',
        email: `nopass-${Date.now()}@eec.gov.et`,
        password: '',
      },
    });
    assert(
      emptyPasswordReg.status === 400,
      'Registration rejects empty password with 400 Bad Request'
    );

    const shortPasswordReg = await request('POST', '/api/auth/register', {
      body: {
        fullName: 'Short Password Tester',
        email: `short-pass-${Date.now()}@eec.gov.et`,
        password: 'Pass123', // 7 characters
      },
    });
    assert(
      shortPasswordReg.status === 400,
      'Registration rejects 7-character password with 400 Bad Request'
    );
    assert(
      shortPasswordReg.body.message?.includes('at least 8 characters'),
      'Registration error message explicitly requires at least 8 characters long'
    );

    const veryShortPasswordReg = await request('POST', '/api/auth/register', {
      body: {
        fullName: 'Very Short Password Tester',
        email: `veryshort-pass-${Date.now()}@eec.gov.et`,
        password: '12345', // 5 characters
      },
    });
    assert(
      veryShortPasswordReg.status === 400 && veryShortPasswordReg.body.message?.includes('at least 8 characters'),
      'Registration rejects 5-character password with 400 Bad Request'
    );

    // 2. Registration accepts valid passwords with 8 or more characters (including exact boundary)
    const dept = await prisma.department.findFirst();
    const boundaryEmail = `boundary-pass-${Date.now()}@eec.gov.et`;
    const boundaryPasswordReg = await request('POST', '/api/auth/register', {
      body: {
        fullName: 'Boundary Password Tester',
        email: boundaryEmail,
        password: 'Pass@123', // exactly 8 characters boundary
        departmentId: dept!.id,
      },
    });
    assert(
      boundaryPasswordReg.status === 201 && boundaryPasswordReg.body.success === true,
      'Registration accepts exact 8-character boundary password (201 Created)'
    );

    // Clean up temporary boundary test user
    if (boundaryPasswordReg.body.user?.id) {
      await prisma.employee.deleteMany({ where: { email: boundaryEmail } }).catch(() => {});
      await prisma.user.deleteMany({ where: { email: boundaryEmail } }).catch(() => {});
    }

    const validEmail = `valid-pass-${Date.now()}@eec.gov.et`;
    const validPasswordReg = await request('POST', '/api/auth/register', {
      body: {
        fullName: 'Valid Password Tester',
        email: validEmail,
        password: 'SecurePass8!', // 11 characters
        departmentId: dept!.id,
      },
    });
    assert(
      validPasswordReg.status === 201 && validPasswordReg.body.success === true,
      'Registration accepts 11-character password and creates pending account (201 Created)'
    );

    // Clean up temporary registration user and employee record
    if (validPasswordReg.body.user?.id) {
      await prisma.employee.deleteMany({ where: { email: validEmail } }).catch(() => {});
      await prisma.user.deleteMany({ where: { email: validEmail } }).catch(() => {});
    }

    // 3. Reset-password rejects passwords shorter than 8 characters
    const missingPasswordReset = await request('POST', '/api/auth/reset-password', {
      body: {
        token: 'any-dummy-token',
        password: '',
      },
    });
    assert(
      missingPasswordReset.status === 400 && missingPasswordReset.body.message?.includes('at least 8 characters'),
      'Reset-password rejects missing/empty password with 400 Bad Request'
    );

    const shortPasswordReset = await request('POST', '/api/auth/reset-password', {
      body: {
        token: 'any-dummy-token',
        password: 'Short7!', // 7 characters
      },
    });
    assert(
      shortPasswordReset.status === 400 && shortPasswordReset.body.message?.includes('at least 8 characters'),
      'Reset-password rejects 7-character password with 400 Bad Request'
    );

    // 4. Frontend RegisterPage and ResetPasswordPage source checks:
    const regPagePath = path.resolve(__dirname, '../../frontend/src/pages/auth/RegisterPage.tsx');
    const regPageContent = fs.readFileSync(regPagePath, 'utf8');
    assert(
      regPageContent.includes('password.length < 8') && regPageContent.includes('at least 8 characters'),
      'Frontend RegisterPage enforces minimum 8 characters validation'
    );

    const resetPagePath = path.resolve(__dirname, '../../frontend/src/pages/auth/ResetPasswordPage.tsx');
    const resetPageContent = fs.readFileSync(resetPagePath, 'utf8');
    assert(
      resetPageContent.includes('password.length < 8') && resetPageContent.includes('at least 8 characters'),
      'Frontend ResetPasswordPage enforces minimum 8 characters validation'
    );

  } finally {
    if (testServer) {
      testServer.close();
    }
  }

  console.log('\n======================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
