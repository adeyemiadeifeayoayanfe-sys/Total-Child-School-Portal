import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, authorizeAdmin, authorizeTeacher } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { AppError, NotFoundError, ForbiddenError } from '../middleware/errorHandler';
import { submitBroadsheetSchema, returnBroadsheetSchema, approveBroadsheetSchema } from '../validators/broadsheet';
import { submitBroadsheet, returnBroadsheet, approveBroadsheet, getBroadsheets, getBroadsheetById, checkAllBroadsheetsSubmitted } from '../services/broadsheetService';
import { getTeacherRecordForUser } from '../services/accessService';

const router = Router();

/**
 * GET /api/broadsheets
 * List all broadsheets with filters
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin' && req.user?.role !== 'teacher') {
      throw new ForbiddenError('You do not have permission to view broadsheets');
    }

    let teacherId: string | undefined;
    if (req.user?.role === 'teacher') {
      const teacher = await getTeacherRecordForUser(req.authUserId!);
      teacherId = teacher.id;
    }

    const filters = {
      class_id: req.query.class_id as string,
      subject_id: req.query.subject_id as string,
      session_id: req.query.session_id as string,
      term_id: req.query.term_id as string,
      teacher_id: teacherId || (req.query.teacher_id as string),
      status: req.query.status as string,
    };

    const broadsheets = await getBroadsheets(filters);
    res.json({
      success: true,
      data: broadsheets,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/broadsheets/:id
 * Get broadsheet details
 */
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user?.role === 'teacher') {
      const teacher = await getTeacherRecordForUser(req.authUserId!);
      const broadsheet = await getBroadsheetById(req.params.id, teacher.id);
      res.json({
        success: true,
        data: broadsheet,
      });
      return;
    }

    if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
      throw new ForbiddenError('You do not have permission to view this broadsheet');
    }

    const broadsheet = await getBroadsheetById(req.params.id);
    res.json({
      success: true,
      data: broadsheet,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/broadsheets/submit
 * Submit broadsheet (Teacher)
 */
router.post('/submit', authenticate, authorizeTeacher, validate(submitBroadsheetSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teacher = await getTeacherRecordForUser(req.authUserId!);

    const broadsheet = await submitBroadsheet(
      req.body,
      teacher.id,
      req.authUserId!
    );
    res.json({
      success: true,
      data: broadsheet,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/broadsheets/:id/return
 * Return broadsheet to teacher (Admin)
 */
router.post('/:id/return', authenticate, authorizeAdmin, validate(returnBroadsheetSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const broadsheet = await returnBroadsheet(
      req.params.id,
      req.body.return_reason,
      req.authUserId!
    );
    res.json({
      success: true,
      data: broadsheet,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/broadsheets/:id/approve
 * Approve broadsheet (Admin)
 */
router.post('/:id/approve', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const broadsheet = await approveBroadsheet(req.params.id, req.authUserId!);
    res.json({
      success: true,
      data: broadsheet,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/broadsheets/check/:classId/:sessionId/:termId
 * Check if all broadsheets are submitted
 */
router.get('/check/:classId/:sessionId/:termId', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const check = await checkAllBroadsheetsSubmitted(
      req.params.classId,
      req.params.sessionId,
      req.params.termId
    );
    res.json({
      success: true,
      data: check,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
