import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { BookmarkButton } from "@/components/bookmark-button";

export const Route = createFileRoute("/practice/$testId")({
  ssr: false,
  head: () => ({ meta: [{ title: "Take test | Grade 12 Success Hub" }] }),
  component: TakeTest,
});

type Test = { id: string; title: string; duration_minutes: number };
type Option = { id: string; option_text: string; order_index: number };
type Question = {
  id: string;
  question_text: string;
  order_index: number;
  explanation: string | null;
  question_options: Option[];
};
type Attempt = {
  id: string;
  seconds_remaining: number | null;
  last_question_index: number;
  status: string;
};

function TakeTest() {
  const { testId } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resumed, setResumed] = useState(false);

  const submittedRef = useRef(false);
  const attemptIdRef = useRef<string | null>(null);
  const stateRef = useRef({ secondsLeft: 0, currentIdx: 0 });

  useEffect(() => {
    stateRef.current = { secondsLeft: secondsLeft ?? 0, currentIdx };
  }, [secondsLeft, currentIdx]);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  // Load test + questions + resume-or-create attempt
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: tData }, { data: qData }] = await Promise.all([
        supabase
          .from("practice_tests")
          .select("id, title, duration_minutes")
          .eq("id", testId)
          .maybeSingle(),
        supabase
          .from("questions")
          .select("id, question_text, order_index, explanation, question_options ( id, option_text, order_index )")
          .eq("test_id", testId)
          .order("order_index"),
      ]);

      if (!tData) {
        toast.error("Test not found");
        navigate({ to: "/practice" });
        return;
      }
      const qs = (qData ?? []) as unknown as Question[];
      qs.forEach((q) => q.question_options.sort((a, b) => a.order_index - b.order_index));
      setTest(tData as Test);
      setQuestions(qs);

      // Find existing in-progress attempt
      const { data: existing } = await supabase
        .from("test_attempts")
        .select("id, seconds_remaining, last_question_index, status")
        .eq("user_id", user.id)
        .eq("test_id", testId)
        .eq("status", "in_progress")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        // Restore
        const { data: drafts } = await supabase
          .from("attempt_progress_answers")
          .select("question_id, selected_option_id")
          .eq("attempt_id", existing.id);

        const restored: Record<string, string> = {};
        (drafts ?? []).forEach((d) => {
          if (d.selected_option_id) restored[d.question_id] = d.selected_option_id;
        });
        setAnswers(restored);
        setAttempt(existing as Attempt);
        attemptIdRef.current = existing.id;
        setCurrentIdx(Math.min(existing.last_question_index, Math.max(0, qs.length - 1)));
        setSecondsLeft(existing.seconds_remaining ?? tData.duration_minutes * 60);
        setResumed(true);
      } else {
        // Create new in-progress
        const initialSeconds = tData.duration_minutes * 60;
        const { data: created } = await supabase
          .from("test_attempts")
          .insert({
            user_id: user.id,
            test_id: tData.id,
            total_questions: qs.length,
            seconds_remaining: initialSeconds,
            last_question_index: 0,
            status: "in_progress",
          })
          .select("id, seconds_remaining, last_question_index, status")
          .single();
        if (created) {
          setAttempt(created as Attempt);
          attemptIdRef.current = created.id;
        }
        setSecondsLeft(initialSeconds);
      }
      setLoading(false);
    })();
  }, [testId, user, navigate]);

  // Auto-save answer + progress
  const persistAnswer = useCallback(
    async (questionId: string, optionId: string) => {
      const aid = attemptIdRef.current;
      if (!aid) return;
      await supabase
        .from("attempt_progress_answers")
        .upsert(
          { attempt_id: aid, question_id: questionId, selected_option_id: optionId, updated_at: new Date().toISOString() },
          { onConflict: "attempt_id,question_id" },
        );
    },
    [],
  );

  const persistProgress = useCallback(async () => {
    const aid = attemptIdRef.current;
    if (!aid || submittedRef.current) return;
    const { secondsLeft: s, currentIdx: idx } = stateRef.current;
    await supabase
      .from("test_attempts")
      .update({ seconds_remaining: Math.max(0, s), last_question_index: idx })
      .eq("id", aid);
  }, []);

  // Save progress every 10s and on tab hidden / unload
  useEffect(() => {
    if (submittedRef.current) return;
    const id = setInterval(persistProgress, 10_000);
    const onHide = () => {
      if (document.visibilityState === "hidden") persistProgress();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", persistProgress);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", persistProgress);
    };
  }, [persistProgress]);

  const handleSubmit = useCallback(async () => {
    if (submittedRef.current || !user || !test || !attemptIdRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);

    const aid = attemptIdRef.current;

    const answersPayload = questions.map((q) => ({
      question_id: q.id,
      selected_option_id: answers[q.id] ?? null,
    }));

    // Server-trusted scoring — correctness is computed in the database.
    const { error: rpcErr } = await supabase.rpc("submit_test_attempt", {
      _attempt_id: aid,
      _answers: answersPayload,
    });

    if (rpcErr) {
      toast.error("Could not submit your test. Try again.");
      submittedRef.current = false;
      setSubmitting(false);
      return;
    }

    navigate({
      to: "/practice/$testId/results/$attemptId",
      params: { testId: test.id, attemptId: aid },
    });
  }, [answers, navigate, questions, test, user]);


  // Timer
  useEffect(() => {
    if (secondsLeft == null || submittedRef.current) return;
    if (secondsLeft <= 0) {
      toast.message("Time's up — submitting your test.");
      handleSubmit();
      return;
    }
    const id = setTimeout(() => setSecondsLeft((s) => (s == null ? null : s - 1)), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft, handleSubmit]);

  const handleExit = useCallback(async () => {
    await persistProgress();
    toast.success("Progress saved — resume any time.");
    navigate({ to: "/practice" });
  }, [persistProgress, navigate]);

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);

  if (authLoading || loading || !test || !attempt)
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading test...</div>;
  if (questions.length === 0)
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">This test has no questions yet.</div>;

  const q = questions[currentIdx];
  const mins = Math.floor((secondsLeft ?? 0) / 60);
  const secs = (secondsLeft ?? 0) % 60;
  const lowTime = (secondsLeft ?? 0) <= 30;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="container mx-auto flex items-center justify-between px-4 py-3 gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Question {currentIdx + 1} of {questions.length}</p>
            <p className="font-semibold truncate">{test.title}</p>
          </div>
          <div className={`flex items-center gap-2 font-mono text-sm rounded-md px-3 py-1.5 ${lowTime ? "bg-destructive/10 text-destructive" : "bg-muted"}`}>
            <Clock className="h-4 w-4" />
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </div>
        </div>
        <Progress value={((currentIdx + 1) / questions.length) * 100} className="h-1 rounded-none" />
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        {resumed && (
          <div className="mb-4 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            Resumed from your last session.
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-base leading-relaxed">{q.question_text}</CardTitle>
              {user && <BookmarkButton questionId={q.id} userId={user.id} />}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {q.question_options.map((opt) => {
              const selected = answers[q.id] === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setAnswers((prev) => ({ ...prev, [q.id]: opt.id }));
                    persistAnswer(q.id, opt.id);
                  }}
                  className={`w-full text-left rounded-md border px-4 py-3 text-sm transition-colors ${
                    selected ? "border-primary bg-primary/5" : "border-input hover:bg-accent"
                  }`}
                >
                  {opt.option_text}
                </button>
              );
            })}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-3 mt-6">
          <Button variant="outline" disabled={currentIdx === 0} onClick={() => setCurrentIdx((i) => i - 1)}>
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">{answeredCount} of {questions.length} answered</span>
          {currentIdx < questions.length - 1 ? (
            <Button onClick={() => setCurrentIdx((i) => i + 1)}>Next</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting}>{submitting ? "Submitting..." : "Submit test"}</Button>
          )}
        </div>

        {answeredCount < questions.length && currentIdx === questions.length - 1 && (
          <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>You have {questions.length - answeredCount} unanswered question(s). They will be marked incorrect.</p>
          </div>
        )}

        <div className="mt-6 text-center">
          <Button variant="ghost" size="sm" onClick={handleExit}>
            Save &amp; exit
          </Button>
          <p className="text-xs text-muted-foreground mt-1">Your progress is saved automatically.</p>
          <div className="mt-2">
            <Link to="/practice" className="text-xs text-muted-foreground hover:underline">Back to tests</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
