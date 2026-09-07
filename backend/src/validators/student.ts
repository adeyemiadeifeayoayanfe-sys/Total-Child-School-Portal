import { z } from 'zod';

export const createStudentSchema = z.object({
  admission_number: z.string().min(1, 'Admission number is required'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  middle_name: z.string().optional().nullable(),
  date_of_birth: z.string().min(1, 'Date of birth is required'),
  gender: z.enum(['male', 'female', 'other']),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  photo_url: z.string().optional().nullable(),
  admission_date: z.string().optional(),
  class_id: z.string().uuid('Invalid class ID').optional().nullable(),
});

export const updateStudentSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  middle_name: z.string().optional().nullable(),
  date_of_birth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  photo_url: z.string().optional().nullable(),
  status: z.enum(['active', 'archived', 'graduated', 'transferred']).optional(),
  current_class_id: z.string().uuid().optional().nullable(),
});

export const assignStudentToClassSchema = z.object({
  student_id: z.string().uuid('Invalid student ID'),
  class_id: z.string().uuid('Invalid class ID'),
  session_id: z.string().uuid('Invalid session ID'),
});

export const assignParentToStudentSchema = z.object({
  parent_id: z.string().uuid('Invalid parent ID'),
  student_id: z.string().uuid('Invalid student ID'),
  is_primary: z.boolean().optional(),
});