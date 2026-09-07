import { z } from 'zod';

export const scoreEntrySchema = z.object({
  student_id: z.string().uuid('Invalid student ID'),
  subject_id: z.string().uuid('Invalid subject ID'),
  class_id: z.string().uuid('Invalid class ID'),
  session_id: z.string().uuid('Invalid session ID'),
  term_id: z.string().uuid('Invalid term ID'),
  test1: z.number().min(0).max(20).optional().nullable(),
  test2: z.number().min(0).max(20).optional().nullable(),
  test3: z.number().min(0).max(20).optional().nullable(),
  examination: z.number().min(0).max(40).optional().nullable(),
});

export const bulkScoreEntrySchema = z.object({
  scores: z.array(scoreEntrySchema).min(1, 'At least one score is required'),
});

export const updateScoreSchema = z.object({
  test1: z.number().min(0).max(20).optional(),
  test2: z.number().min(0).max(20).optional(),
  test3: z.number().min(0).max(20).optional(),
  examination: z.number().min(0).max(40).optional(),
});