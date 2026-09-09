import { supabaseAdmin } from '../config/supabase';
import {
  AppError,
  ConflictError,
  NotFoundError,
} from '../middleware/errorHandler';
import { UserRole } from '../types';
import { logAudit } from '../utils/auditLogger';

interface CreateUserInput {
  email: string;
  password: string;
  roles: UserRole[];
  first_name: string;
  last_name: string;
  phone?: string | null;
  address?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
}

const MANAGEABLE_ROLES: UserRole[] = [
  'admin',
  'teacher',
  'parent',
];

export async function createUser(
  input: CreateUserInput,
  createdBy: string
) {
  // ----------------------------------------
  // Validate roles
  // ----------------------------------------

  if (!input.roles || input.roles.length === 0) {
    throw new AppError('At least one role is required', 400);
  }

  const uniqueRoles = [...new Set(input.roles)];

  // Normal users cannot be created as super admins.
  const invalidRoles = uniqueRoles.filter(
    (role) => !MANAGEABLE_ROLES.includes(role)
  );

  if (invalidRoles.length > 0) {
    throw new AppError(
      'Only Admin, Teacher, and Parent roles can be assigned through user management',
      400
    );
  }

  // ----------------------------------------
  // Check if user already exists
  // ----------------------------------------

  const { data: existingUser, error: existingUserError } =
    await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', input.email)
      .maybeSingle();

  if (existingUserError) {
    console.error('Existing user lookup error:', existingUserError);
    throw new AppError('Failed to check existing user', 500);
  }

  if (existingUser) {
    throw new ConflictError(
      'A user with this email already exists'
    );
  }

  // ----------------------------------------
  // Create user in Supabase Auth
  // ----------------------------------------

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
    });

  if (authError || !authData.user) {
    console.error('Supabase auth error:', authError);
    throw new AppError('Failed to create user account', 500);
  }

  // The first role becomes the primary role.
  const primaryRole = uniqueRoles[0];

  // ----------------------------------------
  // Create user in our database
  // ----------------------------------------

  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .insert({
      auth_id: authData.user.id,
      email: input.email,
      role: primaryRole,
      status: 'active',
      created_by: createdBy,
    })
    .select()
    .single();

  if (userError || !user) {
    // Rollback Supabase Auth user.
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);

    console.error('Database user creation error:', userError);

    throw new AppError(
      'Failed to create user record',
      500
    );
  }

  // ----------------------------------------
  // Create all user roles
  // ----------------------------------------

  const roleRows = uniqueRoles.map((role) => ({
    user_id: user.id,
    role,
    created_by: createdBy,
  }));

  const { error: rolesError } = await supabaseAdmin
    .from('user_roles')
    .insert(roleRows);

  if (rolesError) {
    console.error('User roles creation error:', rolesError);

    // Rollback everything created so far.
    await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', user.id);

    await supabaseAdmin.auth.admin.deleteUser(
      authData.user.id
    );

    throw new AppError(
      'Failed to assign user roles',
      500
    );
  }

  // ----------------------------------------
  // Create profile
  // ----------------------------------------

  const { data: profile, error: profileError } =
    await supabaseAdmin
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

  if (profileError || !profile) {
    console.error(
      'Profile creation error:',
      profileError
    );

    // Rollback roles.
    await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', user.id);

    // Rollback database user.
    await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', user.id);

    // Rollback Supabase Auth user.
    await supabaseAdmin.auth.admin.deleteUser(
      authData.user.id
    );

    throw new AppError(
      'Failed to create user profile',
      500
    );
  }

  // ----------------------------------------
  // Audit log
  // ----------------------------------------

  await logAudit(createdBy, {
    action: 'user_created',
    entity_type: 'user',
    entity_id: user.id,
    new_value: {
      email: input.email,
      roles: uniqueRoles,
      primary_role: primaryRole,
    },
  });

  // Return user + profile + roles.
  return {
    user: {
      ...user,
      roles: uniqueRoles,
    },
    profile,
  };
}

// ============================================
// UPDATE USER ROLES
// ============================================

export async function updateUserRoles(
  userId: string,
  roles: UserRole[],
  updatedBy: string
) {
  // ----------------------------------------
  // Validate roles
  // ----------------------------------------

  if (!roles || roles.length === 0) {
    throw new AppError(
      'A user must have at least one role',
      400
    );
  }

  const uniqueRoles = [...new Set(roles)];

  // Prevent normal user management from granting
  // super_admin.
  const invalidRoles = uniqueRoles.filter(
    (role) => !MANAGEABLE_ROLES.includes(role)
  );

  if (invalidRoles.length > 0) {
    throw new AppError(
      'Super Admin cannot be assigned through normal user management',
      403
    );
  }

  // ----------------------------------------
  // Load target user
  // ----------------------------------------

  const { data: user, error: userError } =
    await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

  if (userError || !user) {
    throw new NotFoundError('User not found');
  }

  // ----------------------------------------
  // Prevent modification of a super admin
  // through this endpoint.
  // ----------------------------------------

  if (user.role === 'super_admin') {
    throw new AppError(
      'Super Admin roles cannot be modified through normal user management',
      403
    );
  }

  // ----------------------------------------
  // Load current roles
  // ----------------------------------------

  const {
    data: currentRoleRows,
    error: currentRolesError,
  } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  if (currentRolesError) {
    console.error(
      'Failed to load current user roles:',
      currentRolesError
    );

    throw new AppError(
      'Failed to load current user roles',
      500
    );
  }

  const currentRoles =
    currentRoleRows?.map(
      (item) => item.role as UserRole
    ) || [];

  // ----------------------------------------
  // Determine primary role
  // ----------------------------------------

  const primaryRole = uniqueRoles[0];

  // ----------------------------------------
  // Replace role assignments
  // ----------------------------------------

  const { error: deleteRolesError } =
    await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

  if (deleteRolesError) {
    console.error(
      'Failed to remove old user roles:',
      deleteRolesError
    );

    throw new AppError(
      'Failed to update user roles',
      500
    );
  }

  const roleRows = uniqueRoles.map((role) => ({
    user_id: userId,
    role,
    created_by: updatedBy,
  }));

  const { error: insertRolesError } =
    await supabaseAdmin
      .from('user_roles')
      .insert(roleRows);

  if (insertRolesError) {
    console.error(
      'Failed to insert new user roles:',
      insertRolesError
    );

    // Try to restore the previous roles.
    if (currentRoles.length > 0) {
      await supabaseAdmin
        .from('user_roles')
        .insert(
          currentRoles.map((role) => ({
            user_id: userId,
            role,
            created_by: updatedBy,
          }))
        );
    }

    throw new AppError(
      'Failed to update user roles',
      500
    );
  }

  // ----------------------------------------
  // Update primary role
  // ----------------------------------------

  const { error: primaryRoleError } =
    await supabaseAdmin
      .from('users')
      .update({
        role: primaryRole,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

  if (primaryRoleError) {
    console.error(
      'Failed to update primary role:',
      primaryRoleError
    );

    // Restore previous roles if possible.
    await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    if (currentRoles.length > 0) {
      await supabaseAdmin
        .from('user_roles')
        .insert(
          currentRoles.map((role) => ({
            user_id: userId,
            role,
            created_by: updatedBy,
          }))
        );
    }

    throw new AppError(
      'Failed to update primary role',
      500
    );
  }

  // ----------------------------------------
  // Audit role change
  // ----------------------------------------

  await logAudit(updatedBy, {
    action: 'user_roles_updated',
    entity_type: 'user',
    entity_id: userId,
    old_value: {
      roles: currentRoles,
      primary_role: user.role,
    },
    new_value: {
      roles: uniqueRoles,
      primary_role: primaryRole,
    },
  });

  // ----------------------------------------
  // Return updated user
  // ----------------------------------------

  return {
    ...user,
    role: primaryRole,
    roles: uniqueRoles,
    updated_at: new Date().toISOString(),
  };
}

// ============================================
// DEACTIVATE USER
// ============================================

export async function deactivateUser(
  userId: string,
  deactivatedBy: string,
  reason?: string
) {
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
    .update({
      status: 'inactive',
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (updateError) {
    throw new AppError(
      'Failed to deactivate user',
      500
    );
  }

  // Also deactivate in Supabase Auth.
  const { error: authError } =
    await supabaseAdmin.auth.admin.updateUserById(
      user.auth_id,
      {
        ban_duration: '876000h',
      }
    );

  if (authError) {
    console.error(
      'Failed to deactivate Supabase Auth user:',
      authError
    );
  }

  await logAudit(deactivatedBy, {
    action: 'user_deactivated',
    entity_type: 'user',
    entity_id: userId,
    metadata: {
      reason: reason || 'No reason provided',
    },
  });

  return { success: true };
}

// ============================================
// ACTIVATE USER
// ============================================

export async function activateUser(
  userId: string,
  activatedBy: string
) {
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
    .update({
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (updateError) {
    throw new AppError(
      'Failed to activate user',
      500
    );
  }

  const { error: authError } =
    await supabaseAdmin.auth.admin.updateUserById(
      user.auth_id,
      {
        ban_duration: '0h',
      }
    );

  if (authError) {
    console.error(
      'Failed to activate Supabase Auth user:',
      authError
    );
  }

  await logAudit(activatedBy, {
    action: 'user_activated',
    entity_type: 'user',
    entity_id: userId,
  });

  return { success: true };
}

// ============================================
// RESET USER PASSWORD
// ============================================

export async function resetUserPassword(
  userId: string,
  newPassword: string,
  resetBy: string
) {
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !user) {
    throw new NotFoundError('User not found');
  }

  const { error: resetError } =
    await supabaseAdmin.auth.admin.updateUserById(
      user.auth_id,
      {
        password: newPassword,
      }
    );

  if (resetError) {
    throw new AppError(
      'Failed to reset password',
      500
    );
  }

  await logAudit(resetBy, {
    action: 'password_reset',
    entity_type: 'user',
    entity_id: userId,
  });

  return { success: true };
}