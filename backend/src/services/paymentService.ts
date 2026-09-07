import { supabaseAdmin } from '../config/supabase';
import { AppError, NotFoundError, ConflictError, ValidationError } from '../middleware/errorHandler';
import { logAudit } from '../utils/auditLogger';
import { createNotification, notifyAdmins } from '../utils/notifications';
import { generatePaymentReference, generateReceiptNumber, generateIdempotencyKey } from '../utils/idGenerator';

interface RecordPaymentInput {
  student_id: string;
  amount: number;
  purpose: string;
  payment_date?: string;
  payment_method?: string;
  session_id?: string | null;
  idempotency_key?: string;
}

interface ManualCashbookTxnInput {
  transaction_date?: string;
  particulars: string;
  txn_type: 'credit' | 'debit';
  amount: number;
  description?: string | null;
}

export async function recordPayment(
  input: RecordPaymentInput,
  recordedBy: string
) {
  const idempotencyKey = input.idempotency_key || generateIdempotencyKey();

  // Check for existing payment with same idempotency key
  const { data: existingPayment } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('idempotency_key', idempotencyKey)
    .single();

  if (existingPayment) {
    // Return existing payment with its receipt
    const { data: existingReceipt } = await supabaseAdmin
      .from('receipts')
      .select('*')
      .eq('payment_id', existingPayment.id)
      .single();

    return {
      payment: existingPayment,
      cashbook_transaction: null,
      receipt: existingReceipt,
      already_processed: true,
    };
  }

  // Verify student exists
  const { data: student } = await supabaseAdmin
    .from('students')
    .select('id, first_name, last_name, admission_number')
    .eq('id', input.student_id)
    .single();

  if (!student) {
    throw new NotFoundError('Student not found');
  }

  const paymentReference = generatePaymentReference();
  const receiptNumber = generateReceiptNumber();
  const paymentDate = input.payment_date || new Date().toISOString().split('T')[0];

  // Begin transaction - all or nothing
  const { data: payment, error: paymentError } = await supabaseAdmin
    .from('payments')
    .insert({
      payment_reference: paymentReference,
      student_id: input.student_id,
      session_id: input.session_id || null,
      amount: input.amount,
      purpose: input.purpose,
      payment_date: paymentDate,
      payment_method: input.payment_method || 'cash',
      status: 'completed',
      recorded_by: recordedBy,
      idempotency_key: idempotencyKey,
    })
    .select()
    .single();

  if (paymentError || !payment) {
    console.error('Payment creation error:', paymentError);
    throw new AppError('Failed to record payment', 500);
  }

  // Calculate running balance for cashbook
  const { data: lastTxn } = await supabaseAdmin
    .from('cashbook_transactions')
    .select('running_balance')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const currentBalance = lastTxn?.running_balance || 0;
  const newBalance = currentBalance + input.amount;

  // Create cashbook transaction
  const { data: cashbookTxn, error: cashbookError } = await supabaseAdmin
    .from('cashbook_transactions')
    .insert({
      transaction_date: paymentDate,
      particulars: `${student.first_name} ${student.last_name} - ${input.purpose}`,
      txn_type: 'credit',
      amount: input.amount,
      description: `Payment received from ${student.first_name} ${student.last_name}`,
      payment_id: payment.id,
      running_balance: newBalance,
      recorded_by: recordedBy,
    })
    .select()
    .single();

  if (cashbookError || !cashbookTxn) {
    // Rollback - delete payment
    await supabaseAdmin.from('payments').delete().eq('id', payment.id);
    console.error('Cashbook creation error:', cashbookError);
    throw new AppError('Failed to create cashbook entry', 500);
  }

  // Create receipt queue record
  const { data: receipt, error: receiptError } = await supabaseAdmin
    .from('receipts')
    .insert({
      receipt_number: receiptNumber,
      payment_id: payment.id,
      student_id: input.student_id,
      amount: input.amount,
      purpose: input.purpose,
      receipt_date: paymentDate,
      status: 'pending',
    })
    .select()
    .single();

  if (receiptError || !receipt) {
    // Rollback - delete payment and cashbook
    await supabaseAdmin.from('cashbook_transactions').delete().eq('id', cashbookTxn.id);
    await supabaseAdmin.from('payments').delete().eq('id', payment.id);
    console.error('Receipt creation error:', receiptError);
    throw new AppError('Failed to create receipt', 500);
  }

  await logAudit(recordedBy, {
    action: 'payment_created',
    entity_type: 'payment',
    entity_id: payment.id,
    metadata: {
      student_id: input.student_id,
      amount: input.amount,
      purpose: input.purpose,
      payment_reference: paymentReference,
    },
  });

  await notifyAdmins(
    'Payment Received',
    `Payment of ₦${input.amount.toLocaleString()} received from ${student.first_name} ${student.last_name} for ${input.purpose}.`,
    'success',
    '/payments'
  );

  // Notify parent
  const { data: parentAssignment } = await supabaseAdmin
    .from('parent_child_assignments')
    .select('parent_id')
    .eq('student_id', input.student_id)
    .is('unassigned_at', null)
    .single();

  if (parentAssignment) {
    const { data: parent } = await supabaseAdmin
      .from('parents')
      .select('user_id')
      .eq('id', parentAssignment.parent_id)
      .single();

    if (parent) {
      await createNotification({
        user_id: parent.user_id,
        title: 'Payment Recorded',
        message: `A payment of ₦${input.amount.toLocaleString()} has been recorded for your child.`,
        notification_type: 'success',
        link: '/payments',
      });
    }
  }

  return {
    payment,
    cashbook_transaction: cashbookTxn,
    receipt,
    already_processed: false,
  };
}

export async function addManualCashbookTransaction(
  input: ManualCashbookTxnInput,
  recordedBy: string
) {
  const txnDate = input.transaction_date || new Date().toISOString().split('T')[0];

  // Get current balance
  const { data: lastTxn } = await supabaseAdmin
    .from('cashbook_transactions')
    .select('running_balance')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const currentBalance = lastTxn?.running_balance || 0;
  
  let newBalance: number;
  if (input.txn_type === 'credit') {
    newBalance = currentBalance + input.amount;
  } else {
    newBalance = currentBalance - input.amount;
    
    // Check if balance goes negative
    if (newBalance < 0) {
      throw new ValidationError('Insufficient balance for this debit transaction');
    }
  }

  const { data: txn, error } = await supabaseAdmin
    .from('cashbook_transactions')
    .insert({
      transaction_date: txnDate,
      particulars: input.particulars,
      txn_type: input.txn_type,
      amount: input.amount,
      description: input.description || null,
      running_balance: newBalance,
      recorded_by: recordedBy,
    })
    .select()
    .single();

  if (error || !txn) {
    console.error('Cashbook transaction error:', error);
    throw new AppError('Failed to add cashbook transaction', 500);
  }

  await logAudit(recordedBy, {
    action: 'cashbook_transaction_created',
    entity_type: 'cashbook_transaction',
    entity_id: txn.id,
    metadata: {
      particulars: input.particulars,
      txn_type: input.txn_type,
      amount: input.amount,
    },
  });

  return txn;
}

export async function getCashbook(filters?: {
  start_date?: string;
  end_date?: string;
  txn_type?: string;
}) {
  let query = supabaseAdmin
    .from('cashbook_transactions')
    .select(`
      *,
      recorded_by_user:users(id, email),
      payment:payments(payment_reference, purpose)
    `);

  if (filters?.start_date) {
    query = query.gte('transaction_date', filters.start_date);
  }
  if (filters?.end_date) {
    query = query.lte('transaction_date', filters.end_date);
  }
  if (filters?.txn_type) {
    query = query.eq('txn_type', filters.txn_type);
  }

  const { data, error } = await query.order('transaction_date', { ascending: false });

  if (error) {
    throw new AppError('Failed to fetch cashbook', 500);
  }

  // Calculate summary
  const summary = {
    total_credits: 0,
    total_debits: 0,
    balance: 0,
  };

  if (data) {
    for (const txn of data) {
      if (txn.txn_type === 'credit') {
        summary.total_credits += txn.amount;
      } else {
        summary.total_debits += txn.amount;
      }
    }
    summary.balance = summary.total_credits - summary.total_debits;
  }

  return {
    transactions: data || [],
    summary,
  };
}

export async function getPayments(filters?: {
  student_id?: string;
  session_id?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
}) {
  let query = supabaseAdmin
    .from('payments')
    .select(`
      *,
      student:students(id, admission_number, first_name, last_name),
      receipt:receipts(*)
    `);

  if (filters?.student_id) query = query.eq('student_id', filters.student_id);
  if (filters?.session_id) query = query.eq('session_id', filters.session_id);
  if (filters?.start_date) query = query.gte('payment_date', filters.start_date);
  if (filters?.end_date) query = query.lte('payment_date', filters.end_date);
  if (filters?.status) query = query.eq('status', filters.status);

  const { data, error } = await query.order('payment_date', { ascending: false });

  if (error) {
    throw new AppError('Failed to fetch payments', 500);
  }

  return data || [];
}

export async function getPaymentById(paymentId: string) {
  const { data: payment, error } = await supabaseAdmin
    .from('payments')
    .select(`
      *,
      student:students(*),
      receipt:receipts(*),
      cashbook_transaction:cashbook_transactions(*)
    `)
    .eq('id', paymentId)
    .single();

  if (error || !payment) {
    throw new NotFoundError('Payment not found');
  }

  return payment;
}
