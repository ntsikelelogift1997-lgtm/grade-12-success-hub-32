
ALTER TABLE public.attempt_answers
  ADD COLUMN IF NOT EXISTS correct_option_id uuid REFERENCES public.question_options(id) ON DELETE SET NULL;

-- Backfill existing rows from the answer-keys table
UPDATE public.attempt_answers aa
   SET correct_option_id = k.correct_option_id
  FROM public.question_answer_keys k
 WHERE k.question_id = aa.question_id
   AND aa.correct_option_id IS NULL;

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

  DELETE FROM public.attempt_answers
   WHERE attempt_answers.attempt_id = _attempt_id;

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
      k.correct_option_id,
      COALESCE(k.correct_option_id = s.selected_option_id, false) AS is_correct
    FROM test_qs tq
    LEFT JOIN submitted s ON s.question_id = tq.question_id
    LEFT JOIN public.question_answer_keys k ON k.question_id = tq.question_id
  ),
  ins AS (
    INSERT INTO public.attempt_answers
      (attempt_id, question_id, selected_option_id, is_correct, correct_option_id)
    SELECT _attempt_id, question_id, selected_option_id, is_correct, correct_option_id
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

  DELETE FROM public.attempt_progress_answers
   WHERE attempt_progress_answers.attempt_id = _attempt_id;

  RETURN QUERY SELECT _attempt_id, v_score, v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_test_attempt(uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_test_attempt(uuid, jsonb) TO authenticated;
