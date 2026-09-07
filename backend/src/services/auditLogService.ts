import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

export async function getAuditLogs(filters?: {
  user_id?: string;
  action?: string;
  entity_type?: string;
  entity_id?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}) {
  let query = supabaseAdmin
    .from('audit_logs')
    .select(`
      *,
      user:users(id, email, role)
    `);

  if (filters?.user_id) query = query.eq('user_id', filters.user_id);
  if (filters?.action) query = query.eq('action', filters.action);
  if (filters?.entity_type) query = query.eq('entity_type', filters.entity_type);
  if (filters?.entity_id) query = query.eq('entity_id', filters.entity_id);
  if (filters?.start_date) query = query.gte('created_at', filters.start_date);
  if (filters?.end_date) query = query.lte('created_at', filters.end_date);

  const limit = filters?.limit || 100;
  const offset = filters?.offset || 0;

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new AppError('Failed to fetch audit logs', 500);
  }

  return {
    logs: data || [],
    total: count || 0,
    limit,
    offset,
  };
}