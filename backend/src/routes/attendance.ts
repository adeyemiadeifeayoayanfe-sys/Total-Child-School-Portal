import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, authorizeAdmin, authorizeTeacher } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { AppError, NotFoundError, ForbiddenError } from '../middleware/errorHandler';
import { takeAttendanceSchema, updateAttendanceSchema } from '../validators/attendance';
import { takeAttendance, updateAttendance, getClassAttendance, getStudentAttendance, getAttendanceStats } from '../services/attendanceService';
import { getTeacherRecordForUser, ensureTeacherAssignedToClass } from '../services/accessService';

const router = Router();

/**
 * POST /api/attendance
 * Take attendance (Teacher)
 */
router.post('/', authenticate, authorizeTeacher, validate(takeAttendanceSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await takeAttendance(req.body, req.authUserId!);
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/attendance/:id
 * Update attendance record
 */
router.put('/:id', authenticate, authorizeTeacher, validate(updateAttendanceSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, remarks } = req.body;
    const updated = await updateAttendance(req.params.id, status, remarks || null, req.authUserId!);
    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/attendance/class/:classId
 * Get class attendance
 */
router.get('/class/:classId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { session_id, date } = req.query;
    let effectiveSessionId = (session_id as string) || '';

    if (!effectiveSessionId) {
      const { data: currentSession } = await supabaseAdmin
        .from('academic_sessions')
        .select('id')
        .eq('is_current', true)
        .single();

      effectiveSessionId = currentSession?.id || '';
    }

    if (!effectiveSessionId) {
      throw new NotFoundError('No current session found');
    }

    if (req.user?.role === 'teacher') {
      const teacher = await getTeacherRecordForUser(req.authUserId!);
      await ensureTeacherAssignedToClass(teacher.id, req.params.classId, effectiveSessionId);
    } else if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
      throw new ForbiddenError('You do not have permission to view attendance for this class');
    }

    const attendance = await getClassAttendance(
      req.params.classId,
      effectiveSessionId,
      date as string | undefined
    );
    res.json({
      success: true,
      data: attendance,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/attendance/student/:studentId
 * Get student attendance
 */
router.get('/student/:studentId', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { session_id } = req.query;
    const attendance = await getStudentAttendance(
      req.params.studentId,
      session_id as string | undefined
    );
    res.json({
      success: true,
      data: attendance,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/attendance/stats/:classId
 * Get attendance statistics
 */
router.get('/stats/:classId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { session_id, term_id } = req.query;
    let effectiveSessionId = (session_id as string) || '';

    if (!effectiveSessionId) {
      const { data: currentSession } = await supabaseAdmin
        .from('academic_sessions')
        .select('id')
        .eq('is_current', true)
        .single();

      effectiveSessionId = currentSession?.id || '';
    }

    if (!effectiveSessionId) {
      throw new NotFoundError('No current session found');
    }

    if (req.user?.role === 'teacher') {
      const teacher = await getTeacherRecordForUser(req.authUserId!);
      await ensureTeacherAssignedToClass(teacher.id, req.params.classId, effectiveSessionId);
    } else if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
      throw new ForbiddenError('You do not have permission to view attendance stats');
    }

    const stats = await getAttendanceStats(
      req.params.classId,
      effectiveSessionId,
      (term_id as string) || ''
    );
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/attendance/today
 * Get today's attendance summary
 */
router.get('/today', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data: classes } = await supabaseAdmin
      .from('classes')
      .select('id, name')
      .eq('is_active', true);

    const summary = [];

    for (const classData of classes || []) {
      const { data: attendance } = await supabaseAdmin
        .from('attendance')
        .select('status')
        .eq('class_id', classData.id)
        .eq('attendance_date', today);

      if (attendance && attendance.length > 0) {
        const present = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
        const absent = attendance.filter(a => a.status === 'absent').length;
        
        summary.push({
          class_id: classData.id,
          class_name: classData.name,
          present,
          absent,
          total: attendance.length,
        });
      }
    }

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
