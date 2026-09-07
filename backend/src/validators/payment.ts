import { z } from 'zod';

export const recordPaymentSchema = z.object({
  student_id: z.string().uuid('Invalid student ID'),
  amount: z.number().positive('Amount must be positive'),
  purpose: z.string().min(1, 'Purpose is required'),
  payment_date: z.string().optional(),
  payment_method: z.string().optional(),
  session_id: z.string().uuid('Invalid session ID').optional().nullable(),
  idempotency_key: z.string().optional(),
});

export const manualCashbookTxnSchema = z.object({
  transaction_date: z.string().optional(),
  particulars: z.string().min(1, 'Particulars is required'),
  txn_type: z.enum(['credit', 'debit']),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().optional().nullable(),
});

export const editReceiptSchema = z.object({
  receipt_number: z.string().min(1).optional(),
  purpose: z.string().min(1).optional(),
  receipt_date: z.string().optional(),
  void_reason: z.string().optional(),
});