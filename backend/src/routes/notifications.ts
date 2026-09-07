import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { getUserNotifications, markNotificationRead, markAllNotificationsRead, getUnreadCount, deleteNotification } from '../services/notificationService';

const router = Router();

/**
 * GET /api/notifications
 * Get current user's notifications
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const unreadOnly = req.query.unread === 'true';
    const notifications = await getUserNotifications(req.authUserId!, unreadOnly);
    res.json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/notifications/unread-count
 * Get unread notification count
 */
router.get('/unread-count', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await getUnreadCount(req.authUserId!);
    res.json({
      success: true,
      data: count,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/notifications/:id/read
 * Mark notification as read
 */
router.post('/:id/read', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notification = await markNotificationRead(req.params.id, req.authUserId!);
    res.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/notifications/read-all
 * Mark all notifications as read
 */
router.post('/read-all', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await markAllNotificationsRead(req.authUserId!);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete notification
 */
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await deleteNotification(req.params.id, req.authUserId!);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

export default router;