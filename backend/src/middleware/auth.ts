import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthUser, UserRole } from '../types';

/**
 * Authentication middleware
 * Uses Supabase's built-in token verification via getUser()
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'No authentication token provided',
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Invalid authentication token',
      });
      return;
    }

    // Verify token using Supabase
    const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authUser) {
      console.error('Supabase token verification failed:', authError?.message);
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
      return;
    }

    // Get the user from our database
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('auth_id', authUser.id)
      .single();

    if (userError || !user) {
      res.status(401).json({
        success: false,
        error: 'User not found in database',
      });
      return;
    }

    if (user.status !== 'active') {
      res.status(403).json({
        success: false,
        error: 'Account is not active. Contact administrator.',
      });
      return;
    }

    // Get profile
    const { data: profile } = await supabaseAdmin
  .from('profiles')
  .select('*')
  .eq('user_id', user.id)
  .single();

const { data: userRoles, error: rolesError } = await supabaseAdmin
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id);

if (rolesError) {
  console.error('Failed to load user roles:', rolesError.message);
  res.status(500).json({
    success: false,
    error: 'Failed to load user roles',
  });
  return;
}

const roles = userRoles?.map((item) => item.role as UserRole) || [];

// Backward compatibility: if an old user somehow has no
// user_roles record, fall back to the users.role value.
if (roles.length === 0) {
  roles.push(user.role as UserRole);
}

req.user = {
  ...user,
  role: user.role as UserRole,
  roles,
  profile: profile || undefined,
};

    req.authUserId = user.id;
    next();
  } catch (error: any) {
    console.error('Auth middleware error:', error.message);
    res.status(401).json({
      success: false,
      error: 'Authentication failed',
    });
    return;
  }
}

/**
 * Authorization middleware factory
 */
export function authorize(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    if (!req.user.roles?.some((userRole) => roles.includes(userRole))) {
      res.status(403).json({
        success: false,
        error: 'You do not have permission to perform this action',
      });
      return;
    }

    next();
  };
}

export const authorizeAdmin = authorize('admin', 'super_admin');
export const authorizeSuperAdmin = authorize('super_admin');
export const authorizeTeacher = authorize('teacher');
export const authorizeParent = authorize('parent');
