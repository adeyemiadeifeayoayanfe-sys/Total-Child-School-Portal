import { supabaseAdmin } from '../config/supabase';
import { AppError, NotFoundError, ConflictError } from '../middleware/errorHandler';
import { logAudit } from '../utils/auditLogger';
import { generateStaffNumber } from '../utils/idGenerator';
import { createUser } from './authService';

interface CreateTeacherInput {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  address?: string | null;
  qualification?: string | null;
  specialization?: string | null;
  date_hired?: string | null;
}

export async function createTeacher(input: CreateTeacherInput, createdBy: string) {
  // Create user account first
  const { user } = await createUser({
    email: input.email,
    password: input.password,
    roles: ['teacher'],
    first_name: input.first_name,
    last_name: input.last_name,
    phone: input.phone,
    address: input.address,
  }, createdBy);

  // Create teacher record
  const { data: teacher, error } = await supabaseAdmin
    .from('teachers')
    .insert({
      user_id: user.id,
      staff_number: generateStaffNumber(),
      qualification: input.qualification || null,
      specialization: input.specialization || null,
      date_hired: input.date_hired || new Date().toISOString().split('T')[0],
      created_by: createdBy,
    })
    .select()
    .single();

  if (error || !teacher) {
    // Cleanup - delete user
    await supabaseAdmin.from('users').delete().eq('id', user.id);
    console.error('Teacher creation error:', error);
    throw new AppError('Failed to create teacher record', 500);
  }

  await logAudit(createdBy, {
    action: 'teacher_created',
    entity_type: 'teacher',
    entity_id: teacher.id,
    new_value: { email: input.email, name: `${input.first_name} ${input.last_name}` },
  });

  return { teacher, user };
}

export async function updateTeacher(teacherId: string, input: Partial<CreateTeacherInput>, updatedBy: string) {
  const { data: existing } = await supabaseAdmin
    .from('teachers')
    .select('*')
    .eq('id', teacherId)
    .single();

  if (!existing) {
    throw new NotFoundError('Teacher not found');
  }

  const updateData: Record<string, any> = {};
  if (input.qualification !== undefined) updateData.qualification = input.qualification;
  if (input.specialization !== undefined) updateData.specialization = input.specialization;
  if (input.date_hired !== undefined) updateData.date_hired = input.date_hired;

  const { data: teacher, error } = await supabaseAdmin
    .from('teachers')
    .update(updateData)
    .eq('id', teacherId)
    .select()
    .single();

  if (error || !teacher) {
    throw new AppError('Failed to update teacher', 500);
  }

  // Update profile if name/phone changed
  if (input.first_name || input.last_name || input.phone || input.address) {
    const profileUpdate: Record<string, any> = {};
    if (input.first_name) profileUpdate.first_name = input.first_name;
    if (input.last_name) profileUpdate.last_name = input.last_name;
    if (input.phone !== undefined) profileUpdate.phone = input.phone;
    if (input.address !== undefined) profileUpdate.address = input.address;

    await supabaseAdmin
      .from('profiles')
      .update(profileUpdate)
      .eq('user_id', existing.user_id);
  }

  await logAudit(updatedBy, {
    action: 'teacher_updated',
    entity_type: 'teacher',
    entity_id: teacherId,
    old_value: existing,
    new_value: teacher,
  });

  return teacher;
}

export async function deactivateTeacher(teacherId: string, deactivatedBy: string) {
  const { data: teacher } = await supabaseAdmin
    .from('teachers')
    .select('*')
    .eq('id', teacherId)
    .single();

  if (!teacher) {
    throw new NotFoundError('Teacher not found');
  }

  await supabaseAdmin
    .from('teachers')
    .update({ is_active: false })
    .eq('id', teacherId);

  await supabaseAdmin
    .from('users')
    .update({ status: 'inactive' })
    .eq('id', teacher.user_id);

  await logAudit(deactivatedBy, {
    action: 'teacher_deactivated',
    entity_type: 'teacher',
    entity_id: teacherId,
  });

  return { success: true };
}

export async function activateTeacher(teacherId: string, activatedBy: string) {
  const { data: teacher } = await supabaseAdmin
    .from('teachers')
    .select('*')
    .eq('id', teacherId)
    .single();

  if (!teacher) {
    throw new NotFoundError('Teacher not found');
  }

  await supabaseAdmin
    .from('teachers')
    .update({ is_active: true })
    .eq('id', teacherId);

  await supabaseAdmin
    .from('users')
    .update({ status: 'active' })
    .eq('id', teacher.user_id);

  await logAudit(activatedBy, {
    action: 'teacher_activated',
    entity_type: 'teacher',
    entity_id: teacherId,
  });

  return { success: true };
}

export async function assignTeacherToClass(
  teacherId: string,
  classId: string,
  sessionId: string,
  isClassTeacher: boolean,
  assignedBy: string
) {
  const { data: existing } = await supabaseAdmin
    .from('teacher_class_assignments')
    .select('id')
    .eq('teacher_id', teacherId)
    .eq('class_id', classId)
    .eq('session_id', sessionId)
    .single();

  if (existing) {
    throw new ConflictError('Teacher is already assigned to this class for this session');
  }

  const { data: assignment, error } = await supabaseAdmin
    .from('teacher_class_assignments')
    .insert({
      teacher_id: teacherId,
      class_id: classId,
      session_id: sessionId,
      is_class_teacher: isClassTeacher || false,
      created_by: assignedBy,
    })
    .select()
    .single();

  if (error || !assignment) {
    throw new AppError('Failed to assign teacher to class', 500);
  }

  await logAudit(assignedBy, {
    action: 'teacher_class_assignment',
    entity_type: 'teacher_class_assignment',
    entity_id: assignment.id,
    metadata: { teacher_id: teacherId, class_id: classId, session_id: sessionId },
  });

  return assignment;
}

export async function assignTeacherToSubject(
  teacherId: string,
  subjectId: string,
  classId: string,
  sessionId: string,
  assignedBy: string
) {
  const { data: existing } = await supabaseAdmin
    .from('teacher_subject_assignments')
    .select('id')
    .eq('teacher_id', teacherId)
    .eq('subject_id', subjectId)
    .eq('class_id', classId)
    .eq('session_id', sessionId)
    .single();

  if (existing) {
    throw new ConflictError('Teacher is already assigned to this subject for this class');
  }

  const { data: assignment, error } = await supabaseAdmin
    .from('teacher_subject_assignments')
    .insert({
      teacher_id: teacherId,
      subject_id: subjectId,
      class_id: classId,
      session_id: sessionId,
      created_by: assignedBy,
    })
    .select()
    .single();

  if (error || !assignment) {
    throw new AppError('Failed to assign teacher to subject', 500);
  }

  await logAudit(assignedBy, {
    action: 'teacher_subject_assignment',
    entity_type: 'teacher_subject_assignment',
    entity_id: assignment.id,
    metadata: { teacher_id: teacherId, subject_id: subjectId, class_id: classId, session_id: sessionId },
  });

  return assignment;
}

export async function getTeacherAssignments(teacherId: string) {
  const { data: teacher } = await supabaseAdmin
    .from('teachers')
    .select('*')
    .eq('id', teacherId)
    .single();

  if (!teacher) {
    throw new NotFoundError('Teacher not found');
  }

  const { data: classAssignments } = await supabaseAdmin
    .from('teacher_class_assignments')
    .select(`
      *,
      class:classes(*),
      session:academic_sessions(*)
    `)
    .eq('teacher_id', teacherId)
    .is('unassigned_at', null);

  const { data: subjectAssignments } = await supabaseAdmin
    .from('teacher_subject_assignments')
    .select(`
      *,
      subject:subjects(*),
      class:classes(*),
      session:academic_sessions(*)
    `)
    .eq('teacher_id', teacherId)
    .is('unassigned_at', null);

  return {
    teacher,
    classAssignments: classAssignments || [],
    subjectAssignments: subjectAssignments || [],
  };
}