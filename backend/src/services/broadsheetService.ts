import { supabaseAdmin } from '../config/supabase';
import { AppError, NotFoundError, ForbiddenError, ConflictError, ValidationError } from '../middleware/errorHandler';
import { logAudit } from '../utils/auditLogger';
import { createNotification, notifyAdmins } from '../utils/notifications';
import { ensureTeacherAssignedToSubject, getTeacherRecordForUser } from './accessService';

interface SubmitBroadsheetInput {
  class_id: string;
  subject_id: string;
  session_id: string;
  term_id: string;
}

export async function submitBroadsheet(
  input: SubmitBroadsheetInput,
  teacherId: string,
  teacherUserId: string
) {
  const teacher = await getTeacherRecordForUser(teacherUserId);
  await ensureTeacherAssignedToSubject(teacher.id, input.subject_id, input.class_id, input.session_id);

  const { data: classSubject, error: classSubjectError } = await supabaseAdmin
    .from('class_subject_assignments')
    .select('id')
    .eq('class_id', input.class_id)
    .eq('subject_id', input.subject_id)
    .eq('session_id', input.session_id)
    .eq('is_active', true)
    .single();

  if (classSubjectError || !classSubject) {
    throw new ForbiddenError('This subject is not assigned to the selected class');
  }

  const { data: enrolledStudents } = await supabaseAdmin
    .from('enrollments')
    .select('student_id')
    .eq('class_id', input.class_id)
    .eq('session_id', input.session_id)
    .is('unenrolled_at', null);

  const studentIds = (enrolledStudents || []).map((student) => student.student_id);

  if (studentIds.length === 0) {
    throw new ValidationError('No enrolled students were found for this class and session');
  }

  const { data: scoreRows } = await supabaseAdmin
    .from('scores')
    .select('student_id')
    .eq('class_id', input.class_id)
    .eq('subject_id', input.subject_id)
    .eq('session_id', input.session_id)
    .eq('term_id', input.term_id)
    .in('student_id', studentIds);

  const scoredStudentIds = new Set((scoreRows || []).map((row) => row.student_id));
  const missingStudentIds = studentIds.filter((studentId) => !scoredStudentIds.has(studentId));

  if (missingStudentIds.length > 0) {
    throw new ValidationError('Scores must be entered for all enrolled students before submission');
  }

  // Check if broadsheet already exists
  const { data: existing } = await supabaseAdmin
    .from('broadsheet_submissions')
    .select('*')
    .eq('class_id', input.class_id)
    .eq('subject_id', input.subject_id)
    .eq('session_id', input.session_id)
    .eq('term_id', input.term_id)
    .single();

  if (existing) {
    if (existing.status === 'approved') {
      throw new ConflictError('This broadsheet has already been approved');
    }

    if (existing.teacher_id !== teacherId) {
      throw new ForbiddenError('You cannot modify another teacher\'s broadsheet');
    }

    // Update existing broadsheet
    const { data: updated, error } = await supabaseAdmin
      .from('broadsheet_submissions')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error || !updated) {
      throw new AppError('Failed to submit broadsheet', 500);
    }

    await logAudit(teacherUserId, {
      action: 'broadsheet_submitted',
      entity_type: 'broadsheet',
      entity_id: updated.id,
      metadata: {
        class_id: input.class_id,
        subject_id: input.subject_id,
        term_id: input.term_id,
      },
    });

    await notifyAdmins(
      'Broadsheet Submitted',
      `A broadsheet has been submitted for review.`,
      'success',
      '/broadsheets'
    );

    return updated;
  }

  // Create new broadsheet submission
  const { data: created, error } = await supabaseAdmin
    .from('broadsheet_submissions')
    .insert({
      class_id: input.class_id,
      subject_id: input.subject_id,
      session_id: input.session_id,
      term_id: input.term_id,
      teacher_id: teacherId,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !created) {
    console.error('Broadsheet submission error:', error);
    throw new AppError('Failed to submit broadsheet', 500);
  }

  await logAudit(teacherUserId, {
    action: 'broadsheet_submitted',
    entity_type: 'broadsheet',
    entity_id: created.id,
    metadata: {
      class_id: input.class_id,
      subject_id: input.subject_id,
      term_id: input.term_id,
    },
  });

  await notifyAdmins(
    'Broadsheet Submitted',
    `A new broadsheet has been submitted for review.`,
    'success',
    '/broadsheets'
  );

  return created;
}

export async function returnBroadsheet(
  broadsheetId: string,
  returnReason: string,
  returnedBy: string
) {
  const { data: existing } = await supabaseAdmin
    .from('broadsheet_submissions')
    .select('*')
    .eq('id', broadsheetId)
    .single();

  if (!existing) {
    throw new NotFoundError('Broadsheet not found');
  }

  if (existing.status === 'approved') {
    throw new ConflictError('Cannot return an approved broadsheet');
  }

  const { data: updated, error } = await supabaseAdmin
    .from('broadsheet_submissions')
    .update({
      status: 'returned',
      returned_at: new Date().toISOString(),
      return_reason: returnReason,
    })
    .eq('id', broadsheetId)
    .select()
    .single();

  if (error || !updated) {
    throw new AppError('Failed to return broadsheet', 500);
  }

  await logAudit(returnedBy, {
    action: 'broadsheet_returned',
    entity_type: 'broadsheet',
    entity_id: broadsheetId,
    metadata: { reason: returnReason },
  });

  // Notify teacher
  const { data: teacher } = await supabaseAdmin
    .from('teachers')
    .select('user_id')
    .eq('id', existing.teacher_id)
    .single();

  if (teacher) {
    await createNotification({
      user_id: teacher.user_id,
      title: 'Broadsheet Returned',
      message: `Your broadsheet was returned with feedback: ${returnReason}`,
      notification_type: 'warning',
      link: '/broadsheets',
    });
  }

  return updated;
}

export async function approveBroadsheet(
  broadsheetId: string,
  approvedBy: string
) {
  const { data: existing } = await supabaseAdmin
    .from('broadsheet_submissions')
    .select('*')
    .eq('id', broadsheetId)
    .single();

  if (!existing) {
    throw new NotFoundError('Broadsheet not found');
  }

  if (existing.status !== 'submitted') {
    throw new ConflictError('Only submitted broadsheets can be approved');
  }

  const { data: updated, error } = await supabaseAdmin
    .from('broadsheet_submissions')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: approvedBy,
    })
    .eq('id', broadsheetId)
    .select()
    .single();

  if (error || !updated) {
    throw new AppError('Failed to approve broadsheet', 500);
  }

  await logAudit(approvedBy, {
    action: 'broadsheet_approved',
    entity_type: 'broadsheet',
    entity_id: broadsheetId,
  });

  // Notify teacher
  const { data: teacher } = await supabaseAdmin
    .from('teachers')
    .select('user_id')
    .eq('id', existing.teacher_id)
    .single();

  if (teacher) {
    await createNotification({
      user_id: teacher.user_id,
      title: 'Broadsheet Approved',
      message: 'Your broadsheet has been approved.',
      notification_type: 'success',
      link: '/broadsheets',
    });
  }

  return updated;
}

export async function getBroadsheets(filters?: {
  class_id?: string;
  subject_id?: string;
  session_id?: string;
  term_id?: string;
  teacher_id?: string;
  status?: string;
}) {
  let query = supabaseAdmin
    .from('broadsheet_submissions')
    .select(`
      *,
      class:classes(name),
      subject:subjects(name, code),
      session:academic_sessions(name),
      term:terms(name),
      teacher:teachers(
        *,
        profile:profiles(first_name, last_name)
      )
    `);

  if (filters?.class_id) query = query.eq('class_id', filters.class_id);
  if (filters?.subject_id) query = query.eq('subject_id', filters.subject_id);
  if (filters?.session_id) query = query.eq('session_id', filters.session_id);
  if (filters?.term_id) query = query.eq('term_id', filters.term_id);
  if (filters?.teacher_id) query = query.eq('teacher_id', filters.teacher_id);
  if (filters?.status) query = query.eq('status', filters.status);

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    throw new AppError('Failed to fetch broadsheets', 500);
  }

  return data || [];
}

export async function getBroadsheetById(broadsheetId: string, teacherId?: string) {
  let query = supabaseAdmin
    .from('broadsheet_submissions')
    .select(`
      *,
      class:classes(*),
      subject:subjects(*),
      session:academic_sessions(*),
      term:terms(*),
      teacher:teachers(
        *,
        profile:profiles(first_name, last_name)
      )
    `)
    .eq('id', broadsheetId);

  if (teacherId) {
    query = query.eq('teacher_id', teacherId);
  }

  const { data: broadsheet, error } = await query.single();

  if (error || !broadsheet) {
    throw new NotFoundError('Broadsheet not found');
  }

  return broadsheet;
}

export async function getPrintableBroadsheet(broadsheetId: string, teacherId?: string) {
  const broadsheet = await getBroadsheetById(broadsheetId, teacherId);
  return getPrintableBroadsheetData(broadsheet, teacherId);
}

export async function getBroadsheetPreview(input: SubmitBroadsheetInput, teacherId?: string) {
  if (teacherId) await ensureTeacherAssignedToSubject(teacherId, input.subject_id, input.class_id, input.session_id);
  const [{ data: classData }, { data: subject }, { data: session }, { data: term }, { data: classSubject }, { data: submission }] = await Promise.all([
    supabaseAdmin.from('classes').select('id, name').eq('id', input.class_id).single(),
    supabaseAdmin.from('subjects').select('id, name, code').eq('id', input.subject_id).single(),
    supabaseAdmin.from('academic_sessions').select('id, name').eq('id', input.session_id).single(),
    supabaseAdmin.from('terms').select('id, name, session_id, assessment_stage').eq('id', input.term_id).single(),
    supabaseAdmin.from('class_subject_assignments').select('id').eq('class_id', input.class_id).eq('subject_id', input.subject_id).eq('session_id', input.session_id).eq('is_active', true).maybeSingle(),
    supabaseAdmin.from('broadsheet_submissions').select('*').eq('class_id', input.class_id).eq('subject_id', input.subject_id).eq('session_id', input.session_id).eq('term_id', input.term_id).maybeSingle(),
  ]);
  if (!classData || !subject || !session || !term || !classSubject || term.session_id !== input.session_id) throw new NotFoundError('Broadsheet context not found');
  return getPrintableBroadsheetData({ ...input, id: submission?.id || '', status: submission?.status || 'draft', class: classData, subject, session, term }, teacherId);
}

export async function getFullPrintableBroadsheet(input: { class_id: string; session_id: string; term_id: string }, teacherId?: string) {
  const [{ data: classData }, { data: session }, { data: term }, { data: classSubjects }, { data: enrollments, error: enrollmentError }] = await Promise.all([
    supabaseAdmin.from('classes').select('id, name').eq('id', input.class_id).single(),
    supabaseAdmin.from('academic_sessions').select('id, name').eq('id', input.session_id).single(),
    supabaseAdmin.from('terms').select('id, name, session_id, assessment_stage').eq('id', input.term_id).single(),
    supabaseAdmin.from('class_subject_assignments').select('subject_id, subject:subjects(id, name, code)').eq('class_id', input.class_id).eq('session_id', input.session_id).eq('is_active', true),
    supabaseAdmin.from('enrollments').select('student:students(id, admission_number, first_name, middle_name, last_name)').eq('class_id', input.class_id).eq('session_id', input.session_id).is('unenrolled_at', null),
  ]);
  if (!classData || !session || !term || term.session_id !== input.session_id) throw new NotFoundError('Broadsheet context not found');
  if (enrollmentError) throw new AppError('Failed to load class roster', 500);
  let subjects = classSubjects || [];
  if (teacherId) {
    const [{ data: direct }, { data: classTeacher }] = await Promise.all([
      supabaseAdmin.from('teacher_subject_assignments').select('subject_id').eq('teacher_id', teacherId).eq('class_id', input.class_id).eq('session_id', input.session_id).is('unassigned_at', null),
      supabaseAdmin.from('teacher_class_assignments').select('id').eq('teacher_id', teacherId).eq('class_id', input.class_id).eq('session_id', input.session_id).is('unassigned_at', null).maybeSingle(),
    ]);
    const allowed = new Set((direct || []).map((item: any) => item.subject_id));
    if (classTeacher) subjects = subjects;
    else subjects = subjects.filter((item: any) => allowed.has(item.subject_id));
  }
  if (!subjects.length) throw new ForbiddenError('No authorized subjects were found for this broadsheet');
  const subjectIds = subjects.map((item: any) => item.subject_id);
  const [{ data: scores, error: scoreError }, { data: results }] = await Promise.all([
    supabaseAdmin.from('scores').select('*').eq('class_id', input.class_id).eq('session_id', input.session_id).eq('term_id', input.term_id).in('subject_id', subjectIds),
    supabaseAdmin.from('results').select('student_id, term_average, term_position, status').eq('class_id', input.class_id).eq('session_id', input.session_id).eq('term_id', input.term_id),
  ]);
  if (scoreError) throw new AppError('Failed to load broadsheet scores', 500);
  const scoreMap = new Map((scores || []).map((item: any) => [`${item.student_id}:${item.subject_id}`, item]));
  const resultMap = new Map((results || []).map((item: any) => [item.student_id, item]));
  return {
    class: classData, session, term,
    subjects: subjects.map((item: any) => item.subject),
    students: (enrollments || []).map((item: any) => ({ student: item.student, scores: Object.fromEntries(subjectIds.map((subjectId: string) => [subjectId, scoreMap.get(`${item.student?.id}:${subjectId}`) || null])), result: resultMap.get(item.student?.id) || null }))
      .sort((left: any, right: any) => `${left.student?.first_name || ''} ${left.student?.middle_name || ''} ${left.student?.last_name || ''}`.localeCompare(`${right.student?.first_name || ''} ${right.student?.middle_name || ''} ${right.student?.last_name || ''}`)),
  };
}

async function getPrintableBroadsheetData(broadsheet: any, _teacherId?: string) {
  const { data: enrollments, error: enrollmentError } = await supabaseAdmin
    .from('enrollments')
    .select('student:students(id, admission_number, first_name, middle_name, last_name)')
    .eq('class_id', broadsheet.class_id)
    .eq('session_id', broadsheet.session_id)
    .is('unenrolled_at', null);
  const { data: scores, error: scoreError } = await supabaseAdmin
    .from('scores')
    .select('*')
    .eq('class_id', broadsheet.class_id)
    .eq('subject_id', broadsheet.subject_id)
    .eq('session_id', broadsheet.session_id)
    .eq('term_id', broadsheet.term_id);
  if (enrollmentError || scoreError) throw new AppError('Failed to prepare broadsheet for printing', 500);
  const scoreMap = new Map((scores || []).map((score: any) => [score.student_id, score]));
  return {
    ...broadsheet,
    students: (enrollments || []).map((item: any) => ({ student: item.student, score: scoreMap.get(item.student?.id) || null }))
      .sort((left: any, right: any) => `${left.student?.first_name || ''} ${left.student?.middle_name || ''} ${left.student?.last_name || ''}`.localeCompare(`${right.student?.first_name || ''} ${right.student?.middle_name || ''} ${right.student?.last_name || ''}`)),
  };
}

export async function checkAllBroadsheetsApproved(
  classId: string,
  sessionId: string,
  termId: string
) {
  const { data: classSubjects } = await supabaseAdmin
    .from('class_subject_assignments')
    .select('subject_id')
    .eq('class_id', classId)
    .eq('session_id', sessionId)
    .eq('is_active', true);

  if (!classSubjects || classSubjects.length === 0) {
    return {
      all_approved: false,
      total_subjects: 0,
      approved_count: 0,
      pending_subjects: [],
    };
  }

  const subjectIds = classSubjects.map((subject) => subject.subject_id);

  const { data: submissions } = await supabaseAdmin
    .from('broadsheet_submissions')
    .select('subject_id')
    .eq('class_id', classId)
    .eq('session_id', sessionId)
    .eq('term_id', termId)
    .eq('status', 'approved');

  const approvedSubjectIds = new Set((submissions || []).map((submission) => submission.subject_id));
  const pendingSubjects = subjectIds.filter((subjectId) => !approvedSubjectIds.has(subjectId));

  return {
    all_approved: pendingSubjects.length === 0,
    total_subjects: subjectIds.length,
    approved_count: approvedSubjectIds.size,
    pending_subjects: pendingSubjects,
  };
}

export async function checkAllBroadsheetsSubmitted(
  classId: string,
  sessionId: string,
  termId: string
) {
  // Get all subjects assigned to this class
  const { data: classSubjects } = await supabaseAdmin
    .from('class_subject_assignments')
    .select('subject_id')
    .eq('class_id', classId)
    .eq('session_id', sessionId)
    .eq('is_active', true);

  if (!classSubjects || classSubjects.length === 0) {
    return {
      all_submitted: false,
      total_subjects: 0,
      submitted_count: 0,
      pending_subjects: [],
    };
  }

  const subjectIds = classSubjects.map(cs => cs.subject_id);

  // Get submitted/approved broadsheets
  const { data: submissions } = await supabaseAdmin
    .from('broadsheet_submissions')
    .select('subject_id, status')
    .eq('class_id', classId)
    .eq('session_id', sessionId)
    .eq('term_id', termId)
    .in('status', ['submitted', 'approved']);

  const submittedSubjectIds = new Set(
    (submissions || []).map(s => s.subject_id)
  );

  const pendingSubjects = subjectIds.filter(id => !submittedSubjectIds.has(id));

  return {
    all_submitted: pendingSubjects.length === 0,
    total_subjects: subjectIds.length,
    submitted_count: submittedSubjectIds.size,
    pending_subjects: pendingSubjects,
  };
}
