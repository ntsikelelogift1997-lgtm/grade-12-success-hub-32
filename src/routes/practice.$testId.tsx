import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/practice/$testId")({
  ssr: false,
  head: () => ({ meta: [{ title: "Take test | Grade 12 Success Hub" }] }),
  component: TakeTest,
});

type Test = { id: string; title: string; duration_minutes: number };
type Option = { id: string; option_text: string; order_index: number };
type Question = { id: string; question_text: string; order_index: number; explanation: string | null; question_options: Option[] };

function TakeTest() {
  const { testId } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({}); // questionId -> optionId
  const [currentIdx, setCurrentIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const startedAtRef = useRef<number>(Date.now());
  const submittedRef = useRef(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: tData }, { data: qData }] = await Promise.all([
        supabase.from("practice_tests").select("id, title, duration_minutes").eq("id", testId).maybeSingle(),
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
      setSecondsLeft(tData.duration_minutes * 60);
      startedAtRef.current = Date.now();
      setLoading(false);
    })();
  }, [testId, user, navigate]);

  const handleSubmit = useCallback(async () => {
    if (submittedRef.current || !user || !test) return;
    submittedRef.current = true;
    setSubmitting(true);

    const timeTaken = Math.floor((Date.now() - startedAtRef.current) / 1000);

    // Compute correctness from loaded option data via a fresh query (avoids trusting client)
    const { data: opts } = await supabase
      .from("question_options")
      .select("id, question_id, is_correct")
      .in("question_id", questions.map((q) => q.id));

    const correctByQuestion: Record<string, string> = {};
    (opts ?? []).forEach((o) => {
      if (o.is_correct) correctByQuestion[o.question_id] = o.id;
    });

    let score = 0;
    const answerRows: Array<{ question_id: string; selected_option_id: string | null; is_correct: boolean }> = [];
    questions.forEach((q) => {
      const selected = answers[q.id] ?? null;
      const isCorrect = selected != null && correctByQuestion[q.id] === selected;
      if (isCorrect) score += 1;
      answerRows.push({ question_id: q.id, selected_option_id: selected, is_correct: isCorrect });
    });

    const { data: attempt, error: aErr } = await supabase
      .from("test_attempts")
      .insert({
        user_id: user.id,
        test_id: test.id,
        score,
        total_questions: questions.length,
        time_taken_seconds: timeTaken,
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (aErr || !attempt) {
      toast.error("Could not save attempt. Try again.");
      submittedRef.current = false;
      setSubmitting(false);
      return;
    }

    const { error: ansErr } = await supabase
      .from("attempt_answers")
      .insert(answerRows.map((r) => ({ ...r, attempt_id: attempt.id })));

    if (ansErr) toast.error("Some answers could not be saved.");

    navigate({ to: "/practice/$testId/results/$attemptId", params: { testId: test.id, attemptId: attempt.id } });
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

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);

  if (authLoading || loading || !test) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading test...</div>;
  if (questions.length === 0) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">This test has no questions yet.</div>;

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
        <Card>
          <CardHeader>
            <CardTitle className="text-base leading-relaxed">{q.question_text}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {q.question_options.map((opt) => {
              const selected = answers[q.id] === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))}
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
          <Link to="/practice" className="text-xs text-muted-foreground hover:underline">Exit test</Link>
        </div>
      </main>
    </div>
  );
}
