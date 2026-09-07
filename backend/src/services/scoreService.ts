import { supabaseAdmin } from '../config/supabase';
import { AppError, NotFoundError, ForbiddenError, ValidationError } from '../middleware/errorHandler';
import { logAudit } from '../utils/auditLogger';
import { AssessmentStage } from '../types';
import { ensureTeacherAssignedToClass, ensureTeacherAssignedToSubject, getTeacherRecordForUser } from './accessService';

interface ScoreInput {
  student_id: string;
  subject_id: string;
  class_id: string;
  session_id: string;
  term_id: string;
  test1?: number | null;
  test2?: number | null;
  test3?: number | null;
  examination?: number | null;
}

export async function enterScore(input: ScoreInput, enteredBy: string) {
  const teacher = await getTeacherRecordForUser(enteredBy);
  await ensureTeacherAssignedToClass(teacher.id, input.class_id, input.session_id);
  await ensureTeacherAssignedToSubject(teacher.id, input.subject_id, input.class_id, input.session_id);

  const { data: enrollment } = await supabaseAdmin
    .from('enrollments')
    .select('id')
    .eq('student_id', input.student_id)
    .eq('class_id', input.class_id)
    .eq('session_id', input.session_id)
    .is('unenrolled_at', null)
    .single();

  if (!enrollment) {
    throw new ForbiddenError('Student is not enrolled in this class for this session');
  }

  // Get current assessment stage
  const { data: term } = await supabaseAdmin
    .from('terms')
    .select('assessment_stage')
    .eq('id', input.term_id)
    .single();

  if (!term) {
    throw new NotFoundError('Term not found');
  }

  const stage = term.assessment_stage as AssessmentStage;
  const hasValue = (value: number | undefined | null) => value !== undefined && value !== null;

  // Validate score edit permissions based on stage
  if (stage === 'classes') {
    throw new ForbiddenError('Score entry is not allowed during the CLASSES stage');
  }

  // Validate each score field based on stage
  if (stage === 'first_test' && (hasValue(input.test2) || hasValue(input.test3) || hasValue(input.examination))) {
    throw new ForbiddenError('Only Test 1 is editable during FIRST TEST stage');
  }

  if (stage === 'second_test' && (hasValue(input.test3) || hasValue(input.examination))) {
    throw new ForbiddenError('Only Test 1 and Test 2 are editable during SECOND TEST stage');
  }

  if (stage === 'third_test' && hasValue(input.examination)) {
    throw new ForbiddenError('Only Test 1, Test 2, and Test 3 are editable during THIRD TEST stage');
  }

  // Validate score ranges
  const validateScore = (score: number | undefined | null, max: number, label: string) => {
    if (score !== undefined && score !== null) {
      if (score < 0 || score > max) {
        throw new ValidationError(`${label} must be between 0 and ${max}`);
      }
    }
  };

  validateScore(input.test1, 20, 'Test 1');
  validateScore(input.test2, 20, 'Test 2');
  validateScore(input.test3, 20, 'Test 3');
  validateScore(input.examination, 40, 'Examination');

  // Check if score already exists
  const { data: existing } = await supabaseAdmin
    .from('scores')
    .select('*')
    .eq('student_id', input.student_id)
    .eq('subject_id', input.subject_id)
    .eq('term_id', input.term_id)
    .single();

  if (existing) {
    // Update existing score
    const updateData: Record<string, any> = { updated_by: enteredBy };
    
    if (stage === 'first_test' || stage === 'second_test' || stage === 'third_test' || stage === 'examination') {
      if (input.test1 !== undefined && input.test1 !== null) updateData.test1 = input.test1;
    }
    if (stage === 'second_test' || stage === 'third_test' || stage === 'examination') {
      if (input.test2 !== undefined && input.test2 !== null) updateData.test2 = input.test2;
    }
    if (stage === 'third_test' || stage === 'examination') {
      if (input.test3 !== undefined && input.test3 !== null) updateData.test3 = input.test3;
    }
    if (stage === 'examination') {
      if (input.examination !== undefined && input.examination !== null) updateData.examination = input.examination;
    }

    const { data: updated, error } = await supabaseAdmin
      .from('scores')
      .update(updateData)
      .eq('id', existing.id)
      .select()
      .single();

    if (error || !updated) {
      throw new AppError('Failed to update score', 500);
    }

    await logAudit(enteredBy, {
      action: 'score_updated',
      entity_type: 'score',
      entity_id: updated.id,
      old_value: existing,
      new_value: updated,
    });

    return updated;
  } else {
    // Create new score
    const insertData: Record<string, any> = {
      student_id: input.student_id,
      subject_id: input.subject_id,
      class_id: input.class_id,
      session_id: input.session_id,
      term_id: input.term_id,
      entered_by: enteredBy,
    };

    if (input.test1 !== undefined && input.test1 !== null) insertData.test1 = input.test1;
    if (input.test2 !== undefined && input.test2 !== null) insertData.test2 = input.test2;
    if (input.test3 !== undefined && input.test3 !== null) insertData.test3 = input.test3;
    if (input.examination !== undefined && input.examination !== null) insertData.examination = input.examination;

    const { data: created, error } = await supabaseAdmin
      .from('scores')
      .insert(insertData)
      .select()
      .single();

    if (error || !created) {
      console.error('Score creation error:', error);
      throw new AppError('Failed to create score', 500);
    }

    await logAudit(enteredBy, {
      action: 'score_entered',
      entity_type: 'score',
      entity_id: created.id,
      new_value: created,
    });

    return created;
  }
}

export async function bulkEnterScores(scores: ScoreInput[], enteredBy: string) {
  const results = [];
  const errors = [];

  for (const score of scores) {
    try {
      const result = await enterScore(score, enteredBy);
      results.push(result);
    } catch (error: any) {
      errors.push({
        student_id: score.student_id,
        error: error.message,
      });
    }
  }

  return {
    success: results.length,
    failed: errors.length,
    results,
    errors,
  };
}

export async function getClassScores(
  classId: string,
  subjectId: string,
  termId: string
) {
  const { data: scores, error } = await supabaseAdmin
    .from('scores')
    .select(`
      *,
      student:students(id, admission_number, first_name, last_name)
    `)
    .eq('class_id', classId)
    .eq('subject_id', subjectId)
    .eq('term_id', termId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new AppError('Failed to fetch class scores', 500);
  }

  return (scores || []).sort((left, right) => {
    const leftLast = left.student?.last_name || '';
    const rightLast = right.student?.last_name || '';
    return leftLast.localeCompare(rightLast);
  });
}

export async function getStudentScores(studentId: string, termId: string) {
  const { data: scores, error } = await supabaseAdmin
    .from('scores')
    .select(`
      *,
      subject:subjects(id, name, code)
    `)
    .eq('student_id', studentId)
    .eq('term_id', termId);

  if (error) {
    throw new AppError('Failed to fetch student scores', 500);
  }

  return scores || [];
}
