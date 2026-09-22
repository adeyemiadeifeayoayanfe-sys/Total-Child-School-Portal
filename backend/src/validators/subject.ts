import { z } from 'zod';
const optionalText = z.string().trim().optional().nullable();
export const createSubjectSchema = z.object({
  name: z.string().trim().min(1, 'Subject name is required'),
  code: optionalText,
  description: optionalText,
});
export const updateSubjectSchema = z.object({
  name: z.string().trim().min(1).optional(),
  code: optionalText,
  description: optionalText,
  is_active: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  'At least one field must be provided'
);
export const assignTeacherToSubjectSchema = z.object({
  teacher_id: z.string().uuid('Invalid teacher ID'),
  subject_id: z.string().uuid('Invalid subject ID'),
  class_id: z.string().uuid('Invalid class ID'),
  session_id: z.string().uuid('Invalid session ID'),
});
