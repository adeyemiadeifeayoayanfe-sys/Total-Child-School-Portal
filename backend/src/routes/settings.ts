import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, authorizeAdmin, authorizeSuperAdmin } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { getSchoolSettings, updateSchoolSettings, setCurrentSession, setCurrentTerm, setAssessmentStage, getGradingRules, createGradingRule, updateGradingRule, deleteGradingRule } from '../services/settingsService';

const router = Router();

/**
 * GET /api/settings
 * Get school settings
 */
router.get('/', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await getSchoolSettings();
    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/settings
 * Update school settings (Super Admin)
 */
router.put('/', authenticate, authorizeSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await updateSchoolSettings(req.body, req.authUserId!);
    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/settings/set-current-session
 * Set current session (Super Admin)
 */
router.post('/set-current-session', authenticate, authorizeSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { session_id } = req.body;
    const session = await setCurrentSession(session_id, req.authUserId!);
    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/settings/set-current-term
 * Set current term (Super Admin)
 */
router.post('/set-current-term', authenticate, authorizeSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { term_id } = req.body;
    const term = await setCurrentTerm(term_id, req.authUserId!);
    res.json({
      success: true,
      data: term,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/settings/set-assessment-stage
 * Set assessment stage (Super Admin)
 */
router.post('/set-assessment-stage', authenticate, authorizeSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { term_id, stage } = req.body;
    const term = await setAssessmentStage(term_id, stage, req.authUserId!);
    res.json({
      success: true,
      data: term,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/settings/grading-rules
 * Get grading rules
 */
router.get('/grading-rules', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rules = await getGradingRules();
    res.json({
      success: true,
      data: rules,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/settings/grading-rules
 * Create grading rule (Super Admin)
 */
router.post('/grading-rules', authenticate, authorizeSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rule = await createGradingRule(req.body, req.authUserId!);
    res.status(201).json({
      success: true,
      data: rule,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/settings/grading-rules/:id
 * Update grading rule (Super Admin)
 */
router.put('/grading-rules/:id', authenticate, authorizeSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rule = await updateGradingRule(req.params.id, req.body, req.authUserId!);
    res.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/settings/grading-rules/:id
 * Delete grading rule (Super Admin)
 */
router.delete('/grading-rules/:id', authenticate, authorizeSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await deleteGradingRule(req.params.id, req.authUserId!);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
