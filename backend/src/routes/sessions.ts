import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, authorizeAdmin, authorizeSuperAdmin } from '../middleware/auth';
import { AppError, NotFoundError } from '../middleware/errorHandler';

const router = Router();

/**
 * GET /api/sessions
 * List all academic sessions
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('academic_sessions')
      .select(`
        *,
        terms(*)
      `)
      .order('start_date', { ascending: false });

    if (error) {
      throw new AppError('Failed to fetch sessions', 500);
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
 * GET /api/sessions/current
 * Get current session
 */
router.get('/current', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('academic_sessions')
      .select(`
        *,
        terms(*)
      `)
      .eq('is_current', true)
      .single();

    if (error || !data) {
      throw new NotFoundError('No current session found');
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
 * GET /api/sessions/current-term
 * Get current term
 */
router.get('/current-term', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('terms')
      .select('*')
      .eq('is_current', true)
      .single();

    if (error || !data) {
      throw new NotFoundError('No current term found');
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
 * POST /api/sessions
 * Create new academic session
 */
router.post('/', authenticate, authorizeSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, start_date, end_date } = req.body;

    // Create session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('academic_sessions')
      .insert({
        name,
        start_date,
        end_date,
        created_by: req.authUserId,
      })
      .select()
      .single();

    if (sessionError || !session) {
      throw new AppError('Failed to create session', 500);
    }

    // Create three terms automatically
    const termNames = ['first', 'second', 'third'] as const;
    const termDuration = Math.floor(
      (new Date(end_date).getTime() - new Date(start_date).getTime()) / (3 * 24 * 60 * 60 * 1000)
    );

    const terms = [];
    for (let i = 0; i < termNames.length; i++) {
      const termStart = new Date(start_date);
      termStart.setDate(termStart.getDate() + i * termDuration);
      const termEnd = new Date(start_date);
      termEnd.setDate(termEnd.getDate() + (i + 1) * termDuration - 1);

      const { data: term, error: termError } = await supabaseAdmin
        .from('terms')
        .insert({
          session_id: session.id,
          name: termNames[i],
          start_date: termStart.toISOString().split('T')[0],
          end_date: termEnd.toISOString().split('T')[0],
          created_by: req.authUserId,
        })
        .select()
        .single();

      if (termError || !term) {
        throw new AppError('Failed to create terms', 500);
      }

      terms.push(term);
    }

    res.status(201).json({
      success: true,
      data: {
        session,
        terms,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/sessions/:id/set-current
 * Set session as current
 */
router.post('/:id/set-current', authenticate, authorizeSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Unset all current sessions
    await supabaseAdmin
      .from('academic_sessions')
      .update({ is_current: false })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    const { data, error } = await supabaseAdmin
      .from('academic_sessions')
      .update({ is_current: true })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundError('Session not found');
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