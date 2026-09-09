import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, authorizeAdmin } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { AppError } from '../middleware/errorHandler';

import {
  createStudentSchema,
  updateStudentSchema,
  assignStudentToClassSchema,
  assignParentToStudentSchema,
  assignParentByAdmissionNumbersSchema,
} from '../validators/student';

import {
  createStudent,
  updateStudent,
  archiveStudent,
  assignStudentToClass,
  assignParentToStudent,
  assignParentToStudentsByAdmissionNumbers,
  removeParentAssignment,
  getStudentWithDetails,
} from '../services/studentService';

const router = Router();

/**
 * GET /api/students
 * List all students with search/filter
 */
router.get(
  '/',
  authenticate,
  authorizeAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search, class_id, status, gender, page = 1, limit = 50 } =
        req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      let query = supabaseAdmin
        .from('students')
        .select(
          `
          *,
          current_class:classes(name)
        `,
          { count: 'exact' }
        );

      if (search) {
        query = query.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,admission_number.ilike.%${search}%`
        );
      }

      if (class_id) query = query.eq('current_class_id', class_id);
      if (status) query = query.eq('status', status);
      if (gender) query = query.eq('gender', gender);

      const { data, error, count } = await query
        .order('last_name', { ascending: true })
        .range(offset, offset + limitNum - 1);

      if (error) {
        throw new AppError('Failed to fetch students', 500);
      }

      res.json({
        success: true,
        data: data || [],
        total: count || 0,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil((count || 0) / limitNum),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/students/:id
 * Get student details
 */
router.get(
  '/:id',
  authenticate,
  authorizeAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const student = await getStudentWithDetails(req.params.id);

      res.json({
        success: true,
        data: student,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/students
 * Create new student
 */
router.post(
  '/',
  authenticate,
  authorizeAdmin,
  validate(createStudentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const student = await createStudent(req.body, req.authUserId!);

      res.status(201).json({
        success: true,
        data: student,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/students/:id
 * Update student
 */
router.put(
  '/:id',
  authenticate,
  authorizeAdmin,
  validate(updateStudentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const student = await updateStudent(
        req.params.id,
        req.body,
        req.authUserId!
      );

      res.json({
        success: true,
        data: student,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/students/:id/archive
 * Archive student
 */
router.post(
  '/:id/archive',
  authenticate,
  authorizeAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const student = await archiveStudent(
        req.params.id,
        req.authUserId!
      );

      res.json({
        success: true,
        data: student,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/students/assign-class
 * Assign student to class
 */
router.post(
  '/assign-class',
  authenticate,
  authorizeAdmin,
  validate(assignStudentToClassSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { student_id, class_id, session_id } = req.body;

      const enrollment = await assignStudentToClass(
        student_id,
        class_id,
        session_id,
        req.authUserId!
      );

      res.json({
        success: true,
        data: enrollment,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/students/assign-parent
 * Assign one parent to one student
 */
router.post(
  '/assign-parent',
  authenticate,
  authorizeAdmin,
  validate(assignParentToStudentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { parent_id, student_id, is_primary } = req.body;

      const assignment = await assignParentToStudent(
        parent_id,
        student_id,
        is_primary || false,
        req.authUserId!
      );

      res.json({
        success: true,
        data: assignment,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/students/assign-parent-by-admission
 * Assign multiple students to one parent using admission numbers
 *
 * Example:
 * {
 *   "parent_id": "parent-uuid",
 *   "admission_numbers": ["0070", "0123", "0145"],
 *   "is_primary": false
 * }
 */
router.post(
  '/assign-parent-by-admission',
  authenticate,
  authorizeAdmin,
  validate(assignParentByAdmissionNumbersSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        parent_id,
        admission_numbers,
        is_primary,
      } = req.body;

      const result = await assignParentToStudentsByAdmissionNumbers(
        parent_id,
        admission_numbers,
        is_primary || false,
        req.authUserId!
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/students/remove-parent
 * Remove parent from student
 */
router.delete(
  '/remove-parent',
  authenticate,
  authorizeAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { parent_id, student_id } = req.body;

      const result = await removeParentAssignment(
        parent_id,
        student_id,
        req.authUserId!
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/students/:id/attendance
 * Get student attendance history
 */
router.get(
  '/:id/attendance',
  authenticate,
  authorizeAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('attendance')
        .select(`
          *,
          class:classes(name),
          term:terms(name)
        `)
        .eq('student_id', req.params.id)
        .order('attendance_date', { ascending: false });

      if (error) {
        throw new AppError('Failed to fetch attendance', 500);
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
 * GET /api/students/:id/payments
 * Get student payment history
 */
router.get(
  '/:id/payments',
  authenticate,
  authorizeAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('payments')
        .select(`
          *,
          receipt:receipts(*)
        `)
        .eq('student_id', req.params.id)
        .order('payment_date', { ascending: false });

      if (error) {
        throw new AppError('Failed to fetch payments', 500);
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
 * GET /api/students/:id/results
 * Get student results
 */
router.get(
  '/:id/results',
  authenticate,
  authorizeAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('results')
        .select(`
          *,
          term:terms(name),
          session:academic_sessions(name),
          class:classes(name)
        `)
        .eq('student_id', req.params.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw new AppError('Failed to fetch results', 500);
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

export default router;