import { Router, Request, Response } from 'express';
import { SESSION_COOKIE_NAME } from './session';

const router = Router();

/**
 * GET /api/auth/me
 * Returns the current session status and user information
 */
router.get('/me', (req: Request, res: Response) => {
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
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  return res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

export default router;