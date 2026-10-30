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
  console.log('EEC RMS: Reports and Operational Intelligence Integration Tests');
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
    // 1. Unauthenticated Security Boundaries
    console.log('\n--- 1. Unauthenticated Boundaries ---');
    const unauthGet = await request('GET', '/api/reports/overview');
    assert(unauthGet.status === 401, 'GET /api/reports/overview without cookie returns 401');

    // 2. User Authentication
    console.log('\n--- 2. Authenticating System Roles ---');
    const adminCookie = await loginUser('admin@eec.gov.et');
    assert(!!adminCookie, 'Admin session established');

    const managerCookie = await loginUser('manager@eec.gov.et');
    assert(!!managerCookie, 'Department Manager (dept-101) session established');

    const employeeCookie = await loginUser('employee@eec.gov.et');
    assert(!!employeeCookie, 'Employee session established');

    const storeKeeperCookie = await loginUser('storekeeper@eec.gov.et');
    assert(!!storeKeeperCookie, 'Store Keeper session established');

    const techCookie = await loginUser('technician@eec.gov.et');
    assert(!!techCookie, 'IT Technician session established');

    // 3. Admin Corporation-Wide Report & Aggregation Accuracy
    console.log('\n--- 3. Admin Corporation-Wide Report & Aggregations ---');
    const adminReportRes = await request('GET', '/api/reports/overview', { cookie: adminCookie });
    assert(adminReportRes.status === 200, 'Admin can fetch corporate reports overview (200)');
    const adminData = adminReportRes.body;
    assert(adminData?.success === true, 'Response success flag is true');
    assert(adminData?.metadata?.scope === 'CORPORATION', 'Admin scope is CORPORATION');
    assert(adminData?.metadata?.scopeLabel?.includes('Corporation-wide'), 'Scope label indicates corporation-wide');

    // Overview numbers
    const ov = adminData?.overview;
    assert(typeof ov?.totalResources === 'number' && ov.totalResources > 0, 'Total resources is positive number');
    assert(
      ov.available + ov.assigned + ov.underMaintenance + ov.retired + ov.disposed === ov.totalResources,
      'Resource status components sum exactly to totalResources'
    );
    assert(typeof ov?.totalPurchaseCostETB === 'number' && ov.totalPurchaseCostETB > 0, 'Total purchase cost is calculated in ETB');
    assert(typeof ov?.totalCurrentValueETB === 'number', 'Total current book value is calculated in ETB');

    // Distributions
    const dist = adminData?.distribution;
    assert(Array.isArray(dist?.byCategory), 'Distribution by category is array');
    assert(dist.byCategory.length > 0, 'Category breakdown contains active categories');
    const catSum = dist.byCategory.reduce((s: number, c: any) => s + c.count, 0);
    assert(catSum === ov.totalResources, 'Sum of category items matches total resources');

    assert(Array.isArray(dist?.byDepartment), 'Distribution by directorate is array');
    assert(dist.byDepartment.length > 0, 'Directorate breakdown contains entries');

    // Custody
    const custody = adminData?.custody;
    assert(typeof custody?.totalActiveAssignments === 'number', 'Active assignments count is calculated');
    assert(typeof custody?.totalUnassigned === 'number', 'Unassigned resources count is calculated');
    assert(Array.isArray(custody?.byDepartment), 'Custody by department is array');
    assert(Array.isArray(custody?.byEmployee), 'Custody by employee (top custodians) is array');

    // Maintenance Metrics & Real Costs
    const maint = adminData?.maintenance;
    assert(typeof maint?.byStatus?.total === 'number', 'Maintenance total tickets is calculated');
    assert(typeof maint?.totalActualCostETB === 'number', 'Actual recorded maintenance cost in ETB is calculated');
    assert(typeof maint?.totalEstimatedCostETB === 'number', 'Estimated maintenance cost in ETB is calculated');
    assert(Array.isArray(maint?.byCategory), 'Maintenance costs by category is array');

    // Recent Activities Feed
    const recents = adminData?.recentActivities;
    assert(Array.isArray(recents), 'Recent activities feed is array');
    assert(recents.length > 0, 'Recent activities contains entries');
    const firstAct = recents[0];
    assert(!!firstAct?.referenceCode, 'Activity item contains reference code');
    assert(!!firstAct?.resourceName, 'Activity item contains resource name');
    assert(!!firstAct?.timestamp, 'Activity item contains ISO timestamp');

    // 4. Department Manager Department-Level Isolation & Security Guard
    console.log('\n--- 4. Department Manager Directorate Boundary Scoping ---');
    const mgrReportRes = await request('GET', '/api/reports/overview', { cookie: managerCookie });
    assert(mgrReportRes.status === 200, 'Department Manager can fetch department reports overview (200)');
    const mgrData = mgrReportRes.body;
    assert(mgrData?.metadata?.scope === 'DEPARTMENT', 'Manager scope is strictly DEPARTMENT');
    assert(mgrData?.metadata?.departmentId === 'dept-101', 'Manager report scoped to dept-101');

    // All departments in breakdown should only be dept-101
    const mgrDepts = mgrData?.distribution?.byDepartment || [];
    const onlyDept101 = mgrDepts.every((d: any) => d.departmentId === 'dept-101');
    assert(onlyDept101, 'Manager distribution contains ONLY assigned directorate (dept-101)');

    // Manager counts must not exceed corporation-wide counts
    assert(mgrData?.overview?.totalResources <= ov.totalResources, 'Manager resource count is subset of corporation total');

    // Cross-department access attempt: Manager specifies dept-102
    const crossDeptAttempt = await request('GET', '/api/reports/overview?departmentId=dept-102', { cookie: managerCookie });
    assert(crossDeptAttempt.status === 403, 'Department Manager blocked with 403 when requesting foreign department reports');
    assert(crossDeptAttempt.body?.message?.includes('Forbidden'), 'Rejection message explains department restriction');

    // Manager requesting their own department explicitly succeeds
    const ownDeptAttempt = await request('GET', '/api/reports/overview?departmentId=dept-101', { cookie: managerCookie });
    assert(ownDeptAttempt.status === 200, 'Department Manager querying own department ID succeeds (200)');

    // 5. Employee Personal Scoping
    console.log('\n--- 5. Employee Personal Custody & Activity Scoping ---');
    const empReportRes = await request('GET', '/api/reports/overview', { cookie: employeeCookie });
    assert(empReportRes.status === 200, 'Employee can fetch reports overview (200)');
    const empData = empReportRes.body;
    assert(empData?.metadata?.scope === 'EMPLOYEE', 'Employee scope is strictly EMPLOYEE');
    assert(empData?.metadata?.scopeLabel?.includes('Personal Custody'), 'Scope label indicates personal custody');

    // Employee resource count reflects only their custody
    assert(empData?.overview?.totalResources <= mgrData?.overview?.totalResources, 'Employee resource count is subset of department resources');

    // Employee custody by employee contains only the employee themselves
    const empCustodyList = empData?.custody?.byEmployee || [];
    const haileOnly = empCustodyList.every((e: any) => e.employeeName?.includes('Haile'));
    assert(haileOnly, 'Employee custody report does not leak colleagues custody data');

    // 6. Store Keeper & IT Technician Scope
    console.log('\n--- 6. Store Keeper & IT Technician Scopes ---');
    const storeReportRes = await request('GET', '/api/reports/overview', { cookie: storeKeeperCookie });
    assert(storeReportRes.status === 200, 'Store Keeper can fetch reports overview (200)');
    assert(storeReportRes.body?.metadata?.scope === 'STORE', 'Store Keeper scope is STORE');
    assert(storeReportRes.body?.custody?.totalUnassigned >= 0, 'Store Keeper sees inventory storage counts');

    const techReportRes = await request('GET', '/api/reports/overview', { cookie: techCookie });
    assert(techReportRes.status === 200, 'IT Technician can fetch reports overview (200)');
    assert(techReportRes.body?.metadata?.scope === 'TECHNICAL', 'IT Technician scope is TECHNICAL');
    assert(techReportRes.body?.maintenance?.byStatus?.total >= 0, 'IT Technician sees maintenance work orders');

    // 7. Filtering Capabilities
    console.log('\n--- 7. Filters: Category, Status, Maintenance Status, and Date ---');
    // Filter by Category: VEHICLES
    const vehicleFilterRes = await request('GET', '/api/reports/overview?category=VEHICLES', { cookie: adminCookie });
    assert(vehicleFilterRes.status === 200, 'Filter by category=VEHICLES returns 200');
    const vehCats = vehicleFilterRes.body?.distribution?.byCategory || [];
    const allVehicles = vehCats.every((c: any) => c.category === 'VEHICLES');
    assert(allVehicles, 'Category filter results contain ONLY category VEHICLES');

    // Filter by Status: AVAILABLE
    const availFilterRes = await request('GET', '/api/reports/overview?status=AVAILABLE', { cookie: adminCookie });
    assert(availFilterRes.status === 200, 'Filter by status=AVAILABLE returns 200');
    assert(availFilterRes.body?.overview?.assigned === 0, 'Status=AVAILABLE filter has 0 assigned in overview');
    assert(availFilterRes.body?.overview?.underMaintenance === 0, 'Status=AVAILABLE filter has 0 maintenance in overview');
    assert(
      availFilterRes.body?.overview?.available === availFilterRes.body?.overview?.totalResources,
      'Status=AVAILABLE matches total filtered resources'
    );

    // Filter by Maintenance Status: COMPLETED
    const completedMaintRes = await request('GET', '/api/reports/overview?maintenanceStatus=COMPLETED', { cookie: adminCookie });
    assert(completedMaintRes.status === 200, 'Filter by maintenanceStatus=COMPLETED returns 200');
    const mStatus = completedMaintRes.body?.maintenance?.byStatus;
    assert(mStatus?.SUBMITTED === 0, 'Completed maintenance filter has 0 SUBMITTED');
    assert(mStatus?.APPROVED === 0, 'Completed maintenance filter has 0 APPROVED');

    // Date Range Filter
    const dateRangeRes = await request('GET', '/api/reports/overview?startDate=2020-01-01&endDate=2030-12-31', { cookie: adminCookie });
    assert(dateRangeRes.status === 200, 'Date range filter (2020 to 2030) returns 200');
    assert(dateRangeRes.body?.metadata?.filtersApplied?.startDate === '2020-01-01', 'FiltersApplied records startDate');
    assert(dateRangeRes.body?.metadata?.filtersApplied?.endDate === '2030-12-31', 'FiltersApplied records endDate');

    // 8. Empty Dataset & Missing Financials Handling
    console.log('\n--- 8. Empty Dataset & Robustness ---');
    const emptyFilterRes = await request('GET', '/api/reports/overview?category=NON_EXISTENT_CAT_XYZ', { cookie: adminCookie });
    assert(emptyFilterRes.status === 200, 'Empty filter result returns 200 without throwing');
    const emptyData = emptyFilterRes.body;
    assert(emptyData?.overview?.totalResources === 0, 'Empty filter total resources is 0');
    assert(emptyData?.overview?.totalPurchaseCostETB === 0, 'Empty filter total purchase cost is 0 ETB');
    assert(emptyData?.overview?.totalCurrentValueETB === 0, 'Empty filter total current value is 0 ETB');
    assert(Array.isArray(emptyData?.distribution?.byCategory) && emptyData.distribution.byCategory.length === 0, 'Empty category distribution is empty array');
    assert(Array.isArray(emptyData?.recentActivities), 'Empty recent activities is empty array');

    // 9. Phase 2: Detailed Audit Trail Exploration & Search
    console.log('\n--- 9. Detailed Audit Trail Exploration & Role Boundaries ---');
    const auditRes = await request('GET', '/api/reports/audit?page=1&limit=10', { cookie: adminCookie });
    assert(auditRes.status === 200, 'Admin can fetch audit trail (200)');
    assert(Array.isArray(auditRes.body?.events), 'Audit response contains events array');
    assert(auditRes.body?.pagination?.total >= 1, 'Audit records exist in database');
    assert(auditRes.body?.pagination?.page === 1, 'Pagination page is 1');
    assert(auditRes.body?.pagination?.limit === 10, 'Pagination limit is 10');

    // Filter by actionType
    const actionAuditRes = await request('GET', '/api/reports/audit?actionType=RESOURCE_REGISTERED', { cookie: adminCookie });
    assert(actionAuditRes.status === 200, 'Filter audit by actionType returns 200');
    const allRegistered = (actionAuditRes.body?.events || []).every((e: any) => e.actionType === 'RESOURCE_REGISTERED');
    assert(allRegistered, 'All filtered events match RESOURCE_REGISTERED');

    // Search by keyword
    const searchAuditRes = await request('GET', '/api/reports/audit?search=EEC', { cookie: adminCookie });
    assert(searchAuditRes.status === 200, 'Search audit by keyword returns 200');

    // Department boundary check for audit
    const mgrAuditRes = await request('GET', '/api/reports/audit', { cookie: managerCookie });
    assert(mgrAuditRes.status === 200, 'Department Manager can query audit trail (200)');
    const mgrEvents = mgrAuditRes.body?.events || [];
    const allInDept = mgrEvents.every((e: any) => !e.departmentId || e.departmentId === 'dept-101');
    assert(allInDept, 'Manager sees only events within assigned department (dept-101)');

    const mgrForeignAuditRes = await request('GET', '/api/reports/audit?departmentId=dept-102', { cookie: managerCookie });
    assert(mgrForeignAuditRes.status === 403, 'Manager blocked with 403 when requesting foreign department audit');

    // Employee boundary check
    const empAuditRes = await request('GET', '/api/reports/audit', { cookie: employeeCookie });
    assert(empAuditRes.status === 200, 'Employee can query audit trail (200)');

    // 10. Phase 2: Audit Exports (CSV and PDF)
    console.log('\n--- 10. Audit Exports (CSV & PDF) ---');
    const csvRes = await request('GET', '/api/reports/audit/export/csv', { cookie: adminCookie });
    assert(csvRes.status === 200, 'Admin can export audit trail to CSV (200)');
    const contentType = csvRes.headers['content-type'] || '';
    assert(contentType.includes('text/csv'), 'CSV Content-Type is text/csv');
    const disposition = csvRes.headers['content-disposition'] || '';
    assert(disposition.includes('attachment; filename='), 'Content-Disposition specifies attachment filename');
    assert(typeof csvRes.body === 'string' && csvRes.body.includes('Action Type') && csvRes.body.includes('Reference ID'), 'CSV contains header columns');

    const pdfRes = await request('GET', '/api/reports/audit/export/pdf', { cookie: adminCookie });
    assert(pdfRes.status === 200, 'Admin can export audit trail to PDF (200)');
    const pdfContentType = pdfRes.headers['content-type'] || '';
    assert(pdfContentType.includes('application/pdf'), 'PDF Content-Type is application/pdf');
    const pdfDisposition = pdfRes.headers['content-disposition'] || '';
    assert(pdfDisposition.includes('attachment; filename='), 'PDF Content-Disposition specifies attachment filename');
    // Check raw binary output starts with %PDF-1.4
    const pdfRaw = typeof pdfRes.body === 'string' ? pdfRes.body : '';
    assert(pdfRaw.startsWith('%PDF-1.4'), 'Generated PDF begins with %PDF-1.4 magic bytes');

    // Manager export foreign department blocked with 403
    const mgrExportForeignRes = await request('GET', '/api/reports/audit/export/csv?departmentId=dept-102', { cookie: managerCookie });
    assert(mgrExportForeignRes.status === 403, 'Manager blocked with 403 from exporting foreign department CSV');

    // 11. Phase 2: Resource Lifecycle History & Dossier PDF Export
    console.log('\n--- 11. Resource Lifecycle History & Dossier PDF Export ---');
    // Find an existing resource in dept-101 and one in another department
    const dept101Resource = await prisma.resource.findFirst({
      where: { departmentId: 'dept-101' },
      include: { currentAssignee: true },
    });
    const dept102Resource = await prisma.resource.findFirst({
      where: { departmentId: 'dept-102' },
    });

    if (dept101Resource) {
      // Admin query lifecycle
      const adminLifecycleRes = await request('GET', `/api/reports/lifecycle/${dept101Resource.id}`, { cookie: adminCookie });
      assert(adminLifecycleRes.status === 200, 'Admin can fetch resource lifecycle history (200)');
      assert(adminLifecycleRes.body?.resource?.itemCode === dept101Resource.itemCode, 'Lifecycle resource details match item code');
      assert(Array.isArray(adminLifecycleRes.body?.events), 'Lifecycle events is array');
      assert(adminLifecycleRes.body?.events.length >= 1, 'Lifecycle contains at least 1 chronological event');

      // Department Manager query lifecycle for own department resource
      const mgrLifecycleRes = await request('GET', `/api/reports/lifecycle/${dept101Resource.id}`, { cookie: managerCookie });
      assert(mgrLifecycleRes.status === 200, 'Manager can fetch lifecycle for own department resource (200)');

      // Admin export lifecycle dossier as PDF
      const dossierPdfRes = await request('GET', `/api/reports/lifecycle/${dept101Resource.id}/export/pdf`, { cookie: adminCookie });
      assert(dossierPdfRes.status === 200, 'Admin can export lifecycle dossier as PDF (200)');
      assert((dossierPdfRes.headers['content-type'] || '').includes('application/pdf'), 'Lifecycle PDF has application/pdf Content-Type');
      const dossierRaw = typeof dossierPdfRes.body === 'string' ? dossierPdfRes.body : '';
      assert(dossierRaw.startsWith('%PDF-1.4'), 'Lifecycle PDF begins with %PDF-1.4');
    }

    if (dept102Resource) {
      // Department Manager query foreign department resource lifecycle -> 403
      const mgrForeignLifecycleRes = await request('GET', `/api/reports/lifecycle/${dept102Resource.id}`, { cookie: managerCookie });
      assert(mgrForeignLifecycleRes.status === 403, 'Manager blocked with 403 from foreign department resource lifecycle');

      // Employee query resource they never held -> 403
      const empForeignLifecycleRes = await request('GET', `/api/reports/lifecycle/${dept102Resource.id}`, { cookie: employeeCookie });
      assert(empForeignLifecycleRes.status === 403, 'Employee blocked with 403 on resource with no custody history');
    }

    // 12. Fix Verification: Deliberately Long Values, Readability, No Truncation, Multi-page Wrapping, and Excel Export
    console.log('\n--- 12. Deliberately Long Values, Readability & Excel Export ---');

    // Create a test audit event with deliberately long resource name, actor name, and description
    const longResourceName = 'Caterpillar 349D2 Hydraulic Excavator with Reinforced Heavy Duty Steel Arm and Auxiliary Breaker Valve System';
    const longActorName = 'Lead Technical Specialist Dr. Woldeyesus Hailemariam Gebremichael';
    const longDescription = 'Comprehensive 5000-hour major overhaul completed: Overhauled high-pressure hydraulic pumps, replaced boom cylinder oil seals, calibrated electronic throttle control unit to prevent engine stalling under peak load, and certified hydraulic pressure relief valve at 350 bar.';

    const longAuditEvent = await prisma.auditEvent.create({
      data: {
        actionType: 'MAINTENANCE_COMPLETED',
        resourceName: longResourceName,
        resourceCode: 'EEC-EXC-LONG-099',
        resourceCategory: 'HEAVY_MACHINERY',
        departmentId: 'dept-101',
        actorName: longActorName,
        actorRole: 'IT_TECHNICIAN',
        referenceId: 'MR-LONG-2026-999',
        details: longDescription,
        timestamp: new Date(),
      },
    });

    // 12.1. Test CSV Export preserves complete original values without truncation
    const longCsvRes = await request('GET', '/api/reports/audit/export/csv?search=EEC-EXC-LONG-099', { cookie: adminCookie });
    assert(longCsvRes.status === 200, 'Admin can export filtered long event to CSV (200)');
    const csvContent = typeof longCsvRes.body === 'string' ? longCsvRes.body : '';
    assert(csvContent.startsWith('\uFEFF'), 'CSV retains UTF-8 BOM indicator');
    assert(csvContent.includes(longResourceName), 'CSV contains full, untruncated long resource name');
    assert(csvContent.includes(longActorName), 'CSV contains full, untruncated long actor name');
    assert(csvContent.includes(longDescription), 'CSV contains full, untruncated long description');
    assert(!csvContent.includes('Caterpillar 349D2 Hydraulic Excavator with...'), 'CSV does not truncate resource name with ...');

    // 12.2. Test PDF Export preserves full content with multi-line wrapping and no truncation
    const longPdfRes = await request('GET', '/api/reports/audit/export/pdf?search=EEC-EXC-LONG-099', { cookie: adminCookie });
    assert(longPdfRes.status === 200, 'Admin can export filtered long event to PDF (200)');
    const pdfRawText = typeof longPdfRes.body === 'string' ? longPdfRes.body : '';
    assert(pdfRawText.startsWith('%PDF-1.4'), 'Long event PDF starts with %PDF-1.4');
    // Ensure words from the start, middle, and end of the long texts are all present (proving no truncation)
    assert(pdfRawText.includes('Caterpillar 349D2') && pdfRawText.includes('Breaker Valve System'), 'PDF contains full resource name across wrapped lines');
    assert(pdfRawText.includes('Woldeyesus') && pdfRawText.includes('Gebremichael'), 'PDF contains full actor name without truncation');
    assert(pdfRawText.includes('5000-hour') && pdfRawText.includes('350 bar'), 'PDF contains full description without truncation');
    assert(!pdfRawText.includes('...'), 'PDF table rows do not truncate text with ellipsis');

    // 12.3. Test Native Excel (.xlsx) Export
    const xlsxRes = await request('GET', '/api/reports/audit/export/xlsx', { cookie: adminCookie });
    assert(xlsxRes.status === 200, 'Admin can export audit trail to native Excel XLSX (200)');
    const xlsxContentType = xlsxRes.headers['content-type'] || '';
    assert(xlsxContentType.includes('spreadsheetml.sheet'), 'Excel Content-Type is spreadsheetml.sheet');
    const xlsxDisposition = xlsxRes.headers['content-disposition'] || '';
    assert(xlsxDisposition.includes('.xlsx'), 'Content-Disposition specifies .xlsx filename');
    // Check raw binary output starts with PK (0x50 0x4B)
    const xlsxRaw = typeof xlsxRes.body === 'string' ? xlsxRes.body : '';
    assert(xlsxRaw.startsWith('PK'), 'Generated Excel XLSX starts with valid PKZIP signature');

    // Filter verification on XLSX export
    const filteredXlsxRes = await request('GET', '/api/reports/audit/export/xlsx?search=EEC-EXC-LONG-099', { cookie: adminCookie });
    assert(filteredXlsxRes.status === 200, 'Filtered Excel export returns 200');
    assert(typeof filteredXlsxRes.body === 'string' && filteredXlsxRes.body.startsWith('PK'), 'Filtered Excel export is valid ZIP workbook');

    // 12.4. Role Scoping on Excel XLSX Export
    const mgrForeignXlsxRes = await request('GET', '/api/reports/audit/export/xlsx?departmentId=dept-102', { cookie: managerCookie });
    assert(mgrForeignXlsxRes.status === 403, 'Manager blocked with 403 from exporting foreign department XLSX');

    // 12.5. Root Cause Verification: Fix Blank First PDF Page & Multi-Page Pagination
    console.log('\n--- 13. Blank First Page Fix & Multi-Page PDF Verification ---');

    // 13.1. Short Report: Exactly 1 page, starts immediately on Page 1 (no blank page)
    const shortPdfRes = await request('GET', '/api/reports/audit/export/pdf?search=EEC-EXC-LONG-099', { cookie: adminCookie });
    assert(shortPdfRes.status === 200, 'Short PDF export returns 200');
    const shortPdfRaw = typeof shortPdfRes.body === 'string' ? shortPdfRes.body : '';
    const shortPagesCount = (shortPdfRaw.match(/\/Type \/Page\b/g) || []).length;
    assert(shortPagesCount === 1, 'Short PDF has exactly 1 page (no blank first page)');
    const shortCountMatch = shortPdfRaw.match(/\/Count (\d+)/);
    assert(shortCountMatch?.[1] === '1', 'PDF catalog /Count indicates exactly 1 page');
    
    // Extract first stream content
    const shortStreams = [...shortPdfRaw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)];
    assert(shortStreams.length === 1, 'Short PDF contains exactly 1 content stream');
    const page1Stream = shortStreams[0]?.[1] || '';
    assert(page1Stream.includes('RESOURCE AUDIT TRAIL REPORT'), 'Page 1 contains document title');
    assert(page1Stream.includes('Corporate Audit Trail'), 'Page 1 contains header block');
    assert(page1Stream.includes('OPERATIONAL DETAILS'), 'Page 1 contains table header');
    assert(page1Stream.includes('Caterpillar 349D2'), 'Page 1 contains table data rows');
    assert(page1Stream.length > 2000, 'Page 1 stream contains full content (not a 240-byte empty stub)');

    // 13.2. Multi-Page Report: Create enough events to guarantee multi-page generation
    const batchEventsData = Array.from({ length: 35 }, (_, idx) => ({
      actionType: idx % 2 === 0 ? 'RESOURCE_ASSIGNED' : 'MAINTENANCE_PROGRESS',
      resourceName: `Distribution Transformer 33kV Phase #${idx + 1}`,
      resourceCode: `EEC-TRF-PAGE-${String(idx).padStart(3, '0')}`,
      resourceCategory: 'ELECTRICAL_INFRASTRUCTURE',
      departmentId: 'dept-101',
      actorName: `Field Maintenance Officer #${idx + 1}`,
      actorRole: 'STORE_KEEPER',
      referenceId: `PAGE-TEST-${String(idx).padStart(4, '0')}`,
      details: `Periodic oil breakdown voltage test and bushing inspection completed successfully for transformer #${idx + 1}.`,
      timestamp: new Date(),
    }));

    await prisma.auditEvent.createMany({ data: batchEventsData });

    const multiPagePdfRes = await request('GET', '/api/reports/audit/export/pdf?search=PAGE-TEST-', { cookie: adminCookie });
    assert(multiPagePdfRes.status === 200, 'Multi-page PDF export returns 200');
    const multiPdfRaw = typeof multiPagePdfRes.body === 'string' ? multiPagePdfRes.body : '';
    const multiPagesCount = (multiPdfRaw.match(/\/Type \/Page\b/g) || []).length;
    assert(multiPagesCount >= 2, `Multi-page PDF generated ${multiPagesCount} pages (>= 2)`);

    const multiStreams = [...multiPdfRaw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)];
    assert(multiStreams.length === multiPagesCount, 'Stream count matches page count');

    // Page 1 contains title, metadata, table header, and data
    const mPage1 = multiStreams[0]?.[1] || '';
    assert(mPage1.includes('RESOURCE AUDIT TRAIL REPORT'), 'Multi-page Page 1 contains document title');
    assert(mPage1.includes('OPERATIONAL DETAILS'), 'Multi-page Page 1 contains table header');
    assert(mPage1.includes('Distribution Transformer'), 'Multi-page Page 1 contains table rows');

    // Page 2 contains repeated table header
    const mPage2 = multiStreams[1]?.[1] || '';
    assert(mPage2.includes('OPERATIONAL DETAILS'), 'Multi-page Page 2 has repeated table header');
    assert(mPage2.includes('Distribution Transformer'), 'Multi-page Page 2 continues table rows');

    // Clean up created batch test events
    await prisma.auditEvent.deleteMany({
      where: { referenceId: { startsWith: 'PAGE-TEST-' } },
    });

    // Clean up test audit event
    await prisma.auditEvent.delete({ where: { id: longAuditEvent.id } });

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
