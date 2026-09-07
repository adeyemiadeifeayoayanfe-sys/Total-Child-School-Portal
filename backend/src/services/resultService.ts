import { supabaseAdmin } from '../config/supabase';
import { AppError, NotFoundError, ForbiddenError, ConflictError, ValidationError } from '../middleware/errorHandler';
import { logAudit } from '../utils/auditLogger';
import { createNotification, notifyAdmins } from '../utils/notifications';
import { checkAllBroadsheetsApproved } from './broadsheetService';

interface GenerateResultInput {
  student_id: string;
  class_id: string;
  session_id: string;
  term_id: string;
}

interface GenerateBulkResultInput {
  class_id: string;
  session_id: string;
  term_id: string;
}

async function calculateGrade(percentage: number): Promise<string> {
  const { data: gradingRules } = await supabaseAdmin
    .from('grading_rules')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (!gradingRules || gradingRules.length === 0) {
    // Default grading
    if (percentage >= 70) return 'A';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 45) return 'D';
    if (percentage >= 40) return 'E';
    return 'F';
  }

  for (const rule of gradingRules) {
    if (percentage >= rule.min_score && percentage <= rule.max_score) {
      return rule.grade;
    }
  }

  return 'F';
}

async function calculateCumulativeAverage(
  studentId: string,
  sessionId: string,
  termName: string
): Promise<number | null> {
  if (termName !== 'third') {
    return null;
  }

  // Get all terms in this session
  const { data: terms } = await supabaseAdmin
    .from('terms')
    .select('*')
    .eq('session_id', sessionId)
    .order('start_date', { ascending: true });

  if (!terms || terms.length < 3) {
    return null;
  }

  const firstTerm = terms[0];
  const secondTerm = terms[1];
  const thirdTerm = terms[2];

  // Get results from all three terms
  const { data: results } = await supabaseAdmin
    .from('results')
    .select('term_average, term_id')
    .eq('student_id', studentId)
    .in('term_id', [firstTerm.id, secondTerm.id, thirdTerm.id])
    .in('status', ['generated', 'reviewed', 'published']);

  if (!results || results.length < 3) {
    return null;
  }

  const firstAvg = results.find(r => r.term_id === firstTerm.id)?.term_average;
  const secondAvg = results.find(r => r.term_id === secondTerm.id)?.term_average;
  const thirdAvg = results.find(r => r.term_id === thirdTerm.id)?.term_average;

  if (firstAvg == null || secondAvg == null || thirdAvg == null) {
    return null;
  }

  return (firstAvg + secondAvg + thirdAvg) / 3;
}

async function calculatePosition(
  classId: string,
  termId: string,
  studentAverage: number
): Promise<number> {
  const { data: allResults } = await supabaseAdmin
    .from('results')
    .select('term_average')
    .eq('class_id', classId)
    .eq('term_id', termId)
    .not('term_average', 'is', null);

  if (!allResults || allResults.length === 0) {
    return 1;
  }

  const averages = allResults
    .map(r => r.term_average)
    .filter(a => a !== null)
    .sort((a, b) => b - a);

  const position = averages.findIndex(avg => avg <= studentAverage) + 1;
  return position > 0 ? position : averages.length + 1;
}

export async function generateIndividualResult(
  input: GenerateResultInput,
  generatedBy: string
) {
  // Verify all broadsheets submitted
  const broadsheetCheck = await checkAllBroadsheetsApproved(
    input.class_id,
    input.session_id,
    input.term_id
  );

  if (!broadsheetCheck.all_approved) {
    throw new ValidationError(
      `Cannot generate result. Missing approved broadsheets for: ${broadsheetCheck.pending_subjects.length} subject(s)`
    );
  }

  // Get student info
  const { data: student } = await supabaseAdmin
    .from('students')
    .select('*')
    .eq('id', input.student_id)
    .single();

  if (!student) {
    throw new NotFoundError('Student not found');
  }

  // Get term info
  const { data: term } = await supabaseAdmin
    .from('terms')
    .select('*')
    .eq('id', input.term_id)
    .single();

  if (!term) {
    throw new NotFoundError('Term not found');
  }

  // Get session info
  const { data: session } = await supabaseAdmin
    .from('academic_sessions')
    .select('*')
    .eq('id', input.session_id)
    .single();

  if (!session) {
    throw new NotFoundError('Session not found');
  }

  const { data: enrollment } = await supabaseAdmin
    .from('enrollments')
    .select('id')
    .eq('student_id', input.student_id)
    .eq('class_id', input.class_id)
    .eq('session_id', input.session_id)
    .is('unenrolled_at', null)
    .single();

  if (!enrollment) {
    throw new ForbiddenError('Student is not enrolled in the selected class for this session');
  }

  // Check if result already exists
  const { data: existingResult } = await supabaseAdmin
    .from('results')
    .select('*')
    .eq('student_id', input.student_id)
    .eq('term_id', input.term_id)
    .single();

  // Get all scores for this student in this term
  const { data: scores } = await supabaseAdmin
    .from('scores')
    .select(`
      *,
      subject:subjects(id, name, code)
    `)
    .eq('student_id', input.student_id)
    .eq('class_id', input.class_id)
    .eq('session_id', input.session_id)
    .eq('term_id', input.term_id);

  if (!scores || scores.length === 0) {
    throw new ValidationError('No scores found for this student in this term');
  }

  const { data: requiredSubjects } = await supabaseAdmin
    .from('class_subject_assignments')
    .select('subject_id')
    .eq('class_id', input.class_id)
    .eq('session_id', input.session_id)
    .eq('is_active', true);

  const requiredSubjectIds = (requiredSubjects || []).map((subject) => subject.subject_id);
  const scoreSubjectIds = new Set(scores.map((score) => score.subject_id));
  const missingScoreSubjectIds = requiredSubjectIds.filter((subjectId) => !scoreSubjectIds.has(subjectId));

  if (missingScoreSubjectIds.length > 0) {
    throw new ValidationError('Cannot generate result until all class subjects have scores');
  }

  // Calculate subject results
  const subjectResults = [];
  let totalPercentage = 0;

  for (const score of scores) {
    const percentage = score.total; // Already calculated as total
    const grade = await calculateGrade(percentage);
    
    subjectResults.push({
      subject_id: score.subject_id,
      test1: score.test1,
      test2: score.test2,
      test3: score.test3,
      examination: score.examination,
      total: score.total,
      percentage: percentage,
      grade: grade,
    });

    totalPercentage += percentage;
  }

  const termAverage = totalPercentage / scores.length;

  // Calculate position
  const position = await calculatePosition(input.class_id, input.term_id, termAverage);

  // Calculate cumulative average for third term
  const cumulativeAverage = await calculateCumulativeAverage(
    input.student_id,
    input.session_id,
    term.name
  );

  // Get attendance stats
  const { data: attendanceRecords } = await supabaseAdmin
    .from('attendance')
    .select('status')
    .eq('student_id', input.student_id)
    .eq('term_id', input.term_id);

  const attendanceDays = attendanceRecords?.length || 0;
  const attendancePresent = attendanceRecords?.filter(a => a.status === 'present' || a.status === 'late').length || 0;

  // Get personal assessment
  const { data: assessment } = await supabaseAdmin
    .from('personal_assessments')
    .select('*')
    .eq('student_id', input.student_id)
    .eq('term_id', input.term_id)
    .single();

  if (existingResult) {
    // Update existing result
    const { data: updated, error } = await supabaseAdmin
      .from('results')
      .update({
        term_average: termAverage,
        term_position: position,
        cumulative_average: cumulativeAverage,
        status: 'generated',
        attendance_days: attendanceDays,
        attendance_present: attendancePresent,
        generated_by: generatedBy,
        generated_at: new Date().toISOString(),
      })
      .eq('id', existingResult.id)
      .select()
      .single();

    if (error || !updated) {
      throw new AppError('Failed to update result', 500);
    }

    // Delete old result subjects
    await supabaseAdmin
      .from('result_subjects')
      .delete()
      .eq('result_id', updated.id);

    // Insert new result subjects
    const resultSubjectInserts = subjectResults.map(sr => ({
      result_id: updated.id,
      ...sr,
    }));

    await supabaseAdmin.from('result_subjects').insert(resultSubjectInserts);

    // Create version record
    const { data: versions } = await supabaseAdmin
      .from('result_versions')
      .select('version_number')
      .eq('result_id', updated.id)
      .order('version_number', { ascending: false })
      .limit(1);

    const newVersionNumber = (versions?.[0]?.version_number || 0) + 1;

    await supabaseAdmin.from('result_versions').insert({
      result_id: updated.id,
      version_number: newVersionNumber,
      generated_by: generatedBy,
      generated_at: new Date().toISOString(),
      data_snapshot: {
        result: updated,
        subjects: subjectResults,
      },
    });

    await logAudit(generatedBy, {
      action: 'result_regenerated',
      entity_type: 'result',
      entity_id: updated.id,
      metadata: { student_id: input.student_id, term_id: input.term_id },
    });

    return updated;
  } else {
    // Create new result
    const { data: created, error } = await supabaseAdmin
      .from('results')
      .insert({
        student_id: input.student_id,
        class_id: input.class_id,
        session_id: input.session_id,
        term_id: input.term_id,
        term_average: termAverage,
        term_position: position,
        cumulative_average: cumulativeAverage,
        status: 'generated',
        attendance_days: attendanceDays,
        attendance_present: attendancePresent,
        generated_by: generatedBy,
        generated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !created) {
      console.error('Result creation error:', error);
      throw new AppError('Failed to generate result', 500);
    }

    // Insert result subjects
    const resultSubjectInserts = subjectResults.map(sr => ({
      result_id: created.id,
      ...sr,
    }));

    await supabaseAdmin.from('result_subjects').insert(resultSubjectInserts);

    // Create version 1
    await supabaseAdmin.from('result_versions').insert({
      result_id: created.id,
      version_number: 1,
      generated_by: generatedBy,
      generated_at: new Date().toISOString(),
      data_snapshot: {
        result: created,
        subjects: subjectResults,
      },
    });

    await logAudit(generatedBy, {
      action: 'result_generated',
      entity_type: 'result',
      entity_id: created.id,
      metadata: { student_id: input.student_id, term_id: input.term_id },
    });

    return created;
  }
}

export async function generateBulkClassResults(
  input: GenerateBulkResultInput,
  generatedBy: string
) {
  // Verify all broadsheets submitted
  const broadsheetCheck = await checkAllBroadsheetsApproved(
    input.class_id,
    input.session_id,
    input.term_id
  );

  if (!broadsheetCheck.all_approved) {
    throw new ValidationError(
      `Cannot generate results. Missing approved broadsheets for: ${broadsheetCheck.pending_subjects.length} subject(s)`
    );
  }

  // Get all students in this class
  const { data: enrollments } = await supabaseAdmin
    .from('enrollments')
    .select(`
      student:students(*)
    `)
    .eq('class_id', input.class_id)
    .eq('session_id', input.session_id)
    .is('unenrolled_at', null);

  if (!enrollments || enrollments.length === 0) {
    throw new NotFoundError('No students found in this class');
  }

  const summary = {
    total_students: enrollments.length,
    successfully_generated: 0,
    skipped: 0,
    failed: 0,
    details: [] as Array<{
      student_id: string;
      student_name: string;
      status: 'success' | 'skipped' | 'failed';
      reason?: string;
    }>,
  };

  for (const enrollment of enrollments as unknown as Array<{
    student: {
      id: string;
      first_name: string;
      last_name: string;
    };
  }>) {
    const student = enrollment.student;
    try {
      await generateIndividualResult(
        {
          student_id: student.id,
          class_id: input.class_id,
          session_id: input.session_id,
          term_id: input.term_id,
        },
        generatedBy
      );
      summary.successfully_generated++;
      summary.details.push({
        student_id: student.id,
        student_name: `${student.first_name} ${student.last_name}`,
        status: 'success',
      });
    } catch (error: any) {
      if (error instanceof ValidationError) {
        summary.skipped++;
        summary.details.push({
          student_id: student.id,
          student_name: `${student.first_name} ${student.last_name}`,
          status: 'skipped',
          reason: error.message,
        });
      } else {
        summary.failed++;
        summary.details.push({
          student_id: student.id,
          student_name: `${student.first_name} ${student.last_name}`,
          status: 'failed',
          reason: error.message,
        });
      }
    }
  }

  await logAudit(generatedBy, {
    action: 'bulk_results_generated',
    entity_type: 'result',
    metadata: {
      class_id: input.class_id,
      session_id: input.session_id,
      term_id: input.term_id,
      summary,
    },
  });

  return summary;
}

export async function reviewResult(resultId: string, reviewedBy: string) {
  const { data: result } = await supabaseAdmin
    .from('results')
    .select('*')
    .eq('id', resultId)
    .single();

  if (!result) {
    throw new NotFoundError('Result not found');
  }

  if (result.status !== 'generated') {
    throw new ConflictError('Only generated results can be reviewed');
  }

  const { data: updated, error } = await supabaseAdmin
    .from('results')
    .update({
      status: 'reviewed',
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', resultId)
    .select()
    .single();

  if (error || !updated) {
    throw new AppError('Failed to review result', 500);
  }

  await logAudit(reviewedBy, {
    action: 'result_reviewed',
    entity_type: 'result',
    entity_id: resultId,
  });

  return updated;
}

export async function publishResult(resultId: string, publishedBy: string) {
  const { data: result } = await supabaseAdmin
    .from('results')
    .select('*')
    .eq('id', resultId)
    .single();

  if (!result) {
    throw new NotFoundError('Result not found');
  }

  if (result.status !== 'reviewed' && result.status !== 'generated') {
    throw new ConflictError('Result must be reviewed before publishing');
  }

  const { data: updated, error } = await supabaseAdmin
    .from('results')
    .update({
      status: 'published',
      published_by: publishedBy,
      published_at: new Date().toISOString(),
    })
    .eq('id', resultId)
    .select()
    .single();

  if (error || !updated) {
    throw new AppError('Failed to publish result', 500);
  }

  await logAudit(publishedBy, {
    action: 'result_published',
    entity_type: 'result',
    entity_id: resultId,
  });

  // Notify parent
  const { data: parentAssignment } = await supabaseAdmin
    .from('parent_child_assignments')
    .select('parent_id')
    .eq('student_id', result.student_id)
    .is('unassigned_at', null)
    .single();

  if (parentAssignment) {
    const { data: parent } = await supabaseAdmin
      .from('parents')
      .select('user_id')
      .eq('id', parentAssignment.parent_id)
      .single();

    if (parent) {
      await createNotification({
        user_id: parent.user_id,
        title: 'New Result Published',
        message: `A new result has been published for your child.`,
        notification_type: 'success',
        link: '/results',
      });
    }
  }

  return updated;
}

export async function getResultById(resultId: string) {
  const { data: result, error } = await supabaseAdmin
    .from('results')
    .select(`
      *,
      student:students(*),
      class:classes(*),
      session:academic_sessions(*),
      term:terms(*),
      result_subjects(
        *,
        subject:subjects(*)
      ),
      personal_assessment:personal_assessments(*)
    `)
    .eq('id', resultId)
    .single();

  if (error || !result) {
    throw new NotFoundError('Result not found');
  }

  return result;
}

export async function getResults(filters?: {
  student_id?: string;
  class_id?: string;
  session_id?: string;
  term_id?: string;
  status?: string;
}) {
  let query = supabaseAdmin
    .from('results')
    .select(`
      *,
      student:students(id, admission_number, first_name, last_name),
      class:classes(name),
      session:academic_sessions(name),
      term:terms(name)
    `);

  if (filters?.student_id) query = query.eq('student_id', filters.student_id);
  if (filters?.class_id) query = query.eq('class_id', filters.class_id);
  if (filters?.session_id) query = query.eq('session_id', filters.session_id);
  if (filters?.term_id) query = query.eq('term_id', filters.term_id);
  if (filters?.status) query = query.eq('status', filters.status);

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    throw new AppError('Failed to fetch results', 500);
  }

  return data || [];
}

export async function getResultHistory(resultId: string) {
  const { data: versions, error } = await supabaseAdmin
    .from('result_versions')
    .select(`
      *,
      generated_by_user:users(*)
    `)
    .eq('result_id', resultId)
    .order('version_number', { ascending: false });

  if (error) {
    throw new AppError('Failed to fetch result history', 500);
  }

  return versions || [];
}

export async function regenerateResult(
  resultId: string,
  reason: string,
  regeneratedBy: string
) {
  const { data: result } = await supabaseAdmin
    .from('results')
    .select('*')
    .eq('id', resultId)
    .single();

  if (!result) {
    throw new NotFoundError('Result not found');
  }

  // Re-generate using stored data
  return generateIndividualResult(
    {
      student_id: result.student_id,
      class_id: result.class_id,
      session_id: result.session_id,
      term_id: result.term_id,
    },
    regeneratedBy
  );
}
