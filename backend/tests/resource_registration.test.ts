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
  console.log('========================================================================');
  console.log('EEC RMS: Resource Registration Form Improvement & Verification Tests');
  console.log('========================================================================');

  const { server } = await import('../src/index.js');
  await new Promise<void>((resolve) => {
    testServer = server.listen(0, () => {
      const addr = testServer.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      console.log(`Test server listening on ${baseUrl}`);
      resolve();
    });
  });

  const createdResourceIds: string[] = [];

  try {
    console.log('\n--- 1. Authenticating Privileged Roles ---');
    const adminCookie = await loginUser('admin@eec.gov.et');
    assert(Boolean(adminCookie), 'ADMIN authenticated successfully');

    const storeKeeperCookie = await loginUser('storekeeper@eec.gov.et');
    assert(Boolean(storeKeeperCookie), 'STORE_KEEPER authenticated successfully');

    const empCookie = await loginUser('employee@eec.gov.et');
    assert(Boolean(empCookie), 'EMPLOYEE authenticated successfully');

    const depts = await prisma.department.findMany({ take: 2 });
    assert(depts.length > 0, 'Found existing corporate departments');
    const targetDeptId = depts[0].id;

    // --- 2. Category-Aware Resource Creation Across All 5 Categories ---
    console.log('\n--- 2. Category-Aware Resource Creation Across All 5 Categories ---');

    // 2A: IT_EQUIPMENT
    const itPayload = {
      name: 'Dell Latitude 5540 Engineering Laptop',
      category: 'IT_EQUIPMENT',
      subcategory: 'Engineering Laptop',
      departmentId: targetDeptId,
      location: 'Central Store - Kersa',
      manufacturer: 'Dell Technologies',
      model: 'Latitude 5540',
      serialNumber: `TEST-SN-IT-${Date.now()}`,
      purchaseDate: '2026-03-15',
      purchaseCostETB: 78000,
      warrantyExpiry: '2029-03-15',
      supplier: 'Dell East Africa',
      notes: 'Configured for CAD and BIM modeling',
      itSpecs: {
        computerType: 'Laptop',
        os: 'Windows 11 Pro',
        processor: 'Intel Core i7-1365U',
        ramGb: 32,
        storageGb: 1000,
        storage: '1TB NVMe Gen4 SSD',
      },
    };

    const itRes = await request('POST', '/api/resources', {
      cookie: adminCookie,
      body: itPayload,
    });

    assert(itRes.status === 201, 'IT_EQUIPMENT registered with 201 Created');
    assert(Boolean(itRes.body?.resource?.itemCode), 'IT_EQUIPMENT received auto-generated itemCode');
    assert(
      itRes.body?.resource?.itemCode?.startsWith('EEC-IT-'),
      `Item code has expected IT prefix (${itRes.body?.resource?.itemCode})`
    );
    assert(itRes.body?.resource?.status === 'AVAILABLE', 'IT resource starts as AVAILABLE');
    assert(itRes.body?.resource?.currentAssigneeId === null, 'IT resource has no custodian');
    assert(itRes.body?.resource?.specs?.processor === 'Intel Core i7-1365U', 'IT specs preserved correctly');
    if (itRes.body?.resource?.id) createdResourceIds.push(itRes.body.resource.id);

    // 2B: VEHICLES
    const vehSerial = `TEST-VIN-${Date.now()}`;
    const vehPayload = {
      name: 'Toyota Land Cruiser HZ76 4x4 Station Wagon',
      category: 'VEHICLES',
      subcategory: 'Field Station Wagon',
      departmentId: targetDeptId,
      location: 'Kality Equipment Yard - Bay 2',
      manufacturer: 'Toyota Motor Corporation',
      model: 'Land Cruiser HZ76',
      serialNumber: vehSerial,
      purchaseDate: '2026-01-20',
      purchaseCostETB: 4500000,
      supplier: 'Nyala Motors Share Company',
      vehicleSpecs: {
        plateNumber: '3-98214 ET',
        chassisNumber: vehSerial,
        engineNumber: '1HZ-992384',
        vehicleType: 'Station Wagon',
        fuelType: 'DIESEL',
        currentMileageKm: 120,
      },
    };

    const vehRes = await request('POST', '/api/resources', {
      cookie: storeKeeperCookie,
      body: vehPayload,
    });

    assert(vehRes.status === 201, 'VEHICLES registered by STORE_KEEPER with 201 Created');
    assert(
      vehRes.body?.resource?.itemCode?.startsWith('EEC-VEHC-'),
      `Item code has expected vehicle prefix (${vehRes.body?.resource?.itemCode})`
    );
    assert(vehRes.body?.resource?.status === 'AVAILABLE', 'Vehicle resource starts as AVAILABLE');
    assert(vehRes.body?.resource?.specs?.plateNumber === '3-98214 ET', 'Vehicle specs preserved correctly');
    if (vehRes.body?.resource?.id) createdResourceIds.push(vehRes.body.resource.id);

    // 2C: HEAVY_MACHINERY
    const machSerial = `TEST-MACH-SN-${Date.now()}`;
    const machPayload = {
      name: 'Caterpillar 320D Hydraulic Excavator',
      category: 'HEAVY_MACHINERY',
      subcategory: 'Hydraulic Excavator',
      departmentId: targetDeptId,
      location: 'Kality Heavy Machinery Depot',
      manufacturer: 'Caterpillar Inc.',
      model: '320D',
      serialNumber: machSerial,
      purchaseCostETB: 9200000,
      machinerySpecs: {
        machineType: 'Crawler Excavator',
        capacity: '20-Ton Operating Weight, 1.2 m³ Bucket',
        operatingHours: 45,
      },
    };

    const machRes = await request('POST', '/api/resources', {
      cookie: adminCookie,
      body: machPayload,
    });

    assert(machRes.status === 201, 'HEAVY_MACHINERY registered with 201 Created');
    assert(
      machRes.body?.resource?.itemCode?.startsWith('EEC-MACH-'),
      `Item code has expected machinery prefix (${machRes.body?.resource?.itemCode})`
    );
    assert(machRes.body?.resource?.status === 'AVAILABLE', 'Heavy machinery starts as AVAILABLE');
    assert(machRes.body?.resource?.specs?.capacity?.includes('20-Ton'), 'Machinery specs preserved correctly');
    if (machRes.body?.resource?.id) createdResourceIds.push(machRes.body.resource.id);

    // 2D: SURVEYING_GEOTECHNICAL
    const survSerial = `TEST-SURV-SN-${Date.now()}`;
    const survPayload = {
      name: 'Leica TS16 Robotic Total Station 1 arc-sec',
      category: 'SURVEYING_GEOTECHNICAL',
      subcategory: 'Robotic Total Station',
      departmentId: targetDeptId,
      location: 'Central Store - Kersa, Vault 1',
      manufacturer: 'Leica Geosystems',
      model: 'TS16',
      serialNumber: survSerial,
      purchaseCostETB: 1800000,
      surveyingSpecs: {
        equipmentType: 'Robotic Total Station',
        accuracyGrade: '1 arc-second',
        calibrationCertificateNumber: 'EEC-CAL-2026-9901',
        nextCalibrationDue: '2027-02-01',
      },
    };

    const survRes = await request('POST', '/api/resources', {
      cookie: adminCookie,
      body: survPayload,
    });

    assert(survRes.status === 201, 'SURVEYING_GEOTECHNICAL registered with 201 Created');
    assert(
      survRes.body?.resource?.itemCode?.startsWith('EEC-SURV-'),
      `Item code has expected surveying prefix (${survRes.body?.resource?.itemCode})`
    );
    assert(survRes.body?.resource?.status === 'AVAILABLE', 'Surveying equipment starts as AVAILABLE');
    assert(survRes.body?.resource?.specs?.accuracyGrade === '1 arc-second', 'Surveying specs preserved correctly');
    if (survRes.body?.resource?.id) createdResourceIds.push(survRes.body.resource.id);

    // 2E: CAMP_FACILITY_FURNITURE
    const furnPayload = {
      name: 'Executive Ergonomic Mesh Workstation Chair',
      category: 'CAMP_FACILITY_FURNITURE',
      subcategory: 'Office Ergonomic Seating',
      departmentId: targetDeptId,
      location: 'Central Warehouse - Level 2',
      manufacturer: 'Herman Miller',
      model: 'Aeron Size B',
      purchaseCostETB: 42000,
      furnitureSpecs: {
        itemType: 'Ergonomic Task Chair',
        material: 'Breathable Pellicle Mesh & Aluminum Frame',
        dimensions: '68 x 68 x 104 cm',
        color: 'Graphite / Mineral',
      },
    };

    const furnRes = await request('POST', '/api/resources', {
      cookie: adminCookie,
      body: furnPayload,
    });

    assert(furnRes.status === 201, 'CAMP_FACILITY_FURNITURE registered with 201 Created');
    assert(
      furnRes.body?.resource?.itemCode?.startsWith('EEC-FURN-'),
      `Item code has expected furniture prefix (${furnRes.body?.resource?.itemCode})`
    );
    assert(furnRes.body?.resource?.status === 'AVAILABLE', 'Furniture resource starts as AVAILABLE');
    assert(furnRes.body?.resource?.specs?.color === 'Graphite / Mineral', 'Furniture specs preserved correctly');
    if (furnRes.body?.resource?.id) createdResourceIds.push(furnRes.body.resource.id);

    // --- 3. Automatic Item Code Generation Under Concurrency ---
    console.log('\n--- 3. Automatic Item Code Generation Under Concurrency ---');

    const concurrentCount = 6;
    const concurrentPromises = Array.from({ length: concurrentCount }, (_, i) => {
      return request('POST', '/api/resources', {
        cookie: adminCookie,
        body: {
          name: `Concurrent Test Laptop Unit ${i + 1}`,
          category: 'IT_EQUIPMENT',
          departmentId: targetDeptId,
          location: 'Central Store - Kersa',
          itSpecs: {
            ramGb: 16,
            os: 'Windows 11 Pro',
          },
        },
      });
    });

    const concurrentResults = await Promise.all(concurrentPromises);

    assert(
      concurrentResults.every((r) => r.status === 201),
      `All ${concurrentCount} concurrent registration requests returned 201 Created`
    );

    const generatedCodes = concurrentResults.map((r) => r.body?.resource?.itemCode);
    const uniqueCodes = new Set(generatedCodes);

    assert(
      uniqueCodes.size === concurrentCount,
      `All ${concurrentCount} auto-generated item codes are strictly unique (${Array.from(uniqueCodes).join(', ')})`
    );

    concurrentResults.forEach((r) => {
      if (r.body?.resource?.id) createdResourceIds.push(r.body.resource.id);
    });

    // --- 4. Duplicate Serial Number Prevention ---
    console.log('\n--- 4. Duplicate Serial Number Prevention ---');

    const existingSerial = `DUPLICATE-CHECK-SN-${Date.now()}`;
    const firstAssetRes = await request('POST', '/api/resources', {
      cookie: adminCookie,
      body: {
        name: 'Primary Asset With Distinct Serial',
        category: 'IT_EQUIPMENT',
        departmentId: targetDeptId,
        serialNumber: existingSerial,
      },
    });
    assert(firstAssetRes.status === 201, 'First asset registered with distinct serial number');
    if (firstAssetRes.body?.resource?.id) createdResourceIds.push(firstAssetRes.body.resource.id);

    // Attempt to register another asset with identical serial number
    const dupSerialRes = await request('POST', '/api/resources', {
      cookie: adminCookie,
      body: {
        name: 'Secondary Asset Attempting Duplicate Serial',
        category: 'IT_EQUIPMENT',
        departmentId: targetDeptId,
        serialNumber: existingSerial,
      },
    });

    assert(dupSerialRes.status === 409, 'Duplicate serial number registration rejected with 409 Conflict');
    assert(
      dupSerialRes.body?.message?.includes(existingSerial),
      'Error message clearly identifies the duplicate serial number'
    );

    // Also verify case-insensitivity on duplicate serial
    const dupCaseRes = await request('POST', '/api/resources', {
      cookie: adminCookie,
      body: {
        name: 'Tertiary Asset Attempting Lowercase Serial',
        category: 'IT_EQUIPMENT',
        departmentId: targetDeptId,
        serialNumber: existingSerial.toLowerCase(),
      },
    });

    assert(dupCaseRes.status === 409, 'Case-insensitive duplicate serial number rejected with 409 Conflict');

    // --- 5. Flexible Specifications & Optional Fields ---
    console.log('\n--- 5. Flexible Specifications & Optional Fields ---');

    // Omitting all optional fields, only sending minimal required fields
    const minimalRes = await request('POST', '/api/resources', {
      cookie: adminCookie,
      body: {
        name: 'Minimal Surveying Level Unit',
        category: 'SURVEYING_GEOTECHNICAL',
        departmentId: targetDeptId,
      },
    });

    assert(minimalRes.status === 201, 'Minimal resource without optional fields registered with 201 Created');
    assert(Boolean(minimalRes.body?.resource?.itemCode), 'Minimal resource received auto-generated itemCode');
    assert(minimalRes.body?.resource?.location === 'Central Store - Kersa', 'Default storage location applied');
    assert(minimalRes.body?.resource?.purchaseCostETB === 0, 'Default purchase cost is 0');
    assert(minimalRes.body?.resource?.condition === 'EXCELLENT', 'Default condition is EXCELLENT');
    if (minimalRes.body?.resource?.id) createdResourceIds.push(minimalRes.body.resource.id);

    // --- 6. Input Validation & Invalid Input Rejection ---
    console.log('\n--- 6. Input Validation & Invalid Input Rejection ---');

    // 6A: Short name
    const shortNameRes = await request('POST', '/api/resources', {
      cookie: adminCookie,
      body: {
        name: 'A',
        category: 'IT_EQUIPMENT',
        departmentId: targetDeptId,
      },
    });
    assert(shortNameRes.status === 400, 'Name with < 2 characters rejected with 400 Bad Request');

    // 6B: Invalid Category
    const invalidCatRes = await request('POST', '/api/resources', {
      cookie: adminCookie,
      body: {
        name: 'Valid Name Here',
        category: 'SPACE_SHUTTLE_CATEGORY',
        departmentId: targetDeptId,
      },
    });
    assert(invalidCatRes.status === 400, 'Invalid category rejected with 400 Bad Request');

    // 6C: Invalid Department
    const invalidDeptRes = await request('POST', '/api/resources', {
      cookie: adminCookie,
      body: {
        name: 'Valid Name Here',
        category: 'IT_EQUIPMENT',
        departmentId: 'dept-non-existent-999',
      },
    });
    assert(invalidDeptRes.status === 400, 'Non-existent departmentId rejected with 400 Bad Request');

    // 6D: Negative Purchase Cost
    const negativeCostRes = await request('POST', '/api/resources', {
      cookie: adminCookie,
      body: {
        name: 'Valid Name Here',
        category: 'IT_EQUIPMENT',
        departmentId: targetDeptId,
        purchaseCostETB: -500,
      },
    });
    assert(negativeCostRes.status === 400, 'Negative purchase cost rejected with 400 Bad Request');

    // 6E: Invalid Date Format
    const invalidDateRes = await request('POST', '/api/resources', {
      cookie: adminCookie,
      body: {
        name: 'Valid Name Here',
        category: 'IT_EQUIPMENT',
        departmentId: targetDeptId,
        purchaseDate: 'not-a-valid-date-string',
      },
    });
    assert(invalidDateRes.status === 400, 'Invalid purchase date string rejected with 400 Bad Request');

    // 6F: Unauthorized Role
    const unauthEmpRes = await request('POST', '/api/resources', {
      cookie: empCookie,
      body: {
        name: 'Employee Registration Attempt',
        category: 'IT_EQUIPMENT',
        departmentId: targetDeptId,
      },
    });
    assert(unauthEmpRes.status === 403, 'EMPLOYEE role blocked with 403 Forbidden from registering assets');

    // --- 7. Custody and Status Protection Safeguard ---
    console.log('\n--- 7. Custody and Status Protection Safeguard ---');

    // Attempt to register with status: ASSIGNED
    const badStatusRes = await request('POST', '/api/resources', {
      cookie: adminCookie,
      body: {
        name: 'Asset Attempting Direct Assignment',
        category: 'IT_EQUIPMENT',
        departmentId: targetDeptId,
        status: 'ASSIGNED',
      },
    });
    assert(badStatusRes.status === 400, 'Registering with non-AVAILABLE status rejected with 400 Bad Request');

    // Attempt to pass currentAssigneeId
    const assigneeBypassRes = await request('POST', '/api/resources', {
      cookie: adminCookie,
      body: {
        name: 'Asset Attempting Custodian Bypass',
        category: 'IT_EQUIPMENT',
        departmentId: targetDeptId,
        currentAssigneeId: 'some-employee-id',
      },
    });
    assert(assigneeBypassRes.status === 201, 'Registration succeeds but enforces unassigned custody');
    assert(
      assigneeBypassRes.body?.resource?.currentAssigneeId === null,
      'currentAssigneeId is strictly enforced as null on registration'
    );
    assert(
      assigneeBypassRes.body?.resource?.status === 'AVAILABLE',
      'Resource status is strictly AVAILABLE'
    );
    if (assigneeBypassRes.body?.resource?.id) createdResourceIds.push(assigneeBypassRes.body.resource.id);

    // --- 8. Editing Existing Resources (PUT /api/resources/:id) Unaffected ---
    console.log('\n--- 8. Editing Existing Resources (PUT /api/resources/:id) ---');

    const updateRes = await request('PUT', `/api/resources/${itRes.body?.resource?.id}`, {
      cookie: adminCookie,
      body: {
        name: 'Dell Latitude 5540 Engineering Laptop (Updated Edition)',
        notes: 'Upgraded with extra memory and warranty expansion',
      },
    });

    assert(updateRes.status === 200, 'Updating existing resource succeeded with 200 OK');
    assert(
      updateRes.body?.resource?.name === 'Dell Latitude 5540 Engineering Laptop (Updated Edition)',
      'Resource name successfully updated'
    );
    assert(
      updateRes.body?.resource?.itemCode === itRes.body?.resource?.itemCode,
      'Original itemCode preserved intact'
    );

    // Serial number duplicate check on update
    const updateDupSerialRes = await request('PUT', `/api/resources/${itRes.body?.resource?.id}`, {
      cookie: adminCookie,
      body: {
        serialNumber: existingSerial, // already belongs to firstAssetRes
      },
    });

    assert(
      updateDupSerialRes.status === 409,
      'Updating serial number to an existing asset serial number rejected with 409 Conflict'
    );

    // Keeping own serial number on update succeeds
    const updateKeepSerialRes = await request('PUT', `/api/resources/${itRes.body?.resource?.id}`, {
      cookie: adminCookie,
      body: {
        serialNumber: itPayload.serialNumber, // its own serial number
      },
    });

    assert(updateKeepSerialRes.status === 200, 'Updating with same self serial number succeeds without conflict');
  } catch (err) {
    console.error('Unexpected error during test execution:', err);
    failed++;
  } finally {
    console.log('\n--- 9. Cleaning Up Test Resources & Audit Events ---');
    try {
      if (createdResourceIds.length > 0) {
        // First delete audit events associated with test resources
        await prisma.auditEvent.deleteMany({
          where: {
            resourceId: { in: createdResourceIds },
          },
        });
        // Then delete the test resources
        await prisma.resource.deleteMany({
          where: {
            id: { in: createdResourceIds },
          },
        });
        console.log(`  ✓ Safely cleaned up ${createdResourceIds.length} test resources and audit events`);
      }
    } catch (cleanupErr) {
      console.error('Error during test cleanup:', cleanupErr);
    }

    if (testServer) {
      testServer.close();
    }

    console.log('\n========================================================================');
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log('========================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  }
}

runTests();
