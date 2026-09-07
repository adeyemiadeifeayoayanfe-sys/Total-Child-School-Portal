import { supabaseAdmin } from '../config/supabase';
import { AppError, NotFoundError, ForbiddenError } from '../middleware/errorHandler';
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
}

export async function createParent(input: CreateParentInput, createdBy: string) {
  const { user } = await createUser({
    email: input.email,
    password: input.password,
    role: 'parent',
    first_name: input.first_name,
    last_name: input.last_name,
    phone: input.phone,
    address: input.address,
  }, createdBy);

  const { data: parent, error } = await supabaseAdmin
    .from('parents')
    .insert({
      user_id: user.id,
      occupation: input.occupation || null,
      relationship_to_student: input.relationship_to_student || null,
      alternate_phone: input.alternate_phone || null,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error || !parent) {
    await supabaseAdmin.from('users').delete().eq('id', user.id);
    console.error('Parent creation error:', error);
    throw new AppError('Failed to create parent record', 500);
  }

  await logAudit(createdBy, {
    action: 'parent_created',
    entity_type: 'parent',
    entity_id: parent.id,
    new_value: { email: input.email, name: `${input.first_name} ${input.last_name}` },
  });

  return { parent, user };
}

export async function updateParent(parentId: string, input: Partial<CreateParentInput>, updatedBy: string) {
  const { data: existing } = await supabaseAdmin
    .from('parents')
    .select('*')
    .eq('id', parentId)
    .single();

  if (!existing) {
    throw new NotFoundError('Parent not found');
  }

  const updateData: Record<string, any> = {};
  if (input.occupation !== undefined) updateData.occupation = input.occupation;
  if (input.relationship_to_student !== undefined) updateData.relationship_to_student = input.relationship_to_student;
  if (input.alternate_phone !== undefined) updateData.alternate_phone = input.alternate_phone;

  const { data: parent, error } = await supabaseAdmin
    .from('parents')
    .update(updateData)
    .eq('id', parentId)
    .select()
    .single();

  if (error || !parent) {
    throw new AppError('Failed to update parent', 500);
  }

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
    action: 'parent_updated',
    entity_type: 'parent',
    entity_id: parentId,
    old_value: existing,
    new_value: parent,
  });

  return parent;
}

export async function getParentChildren(parentUserId: string) {
  // Get parent record from user_id
  const { data: parent } = await supabaseAdmin
    .from('parents')
    .select('*')
    .eq('user_id', parentUserId)
    .single();

  if (!parent) {
    throw new NotFoundError('Parent record not found');
  }

  const { data: assignments } = await supabaseAdmin
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

export async function getParentChildResults(parentUserId: string, childId: string) {
  // Verify parent-child relationship
  const { data: parent } = await supabaseAdmin
    .from('parents')
    .select('*')
    .eq('user_id', parentUserId)
    .single();

  if (!parent) {
    throw new NotFoundError('Parent record not found');
  }

  const { data: assignment } = await supabaseAdmin
    .from('parent_child_assignments')
    .select('id')
    .eq('parent_id', parent.id)
    .eq('student_id', childId)
    .is('unassigned_at', null)
    .single();

  if (!assignment) {
    throw new ForbiddenError('You do not have access to this child');
  }

  const { data: results } = await supabaseAdmin
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
    .order('created_at', { ascending: false });

  return results || [];
}

export async function getParentChildAttendance(parentUserId: string, childId: string) {
  const { data: parent } = await supabaseAdmin
    .from('parents')
    .select('*')
    .eq('user_id', parentUserId)
    .single();

  if (!parent) {
    throw new NotFoundError('Parent record not found');
  }

  const { data: assignment } = await supabaseAdmin
    .from('parent_child_assignments')
    .select('id')
    .eq('parent_id', parent.id)
    .eq('student_id', childId)
    .is('unassigned_at', null)
    .single();

  if (!assignment) {
    throw new ForbiddenError('You do not have access to this child');
  }

  const { data: attendance } = await supabaseAdmin
    .from('attendance')
    .select(`
      *,
      term:terms(*),
      session:academic_sessions(*)
    `)
    .eq('student_id', childId)
    .order('attendance_date', { ascending: false });

  return attendance || [];
}

export async function getParentChildPayments(parentUserId: string, childId: string) {
  const { data: parent } = await supabaseAdmin
    .from('parents')
    .select('*')
    .eq('user_id', parentUserId)
    .single();

  if (!parent) {
    throw new NotFoundError('Parent record not found');
  }

  const { data: assignment } = await supabaseAdmin
    .from('parent_child_assignments')
    .select('id')
    .eq('parent_id', parent.id)
    .eq('student_id', childId)
    .is('unassigned_at', null)
    .single();

  if (!assignment) {
    throw new ForbiddenError('You do not have access to this child');
  }

  const { data: payments } = await supabaseAdmin
    .from('payments')
    .select(`
      *,
      receipt:receipts(*)
    `)
    .eq('student_id', childId)
    .eq('status', 'completed')
    .order('payment_date', { ascending: false });

  return payments || [];
}