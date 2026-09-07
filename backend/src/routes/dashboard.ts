import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, authorizeAdmin, authorizeTeacher, authorizeParent } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

type RelationRecord<T> = T | T[] | null;

function asRecord<T extends { id: string }>(value: RelationRecord<T>): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

/**
 * GET /api/dashboard/admin
 * Admin dashboard stats
 */
router.get('/admin', authenticate, authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Count students
    const { count: studentCount } = await supabaseAdmin
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Count teachers
    const { count: teacherCount } = await supabaseAdmin
      .from('teachers')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Count parents
    const { count: parentCount } = await supabaseAdmin
      .from('parents')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Count classes
    const { count: classCount } = await supabaseAdmin
      .from('classes')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Today's attendance
    const { data: todayAttendance } = await supabaseAdmin
      .from('attendance')
      .select('status')
      .eq('attendance_date', today);

    // Pending broadsheets
    const { count: pendingBroadsheets } = await supabaseAdmin
      .from('broadsheet_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'submitted');

    // Pending results
    const { count: generatedResults } = await supabaseAdmin
      .from('results')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'generated');

    // Today's payments
    const { data: todayPayments } = await supabaseAdmin
      .from('payments')
      .select('amount')
      .eq('payment_date', today)
      .eq('status', 'completed');

    // Cashbook balance
    const { data: lastTxn } = await supabaseAdmin
      .from('cashbook_transactions')
      .select('running_balance')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Receipt queue
    const { count: receiptQueue } = await supabaseAdmin
      .from('receipts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Published results
    const { count: publishedResults } = await supabaseAdmin
      .from('results')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published');

    res.json({
      success: true,
      data: {
        students: studentCount || 0,
        teachers: teacherCount || 0,
        parents: parentCount || 0,
        classes: classCount || 0,
        today_attendance: {
          total: todayAttendance?.length || 0,
          present: todayAttendance?.filter(a => a.status === 'present' || a.status === 'late').length || 0,
          absent: todayAttendance?.filter(a => a.status === 'absent').length || 0,
        },
        pending_broadsheets: pendingBroadsheets || 0,
        generated_results: generatedResults || 0,
        published_results: publishedResults || 0,
        today_payments: {
          count: todayPayments?.length || 0,
          total: todayPayments?.reduce((sum, p) => sum + p.amount, 0) || 0,
        },
        cashbook_balance: lastTxn?.running_balance || 0,
        receipt_queue: receiptQueue || 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/dashboard/teacher
 * Teacher dashboard stats
 */
router.get('/teacher', authenticate, authorizeTeacher, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Get teacher record
    const { data: teacher } = await supabaseAdmin
      .from('teachers')
      .select('id')
      .eq('user_id', req.authUserId)
      .single();

    if (!teacher) {
      throw new AppError('Teacher record not found', 404);
    }

    // Get teacher's classes
    const { data: classAssignments } = await supabaseAdmin
      .from('teacher_class_assignments')
      .select(`
        class:classes(*),
        session:academic_sessions(*)
      `)
      .eq('teacher_id', teacher.id)
      .is('unassigned_at', null);

    // Get teacher's subjects
    const { data: subjectAssignments } = await supabaseAdmin
      .from('teacher_subject_assignments')
      .select(`
        subject:subjects(*),
        class:classes(*)
      `)
      .eq('teacher_id', teacher.id)
      .is('unassigned_at', null);

    // Get today's attendance status
    let todayAttendanceTaken = false;
    const firstAssignment = asRecord((classAssignments || [])[0] as any);
    const firstClass = firstAssignment ? asRecord(firstAssignment.class as any) : null;
    if (firstClass) {
      const firstClassId = firstClass.id;
      const { data: todayAttendance } = await supabaseAdmin
        .from('attendance')
        .select('id')
        .eq('class_id', firstClassId)
        .eq('attendance_date', today)
        .limit(1);

      todayAttendanceTaken = Boolean(todayAttendance && todayAttendance.length > 0);
    }

    // Get pending broadsheets
    const { data: pendingBroadsheets } = await supabaseAdmin
      .from('broadsheet_submissions')
      .select('*')
      .eq('teacher_id', teacher.id)
      .in('status', ['draft', 'returned']);

    res.json({
      success: true,
      data: {
        classes: classAssignments || [],
        subjects: subjectAssignments || [],
        today_attendance_taken: todayAttendanceTaken,
        pending_broadsheets: pendingBroadsheets || [],
        total_classes: classAssignments?.length || 0,
        total_subjects: subjectAssignments?.length || 0,
        pending_broadsheet_count: pendingBroadsheets?.length || 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/dashboard/parent
 * Parent dashboard stats
 */
router.get('/parent', authenticate, authorizeParent, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get parent record
    const { data: parent } = await supabaseAdmin
      .from('parents')
      .select('id')
      .eq('user_id', req.authUserId)
      .single();

    if (!parent) {
      throw new AppError('Parent record not found', 404);
    }

    // Get children
    const { data: children } = await supabaseAdmin
      .from('parent_child_assignments')
      .select(`
        student:students(
          *,
          current_class:classes(*)
        )
      `)
      .eq('parent_id', parent.id)
      .is('unassigned_at', null);

    const childrenData = [];

    for (const child of (children || []) as Array<{
      student: {
        id: string;
        first_name: string;
        last_name: string;
      } | Array<{
        id: string;
        first_name: string;
        last_name: string;
      }>;
    }>) {
      const student = asRecord(child.student as any);
      if (!student) {
        continue;
      }

      // Get latest published result
      const { data: latestResult } = await supabaseAdmin
        .from('results')
        .select('*')
        .eq('student_id', student.id)
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(1)
        .single();

      // Get recent payments
      const { data: recentPayments } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('student_id', student.id)
        .eq('status', 'completed')
        .order('payment_date', { ascending: false })
        .limit(5);

      // Get recent attendance
      const { data: recentAttendance } = await supabaseAdmin
        .from('attendance')
        .select('*')
        .eq('student_id', student.id)
        .order('attendance_date', { ascending: false })
        .limit(10);

      childrenData.push({
        student,
        latest_result: latestResult || null,
        recent_payments: recentPayments || [],
        recent_attendance: recentAttendance || [],
      });
    }

    res.json({
      success: true,
      data: {
        children: childrenData,
        total_children: childrenData.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
