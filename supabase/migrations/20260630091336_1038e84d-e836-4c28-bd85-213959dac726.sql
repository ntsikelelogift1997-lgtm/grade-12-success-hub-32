
-- Bookmarks
CREATE TABLE public.question_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_id)
);
GRANT SELECT, INSERT, DELETE ON public.question_bookmarks TO authenticated;
GRANT ALL ON public.question_bookmarks TO service_role;
ALTER TABLE public.question_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own bookmarks"
  ON public.question_bookmarks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users create own bookmarks"
  ON public.question_bookmarks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own bookmarks"
  ON public.question_bookmarks FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
CREATE INDEX idx_bookmarks_user ON public.question_bookmarks(user_id, created_at DESC);

-- Extend test_attempts for in-progress state
ALTER TABLE public.test_attempts
  ADD COLUMN status TEXT NOT NULL DEFAULT 'in_progress',
  ADD COLUMN seconds_remaining INT,
  ADD COLUMN last_question_index INT NOT NULL DEFAULT 0;

-- Backfill existing rows with completed_at set
UPDATE public.test_attempts SET status = 'completed' WHERE completed_at IS NOT NULL;

CREATE INDEX idx_attempts_in_progress ON public.test_attempts(user_id, test_id, status);

-- In-progress draft answers
CREATE TABLE public.attempt_progress_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.test_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_option_id UUID REFERENCES public.question_options(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attempt_progress_answers TO authenticated;
GRANT ALL ON public.attempt_progress_answers TO service_role;
ALTER TABLE public.attempt_progress_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own progress answers"
  ON public.attempt_progress_answers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.test_attempts a WHERE a.id = attempt_id AND a.user_id = auth.uid()));
CREATE POLICY "Users insert own progress answers"
  ON public.attempt_progress_answers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.test_attempts a WHERE a.id = attempt_id AND a.user_id = auth.uid()));
CREATE POLICY "Users update own progress answers"
  ON public.attempt_progress_answers FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.test_attempts a WHERE a.id = attempt_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.test_attempts a WHERE a.id = attempt_id AND a.user_id = auth.uid()));
CREATE POLICY "Users delete own progress answers"
  ON public.attempt_progress_answers FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.test_attempts a WHERE a.id = attempt_id AND a.user_id = auth.uid()));
CREATE INDEX idx_progress_answers_attempt ON public.attempt_progress_answers(attempt_id);
