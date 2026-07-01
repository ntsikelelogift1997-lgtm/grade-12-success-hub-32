
REVOKE SELECT ON public.question_options FROM authenticated;
REVOKE SELECT ON public.question_options FROM anon;
GRANT SELECT (id, question_id, option_text, order_index) ON public.question_options TO authenticated;
GRANT ALL ON public.question_options TO service_role;

REVOKE UPDATE ON public.test_attempts FROM authenticated;
GRANT UPDATE (seconds_remaining, last_question_index) ON public.test_attempts TO authenticated;
GRANT ALL ON public.test_attempts TO service_role;

DROP POLICY IF EXISTS "Users create own attempts" ON public.test_attempts;
CREATE POLICY "Users create own attempts"
  ON public.test_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'in_progress'
    AND score = 0
    AND completed_at IS NULL
    AND time_taken_seconds IS NULL
  );

CREATE OR REPLACE FUNCTION public.submit_test_attempt(
  _attempt_id uuid,
  _answers jsonb
)
RETURNS TABLE (attempt_id uuid, score integer, total_questions integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_test_id uuid;
  v_started_at timestamptz;
  v_status text;
  v_total integer;
  v_score integer := 0;
  v_time_taken integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT ta.user_id, ta.test_id, ta.started_at, ta.status
    INTO v_user_id, v_test_id, v_started_at, v_status
  FROM public.test_attempts ta
  WHERE ta.id = _attempt_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Attempt not found';
  END IF;
  IF v_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF v_status = 'completed' THEN
    RAISE EXCEPTION 'Attempt already submitted';
  END IF;

  DELETE FROM public.attempt_answers WHERE attempt_answers.attempt_id = _attempt_id;

  WITH submitted AS (
    SELECT
      (elem->>'question_id')::uuid AS question_id,
      NULLIF(elem->>'selected_option_id', '')::uuid AS selected_option_id
    FROM jsonb_array_elements(_answers) AS elem
  ),
  test_qs AS (
    SELECT q.id AS question_id
    FROM public.questions q
    WHERE q.test_id = v_test_id
  ),
  joined AS (
    SELECT
      tq.question_id,
      s.selected_option_id,
      COALESCE(qo.is_correct, false) AS is_correct
    FROM test_qs tq
    LEFT JOIN submitted s ON s.question_id = tq.question_id
    LEFT JOIN public.question_options qo
      ON qo.id = s.selected_option_id
     AND qo.question_id = tq.question_id
  ),
  ins AS (
    INSERT INTO public.attempt_answers
      (attempt_id, question_id, selected_option_id, is_correct)
    SELECT _attempt_id, question_id, selected_option_id, is_correct
    FROM joined
    RETURNING is_correct
  )
  SELECT count(*)::int, count(*) FILTER (WHERE is_correct)::int
    INTO v_total, v_score
  FROM ins;

  v_time_taken := GREATEST(0, EXTRACT(EPOCH FROM (now() - v_started_at))::int);

  UPDATE public.test_attempts
     SET score = v_score,
         total_questions = v_total,
         time_taken_seconds = v_time_taken,
         completed_at = now(),
         status = 'completed',
         seconds_remaining = 0
   WHERE id = _attempt_id;

  DELETE FROM public.attempt_progress_answers WHERE attempt_progress_answers.attempt_id = _attempt_id;

  RETURN QUERY SELECT _attempt_id, v_score, v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_test_attempt(uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_test_attempt(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_role public.app_role;
  v_role_text TEXT;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, school, grade, phone)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'school',
    NEW.raw_user_meta_data->>'grade',
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;

  v_role_text := NEW.raw_user_meta_data->>'role';
  IF v_role_text IN ('student', 'parent') THEN
    v_role := v_role_text::public.app_role;
  ELSE
    v_role := 'student';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;
