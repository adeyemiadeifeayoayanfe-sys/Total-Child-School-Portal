import { supabaseAdmin } from '../config/supabase';
import config from '../config/env';

interface AuditLogData {
  action: string;
  entity_type: string;
  entity_id?: string;
  old_value?: Record<string, any> | null;
  new_value?: Record<string, any> | null;
  metadata?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}

export async function logAudit(
  userId: string | null,
  data: AuditLogData
): Promise<void> {
  if (!config.auditLoggingEnabled) return;

  try {
    await supabaseAdmin.from('audit_logs').insert({
      user_id: userId,
      action: data.action,
      entity_type: data.entity_type,
      entity_id: data.entity_id || null,
      old_value: data.old_value || null,
      new_value: data.new_value || null,
      metadata: data.metadata || {},
      ip_address: data.ip_address || null,
      user_agent: data.user_agent || null,
    });
  } catch (error) {
    console.error('Audit logging failed:', error);
    // Don't throw - audit logging should not break the main operation
  }
}