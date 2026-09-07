import { z } from 'zod';

export const takeAttendanceSchema = z.object({
  class_id: z.string().uuid('Invalid class ID'),
  session_id: z.string().uuid('Invalid session ID'),
  term_id: z.string().uuid('Invalid term ID'),
  attendance_date: z.string().min(1, 'Date is required'),
  records: z.array(
    z.object({
      student_id: z.string().uuid('Invalid student ID'),
      status: z.enum(['present', 'absent', 'late', 'excused']),
      remarks: z.string().optional().nullable(),
    })
  ).min(1, 'At least one attendance record is required'),
});

export const updateAttendanceSchema = z.object({
  status: z.enum(['present', 'absent', 'late', 'excused']),
  remarks: z.string().optional().nullable(),
});