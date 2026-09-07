import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, authorizeAdmin, authorizeTeacher } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { AppError, NotFoundError, ForbiddenError } from '../middleware/errorHandler';
import { scoreEntrySchema, bulkScoreEntrySchema, updateScoreSchema } from '../validators/score';
import { enterScore, bulkEnterScores, getClassScores, getStudentScores } from '../services/scoreService';
import { getTeacherRecordForUser, ensureTeacherAssignedToSubject } from '../services/accessService';

const router = Router();

/**
 * POST /api/scores
 * Enter score for a student (Teacher)
 */
router.post('/', authenticate, authorizeTeacher, validate(scoreEntrySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const score = await enterScore(req.body, req.authUserId!);
    res.status(201).json({
      success: true,
      data: score,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/scores/bulk
 * Bulk enter scores (Teacher)
 */
router.post('/bulk', authenticate, authorizeTeacher, validate(bulkScoreEntrySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await bulkEnterScores(req.body.scores, req.authUserId!);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/scores/class/:classId/:subjectId/:termId
 * Get class scores for a subject
 */
router.get('/class/:classId/:subjectId/:termId', authenticate, authorizeTeacher, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: term, error: termError } = await supabaseAdmin
      .from('terms')
      .select('session_id')
      .eq('id', req.params.termId)
      .single();

    if (termError || !term) {
      throw new NotFoundError('Term not found');
    }

    const teacher = await getTeacherRecordForUser(req.authUserId!);
    await ensureTeacherAssignedToSubject(teacher.id, req.params.subjectId, req.params.classId, term.session_id);

    const scores = await getClassScores(
      req.params.classId,
      req.params.subjectId,
      req.params.termId
    );
    res.json({
      success: true,
      data: scores,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/scores/student/:studentId/:termId
 * Get student scores for a term
 */
router.get('/student/:studentId/:termId', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scores = await getStudentScores(
      req.params.studentId,
      req.params.termId
    );
    res.json({
      success: true,
      data: scores,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/scores/:id
 * Update score (Teacher)
 */
router.put('/:id', authenticate, authorizeTeacher, validate(updateScoreSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: existing } = await supabaseAdmin
      .from('scores')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (!existing) {
      throw new NotFoundError('Score not found');
    }

    const teacher = await getTeacherRecordForUser(req.authUserId!);

    if (existing.entered_by !== req.authUserId) {
      await ensureTeacherAssignedToSubject(teacher.id, existing.subject_id, existing.class_id, existing.session_id);
    }

    const { data: updated, error } = await supabaseAdmin
      .from('scores')
      .update({
        ...req.body,
        updated_by: req.authUserId,
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error || !updated) {
      throw new AppError('Failed to update score', 500);
    }

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
