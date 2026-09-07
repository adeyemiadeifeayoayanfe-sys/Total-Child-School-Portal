import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorizeAdmin, authorizeSuperAdmin } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { getAuditLogs } from '../services/auditLogService';

const router = Router();

/**
 * GET /api/audit-logs
 * Get audit logs (Admin/Super Admin only)
 */
router.get('/', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      user_id: req.query.user_id as string,
      action: req.query.action as string,
      entity_type: req.query.entity_type as string,
      entity_id: req.query.entity_id as string,
      start_date: req.query.start_date as string,
      end_date: req.query.end_date as string,
      limit: parseInt(req.query.limit as string) || 100,
      offset: parseInt(req.query.offset as string) || 0,
    };

    const logs = await getAuditLogs(filters);
    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    next(error);
  }
});

export default router;