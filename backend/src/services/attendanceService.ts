import { supabaseAdmin } from '../config/supabase';
import { AppError, NotFoundError, ConflictError, ForbiddenError } from '../middleware/errorHandler';
import { logAudit } from '../utils/auditLogger';
import { createNotification, notifyAdmins } from '../utils/notifications';
import { ensureTeacherAssignedToClass, getTeacherRecordForUser } from './accessService';

interface AttendanceRecord {
  student_id: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  remarks?: string | null;
}

interface TakeAttendanceInput {
  class_id: string;
  session_id: string;
  term_id: string;
  attendance_date: string;
  records: AttendanceRecord[];
}

export async function takeAttendance(
  input: TakeAttendanceInput,
  markedBy: string
) {
  const teacher = await getTeacherRecordForUser(markedBy);
  await ensureTeacherAssignedToClass(teacher.id, input.class_id, input.session_id);

  const attendanceDate = input.attendance_date;
  const classId = input.class_id;
  const sessionId = input.session_id;
  const termId = input.term_id;

  // Check for existing attendance for this class/date/session
  const { data: existing } = await supabaseAdmin
    .from('attendance')
    .select('id')
    .eq('class_id', classId)
    .eq('attendance_date', attendanceDate)
    .eq('session_id', sessionId)
    .limit(1);

  if (existing && existing.length > 0) {
    throw new ConflictError('Attendance has already been taken for this class on this date');
  }

  // Verify all students belong to this class
  const studentIds = input.records.map(r => r.student_id);
  const { data: enrolledStudents } = await supabaseAdmin
    .from('enrollments')
    .select('student_id')
    .eq('class_id', classId)
    .eq('session_id', sessionId)
    .is('unenrolled_at', null)
    .in('student_id', studentIds);

  const enrolledIds = new Set((enrolledStudents || []).map(e => e.student_id));

  // Check if any student is not enrolled
  for (const record of input.records) {
    if (!enrolledIds.has(record.student_id)) {
      throw new ForbiddenError(`Student ${record.student_id} is not enrolled in this class`);
    }
  }

  // Insert attendance records
  const attendanceRecords = input.records.map(record => ({
    student_id: record.student_id,
    class_id: classId,
    session_id: sessionId,
    term_id: termId,
    attendance_date: attendanceDate,
    status: record.status,
    remarks: record.remarks || null,
    marked_by: markedBy,
  }));

  const { data, error } = await supabaseAdmin
    .from('attendance')
    .insert(attendanceRecords)
    .select();

  if (error) {
    console.error('Attendance creation error:', error);
    throw new AppError('Failed to record attendance', 500);
  }

  // Count absentees
  const absentCount = input.records.filter(r => r.status === 'absent').length;
  const presentCount = input.records.filter(r => r.status === 'present').length;

  await logAudit(markedBy, {
    action: 'attendance_taken',
    entity_type: 'attendance',
    metadata: {
      class_id: classId,
      date: attendanceDate,
      total: input.records.length,
      present: presentCount,
      absent: absentCount,
    },
  });

  // Notify admins if high absence rate
  if (absentCount > 0 && absentCount / input.records.length > 0.2) {
    await notifyAdmins(
      'High Absence Rate',
      `Class ${classId} has ${absentCount} absent students (${Math.round((absentCount / input.records.length) * 100)}%) on ${attendanceDate}.`,
      'warning'
    );
  }

  return {
    success: true,
    total: input.records.length,
    present: presentCount,
    absent: absentCount,
  };
}

export async function updateAttendance(
  attendanceId: string,
  status: string,
  remarks: string | null,
  updatedBy: string
) {
  const { data: existing } = await supabaseAdmin
    .from('attendance')
    .select('*')
    .eq('id', attendanceId)
    .single();

  if (!existing) {
    throw new NotFoundError('Attendance record not found');
  }

  const teacher = await getTeacherRecordForUser(updatedBy);
  await ensureTeacherAssignedToClass(teacher.id, existing.class_id, existing.session_id);

  const { data: updated, error } = await supabaseAdmin
    .from('attendance')
    .update({
      status,
      remarks,
    })
    .eq('id', attendanceId)
    .select()
    .single();

  if (error || !updated) {
    throw new AppError('Failed to update attendance', 500);
  }

  await logAudit(updatedBy, {
    action: 'attendance_updated',
    entity_type: 'attendance',
    entity_id: attendanceId,
    old_value: existing,
    new_value: updated,
  });

  return updated;
}

export async function getClassAttendance(
  classId: string,
  sessionId: string,
  date?: string
) {
  let query = supabaseAdmin
    .from('attendance')
    .select(`
      *,
      student:students(id, admission_number, first_name, last_name)
    `)
    .eq('class_id', classId)
    .eq('session_id', sessionId);

  if (date) {
    query = query.eq('attendance_date', date);
  }

  const { data, error } = await query.order('attendance_date', { ascending: false });

  if (error) {
    throw new AppError('Failed to fetch attendance', 500);
  }

  return data || [];
}

export async function getStudentAttendance(
  studentId: string,
  sessionId?: string
) {
  let query = supabaseAdmin
    .from('attendance')
    .select(`
      *,
      class:classes(name),
      term:terms(name)
    `)
    .eq('student_id', studentId);

  if (sessionId) {
    query = query.eq('session_id', sessionId);
  }

  const { data, error } = await query.order('attendance_date', { ascending: false });

  if (error) {
    throw new AppError('Failed to fetch student attendance', 500);
  }

  return data || [];
}

export async function getAttendanceStats(
  classId: string,
  sessionId: string,
  termId: string
) {
  const { data: stats, error } = await supabaseAdmin
    .from('attendance')
    .select('status')
    .eq('class_id', classId)
    .eq('session_id', sessionId)
    .eq('term_id', termId);

  if (error) {
    throw new AppError('Failed to fetch attendance stats', 500);
  }

  const total = stats?.length || 0;
  const present = stats?.filter(s => s.status === 'present').length || 0;
  const absent = stats?.filter(s => s.status === 'absent').length || 0;
  const late = stats?.filter(s => s.status === 'late').length || 0;
  const excused = stats?.filter(s => s.status === 'excused').length || 0;

  return {
    total,
    present,
    absent,
    late,
    excused,
    attendanceRate: total > 0 ? ((present + late) / total) * 100 : 0,
  };
}
