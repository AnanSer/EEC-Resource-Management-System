import http from 'node:http';
import { AddressInfo } from 'node:net';
import prisma from '../src/lib/prisma.js';
import {
  createNotification,
  createNotifications,
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  validateNotificationAttributes,
  NotificationServiceError,
} from '../src/notifications/notification.service.js';

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
  console.log('EEC RMS: Notification Service & API Integration Tests');
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

  const createdNotificationIds: string[] = [];
  const cleanupUserIds: string[] = [];
  const cleanupReqIds: string[] = [];
  const cleanupMntIds: string[] = [];
  const cleanupAsgnIds: string[] = [];

  try {
    // 1. Unauthenticated Security Boundaries
    console.log('\n--- 1. Unauthenticated Security Boundaries ---');
    const unauthGet = await request('GET', '/api/notifications');
    assert(unauthGet.status === 401, 'GET /api/notifications without session cookie returns 401');

    const unauthCount = await request('GET', '/api/notifications/unread-count');
    assert(unauthCount.status === 401, 'GET /api/notifications/unread-count without session returns 401');

    const unauthRead = await request('PATCH', '/api/notifications/some-id/read');
    assert(unauthRead.status === 401, 'PATCH /api/notifications/:id/read without session returns 401');

    const unauthReadAll = await request('PATCH', '/api/notifications/read-all');
    assert(unauthReadAll.status === 401, 'PATCH /api/notifications/read-all without session returns 401');

    const unauthDelete = await request('DELETE', '/api/notifications/some-id');
    assert(unauthDelete.status === 401, 'DELETE /api/notifications/:id without session returns 401');

    // 2. User Authentication & ID Resolution
    console.log('\n--- 2. Authenticating System Roles ---');
    const adminCookie = await loginUser('admin@eec.gov.et');
    assert(!!adminCookie, 'Admin session established');

    const managerCookie = await loginUser('manager@eec.gov.et');
    assert(!!managerCookie, 'Department Manager session established');

    const employeeCookie = await loginUser('employee@eec.gov.et');
    assert(!!employeeCookie, 'Employee session established');

    const storeKeeperCookie = await loginUser('storekeeper@eec.gov.et');
    assert(!!storeKeeperCookie, 'Store Keeper session established');

    const techCookie = await loginUser('technician@eec.gov.et');
    assert(!!techCookie, 'IT Technician session established');

    const adminUser = await prisma.user.findUnique({ where: { email: 'admin@eec.gov.et' } });
    const employeeUser = await prisma.user.findUnique({ where: { email: 'employee@eec.gov.et' } });
    const storeKeeperUser = await prisma.user.findUnique({ where: { email: 'storekeeper@eec.gov.et' } });
    const techUser = await prisma.user.findUnique({ where: { email: 'technician@eec.gov.et' } });
    const managerUser = await prisma.user.findUnique({ where: { email: 'manager@eec.gov.et' } });

    assert(!!adminUser && !!employeeUser && !!storeKeeperUser && !!techUser && !!managerUser, 'All system users resolved');

    const adminId = adminUser!.id;
    const employeeId = employeeUser!.id;
    const storeKeeperId = storeKeeperUser!.id;
    const techId = techUser!.id;
    const managerId = managerUser!.id;

    // 3. Notification Service Unit Logic: Validation
    console.log('\n--- 3. Notification Service Validation ---');
    let validationCaught = false;
    try {
      validateNotificationAttributes('INVALID_TYPE', 'NORMAL');
    } catch (e: any) {
      validationCaught = e instanceof NotificationServiceError && e.code === 'INVALID_TYPE';
    }
    assert(validationCaught, 'validateNotificationAttributes rejects unsupported notification type');

    let priorityCaught = false;
    try {
      validateNotificationAttributes('INFO', 'ULTRA_HIGH');
    } catch (e: any) {
      priorityCaught = e instanceof NotificationServiceError && e.code === 'INVALID_PRIORITY';
    }
    assert(priorityCaught, 'validateNotificationAttributes rejects unsupported notification priority');

    const validNorm = validateNotificationAttributes('requisition', 'high');
    assert(
      validNorm.normalizedType === 'REQUISITION' && validNorm.normalizedPriority === 'HIGH',
      'validateNotificationAttributes normalizes supported lowercase types and priorities'
    );

    // 4. Notification Creation & Direct Retrieval
    console.log('\n--- 4. Notification Creation & Batch Delivery ---');
    const notifAdmin1 = await createNotification({
      recipientId: adminId,
      title: 'Admin Work Order Alert',
      message: 'New critical equipment requires review',
      type: 'MAINTENANCE',
      priority: 'HIGH',
      actionUrl: '/maintenance',
      relatedEntityType: 'MAINTENANCE_REQUEST',
      relatedEntityId: 'req-test-01',
    });
    createdNotificationIds.push(notifAdmin1.id);
    assert(notifAdmin1.isRead === false, 'Created notification has isRead = false');
    assert(notifAdmin1.priority === 'HIGH', 'Created notification has priority HIGH');
    assert(notifAdmin1.type === 'MAINTENANCE', 'Created notification has type MAINTENANCE');

    const notifAdmin2 = await createNotification({
      recipientId: adminId,
      title: 'Admin Notice 2',
      message: 'Second notification for admin',
      type: 'INFO',
      priority: 'LOW',
    });
    createdNotificationIds.push(notifAdmin2.id);

    // Batch notification
    const batchCreated = await createNotifications([adminId, employeeId], {
      title: 'Corporation System Update',
      message: 'Scheduled downtime announcement',
      type: 'SYSTEM',
      priority: 'NORMAL',
    });
    batchCreated.forEach((n: any) => createdNotificationIds.push(n.id));
    assert(batchCreated.length === 2, 'Batch createNotifications created 2 notifications');

    // 5. Unread Count Accuracy
    console.log('\n--- 5. Unread Count Accuracy ---');
    const adminUnreadService = await getUnreadCount(adminId);
    assert(adminUnreadService >= 3, `Admin unread count is >= 3 (actual: ${adminUnreadService})`);

    const countRes = await request('GET', '/api/notifications/unread-count', { cookie: adminCookie });
    assert(countRes.status === 200, 'GET /api/notifications/unread-count returns 200');
    assert(countRes.body.unreadCount === adminUnreadService, 'API unread count matches service count');

    const empCountRes = await request('GET', '/api/notifications/unread-count', { cookie: employeeCookie });
    assert(empCountRes.status === 200, 'Employee GET unread-count returns 200');
    assert(empCountRes.body.unreadCount >= 1, 'Employee has unread count >= 1');

    // 6. Pagination & Filtering
    console.log('\n--- 6. Pagination & Filtering ---');
    const listRes = await request('GET', '/api/notifications?page=1&limit=2', { cookie: adminCookie });
    assert(listRes.status === 200, 'GET /api/notifications with page & limit returns 200');
    assert(listRes.body.data.length === 2, 'Limit 2 restricts page items to 2');
    assert(listRes.body.pagination.page === 1, 'Pagination page is 1');
    assert(listRes.body.pagination.limit === 2, 'Pagination limit is 2');
    assert(listRes.body.pagination.total >= 3, 'Pagination total reflects actual records');

    const filterTypeRes = await request('GET', '/api/notifications?type=MAINTENANCE', { cookie: adminCookie });
    assert(filterTypeRes.status === 200, 'GET /api/notifications?type=MAINTENANCE returns 200');
    assert(
      filterTypeRes.body.data.every((n: any) => n.type === 'MAINTENANCE'),
      'Filtered notifications match type MAINTENANCE'
    );

    // 7. Mark One Notification as Read
    console.log('\n--- 7. Mark Single Notification as Read ---');
    const markReadRes = await request('PATCH', `/api/notifications/${notifAdmin1.id}/read`, { cookie: adminCookie });
    assert(markReadRes.status === 200, 'PATCH /api/notifications/:id/read returns 200');
    assert(markReadRes.body.data.isRead === true, 'Updated notification has isRead = true');
    assert(!!markReadRes.body.data.readAt, 'Updated notification has non-null readAt timestamp');

    const updatedAdminCount = await getUnreadCount(adminId);
    assert(updatedAdminCount === adminUnreadService - 1, 'Unread count decremented by 1');

    // 8. Security & User Isolation
    console.log('\n--- 8. Security & User Isolation ---');
    const empUnauthorizedRead = await request('PATCH', `/api/notifications/${notifAdmin1.id}/read`, {
      cookie: employeeCookie,
    });
    assert(
      empUnauthorizedRead.status === 403,
      'Employee forbidden (403) from marking Admin notification as read'
    );

    const empUnauthorizedDelete = await request('DELETE', `/api/notifications/${notifAdmin1.id}`, {
      cookie: employeeCookie,
    });
    assert(
      empUnauthorizedDelete.status === 403,
      'Employee forbidden (403) from deleting Admin notification'
    );

    const empListRes = await request('GET', '/api/notifications', { cookie: employeeCookie });
    assert(empListRes.status === 200, 'Employee list notifications returns 200');
    assert(
      empListRes.body.data.every((n: any) => n.recipientId === employeeId),
      'Employee receives ONLY notifications where recipientId = employeeId'
    );

    // 9. Mark All Notifications as Read
    console.log('\n--- 9. Mark All Notifications as Read ---');
    const readAllRes = await request('PATCH', '/api/notifications/read-all', { cookie: adminCookie });
    assert(readAllRes.status === 200, 'PATCH /api/notifications/read-all returns 200');
    assert(readAllRes.body.success === true, 'Response indicates success');

    const postReadAllCount = await getUnreadCount(adminId);
    assert(postReadAllCount === 0, 'Admin unread count is now exactly 0');

    // 10. Deleting a Notification
    console.log('\n--- 10. Deleting a Notification ---');
    const deleteRes = await request('DELETE', `/api/notifications/${notifAdmin1.id}`, { cookie: adminCookie });
    assert(deleteRes.status === 200, 'DELETE /api/notifications/:id returns 200');

    const checkDeleted = await prisma.notification.findUnique({ where: { id: notifAdmin1.id } });
    assert(checkDeleted === null, 'Notification record deleted from database');

    const deleteNonExistent = await request('DELETE', '/api/notifications/non-existent-id', { cookie: adminCookie });
    assert(deleteNonExistent.status === 404, 'Deleting non-existent notification returns 404');

    // =========================================================================
    // 11. Real Business Events: Requisition Notifications
    // =========================================================================
    console.log('\n--- 11. Real Business Events: Requisition Lifecycle ---');
    const empPreReqNotifs = await prisma.notification.count({ where: { recipientId: employeeId } });
    const adminPreReqNotifs = await prisma.notification.count({ where: { recipientId: adminId } });
    const storePreReqNotifs = await prisma.notification.count({ where: { recipientId: storeKeeperId } });

    // 11.1 Employee submits a new requisition
    const reqSubmitRes = await request('POST', '/api/requisitions', {
      cookie: employeeCookie,
      body: {
        category: 'IT_EQUIPMENT',
        itemDescription: 'High-performance workstation for geotechnical modeling',
        justification: 'Infrastructure analysis for project EEC-2026',
        urgency: 'HIGH',
      },
    });
    assert(reqSubmitRes.status === 201, 'Employee submitted requisition successfully (201)');
    const reqItem1 = reqSubmitRes.body.requisition;
    cleanupReqIds.push(reqItem1.id);

    // Verify Admin & Store Keeper received notification; Employee did not receive self-alert
    const adminPostSubmitNotif = await prisma.notification.findFirst({
      where: {
        recipientId: adminId,
        type: 'REQUISITION',
        relatedEntityId: reqItem1.id,
      },
      orderBy: { createdAt: 'desc' },
    });
    assert(!!adminPostSubmitNotif, 'Admin received New Requisition notification');
    if (adminPostSubmitNotif) createdNotificationIds.push(adminPostSubmitNotif.id);

    const storePostSubmitNotif = await prisma.notification.findFirst({
      where: {
        recipientId: storeKeeperId,
        type: 'REQUISITION',
        relatedEntityId: reqItem1.id,
      },
      orderBy: { createdAt: 'desc' },
    });
    assert(!!storePostSubmitNotif, 'Store Keeper received New Requisition notification');
    if (storePostSubmitNotif) createdNotificationIds.push(storePostSubmitNotif.id);

    // 11.2 Admin approves requisition
    const reqApproveRes = await request('POST', `/api/requisitions/${reqItem1.id}/approve`, {
      cookie: adminCookie,
      body: { approvalComments: 'Approved for central procurement' },
    });
    assert(reqApproveRes.status === 200, 'Admin approved requisition (200)');

    // Verify requesting employee received Requisition Approved notification
    const empApproveNotif = await prisma.notification.findFirst({
      where: {
        recipientId: employeeId,
        type: 'REQUISITION',
        title: { contains: 'Requisition Approved' },
        relatedEntityId: reqItem1.id,
      },
      orderBy: { createdAt: 'desc' },
    });
    assert(!!empApproveNotif, 'Requesting employee received Requisition Approved notification');
    if (empApproveNotif) createdNotificationIds.push(empApproveNotif.id);

    // 11.3 Rejection test
    const reqSubmitRes2 = await request('POST', '/api/requisitions', {
      cookie: employeeCookie,
      body: {
        category: 'VEHICLES',
        itemDescription: 'Secondary field vehicle for routine transport',
        justification: 'Additional mobility',
        urgency: 'ROUTINE',
      },
    });
    const reqItem2 = reqSubmitRes2.body.requisition;
    cleanupReqIds.push(reqItem2.id);

    const reqRejectRes = await request('POST', `/api/requisitions/${reqItem2.id}/reject`, {
      cookie: adminCookie,
      body: { reason: 'Fleet quota reached for current fiscal cycle' },
    });
    assert(reqRejectRes.status === 200, 'Admin rejected requisition (200)');

    const empRejectNotif = await prisma.notification.findFirst({
      where: {
        recipientId: employeeId,
        type: 'REQUISITION',
        title: { contains: 'Requisition Rejected' },
        relatedEntityId: reqItem2.id,
      },
      orderBy: { createdAt: 'desc' },
    });
    assert(!!empRejectNotif, 'Requesting employee received Requisition Rejected notification');
    if (empRejectNotif) createdNotificationIds.push(empRejectNotif.id);

    // =========================================================================
    // 12. Real Business Events: Assignment, Transfer & Return
    // =========================================================================
    console.log('\n--- 12. Real Business Events: Asset Custody Lifecycle ---');
    // Find an available resource
    let testResource = await prisma.resource.findFirst({
      where: { status: 'AVAILABLE' },
    });

    if (!testResource) {
      testResource = await prisma.resource.create({
        data: {
          itemCode: `TEST-RES-${Date.now()}`,
          name: 'Dell Precision Mobile Workstation 7780',
          category: 'IT_EQUIPMENT',
          status: 'AVAILABLE',
          condition: 'EXCELLENT',
          departmentId: employeeUser!.departmentId || 'dept-101',
        },
      });
    }

    const employeeRecord = await prisma.employee.findFirst({
      where: { userId: employeeId },
    });

    // 12.1 Direct Assignment
    const asgnRes = await request('POST', '/api/assignments', {
      cookie: adminCookie,
      body: {
        resourceId: testResource.id,
        employeeId: employeeRecord!.id,
        purpose: 'Engineering design and GIS processing',
      },
    });
    assert(asgnRes.status === 201, 'Direct assignment created (201)');
    const assignmentRecord = asgnRes.body.assignment;
    cleanupAsgnIds.push(assignmentRecord.id);

    // Verify receiving employee received Asset Assigned notification
    const empAsgnNotif = await prisma.notification.findFirst({
      where: {
        recipientId: employeeId,
        type: 'ASSIGNMENT',
        relatedEntityId: testResource.id,
      },
      orderBy: { createdAt: 'desc' },
    });
    assert(!!empAsgnNotif, 'Receiving employee received Asset Assigned notification');
    if (empAsgnNotif) createdNotificationIds.push(empAsgnNotif.id);

    // 12.2 Custody Return
    const returnRes = await request('POST', '/api/assignments/return', {
      cookie: storeKeeperCookie,
      body: {
        resourceId: testResource.id,
        condition: 'GOOD',
        returnLocation: 'Central Store - Kersa',
      },
    });
    assert(returnRes.status === 200, 'Resource returned to store (200)');

    // Verify Store Keeper & Custodian received Return notification
    const storeReturnNotif = await prisma.notification.findFirst({
      where: {
        recipientId: storeKeeperId,
        type: 'ASSIGNMENT',
        title: { contains: 'Resource Returned' },
        relatedEntityId: testResource.id,
      },
      orderBy: { createdAt: 'desc' },
    });
    assert(!!storeReturnNotif, 'Store Keeper received Resource Returned notification');
    if (storeReturnNotif) createdNotificationIds.push(storeReturnNotif.id);

    // =========================================================================
    // 13. Real Business Events: Maintenance Lifecycle
    // =========================================================================
    console.log('\n--- 13. Real Business Events: Maintenance Lifecycle ---');
    // First assign resource to employee so employee has custody to report fault
    const asgnRes2 = await request('POST', '/api/assignments', {
      cookie: adminCookie,
      body: {
        resourceId: testResource.id,
        employeeId: employeeRecord!.id,
        purpose: 'Field surveying deployment',
      },
    });
    assert(asgnRes2.status === 201, 'Resource assigned for maintenance testing (201)');
    cleanupAsgnIds.push(asgnRes2.body.assignment.id);

    // 13.1 Employee reports fault
    const faultRes = await request('POST', '/api/maintenance', {
      cookie: employeeCookie,
      body: {
        resourceId: testResource.id,
        title: 'Screen flickering and battery overheating',
        description: 'Device shuts down abruptly when running CAD simulations in the field.',
        priority: 'HIGH',
      },
    });
    assert(faultRes.status === 201, 'Fault report submitted successfully (201)');
    const mntRequest = faultRes.body.request;
    cleanupMntIds.push(mntRequest.id);

    // Verify IT Technician, Admin, and Department Manager received notifications
    const techMntNotif = await prisma.notification.findFirst({
      where: {
        recipientId: techId,
        type: 'MAINTENANCE',
        relatedEntityId: mntRequest.id,
      },
      orderBy: { createdAt: 'desc' },
    });
    assert(!!techMntNotif, 'IT Technician received Maintenance Fault Reported alert');
    if (techMntNotif) createdNotificationIds.push(techMntNotif.id);

    const adminMntNotif = await prisma.notification.findFirst({
      where: {
        recipientId: adminId,
        type: 'MAINTENANCE',
        relatedEntityId: mntRequest.id,
      },
      orderBy: { createdAt: 'desc' },
    });
    assert(!!adminMntNotif, 'Admin received Maintenance Fault Reported alert');
    if (adminMntNotif) createdNotificationIds.push(adminMntNotif.id);

    // 13.2 Admin approves maintenance
    const reviewRes = await request('POST', `/api/maintenance/${mntRequest.id}/review`, {
      cookie: adminCookie,
      body: {
        action: 'APPROVE',
        comments: 'Authorized for hardware diagnostics and battery replacement',
        assignedTechnicianId: techId,
      },
    });
    assert(reviewRes.status === 200, 'Maintenance request approved (200)');

    const empMntApproveNotif = await prisma.notification.findFirst({
      where: {
        recipientId: employeeId,
        type: 'MAINTENANCE',
        title: { contains: 'Maintenance Approved' },
        relatedEntityId: mntRequest.id,
      },
      orderBy: { createdAt: 'desc' },
    });
    assert(!!empMntApproveNotif, 'Reporter employee received Maintenance Approved notification');
    if (empMntApproveNotif) createdNotificationIds.push(empMntApproveNotif.id);

    // 13.3 Technician starts repair
    const progressStartRes = await request('PUT', `/api/maintenance/${mntRequest.id}/progress`, {
      cookie: techCookie,
      body: {
        status: 'IN_PROGRESS',
        diagnosis: 'Defective power delivery IC and battery degradation',
      },
    });
    assert(progressStartRes.status === 200, 'Work order progressed to IN_PROGRESS (200)');

    const empStartNotif = await prisma.notification.findFirst({
      where: {
        recipientId: employeeId,
        type: 'MAINTENANCE',
        title: { contains: 'Repair Started' },
        relatedEntityId: mntRequest.id,
      },
      orderBy: { createdAt: 'desc' },
    });
    assert(!!empStartNotif, 'Reporter received Repair Started notification');
    if (empStartNotif) createdNotificationIds.push(empStartNotif.id);

    // 13.4 Technician places on hold
    const progressHoldRes = await request('PUT', `/api/maintenance/${mntRequest.id}/progress`, {
      cookie: techCookie,
      body: {
        status: 'ON_HOLD',
        notes: 'Awaiting OEM replacement battery from central logistics',
      },
    });
    assert(progressHoldRes.status === 200, 'Work order progressed to ON_HOLD (200)');

    const empHoldNotif = await prisma.notification.findFirst({
      where: {
        recipientId: employeeId,
        type: 'MAINTENANCE',
        title: { contains: 'Repair On Hold' },
        relatedEntityId: mntRequest.id,
      },
      orderBy: { createdAt: 'desc' },
    });
    assert(!!empHoldNotif, 'Reporter received Repair On Hold notification');
    if (empHoldNotif) createdNotificationIds.push(empHoldNotif.id);

    // 13.5 Technician completes repair
    const progressCompleteRes = await request('PUT', `/api/maintenance/${mntRequest.id}/progress`, {
      cookie: techCookie,
      body: {
        status: 'COMPLETED',
        repairActions: 'Replaced power IC, replaced battery module, tested thermal regulation',
        resolutionNotes: 'Hardware stress testing completed. Temperature is normal.',
        outcome: 'REPAIRED_FIT_FOR_USE',
        actualCostETB: 3500,
      },
    });
    assert(progressCompleteRes.status === 200, 'Work order completed successfully (200)');

    const empCompleteNotif = await prisma.notification.findFirst({
      where: {
        recipientId: employeeId,
        type: 'MAINTENANCE',
        title: { contains: 'Repair Completed' },
        relatedEntityId: mntRequest.id,
      },
      orderBy: { createdAt: 'desc' },
    });
    assert(!!empCompleteNotif, 'Reporter received Repair Completed notification');
    if (empCompleteNotif) createdNotificationIds.push(empCompleteNotif.id);

    // 13.6 QA Inspection
    const inspectRes = await request('POST', `/api/maintenance/${mntRequest.id}/inspections`, {
      cookie: techCookie,
      body: {
        inspectionType: 'MAINTENANCE_QA',
        passed: true,
        findings: 'Hardware diagnostics passed with 100% battery health',
        certificationNumber: 'QA-2026-CERT-099',
      },
    });
    assert(inspectRes.status === 201, 'QA inspection recorded (201)');

    const empInspectNotif = await prisma.notification.findFirst({
      where: {
        recipientId: employeeId,
        type: 'MAINTENANCE',
        title: { contains: 'QA Inspection Passed' },
        relatedEntityId: mntRequest.id,
      },
      orderBy: { createdAt: 'desc' },
    });
    assert(!!empInspectNotif, 'Reporter received QA Inspection notification');
    if (empInspectNotif) createdNotificationIds.push(empInspectNotif.id);

    // =========================================================================
    // 14. Real Business Events: Account Registration, Approval & Suspension
    // =========================================================================
    console.log('\n--- 14. Real Business Events: User Account Lifecycle ---');
    const testApplicantEmail = `applicant.${Date.now()}@eec.gov.et`;

    // 14.1 Public registration
    const regRes = await request('POST', '/api/auth/register', {
      body: {
        fullName: 'Hana Belay',
        email: testApplicantEmail,
        password: 'EEC-Secure2026!',
      },
    });
    assert(regRes.status === 201, 'New applicant registered (201)');
    const newUserId = regRes.body.user.id;
    cleanupUserIds.push(newUserId);

    // Verify Admin received New User Registration notification
    const adminRegNotif = await prisma.notification.findFirst({
      where: {
        recipientId: adminId,
        type: 'USER',
        title: { contains: 'New User Registration' },
        relatedEntityId: newUserId,
      },
      orderBy: { createdAt: 'desc' },
    });
    assert(!!adminRegNotif, 'Admin received New User Registration notification');
    if (adminRegNotif) createdNotificationIds.push(adminRegNotif.id);

    // 14.2 Admin approves applicant
    const approveUserRes = await request('POST', `/api/auth/users/${newUserId}/approve`, {
      cookie: adminCookie,
      body: { role: 'EMPLOYEE' },
    });
    assert(approveUserRes.status === 200, 'Admin approved applicant (200)');

    const applicantApproveNotif = await prisma.notification.findFirst({
      where: {
        recipientId: newUserId,
        type: 'USER',
        title: 'Account Approved',
      },
    });
    assert(!!applicantApproveNotif, 'Applicant received Account Approved notification');
    if (applicantApproveNotif) createdNotificationIds.push(applicantApproveNotif.id);

    // 14.3 Admin suspends user
    const suspendUserRes = await request('POST', `/api/auth/users/${newUserId}/suspend`, {
      cookie: adminCookie,
      body: { reason: 'Security compliance review' },
    });
    assert(suspendUserRes.status === 200, 'Admin suspended user account (200)');

    const userSuspendNotif = await prisma.notification.findFirst({
      where: {
        recipientId: newUserId,
        type: 'USER',
        title: 'Account Suspended',
      },
    });
    assert(!!userSuspendNotif, 'User received Account Suspended notification (CRITICAL)');
    if (userSuspendNotif) createdNotificationIds.push(userSuspendNotif.id);

    // =========================================================================
    // 15. Negative & Robustness Verification: Failed Operations
    // =========================================================================
    console.log('\n--- 15. Negative Verification: Failed Business Operations ---');
    const adminCountBeforeFail = await prisma.notification.count({ where: { recipientId: adminId } });

    // Invalid requisition submission (missing description)
    const failedReq = await request('POST', '/api/requisitions', {
      cookie: employeeCookie,
      body: { category: 'IT_EQUIPMENT' },
    });
    assert(failedReq.status === 400, 'Invalid requisition rejected with 400');

    // Invalid status transition on completed work order
    const failedTransition = await request('PUT', `/api/maintenance/${mntRequest.id}/progress`, {
      cookie: techCookie,
      body: { status: 'IN_PROGRESS' },
    });
    assert(failedTransition.status === 400, 'Transition on completed maintenance rejected with 400');

    const adminCountAfterFail = await prisma.notification.count({ where: { recipientId: adminId } });
    assert(
      adminCountBeforeFail === adminCountAfterFail,
      'Failed operations do NOT generate spurious success notifications'
    );
  } finally {
    // Clean up all created test entities
    if (createdNotificationIds.length > 0) {
      await prisma.notification.deleteMany({
        where: { id: { in: createdNotificationIds } },
      }).catch(() => {});
      console.log(`\nCleaned up ${createdNotificationIds.length} test notifications.`);
    }

    if (cleanupMntIds.length > 0) {
      await prisma.maintenanceInspection.deleteMany({ where: { maintenanceRequestId: { in: cleanupMntIds } } }).catch(() => {});
      await prisma.maintenanceLog.deleteMany({ where: { maintenanceRequestId: { in: cleanupMntIds } } }).catch(() => {});
      await prisma.maintenanceRequest.deleteMany({ where: { id: { in: cleanupMntIds } } }).catch(() => {});
    }

    if (cleanupReqIds.length > 0) {
      await prisma.resourceRequisition.deleteMany({ where: { id: { in: cleanupReqIds } } }).catch(() => {});
    }

    if (cleanupAsgnIds.length > 0) {
      await prisma.resourceAssignment.deleteMany({ where: { id: { in: cleanupAsgnIds } } }).catch(() => {});
    }

    if (cleanupUserIds.length > 0) {
      await prisma.notification.deleteMany({ where: { recipientId: { in: cleanupUserIds } } }).catch(() => {});
      await prisma.session.deleteMany({ where: { userId: { in: cleanupUserIds } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } }).catch(() => {});
    }

    if (testServer) {
      testServer.close();
    }
    await prisma.$disconnect();
  }

  console.log('================================================================');
  console.log(`Tests Completed: ${passed} passed, ${failed} failed.`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
