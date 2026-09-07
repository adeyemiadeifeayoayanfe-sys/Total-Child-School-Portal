import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, authorizeAdmin } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { AppError, NotFoundError } from '../middleware/errorHandler';
import { recordPaymentSchema, manualCashbookTxnSchema } from '../validators/payment';
import { recordPayment, addManualCashbookTransaction, getCashbook, getPayments, getPaymentById } from '../services/paymentService';

const router = Router();

/**
 * POST /api/payments
 * Record a payment (Admin)
 */
router.post('/', authenticate, authorizeAdmin, validate(recordPaymentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await recordPayment(req.body, req.authUserId!);
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/payments
 * List all payments with filters
 */
router.get('/', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      student_id: req.query.student_id as string,
      session_id: req.query.session_id as string,
      start_date: req.query.start_date as string,
      end_date: req.query.end_date as string,
      status: req.query.status as string,
    };

    const payments = await getPayments(filters);
    res.json({
      success: true,
      data: payments,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/payments/cashbook
 * Get cashbook entries
 */
router.get('/cashbook', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      start_date: req.query.start_date as string,
      end_date: req.query.end_date as string,
      txn_type: req.query.txn_type as string,
    };

    const cashbook = await getCashbook(filters);
    res.json({
      success: true,
      data: cashbook,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/payments/cashbook/manual
 * Add manual cashbook transaction (Admin)
 */
router.post('/cashbook/manual', authenticate, authorizeAdmin, validate(manualCashbookTxnSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const txn = await addManualCashbookTransaction(req.body, req.authUserId!);
    res.status(201).json({
      success: true,
      data: txn,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/payments/:id
 * Get payment by ID
 */
router.get('/:id', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payment = await getPaymentById(req.params.id);
    res.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
