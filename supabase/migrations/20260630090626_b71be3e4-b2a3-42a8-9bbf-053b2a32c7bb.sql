
-- Subjects
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subjects TO authenticated;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Subjects readable by signed-in users"
  ON public.subjects FOR SELECT TO authenticated USING (true);

-- Practice tests
CREATE TABLE public.practice_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INT NOT NULL DEFAULT 15,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.practice_tests TO authenticated;
GRANT ALL ON public.practice_tests TO service_role;
ALTER TABLE public.practice_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tests readable by signed-in users"
  ON public.practice_tests FOR SELECT TO authenticated USING (true);

-- Questions
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES public.practice_tests(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  explanation TEXT,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Questions readable by signed-in users"
  ON public.questions FOR SELECT TO authenticated USING (true);

-- Question options
CREATE TABLE public.question_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  order_index INT NOT NULL DEFAULT 0
);
GRANT SELECT ON public.question_options TO authenticated;
GRANT ALL ON public.question_options TO service_role;
ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Options readable by signed-in users"
  ON public.question_options FOR SELECT TO authenticated USING (true);

-- Test attempts
CREATE TABLE public.test_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES public.practice_tests(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  score INT NOT NULL DEFAULT 0,
  total_questions INT NOT NULL DEFAULT 0,
  time_taken_seconds INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_attempts TO authenticated;
GRANT ALL ON public.test_attempts TO service_role;
ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own attempts"
  ON public.test_attempts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users create own attempts"
  ON public.test_attempts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own attempts"
  ON public.test_attempts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Attempt answers
CREATE TABLE public.attempt_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.test_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_option_id UUID REFERENCES public.question_options(id) ON DELETE SET NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attempt_answers TO authenticated;
GRANT ALL ON public.attempt_answers TO service_role;
ALTER TABLE public.attempt_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own answers"
  ON public.attempt_answers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.test_attempts a WHERE a.id = attempt_id AND a.user_id = auth.uid()));
CREATE POLICY "Users insert own answers"
  ON public.attempt_answers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.test_attempts a WHERE a.id = attempt_id AND a.user_id = auth.uid()));

CREATE INDEX idx_test_attempts_user ON public.test_attempts(user_id, completed_at DESC);
CREATE INDEX idx_attempt_answers_attempt ON public.attempt_answers(attempt_id);
CREATE INDEX idx_questions_test ON public.questions(test_id, order_index);
CREATE INDEX idx_options_question ON public.question_options(question_id, order_index);
