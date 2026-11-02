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

// Health check endpoint
router.get('/api/health', (_req: AppRequest, res: AppResponse) => {
  res.status(200).json({
    status: 'healthy',
    service: 'EEC-RMS-Backend',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    server: 'node:http',
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

// Root informational endpoint
router.get('/', (_req: AppRequest, res: AppResponse) => {
  res.status(200).json({
    message: 'Ethiopian Engineering Corporation (EEC) Resource Management System API',
    healthCheck: '/api/health',
    version: '1.0.0',
    framework: 'Node.js Native HTTP',
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
    console.error('[EEC-RMS Error]', err);
    if (!appRes.writableEnded) {
      const statusCode = err.message?.includes('Payload Too Large') ? 413 : 500;
      appRes.status(statusCode).json({
        success: false,
        message: err.message || 'Internal Server Error',
      });
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
  });
}

// Graceful shutdown
const shutdown = () => {
  console.log('\n[EEC-RMS] Gracefully shutting down native HTTP server...');
  server.close(() => {
    console.log('[EEC-RMS] Server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default server;
