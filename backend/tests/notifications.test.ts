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
    console.log('\n--- 2. Authenticating Roles ---');
    const adminCookie = await loginUser('admin@eec.gov.et');
    assert(!!adminCookie, 'Admin session established');

    const employeeCookie = await loginUser('employee@eec.gov.et');
    assert(!!employeeCookie, 'Employee session established');

    const adminUser = await prisma.user.findUnique({ where: { email: 'admin@eec.gov.et' } });
    const employeeUser = await prisma.user.findUnique({ where: { email: 'employee@eec.gov.et' } });
    assert(!!adminUser && !!employeeUser, 'Resolved user records from database');

    const adminId = adminUser!.id;
    const employeeId = employeeUser!.id;

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

    // 8. Security & User Isolation: Preventing Access to Another User's Notifications
    console.log('\n--- 8. Security & User Isolation ---');
    // Employee attempting to read Admin's notification
    const empUnauthorizedRead = await request('PATCH', `/api/notifications/${notifAdmin1.id}/read`, {
      cookie: employeeCookie,
    });
    assert(
      empUnauthorizedRead.status === 403,
      'Employee forbidden (403) from marking Admin notification as read'
    );

    // Employee attempting to delete Admin's notification
    const empUnauthorizedDelete = await request('DELETE', `/api/notifications/${notifAdmin1.id}`, {
      cookie: employeeCookie,
    });
    assert(
      empUnauthorizedDelete.status === 403,
      'Employee forbidden (403) from deleting Admin notification'
    );

    // Employee list notifications does NOT leak Admin notifications
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
  } finally {
    // Clean up created test notifications
    if (createdNotificationIds.length > 0) {
      await prisma.notification.deleteMany({
        where: { id: { in: createdNotificationIds } },
      });
      console.log(`\nCleaned up ${createdNotificationIds.length} test notifications.`);
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

