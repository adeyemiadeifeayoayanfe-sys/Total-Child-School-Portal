import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, authorizeAdmin } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { AppError, NotFoundError } from '../middleware/errorHandler';
import { createClassSchema, updateClassSchema } from '../validators/class';

const router = Router();

router.get('/', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { is_active, search } = req.query;
    let query = supabaseAdmin.from('classes').select('*');

    if (is_active !== undefined) query = query.eq('is_active', is_active === 'true');
    if (search) query = query.ilike('name', `%${search}%`);

    const { data: classRows, error } = await query.order('name', { ascending: true });
    if (error) throw new AppError('Failed to fetch classes', 500);

    const classes = await Promise.all((classRows || []).map(async (cls: any) => {
      const [{ data: enrollments, error: enrollmentError }, { data: subjects, error: subjectError }] =
        await Promise.all([
          supabaseAdmin.from('enrollments').select('id').eq('class_id', cls.id).is('unenrolled_at', null),
          supabaseAdmin.from('class_subject_assignments').select('id').eq('class_id', cls.id),
        ]);

      if (enrollmentError || subjectError) {
        throw new AppError('Failed to load class relationships', 500);
      }

      return {
        ...cls,
        student_count: enrollments?.length || 0,
        subject_count: subjects?.length || 0,
      };
    }));

    res.json({ success: true, data: classes });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: classData, error: classError } = await supabaseAdmin
      .from('classes')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (classError) throw new AppError('Failed to load class details', 500);
    if (!classData) throw new NotFoundError('Class not found');

    const { data: enrollments, error: enrollmentError } = await supabaseAdmin
      .from('enrollments')
      .select('*')
      .eq('class_id', req.params.id);

    const { data: teacherAssignments, error: teacherError } = await supabaseAdmin
      .from('teacher_class_assignments')
      .select('*')
      .eq('class_id', req.params.id)
      .is('unassigned_at', null);

    const { data: subjectAssignments, error: subjectError } = await supabaseAdmin
      .from('class_subject_assignments')
      .select('*')
      .eq('class_id', req.params.id);

    if (enrollmentError) throw new AppError(`Failed to load class enrollments: ${enrollmentError.message}`, 500);
    if (teacherError) throw new AppError(`Failed to load teacher assignments: ${teacherError.message}`, 500);
    if (subjectError) throw new AppError(`Failed to load subject assignments: ${subjectError.message}`, 500);

    const studentIds = [...new Set((enrollments || []).map((item: any) => item.student_id).filter(Boolean))];
    const sessionIds = [...new Set([
      ...(enrollments || []).map((item: any) => item.session_id),
      ...(teacherAssignments || []).map((item: any) => item.session_id),
      ...(subjectAssignments || []).map((item: any) => item.session_id),
    ].filter(Boolean))];
    const teacherIds = [...new Set((teacherAssignments || []).map((item: any) => item.teacher_id).filter(Boolean))];
    const subjectIds = [...new Set((subjectAssignments || []).map((item: any) => item.subject_id).filter(Boolean))];

    const [
      { data: students },
      { data: sessions },
      { data: teachers },
      { data: subjects },
    ] = await Promise.all([
      studentIds.length
        ? supabaseAdmin.from('students').select('*').in('id', studentIds)
        : Promise.resolve({ data: [] }),
      sessionIds.length
        ? supabaseAdmin.from('academic_sessions').select('*').in('id', sessionIds)
        : Promise.resolve({ data: [] }),
      teacherIds.length
        ? supabaseAdmin.from('teachers').select('*').in('id', teacherIds)
        : Promise.resolve({ data: [] }),
      subjectIds.length
        ? supabaseAdmin.from('subjects').select('*').in('id', subjectIds)
        : Promise.resolve({ data: [] }),
    ]);

    const studentMap = new Map((students || []).map((item: any) => [item.id, item]));
    const sessionMap = new Map((sessions || []).map((item: any) => [item.id, item]));
    const teacherMap = new Map((teachers || []).map((item: any) => [item.id, item]));
    const subjectMap = new Map((subjects || []).map((item: any) => [item.id, item]));

    const enrichedEnrollments = (enrollments || []).map((item: any) => ({
      ...item,
      student: studentMap.get(item.student_id) || null,
      session: sessionMap.get(item.session_id) || null,
    }));

    const enrichedTeacherAssignments = (teacherAssignments || []).map((item: any) => ({
      ...item,
      teacher: teacherMap.get(item.teacher_id) || null,
      session: sessionMap.get(item.session_id) || null,
    }));

    const enrichedSubjectAssignments = (subjectAssignments || []).map((item: any) => ({
      ...item,
      subject: subjectMap.get(item.subject_id) || null,
      session: sessionMap.get(item.session_id) || null,
    }));

    res.json({
      success: true,
      data: {
        ...classData,
        enrollments: enrichedEnrollments,
        teacher_class_assignments: enrichedTeacherAssignments,
        class_subject_assignments: enrichedSubjectAssignments,
        student_count: enrichedEnrollments.filter((item: any) => !item.unenrolled_at).length,
        subject_count: enrichedSubjectAssignments.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, authorizeAdmin, validate(createClassSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('classes')
      .insert({ ...req.body, created_by: req.authUserId })
      .select()
      .single();

    if (error || !data) throw new AppError('Failed to create class', 500);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authenticate, authorizeAdmin, validate(updateClassSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('classes')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error || !data) throw new NotFoundError('Class not found');
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/assign-subject', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { class_id, subject_ids, session_id } = req.body;

    if (!class_id || !session_id || !Array.isArray(subject_ids) || subject_ids.length === 0) {
      throw new AppError('Class, session, and at least one subject are required', 400);
    }

    const rows = subject_ids.map((subject_id: string) => ({
      class_id,
      subject_id,
      session_id,
      created_by: req.authUserId,
    }));

    const { data, error } = await supabaseAdmin
      .from('class_subject_assignments')
      .upsert(rows, {
        onConflict: 'class_id,subject_id,session_id',
        ignoreDuplicates: true,
      })
      .select();

    if (error) throw new AppError('Failed to assign subjects to class', 500);

    res.status(201).json({ success: true, data: data || [] });
  } catch (error) {
    next(error);
  }
});

router.put('/:id/subjects', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subject_ids, session_id } = req.body;

    if (!session_id || !Array.isArray(subject_ids)) {
      throw new AppError('Session and subject list are required', 400);
    }

    const { error: deleteError } = await supabaseAdmin
      .from('class_subject_assignments')
      .delete()
      .eq('class_id', req.params.id)
      .eq('session_id', session_id);

    if (deleteError) throw new AppError('Failed to update class subjects', 500);

    if (subject_ids.length > 0) {
      const rows = subject_ids.map((subject_id: string) => ({
        class_id: req.params.id,
        subject_id,
        session_id,
        created_by: req.authUserId,
      }));

      const { error: insertError } = await supabaseAdmin
        .from('class_subject_assignments')
        .insert(rows);

      if (insertError) throw new AppError('Failed to save class subjects', 500);
    }

    const { data } = await supabaseAdmin
      .from('class_subject_assignments')
      .select('*, subject:subjects(*), session:academic_sessions(*)')
      .eq('class_id', req.params.id)
      .eq('session_id', session_id);

    res.json({ success: true, data: data || [] });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/roster', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { session_id } = req.query;

    let query = supabaseAdmin
      .from('enrollments')
      .select('*, student:students(*)')
      .eq('class_id', req.params.id)
      .is('unenrolled_at', null);

    if (session_id) query = query.eq('session_id', session_id);

    const { data, error } = await query;

    if (error) throw new AppError('Failed to fetch class roster', 500);

    res.json({
      success: true,
      data: (data || []).sort((left: any, right: any) =>
        (left.student?.last_name || '').localeCompare(right.student?.last_name || '')
      ),
    });
  } catch (error) {
    next(error);
  }
});

export default router;


