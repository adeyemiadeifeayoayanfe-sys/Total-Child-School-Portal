import { Router, Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { supabaseAdmin } from '../config/supabase';
import config from '../config/env';
import { authenticate, authorizeAdmin, authorizeSuperAdmin } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { AppError, UnauthorizedError, ForbiddenError } from '../middleware/errorHandler';
import { loginSchema, changePasswordSchema, resetPasswordSchema, createUserSchema } from '../validators/auth';
import { createUser, deactivateUser, activateUser, resetUserPassword } from '../services/authService';

const router = Router();

const BOOTSTRAP_SUPER_ADMIN_PROFILES = new Map<string, { first_name: string; last_name: string }>([
  ['adeyemiadeifeayoayanfe@gmail.com', { first_name: 'Adeyemi', last_name: 'Ayanfe' }],
  ['cemkebbistate@gmail.com', { first_name: 'Cemkebbi', last_name: 'State' }],
]);

const supabaseAuth = createClient(config.supabaseUrl, config.supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function ensureAppUserForAuthUser(authId: string, email: string) {
  const { data: existingUser, error: userLookupError } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('auth_id', authId)
    .maybeSingle();

  if (userLookupError) {
    throw new AppError(`Failed to load user account: ${userLookupError.message}`, 500);
  }

  if (existingUser) {
    return existingUser;
  }

  const emailKey = email.toLowerCase();
  const bootstrapProfile = BOOTSTRAP_SUPER_ADMIN_PROFILES.get(emailKey);

  if (!bootstrapProfile) {
    return null;
  }

  const { data: createdUser, error: createUserError } = await supabaseAdmin
    .from('users')
    .insert({
      auth_id: authId,
      email,
      role: 'super_admin',
      status: 'active',
      email_verified: true,
    })
    .select('*')
    .single();

  if (createUserError || !createdUser) {
    throw new AppError(`Failed to create missing app user: ${createUserError?.message || 'unknown error'}`, 500);
  }

  const { error: profileError } = await supabaseAdmin.from('profiles').upsert(
    {
      user_id: createdUser.id,
      first_name: bootstrapProfile.first_name,
      last_name: bootstrapProfile.last_name,
    },
    {
      onConflict: 'user_id',
    }
  );

  if (profileError) {
    throw new AppError(`Failed to create missing profile: ${profileError.message}`, 500);
  }

  const { data: repairedUser, error: repairedLookupError } = await supabaseAdmin
    .from('users')
    .select(`
      *,
      profile:profiles(*)
    `)
    .eq('id', createdUser.id)
    .single();

  if (repairedLookupError || !repairedUser) {
    throw new AppError(`Failed to verify repaired user account: ${repairedLookupError?.message || 'unknown error'}`, 500);
  }

  return repairedUser;
}

/**
 * POST /api/auth/login
 */
router.post('/login', validate(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Get user from our database
    let user = await ensureAppUserForAuthUser(data.user.id, data.user.email || email);

    if (!user) {
      throw new UnauthorizedError('User account not found');
    }

    if (user.status !== 'active') {
      throw new ForbiddenError('Account is not active. Contact administrator.');
    }

    // Update last login
    await supabaseAdmin
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id);

    // Get role-specific data
    let roleData = null;
    if (user.role === 'teacher') {
      const { data: teacher } = await supabaseAdmin
        .from('teachers')
        .select('*')
        .eq('user_id', user.id)
        .single();
      roleData = teacher;
    } else if (user.role === 'parent') {
      const { data: parent } = await supabaseAdmin
        .from('parents')
        .select('*')
        .eq('user_id', user.id)
        .single();
      roleData = parent;
    }

    res.json({
      success: true,
      data: {
        session: data.session,
        user: {
          ...user,
          role_data: roleData,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await supabaseAdmin.auth.signOut();
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/change-password
 */
router.post('/change-password', authenticate, validate(changePasswordSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { current_password, new_password } = req.body;

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('auth_id')
      .eq('id', req.authUserId)
      .single();

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: req.user!.email,
      password: current_password,
    });

    if (signInError) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.auth_id,
      { password: new_password }
    );

    if (updateError) {
      throw new AppError('Failed to change password', 500);
    }

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/reset-password
 */
router.post('/reset-password', authenticate, authorizeAdmin, validate(resetPasswordSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user_id } = req.body;
    const tempPassword = `Tmp_${randomBytes(12).toString('base64url')}!1`;
    await resetUserPassword(user_id, tempPassword, req.authUserId!);

    res.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({
      success: true,
      data: req.user,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/users
 */
router.post('/users', authenticate, authorizeAdmin, validate(createUserSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await createUser(req.body, req.authUserId!);
    res.status(201).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/users/:id/deactivate
 */
router.post('/users/:id/deactivate', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await deactivateUser(req.params.id, req.authUserId!);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/users/:id/activate
 */
router.post('/users/:id/activate', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await activateUser(req.params.id, req.authUserId!);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/users
 */
router.get('/users', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, status, search } = req.query;
    let query = supabaseAdmin
      .from('users')
      .select(`*, profile:profiles(*)`);

    if (role) query = query.eq('role', role);
    if (status) query = query.eq('status', status);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new AppError('Failed to fetch users', 500);
    }

    res.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    next(error);
  }
});

export default router;
