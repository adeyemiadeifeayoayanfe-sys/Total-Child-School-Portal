import { supabaseAdmin } from '../config/supabase';
import { AppError, NotFoundError, ForbiddenError, ConflictError } from '../middleware/errorHandler';
import { logAudit } from '../utils/auditLogger';

export async function getReceipts(filters?: {
  student_id?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
}) {
  let query = supabaseAdmin
    .from('receipts')
    .select(`
      *,
      student:students(id, admission_number, first_name, last_name),
      payment:payments(payment_reference, purpose)
    `);

  if (filters?.student_id) query = query.eq('student_id', filters.student_id);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.start_date) query = query.gte('receipt_date', filters.start_date);
  if (filters?.end_date) query = query.lte('receipt_date', filters.end_date);

  const { data, error } = await query.order('receipt_date', { ascending: false });

  if (error) {
    throw new AppError('Failed to fetch receipts', 500);
  }

  return data || [];
}

export async function getReceiptById(receiptId: string) {
  const { data: receipt, error } = await supabaseAdmin
    .from('receipts')
    .select(`
      *,
      student:students(*),
      payment:payments(*)
    `)
    .eq('id', receiptId)
    .single();

  if (error || !receipt) {
    throw new NotFoundError('Receipt not found');
  }

  return receipt;
}

export async function editReceipt(
  receiptId: string,
  input: {
    receipt_number?: string;
    purpose?: string;
    receipt_date?: string;
    void_reason?: string;
  },
  editedBy: string
) {
  const { data: existing } = await supabaseAdmin
    .from('receipts')
    .select('*')
    .eq('id', receiptId)
    .single();

  if (!existing) {
    throw new NotFoundError('Receipt not found');
  }

  if (existing.status === 'voided') {
    throw new ConflictError('Cannot edit a voided receipt');
  }

  const updateData: Record<string, any> = {
    edited_by: editedBy,
    last_edited_at: new Date().toISOString(),
  };

  if (input.receipt_number) updateData.receipt_number = input.receipt_number;
  if (input.purpose) updateData.purpose = input.purpose;
  if (input.receipt_date) updateData.receipt_date = input.receipt_date;

  // Handle voiding
  if (input.void_reason) {
    updateData.status = 'voided';
    updateData.voided_at = new Date().toISOString();
    updateData.void_reason = input.void_reason;

    // Also void the payment
    await supabaseAdmin
      .from('payments')
      .update({ status: 'voided' })
      .eq('id', existing.payment_id);
  }

  const { data: updated, error } = await supabaseAdmin
    .from('receipts')
    .update(updateData)
    .eq('id', receiptId)
    .select()
    .single();

  if (error || !updated) {
    throw new AppError('Failed to edit receipt', 500);
  }

  await logAudit(editedBy, {
    action: 'receipt_edited',
    entity_type: 'receipt',
    entity_id: receiptId,
    old_value: existing,
    new_value: updated,
  });

  return updated;
}

export async function markReceiptPrinted(receiptId: string, printedBy: string) {
  const { data: existing } = await supabaseAdmin
    .from('receipts')
    .select('*')
    .eq('id', receiptId)
    .single();

  if (!existing) {
    throw new NotFoundError('Receipt not found');
  }

  const { data: updated, error } = await supabaseAdmin
    .from('receipts')
    .update({
      status: 'printed',
      printed_at: new Date().toISOString(),
    })
    .eq('id', receiptId)
    .select()
    .single();

  if (error || !updated) {
    throw new AppError('Failed to mark receipt as printed', 500);
  }

  await logAudit(printedBy, {
    action: 'receipt_printed',
    entity_type: 'receipt',
    entity_id: receiptId,
  });

  return updated;
}

export async function getReceiptQueue() {
  const { data, error } = await supabaseAdmin
    .from('receipts')
    .select(`
      *,
      student:students(id, admission_number, first_name, last_name)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    throw new AppError('Failed to fetch receipt queue', 500);
  }

  return data || [];
}