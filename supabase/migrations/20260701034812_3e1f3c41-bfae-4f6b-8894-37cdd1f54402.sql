
-- 1) New answer-keys table (locked down; no authenticated access)
CREATE TABLE public.question_answer_keys (
  question_id uuid PRIMARY KEY REFERENCES public.questions(id) ON DELETE CASCADE,
  correct_option_id uuid NOT NULL REFERENCES public.question_options(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.question_answer_keys TO service_role;
-- Intentionally NO grants to anon/authenticated.
ALTER TABLE public.question_answer_keys ENABLE ROW LEVEL SECURITY;
-- No policies -> no access for anon/authenticated even if grants leak later.

-- 2) Backfill from question_options.is_correct
INSERT INTO public.question_answer_keys (question_id, correct_option_id)
SELECT DISTINCT ON (qo.question_id) qo.question_id, qo.id
FROM public.question_options qo
WHERE qo.is_correct = true
ORDER BY qo.question_id, qo.order_index
ON CONFLICT (question_id) DO NOTHING;

-- 3) Drop is_correct from question_options so it can never leak.
--    Also drop the earlier column-level grant restriction that referenced it.
ALTER TABLE public.question_options DROP COLUMN is_correct;
-- Re-establish a clean SELECT grant now that the sensitive column is gone.
GRANT SELECT ON public.question_options TO authenticated;

-- 4) Prevent client writes to attempt_answers. Scoring RPC (SECURITY DEFINER)
--    still writes as table owner and bypasses RLS.
DROP POLICY IF EXISTS "Users insert own answers" ON public.attempt_answers;
REVOKE INSERT, UPDATE, DELETE ON public.attempt_answers FROM authenticated;
GRANT SELECT ON public.attempt_answers TO authenticated;
GRANT ALL ON public.attempt_answers TO service_role;

-- 5) Recreate the scoring RPC to use question_answer_keys instead of
--    question_options.is_correct.
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
      COALESCE(k.correct_option_id = s.selected_option_id, false) AS is_correct
    FROM test_qs tq
    LEFT JOIN submitted s ON s.question_id = tq.question_id
    LEFT JOIN public.question_answer_keys k ON k.question_id = tq.question_id
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

  DELETE FROM public.attempt_progress_answers
   WHERE attempt_progress_answers.attempt_id = _attempt_id;

  RETURN QUERY SELECT _attempt_id, v_score, v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_test_attempt(uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_test_attempt(uuid, jsonb) TO authenticated;
