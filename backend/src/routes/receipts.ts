import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, authorizeAdmin } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { AppError, NotFoundError } from '../middleware/errorHandler';
import { editReceiptSchema } from '../validators/payment';
import { getReceipts, getReceiptById, editReceipt, markReceiptPrinted, getReceiptQueue } from '../services/receiptService';

const router = Router();

/**
 * GET /api/receipts
 * List all receipts with filters
 */
router.get('/', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      student_id: req.query.student_id as string,
      status: req.query.status as string,
      start_date: req.query.start_date as string,
      end_date: req.query.end_date as string,
    };

    const receipts = await getReceipts(filters);
    res.json({
      success: true,
      data: receipts,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/receipts/queue
 * Get receipt queue (pending receipts)
 */
router.get('/queue', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const queue = await getReceiptQueue();
    res.json({
      success: true,
      data: queue,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/receipts/:id
 * Get receipt by ID
 */
router.get('/:id', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const receipt = await getReceiptById(req.params.id);
    res.json({
      success: true,
      data: receipt,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/receipts/:id
 * Edit receipt (Admin)
 */
router.put('/:id', authenticate, authorizeAdmin, validate(editReceiptSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const receipt = await editReceipt(req.params.id, req.body, req.authUserId!);
    res.json({
      success: true,
      data: receipt,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/receipts/:id/print
 * Mark receipt as printed (Admin)
 */
router.post('/:id/print', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const receipt = await markReceiptPrinted(req.params.id, req.authUserId!);
    res.json({
      success: true,
      data: receipt,
    });
  } catch (error) {
    next(error);
  }
});

export default router;