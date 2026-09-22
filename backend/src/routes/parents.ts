import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import {
  authenticate,
  authorizeAdmin,
  authorizeParent,
} from '../middleware/auth';
import {
  AppError,
  NotFoundError,
  ForbiddenError,
} from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import {
  createParentSchema,
  updateParentSchema,
} from '../validators/parent';
import {
  createParent,
  updateParent,
  getParentChildren,
  getParentChildResults,
  getParentChildAttendance,
  getParentChildPayments,
} from '../services/parentService';
const router = Router();
router.get(
  '/',
  authenticate,
  authorizeAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search, is_active } = req.query;
      let query = supabaseAdmin
        .from('parents')
        .select(`
          *,
          user:users(email, status),
          profile:profiles(first_name, last_name, phone)
        `);
      if (is_active !== undefined) {
        query = query.eq('is_active', is_active === 'true');
      }
      if (search) {
        const term = String(search).replace(/[%_]/g, '\\$&');
        query = query.or(
          `first_name.ilike.%${term}%,last_name.ilike.%${term}%`,
          { foreignTable: 'profile' }
        );
      }
      const { data, error } = await query.order('created_at', {
        ascending: false,
      });
      if (error) {
        throw new AppError('Failed to fetch parents', 500);
      }
      res.json({
        success: true,
        data: data || [],
      });
    } catch (error) {
      next(error);
    }
  }
);
router.post(
  '/',
  authenticate,
  authorizeAdmin,
  validate(createParentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parent = await createParent(
        req.body,
        req.authUserId!
      );
      res.status(201).json({
        success: true,
        data: parent,
      });
    } catch (error) {
      next(error);
    }
  }
);
router.put(
  '/:id',
  authenticate,
  authorizeAdmin,
  validate(updateParentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parent = await updateParent(
        req.params.id,
        req.body,
        req.authUserId!
      );
      res.json({
        success: true,
        data: parent,
      });
    } catch (error) {
      next(error);
    }
  }
);
router.get(
  '/my/children',
  authenticate,
  authorizeParent,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const children = await getParentChildren(req.authUserId!);
      res.json({
        success: true,
        data: children,
      });
    } catch (error) {
      next(error);
    }
  }
);
router.get(
  '/my/children/:childId/results',
  authenticate,
  authorizeParent,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const results = await getParentChildResults(
        req.authUserId!,
        req.params.childId
      );
      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }
);
router.get(
  '/my/children/:childId/attendance',
  authenticate,
  authorizeParent,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const attendance = await getParentChildAttendance(
        req.authUserId!,
        req.params.childId
      );
      res.json({
        success: true,
        data: attendance,
      });
    } catch (error) {
      next(error);
    }
  }
);
router.get(
  '/my/children/:childId/payments',
  authenticate,
  authorizeParent,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payments = await getParentChildPayments(
        req.authUserId!,
        req.params.childId
      );
      res.json({
        success: true,
        data: payments,
      });
    } catch (error) {
      next(error);
    }
  }
);
export default router;
