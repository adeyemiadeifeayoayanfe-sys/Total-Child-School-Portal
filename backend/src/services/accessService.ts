import { supabaseAdmin } from '../config/supabase';
import { ForbiddenError, NotFoundError } from '../middleware/errorHandler';

export async function getTeacherRecordForUser(userId: string) {
  const { data: teacher, error } = await supabaseAdmin
    .from('teachers')
    .select('id, user_id, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (error || !teacher) {
    throw new NotFoundError('Teacher record not found');
  }

  return teacher;
}

export async function ensureTeacherAssignedToClass(teacherId: string, classId: string, sessionId: string) {
  const { data: assignment, error } = await supabaseAdmin
    .from('teacher_class_assignments')
    .select('id')
    .eq('teacher_id', teacherId)
    .eq('class_id', classId)
    .eq('session_id', sessionId)
    .is('unassigned_at', null)
    .single();

  if (error || !assignment) {
    throw new ForbiddenError('You are not assigned to this class for this session');
  }

  return assignment;
}

export async function ensureTeacherAssignedToSubject(
  teacherId: string,
  subjectId: string,
  classId: string,
  sessionId: string
) {
  const { data: assignment, error } = await supabaseAdmin
    .from('teacher_subject_assignments')
    .select('id')
    .eq('teacher_id', teacherId)
    .eq('subject_id', subjectId)
    .eq('class_id', classId)
    .eq('session_id', sessionId)
    .is('unassigned_at', null)
    .single();

  if (error || !assignment) {
    throw new ForbiddenError('You are not assigned to this subject for this class');
  }

  return assignment;
}

export async function getParentRecordForUser(userId: string) {
  const { data: parent, error } = await supabaseAdmin
    .from('parents')
    .select('id, user_id, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (error || !parent) {
    throw new NotFoundError('Parent record not found');
  }

  return parent;
}

export async function ensureParentAssignedToStudent(parentId: string, studentId: string) {
  const { data: assignment, error } = await supabaseAdmin
    .from('parent_child_assignments')
    .select('id')
    .eq('parent_id', parentId)
    .eq('student_id', studentId)
    .is('unassigned_at', null)
    .single();

  if (error || !assignment) {
    throw new ForbiddenError('You do not have access to this child');
  }

  return assignment;
}
