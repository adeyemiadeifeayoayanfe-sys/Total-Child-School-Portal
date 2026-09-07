import { supabaseAdmin } from '../config/supabase';
import { AppError, NotFoundError, ConflictError } from '../middleware/errorHandler';
import { logAudit } from '../utils/auditLogger';
import { createNotification } from '../utils/notifications';

interface CreateStudentInput {
  admission_number: string;
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  date_of_birth: string;
  gender: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  photo_url?: string | null;
  admission_date?: string;
  class_id?: string | null;
}

export async function createStudent(input: CreateStudentInput, createdBy: string) {
  // Check if admission number exists
  const { data: existing } = await supabaseAdmin
    .from('students')
    .select('id')
    .eq('admission_number', input.admission_number)
    .single();

  if (existing) {
    throw new ConflictError('A student with this admission number already exists');
  }

  const { data: student, error } = await supabaseAdmin
    .from('students')
    .insert({
      admission_number: input.admission_number,
      first_name: input.first_name,
      last_name: input.last_name,
      middle_name: input.middle_name || null,
      date_of_birth: input.date_of_birth,
      gender: input.gender,
      address: input.address || null,
      phone: input.phone || null,
      email: input.email || null,
      photo_url: input.photo_url || null,
      admission_date: input.admission_date || new Date().toISOString().split('T')[0],
      current_class_id: input.class_id || null,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error || !student) {
    console.error('Student creation error:', error);
    throw new AppError('Failed to create student', 500);
  }

  // If class assigned, create enrollment
  if (input.class_id) {
    // Get current session
    const { data: currentSession } = await supabaseAdmin
      .from('academic_sessions')
      .select('id')
      .eq('is_current', true)
      .single();

    if (currentSession) {
      await supabaseAdmin.from('enrollments').insert({
        student_id: student.id,
        class_id: input.class_id,
        session_id: currentSession.id,
        created_by: createdBy,
      });
    }
  }

  await logAudit(createdBy, {
    action: 'student_created',
    entity_type: 'student',
    entity_id: student.id,
    new_value: { admission_number: input.admission_number, name: `${input.first_name} ${input.last_name}` },
  });

  return student;
}

export async function updateStudent(studentId: string, input: Partial<CreateStudentInput>, updatedBy: string) {
  const { data: existing } = await supabaseAdmin
    .from('students')
    .select('*')
    .eq('id', studentId)
    .single();

  if (!existing) {
    throw new NotFoundError('Student not found');
  }

  const { data: student, error } = await supabaseAdmin
    .from('students')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', studentId)
    .select()
    .single();

  if (error || !student) {
    throw new AppError('Failed to update student', 500);
  }

  await logAudit(updatedBy, {
    action: 'student_updated',
    entity_type: 'student',
    entity_id: studentId,
    old_value: existing,
    new_value: student,
  });

  return student;
}

export async function archiveStudent(studentId: string, archivedBy: string) {
  const { data: student, error } = await supabaseAdmin
    .from('students')
    .update({ status: 'archived' })
    .eq('id', studentId)
    .select()
    .single();

  if (error || !student) {
    throw new NotFoundError('Student not found');
  }

  await logAudit(archivedBy, {
    action: 'student_archived',
    entity_type: 'student',
    entity_id: studentId,
  });

  return student;
}

export async function assignStudentToClass(
  studentId: string,
  classId: string,
  sessionId: string,
  assignedBy: string
) {
  // Verify student exists
  const { data: student } = await supabaseAdmin
    .from('students')
    .select('id')
    .eq('id', studentId)
    .single();

  if (!student) {
    throw new NotFoundError('Student not found');
  }

  // Check for existing enrollment
  const { data: existing } = await supabaseAdmin
    .from('enrollments')
    .select('id')
    .eq('student_id', studentId)
    .eq('session_id', sessionId)
    .eq('class_id', classId)
    .single();

  if (existing) {
    throw new ConflictError('Student is already enrolled in this class for this session');
  }

  // Unenroll from any current class in this session
  await supabaseAdmin
    .from('enrollments')
    .update({ unenrolled_at: new Date().toISOString() })
    .eq('student_id', studentId)
    .eq('session_id', sessionId)
    .is('unenrolled_at', null);

  // Create new enrollment
  const { data: enrollment, error } = await supabaseAdmin
    .from('enrollments')
    .insert({
      student_id: studentId,
      class_id: classId,
      session_id: sessionId,
      created_by: assignedBy,
    })
    .select()
    .single();

  if (error || !enrollment) {
    throw new AppError('Failed to assign student to class', 500);
  }

  // Update student's current class
  await supabaseAdmin
    .from('students')
    .update({ current_class_id: classId })
    .eq('id', studentId);

  await logAudit(assignedBy, {
    action: 'student_assigned_to_class',
    entity_type: 'enrollment',
    entity_id: enrollment.id,
    metadata: { student_id: studentId, class_id: classId, session_id: sessionId },
  });

  // Notify parent if assigned
  const { data: parentAssignment } = await supabaseAdmin
    .from('parent_child_assignments')
    .select('parent_id')
    .eq('student_id', studentId)
    .single();

  if (parentAssignment) {
    const { data: parent } = await supabaseAdmin
      .from('parents')
      .select('user_id')
      .eq('id', parentAssignment.parent_id)
      .single();

    if (parent) {
      await createNotification({
        user_id: parent.user_id,
        title: 'Class Assignment Updated',
        message: `Your child has been assigned to a new class for the current session.`,
        notification_type: 'info',
      });
    }
  }

  return enrollment;
}

export async function assignParentToStudent(
  parentId: string,
  studentId: string,
  isPrimary: boolean,
  assignedBy: string
) {
  const { data: existing } = await supabaseAdmin
    .from('parent_child_assignments')
    .select('id')
    .eq('parent_id', parentId)
    .eq('student_id', studentId)
    .single();

  if (existing) {
    throw new ConflictError('This parent is already assigned to this student');
  }

  const { data: assignment, error } = await supabaseAdmin
    .from('parent_child_assignments')
    .insert({
      parent_id: parentId,
      student_id: studentId,
      is_primary: isPrimary || false,
      created_by: assignedBy,
    })
    .select()
    .single();

  if (error || !assignment) {
    throw new AppError('Failed to assign parent to student', 500);
  }

  await logAudit(assignedBy, {
    action: 'parent_child_assignment',
    entity_type: 'parent_child_assignment',
    entity_id: assignment.id,
    metadata: { parent_id: parentId, student_id: studentId },
  });

  return assignment;
}

export async function removeParentAssignment(
  parentId: string,
  studentId: string,
  removedBy: string
) {
  const { error } = await supabaseAdmin
    .from('parent_child_assignments')
    .update({ unassigned_at: new Date().toISOString() })
    .eq('parent_id', parentId)
    .eq('student_id', studentId)
    .is('unassigned_at', null);

  if (error) {
    throw new AppError('Failed to remove parent assignment', 500);
  }

  await logAudit(removedBy, {
    action: 'parent_child_unassigned',
    entity_type: 'parent_child_assignment',
    metadata: { parent_id: parentId, student_id: studentId },
  });

  return { success: true };
}

export async function getStudentWithDetails(studentId: string) {
  const { data: student, error } = await supabaseAdmin
    .from('students')
    .select(`
      *,
      current_class:classes(*),
      enrollments(
        *,
        class:classes(*),
        session:academic_sessions(*)
      ),
      parent_child_assignments(
        *,
        parent:parents(
          *,
          user:users(*),
          profile:profiles(*)
        )
      )
    `)
    .eq('id', studentId)
    .single();

  if (error || !student) {
    throw new NotFoundError('Student not found');
  }

  return student;
}