import { supabaseAdmin } from '../config/supabase';
import { AppError, NotFoundError, ValidationError } from '../middleware/errorHandler';

export interface ScoreReviewFilters {
  session_id?: string;
  term_id?: string;
  assessment_stage?: string;
  class_id?: string;
  subject_id?: string;
  teacher_id?: string;
  status?: string;
}

function scoreCompleteness(score: any, stage: string): 'saved' | 'incomplete' {
  const fields = stage === 'examination'
    ? ['test1', 'test2', 'test3', 'examination']
    : stage === 'third_test'
      ? ['test1', 'test2', 'test3']
      : stage === 'second_test'
        ? ['test1', 'test2']
        : ['test1'];
  return fields.some((field) => score[field] === null || score[field] === undefined)
    ? 'incomplete'
    : 'saved';
}

async function getTermContext(sessionId?: string, termId?: string) {
  if (!termId) return null;
  const { data: term, error } = await supabaseAdmin
    .from('terms')
    .select('id, session_id, assessment_stage, name')
    .eq('id', termId)
    .single();
  if (error || !term) throw new NotFoundError('Term not found');
  if (sessionId && term.session_id !== sessionId) {
    throw new ValidationError('The selected term does not belong to the selected session');
  }
  return term;
}

export async function getScoreReviewOverview(filters: ScoreReviewFilters) {
  const term = await getTermContext(filters.session_id, filters.term_id);
  if (filters.assessment_stage && term && filters.assessment_stage !== term.assessment_stage) {
    throw new ValidationError('The selected assessment stage is not active for this term');
  }
  const sessionId = filters.session_id || term?.session_id;
  if (!sessionId || !filters.term_id) {
    throw new ValidationError('Academic session and term are required');
  }

  let assignmentsQuery = supabaseAdmin
    .from('class_subject_assignments')
    .select('class_id, subject_id, session_id, class:classes(id, name), subject:subjects(id, name, code)')
    .eq('session_id', sessionId)
    .eq('is_active', true);
  if (filters.class_id) assignmentsQuery = assignmentsQuery.eq('class_id', filters.class_id);
  if (filters.subject_id) assignmentsQuery = assignmentsQuery.eq('subject_id', filters.subject_id);
  const { data: assignments, error: assignmentError } = await assignmentsQuery;
  if (assignmentError) throw new AppError('Failed to load class subjects', 500);

  const assignmentList = assignments || [];
  const classIds = [...new Set(assignmentList.map((item: any) => item.class_id))];
  const subjectIds = [...new Set(assignmentList.map((item: any) => item.subject_id))];
  const [{ data: enrollments }, { data: scores }, { data: submissions }, { data: teacherAssignments }] = await Promise.all([
    classIds.length ? supabaseAdmin.from('enrollments').select('class_id, student_id').eq('session_id', sessionId).is('unenrolled_at', null).in('class_id', classIds) : Promise.resolve({ data: [] }),
    subjectIds.length ? supabaseAdmin.from('scores').select('class_id, subject_id, student_id').eq('session_id', sessionId).eq('term_id', filters.term_id).in('class_id', classIds).in('subject_id', subjectIds) : Promise.resolve({ data: [] }),
    supabaseAdmin.from('broadsheet_submissions').select('id, class_id, subject_id, teacher_id, status, submitted_at').eq('session_id', sessionId).eq('term_id', filters.term_id),
    subjectIds.length ? supabaseAdmin.from('teacher_subject_assignments').select('teacher_id, class_id, subject_id, teacher:teachers(id, profile:profiles(first_name, last_name))').eq('session_id', sessionId).is('unassigned_at', null).in('class_id', classIds).in('subject_id', subjectIds) : Promise.resolve({ data: [] }),
  ]);

  const enrollmentCounts = new Map<string, number>();
  (enrollments || []).forEach((item: any) => enrollmentCounts.set(item.class_id, (enrollmentCounts.get(item.class_id) || 0) + 1));
  const scoreCounts = new Map<string, number>();
  (scores || []).forEach((item: any) => {
    const key = `${item.class_id}:${item.subject_id}`;
    scoreCounts.set(key, (scoreCounts.get(key) || 0) + 1);
  });
  const submissionMap = new Map((submissions || []).map((item: any) => [`${item.class_id}:${item.subject_id}`, item]));
  const teacherMap = new Map((teacherAssignments || []).map((item: any) => [`${item.class_id}:${item.subject_id}`, item]));

  const rows = assignmentList.map((assignment: any) => {
    const key = `${assignment.class_id}:${assignment.subject_id}`;
    const submission = submissionMap.get(key);
    const teacher = teacherMap.get(key);
    const enrolled = enrollmentCounts.get(assignment.class_id) || 0;
    const saved = scoreCounts.get(key) || 0;
    return {
      id: key,
      class_id: assignment.class_id,
      subject_id: assignment.subject_id,
      class: assignment.class,
      subject: assignment.subject,
      teacher: teacher?.teacher || null,
      teacher_id: teacher?.teacher_id || submission?.teacher_id || null,
      enrolled_students: enrolled,
      saved_scores: saved,
      missing_scores: Math.max(enrolled - saved, 0),
      entry_status: saved === 0 ? 'not_started' : saved < enrolled ? 'incomplete' : 'complete',
      broadsheet: submission || null,
      broadsheet_status: submission?.status || 'unsubmitted',
    };
  }).filter((row: any) => !filters.teacher_id || row.teacher_id === filters.teacher_id)
    .filter((row: any) => !filters.status || row.broadsheet_status === filters.status);

  return {
    term,
    rows,
    summary: {
      class_subjects: rows.length,
      with_saved_scores: rows.filter((row: any) => row.saved_scores > 0).length,
      incomplete_entries: rows.filter((row: any) => row.entry_status === 'incomplete' || row.entry_status === 'not_started').length,
      missing_scores: rows.reduce((total: number, row: any) => total + row.missing_scores, 0),
      submitted: rows.filter((row: any) => ['submitted', 'approved'].includes(row.broadsheet_status)).length,
      unsubmitted: rows.filter((row: any) => row.broadsheet_status === 'unsubmitted').length,
    },
  };
}

export async function getScoreReviewBroadsheet(input: { class_id: string; subject_id: string; session_id: string; term_id: string }) {
  const term = await getTermContext(input.session_id, input.term_id);
  const [{ data: classData }, { data: subject }, { data: enrolled, error: enrollmentError }, { data: scores, error: scoreError }, { data: submission }, { data: teacherAssignment }] = await Promise.all([
    supabaseAdmin.from('classes').select('id, name').eq('id', input.class_id).single(),
    supabaseAdmin.from('subjects').select('id, name, code').eq('id', input.subject_id).single(),
    supabaseAdmin.from('enrollments').select('student:students(id, admission_number, first_name, last_name)').eq('class_id', input.class_id).eq('session_id', input.session_id).is('unenrolled_at', null),
    supabaseAdmin.from('scores').select('*').eq('class_id', input.class_id).eq('subject_id', input.subject_id).eq('session_id', input.session_id).eq('term_id', input.term_id),
    supabaseAdmin.from('broadsheet_submissions').select('*').eq('class_id', input.class_id).eq('subject_id', input.subject_id).eq('session_id', input.session_id).eq('term_id', input.term_id).maybeSingle(),
    supabaseAdmin.from('teacher_subject_assignments').select('teacher_id, teacher:teachers(id, profile:profiles(first_name, last_name))').eq('class_id', input.class_id).eq('subject_id', input.subject_id).eq('session_id', input.session_id).is('unassigned_at', null).maybeSingle(),
  ]);
  if (!classData || !subject) throw new NotFoundError('Class or subject not found');
  if (enrollmentError || scoreError) throw new AppError('Failed to load saved scores', 500);
  const scoreMap = new Map((scores || []).map((score: any) => [score.student_id, score]));
  const students = (enrolled || []).map((item: any) => {
    const student = item.student;
    const score = scoreMap.get(student.id) || null;
    return { student, score, score_status: score ? scoreCompleteness(score, term!.assessment_stage) : 'missing' };
  }).sort((left: any, right: any) => `${left.student.last_name} ${left.student.first_name}`.localeCompare(`${right.student.last_name} ${right.student.first_name}`));
  return { class: classData, subject, term, teacher: teacherAssignment?.teacher || null, broadsheet: submission || null, students };
}

export async function getScoreReviewStudent(studentId: string, input: { class_id: string; subject_id: string; session_id: string; term_id: string }) {
  const broadsheet = await getScoreReviewBroadsheet(input);
  const record = broadsheet.students.find((item: any) => item.student.id === studentId);
  if (!record) throw new NotFoundError('Student is not enrolled in this class for the selected session');
  return { ...record, context: { class: broadsheet.class, subject: broadsheet.subject, term: broadsheet.term, broadsheet_status: broadsheet.broadsheet?.status || 'unsubmitted' } };
}

export async function correctScoreAsSuperAdmin(scoreId: string, input: { field: string; value: number; reason: string; expected_updated_at: string }, actorId: string) {
  const { data, error } = await supabaseAdmin.rpc('correct_score_as_super_admin', {
    p_score_id: scoreId,
    p_field: input.field,
    p_new_value: input.value,
    p_reason: input.reason,
    p_actor: actorId,
    p_expected_updated_at: input.expected_updated_at,
  });
  if (error) {
    const message = error.message || 'Failed to correct score';
    if (message.includes('changed by another user')) throw new ValidationError(message);
    throw new AppError(message, 400);
  }
  return data;
}
