import { z } from 'zod';
const optionalText = z.string().trim().optional().nullable();
const admissionNumbers = z
  .array(
    z.string().trim().regex(/^\d{4}$/, 'Admission number must be exactly 4 digits')
  )
  .optional();
export const createParentSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  first_name: z.string().trim().min(1, 'First name is required'),
  last_name: z.string().trim().min(1, 'Last name is required'),
  phone: optionalText,
  address: optionalText,
  occupation: optionalText,
  relationship_to_student: optionalText,
  alternate_phone: optionalText,
  admission_numbers: admissionNumbers,
  is_primary: z.boolean().optional(),
});
export const updateParentSchema = z.object({
  first_name: z.string().trim().min(1).optional(),
  last_name: z.string().trim().min(1).optional(),
  phone: optionalText,
  address: optionalText,
  occupation: optionalText,
  relationship_to_student: optionalText,
  alternate_phone: optionalText,
}).refine(
  (data) => Object.keys(data).length > 0,
  'At least one field must be provided'
);
export const assignParentChildrenSchema = z.object({
  parent_id: z.string().uuid('Invalid parent ID'),
  admission_numbers: z
    .array(
      z.string().trim().regex(
        /^\d{4}$/,
        'Admission number must be exactly 4 digits'
      )
    )
    .min(1, 'At least one admission number is required'),
  is_primary: z.boolean().optional(),
});
