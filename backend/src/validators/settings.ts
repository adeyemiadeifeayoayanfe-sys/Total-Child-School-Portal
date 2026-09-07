import { z } from 'zod';

export const updateSchoolSettingsSchema = z.object({
  school_name: z.string().min(1).optional(),
  school_logo: z.string().optional().nullable(),
  school_address: z.string().optional().nullable(),
  school_phone: z.string().optional().nullable(),
  school_email: z.string().email().optional().nullable(),
  current_session_id: z.string().uuid().optional(),
  current_term_id: z.string().uuid().optional(),
  assessment_stage: z.enum(['classes', 'first_test', 'second_test', 'third_test', 'examination']).optional(),
});

export const updateGradingRuleSchema = z.object({
  grade: z.string().min(1),
  min_score: z.number().min(0).max(100),
  max_score: z.number().min(0).max(100),
  remarks: z.string().optional().nullable(),
  sort_order: z.number().int().optional(),
});

export const createGradingRuleSchema = updateGradingRuleSchema;