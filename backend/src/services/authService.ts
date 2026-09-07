import { supabaseAdmin } from '../config/supabase';
import { AppError, ConflictError, NotFoundError } from '../middleware/errorHandler';
import { AuthUser, UserRole } from '../types';
import { logAudit } from '../utils/auditLogger';

interface CreateUserInput {
  email: string;
  password: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  phone?: string | null;
  address?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
}

export async function createUser(input: CreateUserInput, createdBy: string) {
  // Check if user already exists
  const { data: existingUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', input.email)
    .single();

  if (existingUser) {
    throw new ConflictError('A user with this email already exists');
  }

  // Create auth user in Supabase
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    console.error('Supabase auth error:', authError);
    throw new AppError('Failed to create user account', 500);
  }

  // Create user in our database
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .insert({
      auth_id: authData.user.id,
      email: input.email,
      role: input.role,
      status: 'active',
      created_by: createdBy,
    })
    .select()
    .single();

  if (userError || !user) {
    // Rollback - delete auth user
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    console.error('Database user creation error:', userError);
    throw new AppError('Failed to create user record', 500);
  }

  // Create profile
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert({
      user_id: user.id,
      first_name: input.first_name,
      last_name: input.last_name,
      phone: input.phone || null,
      address: input.address || null,
      date_of_birth: input.date_of_birth || null,
      gender: input.gender || null,
    })
    .select()
    .single();

  if (profileError) {
    console.error('Profile creation error:', profileError);
    // Cleanup
    await supabaseAdmin.from('users').delete().eq('id', user.id);
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    throw new AppError('Failed to create user profile', 500);
  }

  // Log audit
  await logAudit(createdBy, {
    action: 'user_created',
    entity_type: 'user',
    entity_id: user.id,
    new_value: { email: input.email, role: input.role },
  });

  return { user, profile };
}

export async function deactivateUser(userId: string, deactivatedBy: string, reason?: string) {
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !user) {
    throw new NotFoundError('User not found');
  }

  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({ status: 'inactive' })
    .eq('id', userId);

  if (updateError) {
    throw new AppError('Failed to deactivate user', 500);
  }

  // Also deactivate in Supabase Auth
  await supabaseAdmin.auth.admin.updateUserById(user.auth_id, {
    ban_duration: '876000h', // 100 years (effectively banned)
  });

  await logAudit(deactivatedBy, {
    action: 'user_deactivated',
    entity_type: 'user',
    entity_id: userId,
    metadata: { reason: reason || 'No reason provided' },
  });

  return { success: true };
}

export async function activateUser(userId: string, activatedBy: string) {
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !user) {
    throw new NotFoundError('User not found');
  }

  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({ status: 'active' })
    .eq('id', userId);

  if (updateError) {
    throw new AppError('Failed to activate user', 500);
  }

  await supabaseAdmin.auth.admin.updateUserById(user.auth_id, {
    ban_duration: '0h',
  });

  await logAudit(activatedBy, {
    action: 'user_activated',
    entity_type: 'user',
    entity_id: userId,
  });

  return { success: true };
}

export async function resetUserPassword(userId: string, newPassword: string, resetBy: string) {
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !user) {
    throw new NotFoundError('User not found');
  }

  const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(
    user.auth_id,
    { password: newPassword }
  );

  if (resetError) {
    throw new AppError('Failed to reset password', 500);
  }

  await logAudit(resetBy, {
    action: 'password_reset',
    entity_type: 'user',
    entity_id: userId,
  });

  return { success: true };
}