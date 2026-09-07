import { z } from 'zod';

export const createClassSchema = z.object({
  name: z.string().min(1, 'Class name is required'),
  description: z.string().optional().nullable(),
});

export const updateClassSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
});

export const assignTeacherToClassSchema = z.object({
  teacher_id: z.string().uuid('Invalid teacher ID'),
  class_id: z.string().uuid('Invalid class ID'),
  session_id: z.string().uuid('Invalid session ID'),
  is_class_teacher: z.boolean().optional(),
});

export const assignSubjectToClassSchema = z.object({
  class_id: z.string().uuid('Invalid class ID'),
  subject_id: z.string().uuid('Invalid subject ID'),
  session_id: z.string().uuid('Invalid session ID'),
});