import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, authorizeAdmin, authorizeTeacher } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { AppError, NotFoundError, ForbiddenError, ValidationError } from '../middleware/errorHandler';
import { scoreEntrySchema, bulkScoreEntrySchema, updateScoreSchema } from '../validators/score';
import { enterScore, bulkEnterScores, getClassScores, getStudentScores } from '../services/scoreService';
import { getTeacherRecordForUser, ensureTeacherAssignedToSubject } from '../services/accessService';
const router = Router();
router.post(
  '/',
  authenticate,
  authorizeTeacher,
  validate(scoreEntrySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const score = await enterScore(req.body, req.authUserId!);
      res.status(201).json({
        success: true,
        data: score,
      });
    } catch (error) {
      next(error);
    }
  },
);
router.post(
  '/bulk',
  authenticate,
  authorizeTeacher,
  validate(bulkScoreEntrySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await bulkEnterScores(req.body.scores, req.authUserId!);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
);
router.get(
  '/class/:classId/:subjectId/:termId',
  authenticate,
  authorizeTeacher,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { data: term, error: termError } = await supabaseAdmin
        .from('terms')
        .select('session_id, assessment_stage')
        .eq('id', req.params.termId)
        .single();
      if (termError || !term) {
        throw new NotFoundError('Term not found');
      }
      const teacher = await getTeacherRecordForUser(req.authUserId!);
      await ensureTeacherAssignedToSubject(
        teacher.id,
        req.params.subjectId,
        req.params.classId,
        term.session_id,
      );
      const scores = await getClassScores(
        req.params.classId,
        req.params.subjectId,
        req.params.termId,
      );
      res.json({
        success: true,
        data: scores,
        assessment_stage: term.assessment_stage,
      });
    } catch (error) {
      next(error);
    }
  },
);
router.get(
  '/student/:studentId/:termId',
  authenticate,
  authorizeAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scores = await getStudentScores(
        req.params.studentId,
        req.params.termId,
      );
      res.json({
        success: true,
        data: scores,
      });
    } catch (error) {
      next(error);
    }
  },
);
router.put(
  '/:id',
  authenticate,
  authorizeTeacher,
  validate(updateScoreSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from('scores')
        .select('*')
        .eq('id', req.params.id)
        .single();
      if (existingError || !existing) {
        throw new NotFoundError('Score not found');
      }
      const { data: term, error: termError } = await supabaseAdmin
        .from('terms')
        .select('assessment_stage, session_id')
        .eq('id', existing.term_id)
        .single();
      if (termError || !term) {
        throw new NotFoundError('Term not found');
      }
      const stage = term.assessment_stage;
      if (stage === 'classes') {
        throw new ForbiddenError(
          'Score editing is not allowed during the CLASSES stage',
        );
      }
      const teacher = await getTeacherRecordForUser(req.authUserId!);
      if (existing.entered_by !== req.authUserId) {
        await ensureTeacherAssignedToSubject(
          teacher.id,
          existing.subject_id,
          existing.class_id,
          existing.session_id,
        );
      }
      const requested = req.body as {
        test1?: number | null;
        test2?: number | null;
        test3?: number | null;
        examination?: number | null;
      };
      const hasValue = (value: number | null | undefined) =>
        value !== undefined && value !== null;
      if (
        stage === 'first_test' &&
        (hasValue(requested.test2) ||
          hasValue(requested.test3) ||
          hasValue(requested.examination))
      ) {
        throw new ForbiddenError(
          'Only Test 1 is editable during FIRST TEST stage',
        );
      }
      if (
        stage === 'second_test' &&
        (hasValue(requested.test3) || hasValue(requested.examination))
      ) {
        throw new ForbiddenError(
          'Only Test 1 and Test 2 are editable during SECOND TEST stage',
        );
      }
      if (
        stage === 'third_test' &&
        hasValue(requested.examination)
      ) {
        throw new ForbiddenError(
          'Only Test 1, Test 2, and Test 3 are editable during THIRD TEST stage',
        );
      }
      const validateScore = (
        score: number | null | undefined,
        max: number,
        label: string,
      ) => {
        if (score !== undefined && score !== null) {
          if (score < 0 || score > max) {
            throw new ValidationError(
              `${label} must be between 0 and ${max}`,
            );
          }
        }
      };
      validateScore(requested.test1, 20, 'Test 1');
      validateScore(requested.test2, 20, 'Test 2');
      validateScore(requested.test3, 20, 'Test 3');
      validateScore(requested.examination, 40, 'Examination');
      const allowedFields: Record<string, number | null> = {};
      if (hasValue(requested.test1)) {
        allowedFields.test1 = requested.test1!;
      }
      if (
        (stage === 'second_test' ||
          stage === 'third_test' ||
          stage === 'examination') &&
        hasValue(requested.test2)
      ) {
        allowedFields.test2 = requested.test2!;
      }
      if (
        (stage === 'third_test' ||
          stage === 'examination') &&
        hasValue(requested.test3)
      ) {
        allowedFields.test3 = requested.test3!;
      }
      if (
        stage === 'examination' &&
        hasValue(requested.examination)
      ) {
        allowedFields.examination = requested.examination!;
      }
      if (Object.keys(allowedFields).length === 0) {
        throw new ValidationError(
          'No editable score was provided for the current assessment stage',
        );
      }
      const { data: updated, error } = await supabaseAdmin
        .from('scores')
        .update({
          ...allowedFields,
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
  },
);
export default router;
