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

import {
  createParent,
  updateParent,
  getParentChildren,
  getParentChildResults,
  getParentChildAttendance,
  getParentChildPayments,
} from '../services/parentService';

const router = Router();

/**
 * GET /api/parents
 * List all parents (Admin)
 */
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

      if (search) {
        query = query.or(
          `profile.first_name.ilike.%${search}%,profile.last_name.ilike.%${search}%`
        );
      }

      if (is_active !== undefined) {
        query = query.eq('is_active', is_active === 'true');
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

/**
 * POST /api/parents
 * Create new parent (Admin)
 *
 * admission_numbers is optional.
 *
 * Example:
 * {
 *   "email": "parent@example.com",
 *   "password": "temporary123",
 *   "first_name": "John",
 *   "last_name": "Doe",
 *   "phone": "08000000000",
 *   "address": "Some address",
 *   "occupation": "Engineer",
 *   "relationship_to_student": "Father",
 *   "admission_numbers": ["0070", "0123"],
 *   "is_primary": true
 * }
 */
router.post(
  '/',
  authenticate,
  authorizeAdmin,
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

/**
 * PUT /api/parents/:id
 * Update parent (Admin)
 */
router.put(
  '/:id',
  authenticate,
  authorizeAdmin,
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

/**
 * GET /api/parents/my/children
 * Get current parent's children
 */
router.get(
  '/my/children',
  authenticate,
  authorizeParent,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const children = await getParentChildren(
        req.authUserId!
      );

      res.json({
        success: true,
        data: children,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/parents/my/children/:childId/results
 * Get child's published results
 */
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

/**
 * GET /api/parents/my/children/:childId/attendance
 * Get child's attendance
 */
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

/**
 * GET /api/parents/my/children/:childId/payments
 * Get child's payment history
 */
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