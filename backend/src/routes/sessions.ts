import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, authorizeSuperAdmin } from '../middleware/auth';
const router = Router();
router.use(authenticate);
router.get(
  '/',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { data, error } = await supabaseAdmin
        .from('academic_sessions')
        .select('*, terms(*)')
        .order('start_date', { ascending: false });
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.json(data ?? []);
    } catch (error) {
      next(error);
    }
  },
);
router.get(
  '/current',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { data, error } = await supabaseAdmin
        .from('academic_sessions')
        .select('*, terms(*)')
        .eq('is_current', true)
        .maybeSingle();
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.json(data ?? null);
    } catch (error) {
      next(error);
    }
  },
);
router.get(
  '/current-term',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { data, error } = await supabaseAdmin
        .from('terms')
        .select('*')
        .eq('is_current', true)
        .maybeSingle();
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.json(data ?? null);
    } catch (error) {
      next(error);
    }
  },
);
router.post(
  '/',
  authorizeSuperAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, start_date, end_date } = req.body;
      if (!name || !start_date || !end_date) {
        res.status(400).json({
          error: 'Name, start date, and end date are required.',
        });
        return;
      }
      const startDate = new Date(`${start_date}T00:00:00`);
      const endDate = new Date(`${end_date}T00:00:00`);
      if (
        Number.isNaN(startDate.getTime()) ||
        Number.isNaN(endDate.getTime()) ||
        endDate < startDate
      ) {
        res.status(400).json({
          error: 'Invalid session dates.',
        });
        return;
      }
      const { data: session, error: sessionError } = await supabaseAdmin
        .from('academic_sessions')
        .insert({
          name,
          start_date,
          end_date,
          is_current: false,
          created_by: req.user?.id,
        })
        .select()
        .single();
      if (sessionError) {
        res.status(400).json({ error: sessionError.message });
        return;
      }
      try {
        const totalDays =
          Math.floor(
            (endDate.getTime() - startDate.getTime()) /
              (1000 * 60 * 60 * 24),
          ) + 1;
        const baseDays = Math.floor(totalDays / 3);
        const remainder = totalDays % 3;
        const termNames = ['First Term', 'Second Term', 'Third Term'];
        let currentTermStart = new Date(startDate);
        for (let index = 0; index < 3; index++) {
          const termDays =
            baseDays + (index < remainder ? 1 : 0);
          const termEnd = new Date(currentTermStart);
          termEnd.setDate(
            termEnd.getDate() + termDays - 1,
          );
          const { error: termError } = await supabaseAdmin
            .from('terms')
            .insert({
              session_id: session.id,
              name: termNames[index],
              start_date: currentTermStart
                .toISOString()
                .slice(0, 10),
              end_date: termEnd
                .toISOString()
                .slice(0, 10),
              is_current: false,
              assessment_stage: 'classes',
              created_by: req.user?.id,
            });
          if (termError) {
            await supabaseAdmin
              .from('terms')
              .delete()
              .eq('session_id', session.id);
            await supabaseAdmin
              .from('academic_sessions')
              .delete()
              .eq('id', session.id);
            res.status(400).json({
              error: termError.message,
            });
            return;
          }
          currentTermStart = new Date(termEnd);
          currentTermStart.setDate(
            currentTermStart.getDate() + 1,
          );
        }
        const {
          data: createdSession,
          error: createdSessionError,
        } = await supabaseAdmin
          .from('academic_sessions')
          .select('*, terms(*)')
          .eq('id', session.id)
          .single();
        if (createdSessionError) {
          res.status(500).json({
            error: createdSessionError.message,
          });
          return;
        }
        res.status(201).json(createdSession);
      } catch (error) {
        await supabaseAdmin
          .from('terms')
          .delete()
          .eq('session_id', session.id);
        await supabaseAdmin
          .from('academic_sessions')
          .delete()
          .eq('id', session.id);
        next(error);
      }
    } catch (error) {
      next(error);
    }
  },
);
router.post(
  '/:id/set-current',
  authorizeSuperAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { data: session, error: sessionLookupError } =
        await supabaseAdmin
          .from('academic_sessions')
          .select('id')
          .eq('id', id)
          .maybeSingle();
      if (sessionLookupError) {
        res.status(500).json({
          error: sessionLookupError.message,
        });
        return;
      }
      if (!session) {
        res.status(404).json({
          error: 'Academic session not found.',
        });
        return;
      }
      const { error: clearSessionError } = await supabaseAdmin
        .from('academic_sessions')
        .update({ is_current: false })
        .eq('is_current', true);
      if (clearSessionError) {
        res.status(500).json({
          error: clearSessionError.message,
        });
        return;
      }
      const { error: clearTermsError } = await supabaseAdmin
        .from('terms')
        .update({ is_current: false })
        .eq('is_current', true);
      if (clearTermsError) {
        res.status(500).json({
          error: clearTermsError.message,
        });
        return;
      }
      const { data, error } = await supabaseAdmin
        .from('academic_sessions')
        .update({ is_current: true })
        .eq('id', id)
        .select('*, terms(*)')
        .single();
      if (error) {
        res.status(500).json({
          error: error.message,
        });
        return;
      }
      res.json(data);
    } catch (error) {
      next(error);
    }
  },
);
export default router;
