import { Router } from '../http/router';
import { AppRequest, AppResponse } from '../http/types';
import { requireAuth } from '../auth/auth.middleware';
import {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  NotificationServiceError,
} from './notification.service';

const router = new Router();

/**
 * GET /api/notifications/unread-count
 * Returns the unread notification count for the authenticated user.
 */
router.get('/unread-count', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const userId = req.user!.id;
    const count = await getUnreadCount(userId);
    res.status(200).json({
      success: true,
      unreadCount: count,
    });
  } catch (error: any) {
    if (error instanceof NotificationServiceError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
      });
      return;
    }
    console.error('[Notification Router] Error getting unread count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve unread notification count',
    });
  }
});

/**
 * GET /api/notifications
 * Returns paginated notifications for the authenticated user.
 */
router.get('/', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const userId = req.user!.id;
    const { page, limit, unreadOnly, type, priority } = req.query || {};

    const parsedPage = page ? parseInt(String(page), 10) : 1;
    const parsedLimit = limit ? parseInt(String(limit), 10) : 20;
    const isUnreadOnly = unreadOnly !== undefined ? String(unreadOnly).toLowerCase() === 'true' : false;

    const result = await listNotifications(userId, {
      page: isNaN(parsedPage) ? 1 : parsedPage,
      limit: isNaN(parsedLimit) ? 20 : parsedLimit,
      unreadOnly: isUnreadOnly,
      type: type ? String(type) : undefined,
      priority: priority ? String(priority) : undefined,
    });

    res.status(200).json({
      success: true,
      data: result.notifications,
      pagination: result.pagination,
      unreadCount: result.unreadCount,
    });
  } catch (error: any) {
    if (error instanceof NotificationServiceError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
      });
      return;
    }
    console.error('[Notification Router] Error listing notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve notifications',
    });
  }
});

/**
 * PATCH /api/notifications/read-all
 * Marks all notifications for the authenticated user as read.
 */
router.patch('/read-all', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const userId = req.user!.id;
    const result = await markAllAsRead(userId);

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      updatedCount: result.updatedCount,
    });
  } catch (error: any) {
    if (error instanceof NotificationServiceError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
      });
      return;
    }
    console.error('[Notification Router] Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notifications as read',
    });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Marks a specific notification as read.
 */
router.patch('/:id/read', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const userId = req.user!.id;
    const notificationId = req.params.id;

    if (!notificationId) {
      res.status(400).json({
        success: false,
        error: 'Notification ID is required',
      });
      return;
    }

    const updated = await markAsRead(userId, notificationId);

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    if (error instanceof NotificationServiceError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
      });
      return;
    }
    console.error('[Notification Router] Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notification',
    });
  }
});

/**
 * DELETE /api/notifications/:id
 * Deletes a single notification belonging to the current user.
 */
router.delete('/:id', requireAuth, async (req: AppRequest, res: AppResponse) => {
  try {
    const userId = req.user!.id;
    const notificationId = req.params.id;

    if (!notificationId) {
      res.status(400).json({
        success: false,
        error: 'Notification ID is required',
      });
      return;
    }

    await deleteNotification(userId, notificationId);

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error: any) {
    if (error instanceof NotificationServiceError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
      });
      return;
    }
    console.error('[Notification Router] Error deleting notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete notification',
    });
  }
});

export default router;
