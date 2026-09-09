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

  if (input.class_id) {
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
    new_value: {
      admission_number: input.admission_number,
      name: `${input.first_name} ${input.last_name}`,
    },
  });

  return student;
}

export async function updateStudent(
  studentId: string,
  input: Partial<CreateStudentInput>,
  updatedBy: string
) {
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
  const { data: student } = await supabaseAdmin
    .from('students')
    .select('id')
    .eq('id', studentId)
    .single();

  if (!student) {
    throw new NotFoundError('Student not found');
  }

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

  await supabaseAdmin
    .from('enrollments')
    .update({ unenrolled_at: new Date().toISOString() })
    .eq('student_id', studentId)
    .eq('session_id', sessionId)
    .is('unenrolled_at', null);

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

  await supabaseAdmin
    .from('students')
    .update({ current_class_id: classId })
    .eq('id', studentId);

  await logAudit(assignedBy, {
    action: 'student_assigned_to_class',
    entity_type: 'enrollment',
    entity_id: enrollment.id,
    metadata: {
      student_id: studentId,
      class_id: classId,
      session_id: sessionId,
    },
  });

  const { data: parentAssignment } = await supabaseAdmin
    .from('parent_child_assignments')
    .select('parent_id')
    .eq('student_id', studentId)
    .is('unassigned_at', null)
    .maybeSingle();

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
        message: 'Your child has been assigned to a new class for the current session.',
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
  const { data: parent } = await supabaseAdmin
    .from('parents')
    .select('id')
    .eq('id', parentId)
    .single();

  if (!parent) {
    throw new NotFoundError('Parent not found');
  }

  const { data: student } = await supabaseAdmin
    .from('students')
    .select('id')
    .eq('id', studentId)
    .single();

  if (!student) {
    throw new NotFoundError('Student not found');
  }

  const { data: existing } = await supabaseAdmin
    .from('parent_child_assignments')
    .select('id')
    .eq('parent_id', parentId)
    .eq('student_id', studentId)
    .is('unassigned_at', null)
    .maybeSingle();

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
    metadata: {
      parent_id: parentId,
      student_id: studentId,
    },
  });

  return assignment;
}

export async function assignParentToStudentsByAdmissionNumbers(
  parentId: string,
  admissionNumbers: string[],
  isPrimary: boolean,
  assignedBy: string
) {
  const { data: parent } = await supabaseAdmin
    .from('parents')
    .select('id, user_id')
    .eq('id', parentId)
    .single();

  if (!parent) {
    throw new NotFoundError('Parent not found');
  }

  // Keep admission numbers as strings so leading zeros are preserved.
  const normalizedNumbers = [
    ...new Set(admissionNumbers.map((number) => number.trim())),
  ];

  if (!normalizedNumbers.length) {
    throw new AppError('At least one admission number is required', 400);
  }

  // Find every requested student before making ANY assignment.
  const { data: students, error: studentsError } = await supabaseAdmin
    .from('students')
    .select('id, admission_number, first_name, last_name')
    .in('admission_number', normalizedNumbers);

  if (studentsError) {
    console.error('Student lookup error:', studentsError);
    throw new AppError('Failed to find students', 500);
  }

  const foundStudents = students || [];

  const foundNumbers = new Set(
    foundStudents.map((student) => student.admission_number)
  );

  const missingNumbers = normalizedNumbers.filter(
    (number) => !foundNumbers.has(number)
  );

  // Important: if even one number doesn't exist, stop before inserting anything.
  if (missingNumbers.length > 0) {
    throw new AppError(
      `Student(s) not found for admission number(s): ${missingNumbers.join(', ')}`,
      400
    );
  }

  const studentIds = foundStudents.map((student) => student.id);

  const { data: existingAssignments, error: existingError } = await supabaseAdmin
    .from('parent_child_assignments')
    .select('student_id')
    .eq('parent_id', parentId)
    .in('student_id', studentIds)
    .is('unassigned_at', null);

  if (existingError) {
    console.error('Existing assignment lookup error:', existingError);
    throw new AppError('Failed to check existing parent assignments', 500);
  }

  const alreadyAssignedIds = new Set(
    (existingAssignments || []).map((assignment) => assignment.student_id)
  );

  const alreadyAssigned = foundStudents.filter((student) =>
    alreadyAssignedIds.has(student.id)
  );

  const studentsToAssign = foundStudents.filter(
    (student) => !alreadyAssignedIds.has(student.id)
  );

  let assigned: typeof foundStudents = [];

  if (studentsToAssign.length > 0) {
    const rows = studentsToAssign.map((student) => ({
      parent_id: parentId,
      student_id: student.id,
      is_primary: isPrimary || false,
      created_by: assignedBy,
    }));

    const { data: insertedAssignments, error: insertError } =
      await supabaseAdmin
        .from('parent_child_assignments')
        .insert(rows)
        .select('id, student_id');

    if (insertError || !insertedAssignments) {
      console.error('Bulk parent assignment error:', insertError);
      throw new AppError('Failed to assign children to parent', 500);
    }

    const insertedIds = new Set(
      insertedAssignments.map((assignment) => assignment.student_id)
    );

    assigned = studentsToAssign.filter((student) =>
      insertedIds.has(student.id)
    );
  }

  await logAudit(assignedBy, {
    action: 'parent_children_bulk_assignment',
    entity_type: 'parent',
    entity_id: parentId,
    metadata: {
      admission_numbers: normalizedNumbers,
      assigned_student_ids: assigned.map((student) => student.id),
      already_assigned_student_ids: alreadyAssigned.map(
        (student) => student.id
      ),
      assigned_count: assigned.length,
      already_assigned_count: alreadyAssigned.length,
    },
  });

  return {
    assigned,
    already_assigned: alreadyAssigned,
    count: assigned.length,
  };
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
    metadata: {
      parent_id: parentId,
      student_id: studentId,
    },
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