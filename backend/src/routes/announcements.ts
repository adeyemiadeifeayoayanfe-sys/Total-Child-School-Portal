import { Router, Request, Response, NextFunction } from 'express';
import {
  authenticate,
  authorizeAdmin,
} from '../middleware/auth';
import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncementById,
  getAnnouncements,
  updateAnnouncement,
} from '../services/announcementService';
const router = Router();
/**
 * GET /api/announcements
 * Admins receive all announcements.
 * Other authenticated users receive only published announcements
 * targeted to everyone or their role.
 */
router.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.user?.role;
      const isAdmin =
        role === 'admin' ||
        role === 'super_admin';
      const audience =
        role === 'teacher'
          ? 'teachers'
          : role === 'parent'
            ? 'parents'
            : undefined;
      const announcements = await getAnnouncements({
        includeUnpublished: isAdmin,
        audience,
      });
      res.json({
        success: true,
        data: announcements,
      });
    } catch (error) {
      next(error);
    }
  }
);
/**
 * GET /api/announcements/:id
 */
router.get(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const announcement = await getAnnouncementById(req.params.id);
      if (
        !announcement.is_published &&
        req.user?.role !== 'admin' &&
        req.user?.role !== 'super_admin'
      ) {
        res.status(404).json({
          success: false,
          error: 'Announcement not found',
        });
        return;
      }
      res.json({
        success: true,
        data: announcement,
      });
    } catch (error) {
      next(error);
    }
  }
);
/**
 * POST /api/announcements
 */
router.post(
  '/',
  authenticate,
  authorizeAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const announcement = await createAnnouncement(
        req.body,
        req.authUserId!
      );
      res.status(201).json({
        success: true,
        data: announcement,
        message: 'Announcement created successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);
/**
 * PUT /api/announcements/:id
 */
router.put(
  '/:id',
  authenticate,
  authorizeAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const announcement = await updateAnnouncement(
        req.params.id,
        req.body,
        req.authUserId!
      );
      res.json({
        success: true,
        data: announcement,
        message: 'Announcement updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);
/**
 * DELETE /api/announcements/:id
 */
router.delete(
  '/:id',
  authenticate,
  authorizeAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await deleteAnnouncement(
        req.params.id,
        req.authUserId!
      );
      res.json({
        success: true,
        message: 'Announcement deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);
export default router;
