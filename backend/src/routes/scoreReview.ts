import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorizeSuperAdmin } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { correctScoreSchema } from '../validators/scoreReview';
import { correctScoreAsSuperAdmin, getScoreReviewBroadsheet, getScoreReviewOverview, getScoreReviewStudent } from '../services/scoreReviewService';

const router = Router();

router.use(authenticate, authorizeSuperAdmin);

router.get('/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getScoreReviewOverview(req.query as Record<string, string>);
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

router.get('/broadsheet', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getScoreReviewBroadsheet(req.query as any);
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

router.get('/student/:studentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getScoreReviewStudent(req.params.studentId, req.query as any);
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

router.post('/scores/:id/correct', validate(correctScoreSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await correctScoreAsSuperAdmin(req.params.id, req.body, req.authUserId!);
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

export default router;
