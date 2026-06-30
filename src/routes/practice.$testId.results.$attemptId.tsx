import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";

export const Route = createFileRoute("/practice/$testId/results/$attemptId")({
  ssr: false,
  head: () => ({ meta: [{ title: "Results | Grade 12 Success Hub" }] }),
  component: Results,
});

type Attempt = {
  id: string;
  score: number;
  total_questions: number;
  time_taken_seconds: number | null;
  test_id: string;
  practice_tests: { title: string } | null;
};
type ReviewRow = {
  question_id: string;
  selected_option_id: string | null;
  is_correct: boolean;
  questions: {
    id: string;
    question_text: string;
    explanation: string | null;
    order_index: number;
    question_options: { id: string; option_text: string; is_correct: boolean; order_index: number }[];
  } | null;
};

function Results() {
  const { testId, attemptId } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: a }, { data: r }] = await Promise.all([
        supabase
          .from("test_attempts")
          .select("id, score, total_questions, time_taken_seconds, test_id, practice_tests ( title )")
          .eq("id", attemptId)
          .maybeSingle(),
        supabase
          .from("attempt_answers")
          .select("question_id, selected_option_id, is_correct, questions ( id, question_text, explanation, order_index, question_options ( id, option_text, is_correct, order_index ) )")
          .eq("attempt_id", attemptId),
      ]);
      setAttempt(a as unknown as Attempt | null);
      const sorted = (r ?? []) as unknown as ReviewRow[];
      sorted.sort((x, y) => (x.questions?.order_index ?? 0) - (y.questions?.order_index ?? 0));
      sorted.forEach((row) => row.questions?.question_options.sort((a, b) => a.order_index - b.order_index));
      setRows(sorted);
      setLoading(false);
    })();
  }, [attemptId, user]);

  if (authLoading || loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading results...</div>;
  if (!attempt) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Results not found.</div>;

  const pct = Math.round((attempt.score / Math.max(1, attempt.total_questions)) * 100);
  const mins = Math.floor((attempt.time_taken_seconds ?? 0) / 60);
  const secs = (attempt.time_taken_seconds ?? 0) % 60;
  const gradeColor = pct >= 80 ? "text-green-600" : pct >= 50 ? "text-amber-600" : "text-destructive";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link to="/practice" className="font-bold">Grade 12 Success Hub</Link>
          <Link to="/progress"><Button variant="ghost" size="sm">My progress</Button></Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <p className="text-sm text-muted-foreground">{attempt.practice_tests?.title}</p>
            <CardTitle className="text-2xl">Your results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div>
                <div className={`text-5xl font-bold ${gradeColor}`}>{pct}%</div>
                <p className="text-sm text-muted-foreground mt-1">
                  {attempt.score} of {attempt.total_questions} correct
                </p>
              </div>
              <div className="ml-auto text-sm text-muted-foreground">
                Time: {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <Link to="/practice/$testId" params={{ testId }}><Button>Try again</Button></Link>
              <Link to="/practice"><Button variant="outline">More tests</Button></Link>
            </div>
          </CardContent>
        </Card>

        <div>
          <h2 className="font-semibold mb-3">Answer review</h2>
          <div className="space-y-3">
            {rows.map((row, i) => {
              if (!row.questions) return null;
              const correctOpt = row.questions.question_options.find((o) => o.is_correct);
              return (
                <Card key={row.question_id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="text-sm leading-relaxed">
                        <span className="text-muted-foreground mr-2">Q{i + 1}.</span>
                        {row.questions.question_text}
                      </CardTitle>
                      <Badge variant={row.is_correct ? "default" : "destructive"} className="shrink-0">
                        {row.is_correct ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                        {row.is_correct ? "Correct" : "Wrong"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {row.questions.question_options.map((opt) => {
                      const isSelected = opt.id === row.selected_option_id;
                      const isCorrect = opt.is_correct;
                      const cls = isCorrect
                        ? "border-green-500 bg-green-500/10"
                        : isSelected
                        ? "border-destructive bg-destructive/10"
                        : "border-input";
                      return (
                        <div key={opt.id} className={`rounded-md border px-3 py-2 text-sm flex items-center justify-between gap-2 ${cls}`}>
                          <span>{opt.option_text}</span>
                          <span className="text-xs text-muted-foreground">
                            {isCorrect && "Correct answer"}
                            {!isCorrect && isSelected && "Your answer"}
                          </span>
                        </div>
                      );
                    })}
                    {!row.selected_option_id && (
                      <p className="text-xs text-muted-foreground italic">You did not answer this question.</p>
                    )}
                    {row.questions.explanation && (
                      <div className="mt-3 rounded-md bg-muted px-3 py-2 text-sm">
                        <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">Explanation</p>
                        <p>{row.questions.explanation}</p>
                        {correctOpt && !row.is_correct && (
                          <p className="mt-1 text-xs text-muted-foreground">Correct answer: <span className="font-medium">{correctOpt.option_text}</span></p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
