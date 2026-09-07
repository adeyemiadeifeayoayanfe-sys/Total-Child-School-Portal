import { z } from 'zod';

export const generateIndividualResultSchema = z.object({
  student_id: z.string().uuid('Invalid student ID'),
  class_id: z.string().uuid('Invalid class ID'),
  session_id: z.string().uuid('Invalid session ID'),
  term_id: z.string().uuid('Invalid term ID'),
});

export const generateBulkResultSchema = z.object({
  class_id: z.string().uuid('Invalid class ID'),
  session_id: z.string().uuid('Invalid session ID'),
  term_id: z.string().uuid('Invalid term ID'),
});

export const publishResultSchema = z.object({
  result_id: z.string().uuid('Invalid result ID'),
});

export const reviewResultSchema = z.object({
  result_id: z.string().uuid('Invalid result ID'),
});

export const regenerateResultSchema = z.object({
  result_id: z.string().uuid('Invalid result ID'),
  reason: z.string().min(1, 'Reason for regeneration is required'),
});