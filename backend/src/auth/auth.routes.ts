import { Router } from '../http/router';
import { AppRequest, AppResponse } from '../http/types';
import { SESSION_COOKIE_NAME } from './session';

const router = new Router();

/**
 * GET /api/auth/me
 * Returns the current session status and user information
 */
router.get('/me', (req: AppRequest, res: AppResponse) => {
  if (!req.user) {
    return res.status(200).json({
      authenticated: false,
      user: null,
    });
  }

  return res.status(200).json({
    authenticated: true,
    user: req.user,
  });
});

/**
 * POST /api/auth/logout
 * Clears the HTTP-only session cookie
 */
router.post('/logout', (_req: AppRequest, res: AppResponse) => {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
  });

  return res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

export default router;
