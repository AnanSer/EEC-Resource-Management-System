import http from 'node:http';
import dotenv from 'dotenv';
import { Router } from './http/router';
import { AppRequest, AppResponse } from './http/types';
import { decorateResponse } from './http/response';
import { handleCors } from './http/cors';
import { applySecurityHeaders } from './http/securityHeaders';
import { parseCookies } from './http/cookies';
import { parseRequestBody } from './http/bodyParser';
import { sessionMiddleware } from './auth/auth.middleware';
import { 
  startPeriodicSessionCleanup, 
  stopPeriodicSessionCleanup, 
  cleanupExpiredSessions 
} from './auth/session';
import authRouter from './auth/auth.routes';
import departmentRouter from './departments/department.routes';
import employeeRouter from './employees/employee.routes';
import resourceRouter from './resources/resource.routes';
import assignmentRouter from './assignments/assignment.routes';
import requisitionRouter from './requisitions/requisition.routes';
import maintenanceRouter from './maintenance/maintenance.routes';
import reportRouter from './reports/report.routes';
import notificationRouter from './notifications/notification.routes';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '5000', 10);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Configure allowed CORS origins (SEC-07)
export function getAllowedOrigins(): string[] {
  const configured = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (process.env.NODE_ENV === 'production') {
    return configured.length > 0 ? configured : ['https://eec-rms.vercel.app'];
  }

  // Development/test fallbacks
  const devOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
  return Array.from(new Set([...configured, ...devOrigins]));
}

// Initialize main router
export const router = new Router();

// Health check endpoint (SEC-15: minimal public response, no environment or infrastructure leakage)
router.get('/api/health', (_req: AppRequest, res: AppResponse) => {
  res.status(200).json({
    status: 'ok',
  });
});

// Mount modular sub-routers
router.mount('/api/auth', authRouter);
router.mount('/api/departments', departmentRouter);
router.mount('/api/employees', employeeRouter);
router.mount('/api/resources', resourceRouter);
router.mount('/api/assignments', assignmentRouter);
router.mount('/api/requisitions', requisitionRouter);
router.mount('/api/maintenance', maintenanceRouter);
router.mount('/api/reports', reportRouter);
router.mount('/api/notifications', notificationRouter);

// Root informational endpoint (SEC-15: minimal public response)
router.get('/', (_req: AppRequest, res: AppResponse) => {
  res.status(200).json({
    status: 'ok',
  });
});

/**
 * Core Request Listener using Node.js built-in node:http module
 */
export async function requestListener(req: http.IncomingMessage, res: http.ServerResponse) {
  // Apply centralized security headers uniformly (SEC-08)
  applySecurityHeaders(res);

  // Handle CORS & Preflight OPTIONS (SEC-07)
  if (handleCors(req, res, getAllowedOrigins())) {
    return;
  }

  // Decorate response with json(), status(), setCookie(), clearCookie()
  const appRes = decorateResponse(res);

  // Parse URL, pathname, query parameters
  const host = req.headers.host || 'localhost';
  const urlObj = new URL(req.url || '/', `http://${host}`);

  const appReq = req as AppRequest;
  appReq.pathname = urlObj.pathname;
  appReq.query = {};
  urlObj.searchParams.forEach((val, key) => {
    appReq.query[key] = val;
  });
  appReq.params = {};

  // Parse cookies
  appReq.cookies = parseCookies(req.headers.cookie);

  try {
    // Parse request body natively (JSON / urlencoded)
    appReq.body = await parseRequestBody(req);

    // Apply session verification middleware
    await sessionMiddleware(appReq, appRes, async () => {
      // Dispatch request through router
      const handled = await router.handle(appReq, appRes);

      if (!handled && !appRes.writableEnded) {
        appRes.status(404).json({
          success: false,
          message: `Cannot ${req.method} ${appReq.pathname}`,
          error: 'Not Found',
        });
      }
    });
  } catch (err: any) {
    const errorId = `ERR-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    console.error(`[EEC-RMS Internal Error ${errorId}]`, err);

    if (!appRes.writableEnded) {
      if (err.message?.includes('Payload Too Large')) {
        appRes.status(413).json({
          success: false,
          error: 'Payload Too Large',
          message: 'Request payload exceeds allowed limit',
        });
      } else if (err.message?.includes('Invalid JSON format')) {
        appRes.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Invalid JSON format in request body',
        });
      } else {
        // SEC-10: Never leak raw error messages, SQL errors, or stack traces to clients
        appRes.status(500).json({
          success: false,
          error: 'Internal Server Error',
          message: 'An unexpected internal server error occurred. Please contact IT support.',
          errorId,
        });
      }
    }
  }
}

// Create native HTTP server
export const server = http.createServer(requestListener);

// Start listening if not running in test mode
if (process.env.NODE_ENV !== 'test' && !process.env.RMS_TEST_MODE) {
  server.listen(PORT, () => {
    console.log(`[EEC-RMS] Native Node.js HTTP server running on port ${PORT}`);
    console.log(`[EEC-RMS] Health endpoint: http://localhost:${PORT}/api/health`);
    console.log(`[EEC-RMS] Trusted Frontend origin: ${FRONTEND_URL}`);

    // Start background expired session cleanup (SEC-14)
    startPeriodicSessionCleanup();
    cleanupExpiredSessions().catch(() => {});
  });
}

// Graceful shutdown
const shutdown = () => {
  console.log('\n[EEC-RMS] Gracefully shutting down native HTTP server...');
  stopPeriodicSessionCleanup();
  server.close(() => {
    console.log('[EEC-RMS] Server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default server;
