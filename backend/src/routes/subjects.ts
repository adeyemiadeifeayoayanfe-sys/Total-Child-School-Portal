import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, authorizeAdmin } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { AppError, NotFoundError } from '../middleware/errorHandler';
import { createSubjectSchema, updateSubjectSchema } from '../validators/subject';
const router = Router();
router.get(
  '/',
  authenticate,
  authorizeAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { is_active, search } = req.query;
      let query = supabaseAdmin.from('subjects').select('*');
      if (is_active !== undefined) {
        query = query.eq('is_active', is_active === 'true');
      }
      if (search) {
        const term = String(search).replace(/[%_]/g, '\\$&');
        query = query.or(`name.ilike.%${term}%,code.ilike.%${term}%`);
      }
      const { data, error } = await query.order('name', { ascending: true });
      if (error) {
        throw new AppError('Failed to fetch subjects', 500);
      }
      res.json({
        success: true,
        data: data || [],
      });
    } catch (error) {
      next(error);
    }
  }
);
router.get(
  '/:id',
  authenticate,
  authorizeAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('subjects')
        .select(`
          *,
          class_subject_assignments(
            *,
            class:classes(*),
            session:academic_sessions(*)
          ),
          teacher_subject_assignments(
            *,
            teacher:teachers(
              *,
              profile:profiles(first_name, last_name)
            )
          )
        `)
        .eq('id', req.params.id)
        .single();
      if (error || !data) {
        throw new NotFoundError('Subject not found');
      }
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
);
router.post(
  '/',
  authenticate,
  authorizeAdmin,
  validate(createSubjectSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('subjects')
        .insert({
          name: req.body.name.trim(),
          code: req.body.code?.trim() || null,
          description: req.body.description?.trim() || null,
          created_by: req.authUserId,
        })
        .select()
        .single();
      if (error || !data) {
        if (error?.code === '23505') {
          throw new AppError('A subject with this name or code already exists', 409);
        }
        throw new AppError('Failed to create subject', 500);
      }
      res.status(201).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
);
router.put(
  '/:id',
  authenticate,
  authorizeAdmin,
  validate(updateSubjectSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updates: Record<string, unknown> = {};
      if (req.body.name !== undefined) {
        updates.name = req.body.name.trim();
      }
      if (req.body.code !== undefined) {
        updates.code = req.body.code?.trim() || null;
      }
      if (req.body.description !== undefined) {
        updates.description = req.body.description?.trim() || null;
      }
      if (req.body.is_active !== undefined) {
        updates.is_active = req.body.is_active;
      }
      if (Object.keys(updates).length === 0) {
        throw new AppError('No changes provided', 400);
      }
      const { data, error } = await supabaseAdmin
        .from('subjects')
        .update(updates)
        .eq('id', req.params.id)
        .select()
        .single();
      if (error) {
        if (error.code === '23505') {
          throw new AppError('A subject with this name or code already exists', 409);
        }
        throw new AppError('Failed to update subject', 500);
      }
      if (!data) {
        throw new NotFoundError('Subject not found');
      }
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
);
export default router;
