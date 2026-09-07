import { z } from 'zod';

export const createSubjectSchema = z.object({
  name: z.string().min(1, 'Subject name is required'),
  code: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

export const updateSubjectSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
});

export const assignTeacherToSubjectSchema = z.object({
  teacher_id: z.string().uuid('Invalid teacher ID'),
  subject_id: z.string().uuid('Invalid subject ID'),
  class_id: z.string().uuid('Invalid class ID'),
  session_id: z.string().uuid('Invalid session ID'),
});