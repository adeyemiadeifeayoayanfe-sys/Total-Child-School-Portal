import { z } from 'zod';

export const submitBroadsheetSchema = z.object({
  class_id: z.string().uuid('Invalid class ID'),
  subject_id: z.string().uuid('Invalid subject ID'),
  session_id: z.string().uuid('Invalid session ID'),
  term_id: z.string().uuid('Invalid term ID'),
});

export const returnBroadsheetSchema = z.object({
  return_reason: z.string().min(1, 'Return reason is required'),
});

export const approveBroadsheetSchema = z.object({
  broadsheet_id: z.string().uuid('Invalid broadsheet ID'),
});