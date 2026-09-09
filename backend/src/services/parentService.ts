import { supabaseAdmin } from '../config/supabase';
import {
  AppError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../middleware/errorHandler';
import { logAudit } from '../utils/auditLogger';
import { createUser } from './authService';

interface CreateParentInput {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  address?: string | null;
  occupation?: string | null;
  relationship_to_student?: string | null;
  alternate_phone?: string | null;

  // Optional children during parent creation
  admission_numbers?: string[];
  is_primary?: boolean;
}

export async function createParent(
  input: CreateParentInput,
  createdBy: string
) {
  /*
   * Normalize admission numbers before doing anything.
   * They remain strings so values such as 0070 stay 0070.
   */
  const admissionNumbers = [
    ...new Set(
      (input.admission_numbers || [])
        .map((number) => String(number).trim())
        .filter(Boolean)
    ),
  ];

  /*
   * Validate admission-number format before creating the account.
   */
  const invalidAdmissionNumbers = admissionNumbers.filter(
    (number) => !/^\d{4}$/.test(number)
  );

  if (invalidAdmissionNumbers.length > 0) {
    throw new AppError(
      `Invalid admission number(s): ${invalidAdmissionNumbers.join(', ')}`,
      400
    );
  }

  /*
   * Validate that every requested student exists BEFORE creating
   * the parent account.
   *
   * This prevents:
   *
   * Parent created
   * + Child 1 assigned
   * + Child 2 missing
   *
   * from happening.
   */
  let students: Array<{
    id: string;
    admission_number: string;
    first_name: string;
    last_name: string;
  }> = [];

  if (admissionNumbers.length > 0) {
    const {
      data: foundStudents,
      error: studentsError,
    } = await supabaseAdmin
      .from('students')
      .select(
        'id, admission_number, first_name, last_name'
      )
      .in('admission_number', admissionNumbers);

    if (studentsError) {
      console.error(
        'Parent creation student lookup error:',
        studentsError
      );

      throw new AppError(
        'Failed to verify student admission numbers',
        500
      );
    }

    students = foundStudents || [];

    const foundNumbers = new Set(
      students.map(
        (student) => student.admission_number
      )
    );

    const missingNumbers = admissionNumbers.filter(
      (number) => !foundNumbers.has(number)
    );

    if (missingNumbers.length > 0) {
      throw new AppError(
        `Student(s) not found for admission number(s): ${missingNumbers.join(
          ', '
        )}`,
        400
      );
    }
  }

  /*
   * Create the user account.
   */
  let userId: string | null = null;

  try {
    const { user } = await createUser(
      {
        email: input.email,
        password: input.password,
        roles: ['parent'],
        first_name: input.first_name,
        last_name: input.last_name,
        phone: input.phone,
        address: input.address,
      },
      createdBy
    );

    userId = user.id;

    /*
     * Create the parent record.
     */
    const {
      data: parent,
      error: parentError,
    } = await supabaseAdmin
      .from('parents')
      .insert({
        user_id: user.id,
        occupation: input.occupation || null,
        relationship_to_student:
          input.relationship_to_student || null,
        alternate_phone:
          input.alternate_phone || null,
        created_by: createdBy,
      })
      .select()
      .single();

    if (parentError || !parent) {
      console.error(
        'Parent creation error:',
        parentError
      );

      throw new AppError(
        'Failed to create parent record',
        500
      );
    }

    /*
     * Assign children if admission numbers were supplied.
     */
    let assignedChildren: typeof students = [];

    if (students.length > 0) {
      const rows = students.map((student) => ({
        parent_id: parent.id,
        student_id: student.id,
        is_primary: input.is_primary || false,
        created_by: createdBy,
      }));

      const {
        data: assignments,
        error: assignmentError,
      } = await supabaseAdmin
        .from('parent_child_assignments')
        .insert(rows)
        .select('id, student_id');

      if (
        assignmentError ||
        !assignments
      ) {
        console.error(
          'Parent-child assignment error:',
          assignmentError
        );

        /*
         * Clean up the parent record.
         * The user record is cleaned up below as well.
         */
        await supabaseAdmin
          .from('parents')
          .delete()
          .eq('id', parent.id);

        throw new AppError(
          'Failed to assign children to parent',
          500
        );
      }

      const assignedIds = new Set(
        assignments.map(
          (assignment) => assignment.student_id
        )
      );

      assignedChildren = students.filter(
        (student) => assignedIds.has(student.id)
      );
    }

    /*
     * Audit the parent creation.
     */
    await logAudit(createdBy, {
      action: 'parent_created',
      entity_type: 'parent',
      entity_id: parent.id,
      new_value: {
        email: input.email,
        name: `${input.first_name} ${input.last_name}`,
        admission_numbers: admissionNumbers,
        assigned_children_count:
          assignedChildren.length,
      },
    });

    return {
      parent,
      user,
      children: assignedChildren,
      children_count: assignedChildren.length,
    };
  } catch (error) {
    /*
     * If anything failed after createUser(), clean up
     * the user so we don't leave an orphaned account.
     */
    if (userId) {
      await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', userId);
    }

    throw error;
  }
}

export async function updateParent(
  parentId: string,
  input: Partial<CreateParentInput>,
  updatedBy: string
) {
  const { data: existing } = await supabaseAdmin
    .from('parents')
    .select('*')
    .eq('id', parentId)
    .single();

  if (!existing) {
    throw new NotFoundError('Parent not found');
  }

  const updateData: Record<string, any> = {};

  if (input.occupation !== undefined) {
    updateData.occupation = input.occupation;
  }

  if (
    input.relationship_to_student !== undefined
  ) {
    updateData.relationship_to_student =
      input.relationship_to_student;
  }

  if (input.alternate_phone !== undefined) {
    updateData.alternate_phone =
      input.alternate_phone;
  }

  const {
    data: parent,
    error,
  } = await supabaseAdmin
    .from('parents')
    .update(updateData)
    .eq('id', parentId)
    .select()
    .single();

  if (error || !parent) {
    throw new AppError(
      'Failed to update parent',
      500
    );
  }

  if (
    input.first_name ||
    input.last_name ||
    input.phone ||
    input.address
  ) {
    const profileUpdate: Record<string, any> = {};

    if (input.first_name) {
      profileUpdate.first_name =
        input.first_name;
    }

    if (input.last_name) {
      profileUpdate.last_name =
        input.last_name;
    }

    if (input.phone !== undefined) {
      profileUpdate.phone = input.phone;
    }

    if (input.address !== undefined) {
      profileUpdate.address =
        input.address;
    }

    await supabaseAdmin
      .from('profiles')
      .update(profileUpdate)
      .eq('user_id', existing.user_id);
  }

  await logAudit(updatedBy, {
    action: 'parent_updated',
    entity_type: 'parent',
    entity_id: parentId,
    old_value: existing,
    new_value: parent,
  });

  return parent;
}

export async function getParentChildren(
  parentUserId: string
) {
  const { data: parent } = await supabaseAdmin
    .from('parents')
    .select('*')
    .eq('user_id', parentUserId)
    .single();

  if (!parent) {
    throw new NotFoundError(
      'Parent record not found'
    );
  }

  const { data: assignments } =
    await supabaseAdmin
      .from('parent_child_assignments')
      .select(`
        *,
        student:students(
          *,
          current_class:classes(*)
        )
      `)
      .eq('parent_id', parent.id)
      .is('unassigned_at', null);

  return assignments || [];
}

export async function getParentChildResults(
  parentUserId: string,
  childId: string
) {
  const { data: parent } = await supabaseAdmin
    .from('parents')
    .select('*')
    .eq('user_id', parentUserId)
    .single();

  if (!parent) {
    throw new NotFoundError(
      'Parent record not found'
    );
  }

  const { data: assignment } =
    await supabaseAdmin
      .from('parent_child_assignments')
      .select('id')
      .eq('parent_id', parent.id)
      .eq('student_id', childId)
      .is('unassigned_at', null)
      .single();

  if (!assignment) {
    throw new ForbiddenError(
      'You do not have access to this child'
    );
  }

  const { data: results } =
    await supabaseAdmin
      .from('results')
      .select(`
        *,
        result_subjects(*),
        term:terms(*),
        session:academic_sessions(*),
        class:classes(*)
      `)
      .eq('student_id', childId)
      .eq('status', 'published')
      .order('created_at', {
        ascending: false,
      });

  return results || [];
}

export async function getParentChildAttendance(
  parentUserId: string,
  childId: string
) {
  const { data: parent } = await supabaseAdmin
    .from('parents')
    .select('*')
    .eq('user_id', parentUserId)
    .single();

  if (!parent) {
    throw new NotFoundError(
      'Parent record not found'
    );
  }

  const { data: assignment } =
    await supabaseAdmin
      .from('parent_child_assignments')
      .select('id')
      .eq('parent_id', parent.id)
      .eq('student_id', childId)
      .is('unassigned_at', null)
      .single();

  if (!assignment) {
    throw new ForbiddenError(
      'You do not have access to this child'
    );
  }

  const { data: attendance } =
    await supabaseAdmin
      .from('attendance')
      .select(`
        *,
        term:terms(*),
        session:academic_sessions(*)
      `)
      .eq('student_id', childId)
      .order('attendance_date', {
        ascending: false,
      });

  return attendance || [];
}

export async function getParentChildPayments(
  parentUserId: string,
  childId: string
) {
  const { data: parent } = await supabaseAdmin
    .from('parents')
    .select('*')
    .eq('user_id', parentUserId)
    .single();

  if (!parent) {
    throw new NotFoundError(
      'Parent record not found'
    );
  }

  const { data: assignment } =
    await supabaseAdmin
      .from('parent_child_assignments')
      .select('id')
      .eq('parent_id', parent.id)
      .eq('student_id', childId)
      .is('unassigned_at', null)
      .single();

  if (!assignment) {
    throw new ForbiddenError(
      'You do not have access to this child'
    );
  }

  const { data: payments } =
    await supabaseAdmin
      .from('payments')
      .select(`
        *,
        receipt:receipts(*)
      `)
      .eq('student_id', childId)
      .eq('status', 'completed')
      .order('payment_date', {
        ascending: false,
      });

  return payments || [];
}