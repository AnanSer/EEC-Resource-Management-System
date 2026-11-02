import http from 'node:http';
import { AddressInfo } from 'node:net';
import { execSync } from 'node:child_process';
import path from 'node:path';
import prisma from '../src/lib/prisma';
import { getSessionCookieOptions } from '../src/auth/session';
import { getClientIp, checkRateLimit, resetRateLimiter } from '../src/auth/rateLimiter';
import { applySecurityHeaders } from '../src/http/securityHeaders';
import { getAllowedOrigins } from '../src/index';

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

async function runTests() {
  console.log('\n======================================================');
  console.log('EEC RMS — Phase 2 High-Priority Security Verification');
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
    // SEC-05: Audit Backfilling Isolation & Standalone Maintenance Script
    // =========================================================================
    console.log('\n[SEC-05] Audit Backfilling Isolation:');

    // 1. Audit trail query does not trigger backfill mutations
    const auditCountBefore = await prisma.auditEvent.count();
    const auditRes = await request('GET', '/api/reports/audit?page=1&limit=10', {
      cookie: adminCookie,
    });
    const auditCountAfter = await prisma.auditEvent.count();

    assert(
      auditRes.status === 200 && auditRes.body.success === true,
      'Normal audit query returns 200 OK without errors',
      auditRes.body
    );
    assert(
      auditCountBefore === auditCountAfter,
      'Normal audit query does not trigger backfilling or change audit record count',
      { before: auditCountBefore, after: auditCountAfter }
    );

    // 2. Standalone script can be executed idempotently
    try {
      const scriptPath = path.resolve(__dirname, '../scripts/backfill_audit.ts');
      const output1 = execSync(`npx tsx "${scriptPath}"`, {
        cwd: path.resolve(__dirname, '..'),
        encoding: 'utf8',
      });
      assert(
        output1.includes('[Backfill] Maintenance backfill completed successfully.'),
        'Standalone backfill script executes cleanly and logs summary'
      );

      // Run second time to verify idempotency
      const countAfterScript1 = await prisma.auditEvent.count();
      const output2 = execSync(`npx tsx "${scriptPath}"`, {
        cwd: path.resolve(__dirname, '..'),
        encoding: 'utf8',
      });
      const countAfterScript2 = await prisma.auditEvent.count();

      assert(
        countAfterScript1 === countAfterScript2 && output2.includes('[Backfill] Net new events added: 0'),
        'Repeated backfill execution is strictly idempotent with 0 new events',
        { countAfterScript1, countAfterScript2 }
      );
    } catch (err: any) {
      assert(false, 'Standalone backfill script execution succeeded', err.message);
    }

    // =========================================================================
    // SEC-06: Preserve Audit History During Resource Deletion
    // =========================================================================
    console.log('\n[SEC-06] Preserve Audit History During Resource Deletion:');

    // 1. Blocking deletion when assigned to personnel (400)
    const assignedResource = await prisma.resource.findFirst({
      where: {
        OR: [{ status: 'ASSIGNED' }, { currentAssigneeId: { not: null } }],
      },
    });

    if (assignedResource) {
      const delAssignedRes = await request('DELETE', `/api/resources/${assignedResource.id}`, {
        cookie: adminCookie,
      });
      assert(
        delAssignedRes.status === 400 && delAssignedRes.body.message?.includes('currently assigned to personnel'),
        `Permanent deletion blocked with 400 Bad Request for currently assigned resource (${assignedResource.itemCode})`,
        delAssignedRes.body
      );
    }

    // 2. Blocking deletion when operational history exists (409 Conflict)
    let unassignedWithHistory = await prisma.resource.findFirst({
      where: {
        status: { not: 'ASSIGNED' },
        currentAssigneeId: null,
        OR: [
          { assignments: { some: {} } },
          { maintenanceRequests: { some: {} } },
          { transfers: { some: {} } },
        ],
      },
    });

    // If none exists, create an ephemeral resource with an operational audit record to test 409
    let createdHistoryResourceId: string | null = null;
    let createdAuditId: string | null = null;
    const deptForTest = await prisma.department.findFirst();

    if (!unassignedWithHistory && deptForTest) {
      const tempItemCode = `HIST-TEST-${Date.now()}`;
      const tempRes = await prisma.resource.create({
        data: {
          itemCode: tempItemCode,
          name: 'Historical Asset Test',
          category: 'IT_EQUIPMENT',
          status: 'AVAILABLE',
          condition: 'GOOD',
          departmentId: deptForTest.id,
        },
      });
      createdHistoryResourceId = tempRes.id;
      const auditEvt = await prisma.auditEvent.create({
        data: {
          actionType: 'RESOURCE_ASSIGNED',
          actorId: 'test-actor',
          actorName: 'Test Custodian',
          actorRole: 'STORE_KEEPER',
          resourceId: tempRes.id,
          resourceCode: tempItemCode,
          resourceName: tempRes.name,
          details: 'Historical assignment for test',
        },
      });
      createdAuditId = auditEvt.id;
      unassignedWithHistory = tempRes;
    }

    if (unassignedWithHistory) {
      const delBlockedRes = await request('DELETE', `/api/resources/${unassignedWithHistory.id}`, {
        cookie: adminCookie,
      });
      assert(
        delBlockedRes.status === 409,
        `Permanent deletion blocked with 409 Conflict for resource with operational history (${unassignedWithHistory.itemCode})`,
        delBlockedRes.body
      );
      assert(
        delBlockedRes.body.message?.includes('cannot be deleted because it has active historical operational records'),
        'Deletion error message explains why deletion is blocked with operational history reasons'
      );
    }

    // Cleanup ephemeral history test resource if created
    if (createdAuditId) {
      await prisma.auditEvent.delete({ where: { id: createdAuditId } }).catch(() => {});
    }
    if (createdHistoryResourceId) {
      await prisma.resource.delete({ where: { id: createdHistoryResourceId } }).catch(() => {});
    }

    // 2. Eligible deletion without operational history preserves audit events
    const dept = await prisma.department.findFirst();
    const testItemCode = `TEST-DEL-${Date.now()}`;
    const testResource = await prisma.resource.create({
      data: {
        itemCode: testItemCode,
        name: 'Ephemeral Test Asset for Audit Preservation',
        category: 'OFFICE_EQUIPMENT',
        model: 'TestModel-2026',
        serialNumber: `SN-${Date.now()}`,
        status: 'AVAILABLE',
        condition: 'NEW',
        departmentId: dept!.id,
      },
    });

    // Create an audit event associated with this test resource
    const regAuditEvent = await prisma.auditEvent.create({
      data: {
        actionType: 'RESOURCE_REGISTERED',
        actorId: 'test-admin-actor',
        actorName: 'System Test Admin',
        actorRole: 'ADMIN',
        resourceId: testResource.id,
        resourceCode: testResource.itemCode,
        resourceName: testResource.name,
        departmentId: dept!.id,
        details: 'Initial registration audit record for deletion test',
      },
    });

    // Issue DELETE request
    const delAllowedRes = await request('DELETE', `/api/resources/${testResource.id}`, {
      cookie: adminCookie,
    });

    assert(
      delAllowedRes.status === 200 && delAllowedRes.body.success === true,
      'Clean resource without operational history can be deleted (200 OK)',
      delAllowedRes.body
    );

    // Verify Resource table no longer has this item
    const deletedResourceInDb = await prisma.resource.findUnique({
      where: { id: testResource.id },
    });
    assert(deletedResourceInDb === null, 'Resource record was successfully deleted from database');

    // Verify original audit event is PRESERVED with resourceId set to null (SetNull foreign key behavior)
    const preservedRegEvent = await prisma.auditEvent.findUnique({
      where: { id: regAuditEvent.id },
    });
    assert(
      preservedRegEvent !== null,
      'Historical registration audit event was NOT deleted along with the resource'
    );
    assert(
      preservedRegEvent?.resourceId === null,
      'Historical registration audit event foreign key dissociated safely (resourceId: null)'
    );
    assert(
      preservedRegEvent?.resourceCode === testItemCode,
      'Historical registration audit event retains original resourceCode and metadata'
    );

    // Verify RESOURCE_DELETED audit event was logged
    const deletionAuditEvent = await prisma.auditEvent.findFirst({
      where: {
        actionType: 'RESOURCE_DELETED',
        resourceCode: testItemCode,
      },
    });
    assert(
      deletionAuditEvent !== null,
      'RESOURCE_DELETED audit event recorded for deleted resource'
    );
    assert(
      deletionAuditEvent?.resourceName === testResource.name,
      'RESOURCE_DELETED audit event captures snapshot metadata of the deleted resource'
    );

    // Cleanup test audit events to keep database clean
    if (regAuditEvent) {
      await prisma.auditEvent.delete({ where: { id: regAuditEvent.id } }).catch(() => {});
    }
    if (deletionAuditEvent) {
      await prisma.auditEvent.delete({ where: { id: deletionAuditEvent.id } }).catch(() => {});
    }

    // =========================================================================
    // SEC-07: Secure Cookies and CORS for Vercel + Render
    // =========================================================================
    console.log('\n[SEC-07] Secure Cookies and CORS Configuration:');

    // 1. Test cookie options generation
    const defaultOptions = getSessionCookieOptions();
    assert(defaultOptions.httpOnly === true, 'Cookie httpOnly is always true');
    assert(defaultOptions.path === '/', 'Cookie path defaults to /');

    // Test SameSite=None browser safety rule
    const origSameSite = process.env.COOKIE_SAME_SITE;
    const origSecure = process.env.COOKIE_SECURE;
    const origDomain = process.env.COOKIE_DOMAIN;

    try {
      process.env.COOKIE_SAME_SITE = 'None';
      process.env.COOKIE_SECURE = 'false'; // simulate improper config
      const noneOptions = getSessionCookieOptions();
      assert(noneOptions.sameSite === 'None', 'COOKIE_SAME_SITE=None respected');
      assert(
        noneOptions.secure === true,
        'Secure=true auto-enforced when SameSite=None to prevent modern browser cookie rejection'
      );

      process.env.COOKIE_SAME_SITE = 'Strict';
      const strictOptions = getSessionCookieOptions();
      assert(strictOptions.sameSite === 'Strict', 'COOKIE_SAME_SITE=Strict respected');

      process.env.COOKIE_DOMAIN = '.eec.gov.et';
      const domainOptions = getSessionCookieOptions();
      assert(domainOptions.domain === '.eec.gov.et', 'COOKIE_DOMAIN configured correctly');
    } finally {
      process.env.COOKIE_SAME_SITE = origSameSite;
      process.env.COOKIE_SECURE = origSecure;
      process.env.COOKIE_DOMAIN = origDomain;
    }

    // 2. Test CORS exact origin matching and exposed headers
    const corsRes = await request('OPTIONS', '/api/auth/login', {
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
      },
    });

    assert(corsRes.status === 204, 'CORS preflight returns 204 No Content');
    assert(
      corsRes.headers['access-control-allow-origin'] === 'http://localhost:5173',
      'Exact matching allowed origin reflected in Access-Control-Allow-Origin'
    );
    assert(
      corsRes.headers['access-control-allow-credentials'] === 'true',
      'Access-Control-Allow-Credentials is true for allowed origin'
    );
    assert(
      corsRes.headers['access-control-expose-headers']?.includes('Retry-After'),
      'Retry-After is exposed in Access-Control-Expose-Headers'
    );

    // =========================================================================
    // SEC-08: Centralized HTTP Security Headers
    // =========================================================================
    console.log('\n[SEC-08] Centralized HTTP Security Headers:');

    // Test on 200 OK endpoint
    const healthRes = await request('GET', '/api/health');
    assert(
      healthRes.headers['x-content-type-options'] === 'nosniff',
      'X-Content-Type-Options: nosniff present on 200 OK'
    );
    assert(
      healthRes.headers['x-frame-options'] === 'DENY',
      'X-Frame-Options: DENY present on 200 OK'
    );
    assert(
      healthRes.headers['referrer-policy'] === 'strict-origin-when-cross-origin',
      'Referrer-Policy: strict-origin-when-cross-origin present on 200 OK'
    );
    assert(
      healthRes.headers['content-security-policy']?.includes("default-src 'none'"),
      "Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; present on 200 OK"
    );

    // Test on 404 Not Found endpoint
    const notFoundRes = await request('GET', '/api/nonexistent-route-xyz');
    assert(
      notFoundRes.headers['x-content-type-options'] === 'nosniff' &&
      notFoundRes.headers['x-frame-options'] === 'DENY',
      'Security headers present on 404 Not Found responses'
    );

    // Test on OPTIONS preflight endpoint
    const optRes = await request('OPTIONS', '/api/health');
    assert(
      optRes.headers['x-content-type-options'] === 'nosniff' &&
      optRes.headers['x-frame-options'] === 'DENY',
      'Security headers present on preflight OPTIONS responses'
    );

    // Test Strict-Transport-Security in production mode
    const mockRes: any = {
      headers: {},
      setHeader(k: string, v: string) {
        this.headers[k.toLowerCase()] = v;
      },
    };
    const origEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      applySecurityHeaders(mockRes);
      assert(
        mockRes.headers['strict-transport-security']?.includes('max-age=31536000'),
        'Strict-Transport-Security header enabled in production mode'
      );
    } finally {
      process.env.NODE_ENV = origEnv;
    }

    // =========================================================================
    // SEC-09: Safe Client IP Extraction and Rate Limiting
    // =========================================================================
    console.log('\n[SEC-09] Safe Client IP Extraction and Rate Limiting:');

    // 1. Safe Client IP Extraction (untrusted reverse proxy handling)
    const mockReqDirect: any = {
      headers: {},
      socket: { remoteAddress: '192.168.1.50' },
    };
    assert(
      getClientIp(mockReqDirect) === '192.168.1.50',
      'Extracts direct client IP when no proxy headers present'
    );

    const mockReqSingleProxy: any = {
      headers: { 'x-forwarded-for': '203.0.113.195' },
      socket: { remoteAddress: '10.0.0.1' },
    };
    assert(
      getClientIp(mockReqSingleProxy) === '203.0.113.195',
      'Extracts client IP from single-hop X-Forwarded-For'
    );

    // Spoofed multi-hop attack: attacker sends "1.2.3.4, 5.6.7.8", Render appends real client IP
    const mockReqSpoofed: any = {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 198.51.100.77' },
      socket: { remoteAddress: '10.0.0.1' },
    };
    assert(
      getClientIp(mockReqSpoofed) === '198.51.100.77',
      'Extracts the verified rightmost IP from X-Forwarded-For, ignoring spoofed client prefixes'
    );

    // 2. Rate limiting on Login
    resetRateLimiter();
    const testIp = '198.51.100.99';
    let triggeredRateLimit = false;
    let rateLimitResponse: HttpResponse | null = null;

    for (let i = 0; i < 22; i++) {
      const res = await request('POST', '/api/auth/login', {
        headers: {
          'x-forwarded-for': testIp,
        },
        body: {
          email: 'nonexistent-probe@eec.gov.et',
          password: 'WrongPassword123!',
        },
      });

      if (res.status === 429) {
        triggeredRateLimit = true;
        rateLimitResponse = res;
        break;
      }
    }

    assert(
      triggeredRateLimit,
      'Login rate limiter triggers HTTP 429 Too Many Requests after exceeding threshold'
    );
    assert(
      Boolean(rateLimitResponse?.headers['retry-after']),
      'HTTP 429 response includes Retry-After header'
    );
    assert(
      rateLimitResponse?.body.message?.includes('Too many login attempts'),
      'Rate limit response provides generic guidance without disclosing account existence'
    );

    // 3. Rate limiting on Registration
    resetRateLimiter();
    const regTestIp = '198.51.100.101';
    let regRateLimitTriggered = false;
    let regLimitRes: HttpResponse | null = null;

    for (let i = 0; i < 12; i++) {
      const res = await request('POST', '/api/auth/register', {
        headers: {
          'x-forwarded-for': regTestIp,
        },
        body: {
          email: `probe-${i}@eec.gov.et`,
          password: 'TestPassword123!',
          fullName: `Probe User ${i}`,
        },
      });

      if (res.status === 429) {
        regRateLimitTriggered = true;
        regLimitRes = res;
        break;
      }
    }

    assert(
      regRateLimitTriggered,
      'Registration rate limiter triggers HTTP 429 Too Many Requests after exceeding threshold'
    );
    assert(
      Boolean(regLimitRes?.headers['retry-after']),
      'Registration HTTP 429 response includes Retry-After header'
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
