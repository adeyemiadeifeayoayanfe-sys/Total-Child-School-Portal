-- Apply Super Admin score corrections and their audit entry in one transaction.
CREATE OR REPLACE FUNCTION public.correct_score_as_super_admin(
  p_score_id UUID,
  p_field TEXT,
  p_new_value NUMERIC,
  p_reason TEXT,
  p_actor UUID,
  p_expected_updated_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  score_row scores%ROWTYPE;
  corrected_score scores%ROWTYPE;
  term_row terms%ROWTYPE;
  previous_value NUMERIC;
  submission_row broadsheet_submissions%ROWTYPE;
  has_submission BOOLEAN := FALSE;
  submission_status TEXT := 'unsubmitted';
  invalidated_results INTEGER := 0;
  permitted BOOLEAN := FALSE;
BEGIN
  IF length(trim(coalesce(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'A correction reason of at least 5 characters is required';
  END IF;

  IF p_field NOT IN ('test1', 'test2', 'test3', 'examination') THEN
    RAISE EXCEPTION 'Invalid score field';
  END IF;

  IF p_new_value < 0 OR
     (p_field IN ('test1', 'test2', 'test3') AND p_new_value > 20) OR
     (p_field = 'examination' AND p_new_value > 40) THEN
    RAISE EXCEPTION 'Score is outside the permitted range';
  END IF;

  SELECT * INTO score_row FROM scores WHERE id = p_score_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Score not found';
  END IF;

  IF p_expected_updated_at IS NULL OR score_row.updated_at <> p_expected_updated_at THEN
    RAISE EXCEPTION 'This score was changed by another user. Refresh and try again';
  END IF;

  SELECT * INTO term_row FROM terms WHERE id = score_row.term_id;
  IF NOT FOUND OR term_row.session_id <> score_row.session_id THEN
    RAISE EXCEPTION 'Score term and session are inconsistent';
  END IF;

  permitted := (p_field = 'test1' AND term_row.assessment_stage IN ('first_test', 'second_test', 'third_test', 'examination'))
    OR (p_field = 'test2' AND term_row.assessment_stage IN ('second_test', 'third_test', 'examination'))
    OR (p_field = 'test3' AND term_row.assessment_stage IN ('third_test', 'examination'))
    OR (p_field = 'examination' AND term_row.assessment_stage = 'examination');

  IF NOT permitted THEN
    RAISE EXCEPTION 'The selected assessment field is not available during the current assessment stage';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM enrollments
    WHERE student_id = score_row.student_id
      AND class_id = score_row.class_id
      AND session_id = score_row.session_id
  ) OR NOT EXISTS (
    SELECT 1 FROM class_subject_assignments
    WHERE class_id = score_row.class_id
      AND subject_id = score_row.subject_id
      AND session_id = score_row.session_id
      AND is_active = TRUE
  ) OR NOT EXISTS (
    SELECT 1
    FROM teacher_subject_assignments assignment
    INNER JOIN teachers teacher ON teacher.id = assignment.teacher_id
    WHERE teacher.user_id = score_row.entered_by
      AND assignment.class_id = score_row.class_id
      AND assignment.subject_id = score_row.subject_id
      AND assignment.session_id = score_row.session_id
  ) THEN
    RAISE EXCEPTION 'Score relationships are no longer valid';
  END IF;

  previous_value := CASE p_field
    WHEN 'test1' THEN score_row.test1
    WHEN 'test2' THEN score_row.test2
    WHEN 'test3' THEN score_row.test3
    ELSE score_row.examination
  END;

  UPDATE scores
  SET test1 = CASE WHEN p_field = 'test1' THEN p_new_value ELSE test1 END,
      test2 = CASE WHEN p_field = 'test2' THEN p_new_value ELSE test2 END,
      test3 = CASE WHEN p_field = 'test3' THEN p_new_value ELSE test3 END,
      examination = CASE WHEN p_field = 'examination' THEN p_new_value ELSE examination END,
      updated_by = p_actor
  WHERE id = p_score_id
  RETURNING * INTO corrected_score;

  SELECT * INTO submission_row
  FROM broadsheet_submissions
  WHERE class_id = score_row.class_id
    AND subject_id = score_row.subject_id
    AND session_id = score_row.session_id
    AND term_id = score_row.term_id
  FOR UPDATE;

  has_submission := FOUND;
  IF has_submission THEN
    submission_status := submission_row.status::TEXT;
  END IF;

  IF has_submission AND submission_row.status IN ('submitted', 'approved') THEN
    UPDATE broadsheet_submissions
    SET status = 'returned',
        returned_at = NOW(),
        return_reason = 'Score correction requires teacher review: ' || trim(p_reason),
        approved_at = NULL,
        approved_by = NULL
    WHERE id = submission_row.id;
    submission_status := 'returned';
  END IF;

  UPDATE results
  SET status = 'archived'
  WHERE class_id = score_row.class_id
    AND session_id = score_row.session_id
    AND term_id = score_row.term_id
    AND status IN ('generated', 'reviewed', 'published');
  GET DIAGNOSTICS invalidated_results = ROW_COUNT;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value, metadata)
  VALUES (
    p_actor,
    'super_admin_score_corrected',
    'score',
    p_score_id,
    jsonb_build_object('field', p_field, 'value', previous_value),
    jsonb_build_object('field', p_field, 'value', p_new_value),
    jsonb_build_object(
      'reason', trim(p_reason),
      'student_id', score_row.student_id,
      'class_id', score_row.class_id,
      'subject_id', score_row.subject_id,
      'session_id', score_row.session_id,
      'term_id', score_row.term_id,
      'assessment_stage', term_row.assessment_stage,
    'broadsheet_status_before', CASE WHEN submission_status = 'returned' THEN submission_row.status::TEXT ELSE submission_status END,
      'invalidated_results', invalidated_results
    )
  );

  RETURN jsonb_build_object(
    'score', to_jsonb(corrected_score),
    'broadsheet_status', submission_status,
    'invalidated_results', invalidated_results
  );
END;
$$;

REVOKE ALL ON FUNCTION public.correct_score_as_super_admin(UUID, TEXT, NUMERIC, TEXT, UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.correct_score_as_super_admin(UUID, TEXT, NUMERIC, TEXT, UUID, TIMESTAMPTZ) TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_audit_logs_score_corrections
  ON public.audit_logs (entity_id, created_at DESC)
  WHERE action = 'super_admin_score_corrected';
