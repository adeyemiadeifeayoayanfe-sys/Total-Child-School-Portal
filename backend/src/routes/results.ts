import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, authorizeAdmin, authorizeParent } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { AppError, NotFoundError, ForbiddenError } from '../middleware/errorHandler';
import { generateIndividualResultSchema, generateBulkResultSchema, publishResultSchema, reviewResultSchema, regenerateResultSchema } from '../validators/result';
import { generateIndividualResult, generateBulkClassResults, reviewResult, publishResult, getResultById, getResults, getResultHistory, regenerateResult } from '../services/resultService';

const router = Router();

/**
 * GET /api/results
 * List all results with filters
 */
router.get('/', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      student_id: req.query.student_id as string,
      class_id: req.query.class_id as string,
      session_id: req.query.session_id as string,
      term_id: req.query.term_id as string,
      status: req.query.status as string,
    };

    const results = await getResults(filters);
    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/results/:id
 * Get result by ID
 */
router.get('/:id', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await getResultById(req.params.id);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/results/:id/history
 * Get result version history
 */
router.get('/:id/history', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const history = await getResultHistory(req.params.id);
    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/results/generate
 * Generate individual result (Admin)
 */
router.post('/generate', authenticate, authorizeAdmin, validate(generateIndividualResultSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await generateIndividualResult(req.body, req.authUserId!);
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/results/bulk-generate
 * Generate bulk class results (Admin)
 */
router.post('/bulk-generate', authenticate, authorizeAdmin, validate(generateBulkResultSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const summary = await generateBulkClassResults(req.body, req.authUserId!);
    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/results/:id/review
 * Review result (Admin)
 */
router.post('/:id/review', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await reviewResult(req.params.id, req.authUserId!);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/results/:id/publish
 * Publish result (Admin)
 */
router.post('/:id/publish', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await publishResult(req.params.id, req.authUserId!);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/results/:id/regenerate
 * Regenerate result (Admin)
 */
router.post('/:id/regenerate', authenticate, authorizeAdmin, validate(regenerateResultSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await regenerateResult(
      req.params.id,
      req.body.reason,
      req.authUserId!
    );
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
