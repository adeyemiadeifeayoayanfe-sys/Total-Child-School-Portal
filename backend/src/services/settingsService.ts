import { supabaseAdmin } from '../config/supabase';
import { AppError, NotFoundError } from '../middleware/errorHandler';
import { logAudit } from '../utils/auditLogger';

export async function getSchoolSettings() {
  const { data: settings, error } = await supabaseAdmin
    .from('school_settings')
    .select('*');

  if (error) {
    throw new AppError('Failed to fetch school settings', 500);
  }

  // Convert to key-value object
  const settingsObject: Record<string, any> = {};
  for (const setting of settings || []) {
    settingsObject[setting.setting_key] = setting.setting_value;
  }

  return settingsObject;
}

export async function updateSchoolSettings(
  input: Record<string, any>,
  updatedBy: string
) {
  const updatedSettings = [];

  for (const [key, value] of Object.entries(input)) {
    const { data: existing } = await supabaseAdmin
      .from('school_settings')
      .select('id')
      .eq('setting_key', key)
      .single();

    if (existing) {
      const { data: updated } = await supabaseAdmin
        .from('school_settings')
        .update({
          setting_value: value,
          updated_by: updatedBy,
        })
        .eq('setting_key', key)
        .select()
        .single();

      updatedSettings.push(updated);
    } else {
      const { data: created } = await supabaseAdmin
        .from('school_settings')
        .insert({
          setting_key: key,
          setting_value: value,
          updated_by: updatedBy,
        })
        .select()
        .single();

      updatedSettings.push(created);
    }
  }

  await logAudit(updatedBy, {
    action: 'school_settings_updated',
    entity_type: 'school_settings',
    metadata: { updated_keys: Object.keys(input) },
  });

  return updatedSettings;
}

export async function setCurrentSession(sessionId: string, updatedBy: string) {
  // Unset all current sessions
  await supabaseAdmin
    .from('academic_sessions')
    .update({ is_current: false })
    .neq('id', '00000000-0000-0000-0000-000000000000');

  // Set new current session
  const { data: session, error } = await supabaseAdmin
    .from('academic_sessions')
    .update({ is_current: true })
    .eq('id', sessionId)
    .select()
    .single();

  if (error || !session) {
    throw new NotFoundError('Session not found');
  }

  await logAudit(updatedBy, {
    action: 'current_session_changed',
    entity_type: 'academic_session',
    entity_id: sessionId,
  });

  return session;
}

export async function setCurrentTerm(termId: string, updatedBy: string) {
  const { data: term } = await supabaseAdmin
    .from('terms')
    .select('*')
    .eq('id', termId)
    .single();

  if (!term) {
    throw new NotFoundError('Term not found');
  }

  // Unset all current terms in this session
  await supabaseAdmin
    .from('terms')
    .update({ is_current: false })
    .eq('session_id', term.session_id);

  // Set new current term
  const { data: updated, error } = await supabaseAdmin
    .from('terms')
    .update({ is_current: true })
    .eq('id', termId)
    .select()
    .single();

  if (error || !updated) {
    throw new AppError('Failed to set current term', 500);
  }

  await logAudit(updatedBy, {
    action: 'current_term_changed',
    entity_type: 'term',
    entity_id: termId,
  });

  return updated;
}

export async function setAssessmentStage(
  termId: string,
  stage: string,
  updatedBy: string
) {
  const { data: term } = await supabaseAdmin
    .from('terms')
    .select('*')
    .eq('id', termId)
    .single();

  if (!term) {
    throw new NotFoundError('Term not found');
  }

  const { data: updated, error } = await supabaseAdmin
    .from('terms')
    .update({ assessment_stage: stage })
    .eq('id', termId)
    .select()
    .single();

  if (error || !updated) {
    throw new AppError('Failed to update assessment stage', 500);
  }

  await logAudit(updatedBy, {
    action: 'assessment_stage_changed',
    entity_type: 'term',
    entity_id: termId,
    metadata: { old_stage: term.assessment_stage, new_stage: stage },
  });

  return updated;
}

export async function getGradingRules() {
  const { data, error } = await supabaseAdmin
    .from('grading_rules')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    throw new AppError('Failed to fetch grading rules', 500);
  }

  return data || [];
}

export async function createGradingRule(
  input: {
    grade: string;
    min_score: number;
    max_score: number;
    remarks?: string | null;
    sort_order?: number;
  },
  createdBy: string
) {
  const { data, error } = await supabaseAdmin
    .from('grading_rules')
    .insert({
      grade: input.grade,
      min_score: input.min_score,
      max_score: input.max_score,
      remarks: input.remarks || null,
      sort_order: input.sort_order || 0,
    })
    .select()
    .single();

  if (error || !data) {
    throw new AppError('Failed to create grading rule', 500);
  }

  await logAudit(createdBy, {
    action: 'grading_rule_created',
    entity_type: 'grading_rule',
    entity_id: data.id,
    new_value: data,
  });

  return data;
}

export async function updateGradingRule(
  ruleId: string,
  input: {
    grade?: string;
    min_score?: number;
    max_score?: number;
    remarks?: string | null;
    sort_order?: number;
    is_active?: boolean;
  },
  updatedBy: string
) {
  const { data: existing } = await supabaseAdmin
    .from('grading_rules')
    .select('*')
    .eq('id', ruleId)
    .single();

  if (!existing) {
    throw new NotFoundError('Grading rule not found');
  }

  const { data: updated, error } = await supabaseAdmin
    .from('grading_rules')
    .update(input)
    .eq('id', ruleId)
    .select()
    .single();

  if (error || !updated) {
    throw new AppError('Failed to update grading rule', 500);
  }

  await logAudit(updatedBy, {
    action: 'grading_rule_updated',
    entity_type: 'grading_rule',
    entity_id: ruleId,
    old_value: existing,
    new_value: updated,
  });

  return updated;
}

export async function deleteGradingRule(ruleId: string, deletedBy: string) {
  const { error } = await supabaseAdmin
    .from('grading_rules')
    .delete()
    .eq('id', ruleId);

  if (error) {
    throw new AppError('Failed to delete grading rule', 500);
  }

  await logAudit(deletedBy, {
    action: 'grading_rule_deleted',
    entity_type: 'grading_rule',
    entity_id: ruleId,
  });

  return { success: true };
}