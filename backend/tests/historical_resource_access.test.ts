import http from 'node:http';
import { AddressInfo } from 'node:net';
import prisma from '../src/lib/prisma.js';

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
  console.log('EEC RMS: Historical Resource Access & Custody Archive Tests');
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
    const adminCookie = await loginUser('admin@eec.gov.et');
    const haileCookie = await loginUser('employee@eec.gov.et'); // EMPLOYEE in dept-101 (Haile Gebrselassie)
    const managerCookie = await loginUser('manager@eec.gov.et'); // Manager in dept-101

    // 1. Verify Haile's access to transferred resource EEC-VEHC-2026-3557 (now in dept-107)
    console.log('\n--- 1. Historical Resource Access for Transferred Asset EEC-VEHC-2026-3557 ---');
    const vehc1Res = await request('GET', '/api/resources/1e1176be-c7d4-49b0-891a-0790a68e08ef', {
      cookie: haileCookie,
    });
    assert(vehc1Res.status === 200, 'Haile can access out-of-department resource with historical assignment');
    assert(vehc1Res.body?.resource?.itemCode === 'EEC-VEHC-2026-3557', 'Resource itemCode matches EEC-VEHC-2026-3557');
    assert(vehc1Res.body?.resource?.historicalContext?.isHistoricalAccess === true, 'Historical context is marked isHistoricalAccess: true');
    assert(vehc1Res.body?.resource?.historicalContext?.historicalAssigneeName === 'Haile Gebrselassie', 'Historical assignee name is Haile Gebrselassie');
    assert(vehc1Res.body?.resource?.historicalContext?.conclusionStatus === 'TRANSFERRED', 'Conclusion status is TRANSFERRED');
    assert(Boolean(vehc1Res.body?.resource?.historicalContext?.assignmentNumber), 'Historical assignment number is attached');

    // 2. Access via itemCode
    console.log('\n--- 2. Historical Resource Access via itemCode ---');
    const vehcByCode = await request('GET', '/api/resources/EEC-VEHC-2026-3557', {
      cookie: haileCookie,
    });
    assert(vehcByCode.status === 200, 'Haile can access historical resource by itemCode');
    assert(vehcByCode.body?.resource?.historicalContext?.isHistoricalAccess === true, 'Historical context attached when looked up by itemCode');

    // 3. Access via assignment ID
    console.log('\n--- 3. Historical Resource Access via Assignment ID fallback ---');
    const vehcByAsgnId = await request('GET', '/api/resources/19d616c1-fadb-4a05-bacf-0c0aee86d14d', {
      cookie: haileCookie,
    });
    assert(vehcByAsgnId.status === 200, 'Haile can resolve resource using assignment ID');
    assert(vehcByAsgnId.body?.resource?.itemCode === 'EEC-VEHC-2026-3557', 'Resolved resource is EEC-VEHC-2026-3557');

    // 4. Verify Haile's access to transferred resource EEC-VEHC-2022-081 (res-veh-001 in dept-107)
    console.log('\n--- 4. Historical Resource Access for Transferred Asset EEC-VEHC-2022-081 (res-veh-001) ---');
    const vehc2Res = await request('GET', '/api/resources/res-veh-001', {
      cookie: haileCookie,
    });
    assert(vehc2Res.status === 200, 'Haile can access res-veh-001');
    assert(vehc2Res.body?.resource?.itemCode === 'EEC-VEHC-2022-081', 'Resource itemCode matches EEC-VEHC-2022-081');
    assert(vehc2Res.body?.resource?.historicalContext?.isHistoricalAccess === true, 'Historical context is marked isHistoricalAccess: true');

    // 5. Custody History endpoint allows historical viewer
    console.log('\n--- 5. Custody History Endpoint for Historical Assignee ---');
    const histRes = await request('GET', '/api/assignments/history/res-veh-001', {
      cookie: haileCookie,
    });
    assert(histRes.status === 200, 'Haile can access assignment history for res-veh-001');
    assert(Array.isArray(histRes.body?.timeline), 'Custody timeline is returned');

    // 6. Security & Boundary: Employee cannot access out-of-department resource with NO assignment history
    console.log('\n--- 6. Security Boundary Enforcement for Unrelated Out-of-Department Resources ---');
    // Find an IT resource or resource in another department with no assignments to Haile
    const otherDeptResource = await prisma.resource.findFirst({
      where: {
        departmentId: 'dept-107',
        assignments: {
          none: {
            employee: {
              OR: [{ email: 'employee@eec.gov.et' }, { name: 'Haile Gebrselassie' }],
            },
          },
        },
      },
    });

    if (otherDeptResource) {
      const forbiddenRes = await request('GET', `/api/resources/${otherDeptResource.id}`, {
        cookie: haileCookie,
      });
      assert(forbiddenRes.status === 403, `Haile accessing unrelated out-of-department resource ${otherDeptResource.itemCode} returns 403 Forbidden`);

      const forbiddenHistRes = await request('GET', `/api/assignments/history/${otherDeptResource.id}`, {
        cookie: haileCookie,
      });
      assert(forbiddenHistRes.status === 403, `Haile accessing history of unrelated out-of-department resource returns 403 Forbidden`);
    } else {
      console.log('  (Skipping specific unassigned dept-107 resource: all existing belong to history)');
    }

    // 7. Active Resource Registry remains department-scoped
    console.log('\n--- 7. Active Resource Registry Remains Department-Scoped ---');
    const registryRes = await request('GET', '/api/resources', {
      cookie: haileCookie,
    });
    assert(registryRes.status === 200, 'Haile can list resources in active registry');
    const listResources: any[] = registryRes.body?.resources || [];
    const containsVehc1 = listResources.some((r) => r.id === '1e1176be-c7d4-49b0-891a-0790a68e08ef' || r.itemCode === 'EEC-VEHC-2026-3557');
    const containsVehc2 = listResources.some((r) => r.id === 'res-veh-001' || r.itemCode === 'EEC-VEHC-2022-081');
    assert(!containsVehc1, 'Transferred resource EEC-VEHC-2026-3557 is NOT listed in Haile\'s active department registry');
    assert(!containsVehc2, 'Transferred resource EEC-VEHC-2022-081 is NOT listed in Haile\'s active department registry');

    // 8. Admin full access without historical restriction
    console.log('\n--- 8. Admin Global Access ---');
    const adminVehc = await request('GET', '/api/resources/1e1176be-c7d4-49b0-891a-0790a68e08ef', {
      cookie: adminCookie,
    });
    assert(adminVehc.status === 200, 'Admin can access transferred resource');
    assert(!adminVehc.body?.resource?.historicalContext, 'Admin gets live resource view without historicalContext override');

    // 9. Non-existent resource returns 404
    console.log('\n--- 9. Non-Existent Resource Returns 404 ---');
    const notFoundRes = await request('GET', '/api/resources/00000000-0000-0000-0000-000000000000', {
      cookie: haileCookie,
    });
    assert(notFoundRes.status === 404, 'Non-existent resource returns 404 Not Found');

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
