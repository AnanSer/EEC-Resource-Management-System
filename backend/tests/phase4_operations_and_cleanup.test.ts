import http from 'node:http';
import { AddressInfo } from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import prisma from '../src/lib/prisma';
import { 
  cleanupExpiredSessions, 
  startPeriodicSessionCleanup, 
  stopPeriodicSessionCleanup,
  validateSession,
  generateSessionToken
} from '../src/auth/session';

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

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
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
  console.log('EEC RMS — Phase 4 Operations & Cleanup Verification');
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
    // =========================================================================
    // SEC-14: Expired Session Cleanup
    // =========================================================================
    console.log('\n[SEC-14] Expired Session Cleanup:');

    // 1. Create a dummy test user or find existing user
    const testUser = await prisma.user.findFirst();
    assert(testUser !== null, 'Found existing user for session tests');

    if (testUser) {
      const expiredToken = generateSessionToken();
      const activeToken = generateSessionToken();

      // Create an expired session record (1 hour ago)
      const expiredSession = await prisma.session.create({
        data: {
          token: expiredToken,
          userId: testUser.id,
          expiresAt: new Date(Date.now() - 3600 * 1000),
        },
      });

      // Create an active session record (7 days in future)
      const activeSession = await prisma.session.create({
        data: {
          token: activeToken,
          userId: testUser.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        },
      });

      // Verify both were inserted
      const checkExpiredBefore = await prisma.session.findUnique({ where: { token: expiredToken } });
      const checkActiveBefore = await prisma.session.findUnique({ where: { token: activeToken } });
      assert(checkExpiredBefore !== null, 'Expired test session created in database');
      assert(checkActiveBefore !== null, 'Active test session created in database');

      // Execute bounded cleanup function
      const { deletedCount } = await cleanupExpiredSessions();
      assert(deletedCount >= 1, `cleanupExpiredSessions removed at least 1 expired session (count: ${deletedCount})`);

      // Verify expired session was removed
      const checkExpiredAfter = await prisma.session.findUnique({ where: { token: expiredToken } });
      assert(checkExpiredAfter === null, 'Expired session record was safely deleted');

      // Verify active session was PRESERVED
      const checkActiveAfter = await prisma.session.findUnique({ where: { token: activeToken } });
      assert(checkActiveAfter !== null, 'Active session record was strictly preserved and NOT deleted');

      // Verify active session validates successfully
      const validated = await validateSession(activeToken);
      assert(validated !== null && validated.user.id === testUser.id, 'Active session remains valid and usable');

      // Clean up test active session
      await prisma.session.delete({ where: { token: activeToken } }).catch(() => {});
    }

    // 2. Test periodic cleanup timer start and stop
    const timer = startPeriodicSessionCleanup(1000);
    assert(timer !== null, 'startPeriodicSessionCleanup returns active timer');
    stopPeriodicSessionCleanup();
    assert(true, 'stopPeriodicSessionCleanup executes without error');

    // =========================================================================
    // SEC-15: Minimize Root & Health Endpoint Information
    // =========================================================================
    console.log('\n[SEC-15] Minimize Root and Health Endpoint Information:');

    // 1. Health endpoint GET /api/health
    const healthRes = await request('GET', '/api/health');
    assert(healthRes.status === 200, 'GET /api/health returns 200 OK');
    assert(healthRes.body.status === 'ok', 'Health response returns minimal {"status":"ok"}');
    assert(healthRes.body.environment === undefined, 'Health endpoint does NOT leak environment name');
    assert(healthRes.body.server === undefined, 'Health endpoint does NOT leak server framework (node:http)');
    assert(healthRes.body.version === undefined, 'Health endpoint does NOT leak version numbers');
    assert(healthRes.body.service === undefined, 'Health endpoint does NOT leak internal service name');
    assert(healthRes.body.framework === undefined, 'Health endpoint does NOT leak framework name');
    assert(
      !healthRes.rawText.includes('node:') &&
      !healthRes.rawText.includes('localhost') &&
      !healthRes.rawText.includes('database'),
      'Health endpoint does not leak internal infrastructure details'
    );

    // 2. Root endpoint GET /
    const rootRes = await request('GET', '/');
    assert(rootRes.status === 200, 'GET / returns 200 OK');
    assert(rootRes.body.status === 'ok', 'Root endpoint returns minimal {"status":"ok"}');
    assert(rootRes.body.version === undefined, 'Root endpoint does NOT leak version numbers');
    assert(rootRes.body.framework === undefined, 'Root endpoint does NOT leak framework name');

    // =========================================================================
    // SEC-16: Prisma Production Migration Deployment Scripts
    // =========================================================================
    console.log('\n[SEC-16] Prisma Production Migration Deployment Scripts:');

    const pkgPath = path.resolve(__dirname, '../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    assert(
      pkg.scripts && pkg.scripts['prisma:deploy'] === 'prisma migrate deploy',
      'package.json contains "prisma:deploy": "prisma migrate deploy"'
    );
    assert(
      pkg.scripts && pkg.scripts['migrate:deploy'] === 'prisma migrate deploy',
      'package.json contains "migrate:deploy": "prisma migrate deploy" alias'
    );
    assert(
      !pkg.scripts['prisma:deploy'].includes('reset') &&
      !pkg.scripts['prisma:deploy'].includes('push'),
      'Production deployment script does not contain destructive reset or db push commands'
    );

    // Verify migration folder contains existing committed migrations
    const migrationsDir = path.resolve(__dirname, '../prisma/migrations');
    assert(fs.existsSync(migrationsDir), 'Prisma migrations directory exists');
    const migrationEntries = fs.readdirSync(migrationsDir).filter(f => f.includes('_'));
    assert(migrationEntries.length >= 10, `Prisma migrations folder has at least 10 committed migrations (found ${migrationEntries.length})`);

    const lockPath = path.join(migrationsDir, 'migration_lock.toml');
    assert(fs.existsSync(lockPath), 'migration_lock.toml exists');
    const lockContent = fs.readFileSync(lockPath, 'utf8');
    assert(lockContent.includes('provider = "postgresql"'), 'migration_lock.toml specifies postgresql provider');

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

