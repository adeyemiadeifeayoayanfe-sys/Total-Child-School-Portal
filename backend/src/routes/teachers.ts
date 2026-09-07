import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, authorizeAdmin, authorizeTeacher } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { AppError, NotFoundError, ForbiddenError } from '../middleware/errorHandler';
import { createTeacher, updateTeacher, deactivateTeacher, activateTeacher, assignTeacherToClass, assignTeacherToSubject, getTeacherAssignments } from '../services/teacherService';
import { assignTeacherToClassSchema } from '../validators/class';
import { assignTeacherToSubjectSchema } from '../validators/subject';

const router = Router();

/**
 * GET /api/teachers
 * List all teachers
 */
router.get('/', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, is_active } = req.query;

    let query = supabaseAdmin
      .from('teachers')
      .select(`
  *,
  user:users!teachers_user_id_fkey(
    email,
    status,
    profile:profiles(
      first_name,
      last_name,
      phone
    )
  )
`);

    if (search) {
      query = query.or(`profile.first_name.ilike.%${search}%,profile.last_name.ilike.%${search}%,staff_number.ilike.%${search}%`);
    }
    if (is_active !== undefined) query = query.eq('is_active', is_active === 'true');

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch teachers:', error);
      throw new AppError(`Failed to fetch teachers: ${error.message}`, 500);
    }

    res.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/teachers/:id
 * Get teacher details
 */
router.get('/:id', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const assignments = await getTeacherAssignments(req.params.id);
    res.json({
      success: true,
      data: assignments,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/teachers
 * Create new teacher (Admin/Super Admin only)
 */
router.post('/', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teacher = await createTeacher(req.body, req.authUserId!);
    res.status(201).json({
      success: true,
      data: teacher,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/teachers/:id
 * Update teacher
 */
router.put('/:id', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teacher = await updateTeacher(req.params.id, req.body, req.authUserId!);
    res.json({
      success: true,
      data: teacher,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/teachers/:id/deactivate
 * Deactivate teacher
 */
router.post('/:id/deactivate', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await deactivateTeacher(req.params.id, req.authUserId!);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/teachers/:id/activate
 * Activate teacher
 */
router.post('/:id/activate', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await activateTeacher(req.params.id, req.authUserId!);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/teachers/assign-class
 * Assign teacher to class
 */
router.post('/assign-class', authenticate, authorizeAdmin, validate(assignTeacherToClassSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { teacher_id, class_id, session_id, is_class_teacher } = req.body;
    const assignment = await assignTeacherToClass(teacher_id, class_id, session_id, is_class_teacher || false, req.authUserId!);
    res.json({
      success: true,
      data: assignment,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/teachers/assign-subject
 * Assign teacher to subject
 */
router.post('/assign-subject', authenticate, authorizeAdmin, validate(assignTeacherToSubjectSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { teacher_id, subject_id, class_id, session_id } = req.body;
    const assignment = await assignTeacherToSubject(teacher_id, subject_id, class_id, session_id, req.authUserId!);
    res.json({
      success: true,
      data: assignment,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/teachers/my/assignments
 * Get current teacher's assignments
 */
router.get('/my/assignments', authenticate, authorizeTeacher, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get teacher record for current user
    const { data: teacher } = await supabaseAdmin
      .from('teachers')
      .select('id')
      .eq('user_id', req.authUserId)
      .single();

    if (!teacher) {
      throw new NotFoundError('Teacher record not found');
    }

    const assignments = await getTeacherAssignments(teacher.id);
    res.json({
      success: true,
      data: assignments,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/teachers/my/classes
 * Get current teacher's classes with students
 */
router.get('/my/classes', authenticate, authorizeTeacher, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: teacher } = await supabaseAdmin
      .from('teachers')
      .select('id')
      .eq('user_id', req.authUserId)
      .single();

    if (!teacher) {
      throw new NotFoundError('Teacher record not found');
    }

    const { data: classAssignments } = await supabaseAdmin
      .from('teacher_class_assignments')
      .select(`
        class:classes(*),
        session:academic_sessions(*)
      `)
      .eq('teacher_id', teacher.id)
      .is('unassigned_at', null);

    // Get students for each class
    const classesWithStudents = [];
    for (const assignment of (classAssignments || []) as unknown as Array<{
      class: { id: string };
      session: { id: string };
    }>) {
      const { data: enrollments } = await supabaseAdmin
        .from('enrollments')
        .select(`
          student:students(*)
        `)
        .eq('class_id', assignment.class.id)
        .eq('session_id', assignment.session.id)
        .is('unenrolled_at', null);

      classesWithStudents.push({
        ...assignment,
        students: (enrollments || []).map(e => e.student),
      });
    }

    res.json({
      success: true,
      data: classesWithStudents,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
