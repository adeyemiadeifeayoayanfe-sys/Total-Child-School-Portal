import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, authorizeAdmin } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { AppError, NotFoundError } from '../middleware/errorHandler';
import { createSubjectSchema, updateSubjectSchema } from '../validators/subject';

const router = Router();

/**
 * GET /api/subjects
 * List all subjects
 */
router.get('/', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { is_active, search } = req.query;

    let query = supabaseAdmin
      .from('subjects')
      .select('*');

    if (is_active !== undefined) query = query.eq('is_active', is_active === 'true');
    if (search) query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);

    const { data, error } = await query.order('name', { ascending: true });

    if (error) {
      throw new AppError('Failed to fetch subjects', 500);
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
 * GET /api/subjects/:id
 * Get subject details
 */
router.get('/:id', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('subjects')
      .select(`
        *,
        class_subject_assignments(
          *,
          class:classes(*),
          session:academic_sessions(*)
        ),
        teacher_subject_assignments(
          *,
          teacher:teachers(
            *,
            profile:profiles(first_name, last_name)
          )
        )
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !data) {
      throw new NotFoundError('Subject not found');
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
 * POST /api/subjects
 * Create new subject
 */
router.post('/', authenticate, authorizeAdmin, validate(createSubjectSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('subjects')
      .insert({
        ...req.body,
        created_by: req.authUserId,
      })
      .select()
      .single();

    if (error || !data) {
      throw new AppError('Failed to create subject', 500);
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
 * PUT /api/subjects/:id
 * Update subject
 */
router.put('/:id', authenticate, authorizeAdmin, validate(updateSubjectSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('subjects')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundError('Subject not found');
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
