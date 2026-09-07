import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, authorizeAdmin } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { AppError, NotFoundError } from '../middleware/errorHandler';
import { createClassSchema, updateClassSchema, assignSubjectToClassSchema } from '../validators/class';

const router = Router();

/**
 * GET /api/classes
 * List all classes
 */
router.get('/', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { is_active, search } = req.query;

    let query = supabaseAdmin
      .from('classes')
      .select(`
        *,
        students:enrollments(
          student:students(*)
        )
      `);

    if (is_active !== undefined) query = query.eq('is_active', is_active === 'true');
    if (search) query = query.ilike('name', `%${search}%`);

    const { data, error } = await query.order('name', { ascending: true });

    if (error) {
      throw new AppError('Failed to fetch classes', 500);
    }

    res.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/classes/:id
 * Get class details with roster
 */
router.get('/:id', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: classData, error } = await supabaseAdmin
      .from('classes')
      .select(`
        *,
        enrollments(
          *,
          student:students(*),
          session:academic_sessions(*)
        ),
        teacher_class_assignments(
          *,
          teacher:teachers(
            *,
            profile:profiles(first_name, last_name)
          )
        ),
        class_subject_assignments(
          *,
          subject:subjects(*)
        )
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !classData) {
      throw new NotFoundError('Class not found');
    }

    res.json({
      success: true,
      data: classData,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/classes
 * Create new class
 */
router.post('/', authenticate, authorizeAdmin, validate(createClassSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('classes')
      .insert({
        ...req.body,
        created_by: req.authUserId,
      })
      .select()
      .single();

    if (error || !data) {
      throw new AppError('Failed to create class', 500);
    }

    res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/classes/:id
 * Update class
 */
router.put('/:id', authenticate, authorizeAdmin, validate(updateClassSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('classes')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundError('Class not found');
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/classes/assign-subject
 * Assign subject to class
 */
router.post('/assign-subject', authenticate, authorizeAdmin, validate(assignSubjectToClassSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { class_id, subject_id, session_id } = req.body;

    const { data, error } = await supabaseAdmin
      .from('class_subject_assignments')
      .insert({
        class_id,
        subject_id,
        session_id,
        created_by: req.authUserId,
      })
      .select()
      .single();

    if (error || !data) {
      if (error?.code === '23505') {
        throw new AppError('Subject already assigned to this class', 409);
      }
      throw new AppError('Failed to assign subject to class', 500);
    }

    res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/classes/:id/roster
 * Get class roster for a session
 */
router.get('/:id/roster', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { session_id } = req.query;

    let query = supabaseAdmin
      .from('enrollments')
      .select(`
        *,
        student:students(*)
      `)
      .eq('class_id', req.params.id)
      .is('unenrolled_at', null);

    if (session_id) query = query.eq('session_id', session_id);

    const { data, error } = await query;

    if (error) {
      throw new AppError('Failed to fetch class roster', 500);
    }

    res.json({
      success: true,
      data: (data || []).sort((left, right) => {
        const leftLast = left.student?.last_name || '';
        const rightLast = right.student?.last_name || '';
        return leftLast.localeCompare(rightLast);
      }),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
