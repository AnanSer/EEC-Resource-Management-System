import http from 'node:http';
import crypto from 'node:crypto';
import { AddressInfo } from 'node:net';
import prisma from '../src/lib/prisma.js';
import { setMailTransporter } from '../src/auth/email.service.js';
import { resetRateLimiter } from '../src/auth/rateLimiter.js';
import { hashPassword } from '../src/auth/password.js';

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
  console.log('EEC RMS: Forgot Password & Password Reset Integration Tests');
  console.log('========================================================================');

  // 1. Mock Nodemailer Setup: Capture outgoing emails in-memory
  const sentEmails: any[] = [];
  const mockTransporter: any = {
    sendMail: async (mailOptions: any) => {
      sentEmails.push(mailOptions);
      return { messageId: 'mock-test-id-' + Date.now() };
    },
  };
  setMailTransporter(mockTransporter);

  // 2. Start HTTP Test Server
  const { server } = await import('../src/index.js');
  await new Promise<void>((resolve) => {
    testServer = server.listen(0, () => {
      const addr = testServer.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      console.log(`Test server listening on ${baseUrl}`);
      resolve();
    });
  });

  const testEmail = 'employee@eec.gov.et';
  let initialPasswordHash = '';

  try {
    // Record original password hash to restore after test
    const initialUser = await prisma.user.findUnique({ where: { email: testEmail } });
    if (!initialUser) {
      throw new Error(`Test user ${testEmail} not found in database.`);
    }
    initialPasswordHash = initialUser.passwordHash;

    // Clean up any existing tokens for test user
    await prisma.passwordResetToken.deleteMany({ where: { userId: initialUser.id } });
    resetRateLimiter();

    // ------------------------------------------------------------------------
    console.log('\n--- 1. Validation of Forgot Password Request ---');
    // ------------------------------------------------------------------------
    const emptyRes = await request('POST', '/api/auth/forgot-password', {
      body: {},
    });
    assert(emptyRes.status === 400, 'Empty email rejected with 400 Bad Request');
    assert(emptyRes.body?.success === false, 'Error response contains success: false');

    const invalidEmailRes = await request('POST', '/api/auth/forgot-password', {
      body: { email: 'not-an-email' },
    });
    assert(invalidEmailRes.status === 400, 'Invalid email format rejected with 400 Bad Request');

    // ------------------------------------------------------------------------
    console.log('\n--- 2. Existing Account Receives Reset Email ---');
    // ------------------------------------------------------------------------
    sentEmails.length = 0;
    const forgotRes = await request('POST', '/api/auth/forgot-password', {
      body: { email: testEmail },
    });
    assert(forgotRes.status === 200, 'POST /api/auth/forgot-password returns 200 OK');
    assert(forgotRes.body?.success === true, 'Response contains success: true');
    assert(
      forgotRes.body?.message?.includes('If an account with this email address exists'),
      'Response returns generic message preventing user enumeration'
    );
    assert(sentEmails.length === 1, 'Mock Nodemailer sent exactly 1 email');

    const emailItem = sentEmails[0];
    assert(emailItem.to === testEmail, 'Email recipient matches requested email');
    assert(emailItem.subject?.includes('EEC RMS'), 'Email subject contains EEC RMS branding');
    assert(emailItem.html?.includes('ETHIOPIAN ENGINEERING CORPORATION'), 'HTML contains corporate header');
    assert(emailItem.html?.includes('/reset-password?token='), 'HTML contains reset link with token');
    assert(emailItem.text?.includes('20 minutes'), 'Text email specifies 20 minutes expiration');

    // Extract raw token from email URL
    const tokenMatch = emailItem.html.match(/token=([a-f0-9]+)/);
    assert(!!tokenMatch, 'Raw token successfully extracted from email URL');
    const rawToken1 = tokenMatch ? tokenMatch[1] : '';

    // Verify token in database
    const dbToken1 = await prisma.passwordResetToken.findFirst({
      where: { userId: initialUser.id },
    });
    assert(!!dbToken1, 'Token record created in database');
    assert(dbToken1?.tokenHash !== rawToken1, 'Raw token is NOT stored directly in database');
    
    // Verify SHA-256 hash match
    const computedHash1 = crypto.createHash('sha256').update(rawToken1).digest('hex');
    assert(dbToken1?.tokenHash === computedHash1, 'Database stores correct SHA-256 hash of raw token');
    assert(dbToken1?.usedAt === null, 'Token usedAt is initially null');
    assert(dbToken1!.expiresAt.getTime() > Date.now(), 'Token expiresAt is in the future (~20 mins)');

    // ------------------------------------------------------------------------
    console.log('\n--- 3. Unknown Email Returns Same Generic Response ---');
    // ------------------------------------------------------------------------
    sentEmails.length = 0;
    const unknownRes = await request('POST', '/api/auth/forgot-password', {
      body: { email: 'nonexistent.person.999@eec.gov.et' },
    });
    assert(unknownRes.status === 200, 'Unknown email returns 200 OK');
    assert(
      unknownRes.body?.message === forgotRes.body?.message,
      'Unknown email returns identical generic message as existing account'
    );
    assert(sentEmails.length === 0, 'No email was sent for non-existent account');

    // ------------------------------------------------------------------------
    console.log('\n--- 4. Previous Reset Token Invalidation on New Request ---');
    // ------------------------------------------------------------------------
    resetRateLimiter(); // Reset limiter for same user request
    sentEmails.length = 0;
    const forgotRes2 = await request('POST', '/api/auth/forgot-password', {
      body: { email: testEmail },
    });
    assert(forgotRes2.status === 200, 'Second reset request succeeds with 200 OK');
    assert(sentEmails.length === 1, 'Second email sent');

    const rawToken2 = sentEmails[0].html.match(/token=([a-f0-9]+)/)?.[1] || '';
    assert(rawToken2.length > 0 && rawToken2 !== rawToken1, 'New unique token generated');

    // Attempt to use Token 1 now that Token 2 has been issued
    const useToken1Res = await request('POST', '/api/auth/reset-password', {
      body: { token: rawToken1, password: 'BrandNewPassword2026!' },
    });
    assert(useToken1Res.status === 400, 'Previous Token 1 rejected with 400 Bad Request');
    assert(useToken1Res.body?.code === 'INVALID_TOKEN', 'Rejection code is INVALID_TOKEN');

    // ------------------------------------------------------------------------
    console.log('\n--- 5. Password Policy Enforcement on Reset ---');
    // ------------------------------------------------------------------------
    const shortPassRes = await request('POST', '/api/auth/reset-password', {
      body: { token: rawToken2, password: 'short' },
    });
    assert(shortPassRes.status === 400, 'Password under 8 characters rejected with 400 Bad Request');

    const emptyTokenRes = await request('POST', '/api/auth/reset-password', {
      body: { token: '', password: 'BrandNewPassword2026!' },
    });
    assert(emptyTokenRes.status === 400, 'Missing token rejected with 400 Bad Request');

    // ------------------------------------------------------------------------
    console.log('\n--- 6. Session Invalidation on Password Reset ---');
    // ------------------------------------------------------------------------
    // Establish a live session before password reset
    const loginBeforeRes = await request('POST', '/api/auth/login', {
      body: { email: testEmail, password: 'EEC-Secure2026!' },
    });
    assert(loginBeforeRes.status === 200, 'User logged in successfully before reset');
    const activeSessionCookie = extractCookie(loginBeforeRes.headers);
    assert(activeSessionCookie.length > 0, 'Active session cookie obtained');

    const meBeforeRes = await request('GET', '/api/auth/me', {
      cookie: activeSessionCookie,
    });
    assert(meBeforeRes.body?.authenticated === true, 'Session confirmed active via /api/auth/me');

    // ------------------------------------------------------------------------
    console.log('\n--- 7. Valid Token Successfully Resets Password ---');
    // ------------------------------------------------------------------------
    const resetRes = await request('POST', '/api/auth/reset-password', {
      body: { token: rawToken2, password: 'BrandNewPassword2026!' },
    });
    assert(resetRes.status === 200, 'POST /api/auth/reset-password succeeds with 200 OK');
    assert(resetRes.body?.success === true, 'Response contains success: true');

    // Verify token marked used in DB
    const dbToken2 = await prisma.passwordResetToken.findFirst({
      where: { tokenHash: crypto.createHash('sha256').update(rawToken2).digest('hex') },
    });
    assert(dbToken2?.usedAt !== null, 'Token record usedAt timestamp is now populated');

    // Verify previous session is now invalidated
    const meAfterRes = await request('GET', '/api/auth/me', {
      cookie: activeSessionCookie,
    });
    assert(
      meAfterRes.body?.authenticated === false,
      'Previous session cookie is invalidated and rejected on /api/auth/me'
    );

    // ------------------------------------------------------------------------
    console.log('\n--- 8. Reused Token is Rejected ---');
    // ------------------------------------------------------------------------
    const reuseRes = await request('POST', '/api/auth/reset-password', {
      body: { token: rawToken2, password: 'AnotherPassword2026!' },
    });
    assert(reuseRes.status === 400, 'Reusing previously used token rejected with 400 Bad Request');
    assert(reuseRes.body?.code === 'INVALID_TOKEN', 'Error code is INVALID_TOKEN');

    // ------------------------------------------------------------------------
    console.log('\n--- 9. New Password Works for Login & Old Password Fails ---');
    // ------------------------------------------------------------------------
    const oldLoginRes = await request('POST', '/api/auth/login', {
      body: { email: testEmail, password: 'EEC-Secure2026!' },
    });
    assert(oldLoginRes.status === 401, 'Old password fails to login (401 Unauthorized)');

    const newLoginRes = await request('POST', '/api/auth/login', {
      body: { email: testEmail, password: 'BrandNewPassword2026!' },
    });
    assert(newLoginRes.status === 200, 'New password successfully authenticates user (200 OK)');
    assert(newLoginRes.body?.user?.email === testEmail, 'Authenticated user matches test account');

    // ------------------------------------------------------------------------
    console.log('\n--- 10. Expired Token is Rejected ---');
    // ------------------------------------------------------------------------
    const expiredRawToken = crypto.randomBytes(32).toString('hex');
    const expiredHash = crypto.createHash('sha256').update(expiredRawToken).digest('hex');
    await prisma.passwordResetToken.create({
      data: {
        userId: initialUser.id,
        tokenHash: expiredHash,
        expiresAt: new Date(Date.now() - 5 * 60 * 1000), // Expired 5 minutes ago
      },
    });

    const expiredRes = await request('POST', '/api/auth/reset-password', {
      body: { token: expiredRawToken, password: 'SomePassword2026!' },
    });
    assert(expiredRes.status === 400, 'Expired token rejected with 400 Bad Request');
    assert(expiredRes.body?.code === 'TOKEN_EXPIRED', 'Rejection code is TOKEN_EXPIRED');

    // ------------------------------------------------------------------------
    console.log('\n--- 11. Rate Limiting Enforced ---');
    // ------------------------------------------------------------------------
    resetRateLimiter();
    // Maximum allowed per email is 3
    const r1 = await request('POST', '/api/auth/forgot-password', { body: { email: 'rate.limit.test@eec.gov.et' } });
    const r2 = await request('POST', '/api/auth/forgot-password', { body: { email: 'rate.limit.test@eec.gov.et' } });
    const r3 = await request('POST', '/api/auth/forgot-password', { body: { email: 'rate.limit.test@eec.gov.et' } });
    const r4 = await request('POST', '/api/auth/forgot-password', { body: { email: 'rate.limit.test@eec.gov.et' } });

    assert(r1.status === 200, 'Request 1 within rate limit allowed');
    assert(r2.status === 200, 'Request 2 within rate limit allowed');
    assert(r3.status === 200, 'Request 3 within rate limit allowed');
    assert(r4.status === 429, 'Request 4 exceeding limit blocked with 429 Too Many Requests');
    assert(!!r4.headers['retry-after'], 'Response includes Retry-After header');
    assert(r4.body?.message?.includes('Too many password reset requests'), 'Response includes rate limit notice');

    // ------------------------------------------------------------------------
    console.log('\n--- 12. Safe Handling of SMTP Failure ---');
    // ------------------------------------------------------------------------
    resetRateLimiter();
    const failingTransporter: any = {
      sendMail: async () => {
        throw new Error('ETIMEDOUT: Failed to connect to smtp.gmail.com:587');
      },
    };
    setMailTransporter(failingTransporter);

    const smtpFailRes = await request('POST', '/api/auth/forgot-password', {
      body: { email: testEmail },
    });
    assert(smtpFailRes.status === 200, 'SMTP delivery failure returns safe 200 OK');
    assert(
      smtpFailRes.body?.message?.includes('If an account with this email address exists'),
      'SMTP failure does not expose credentials or connection errors to client'
    );

    // Restore working mock transporter
    setMailTransporter(mockTransporter);

  } finally {
    // ------------------------------------------------------------------------
    console.log('\n--- 13. Test Cleanup & Credentials Restoration ---');
    // ------------------------------------------------------------------------
    if (initialPasswordHash) {
      await prisma.user.update({
        where: { email: testEmail },
        data: { passwordHash: initialPasswordHash },
      });
      console.log('  ✓ Test user password successfully restored to original hash');
    }

    const testUser = await prisma.user.findUnique({ where: { email: testEmail } });
    if (testUser) {
      await prisma.passwordResetToken.deleteMany({ where: { userId: testUser.id } });
      console.log('  ✓ Test password reset tokens cleaned up');
    }

    setMailTransporter(null);
    resetRateLimiter();
    testServer.close();
  }

  console.log('\n========================================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test suite error:', err);
  if (testServer) testServer.close();
  process.exit(1);
});

