import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export const Route = createFileRoute("/progress")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "My progress | Grade 12 Success Hub" },
      { name: "description", content: "Track your practice test scores and improvement over time." },
    ],
  }),
  component: ProgressPage,
});

type AttemptRow = {
  id: string;
  test_id: string;
  score: number;
  total_questions: number;
  completed_at: string | null;
  time_taken_seconds: number | null;
  practice_tests: { title: string; subjects: { name: string } | null } | null;
};

function ProgressPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("test_attempts")
      .select("id, test_id, score, total_questions, completed_at, time_taken_seconds, practice_tests ( title, subjects ( name ) )")
      .eq("user_id", user.id)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .then(({ data }) => {
        setAttempts((data ?? []) as unknown as AttemptRow[]);
        setLoading(false);
      });
  }, [user]);

  const { overall, bySubject } = useMemo(() => {
    if (attempts.length === 0) return { overall: 0, bySubject: [] as Array<{ subject: string; avg: number; latest: number; count: number; trend: "up" | "down" | "flat" }> };
    const total = attempts.reduce((s, a) => s + a.score / Math.max(1, a.total_questions), 0);
    const overall = Math.round((total / attempts.length) * 100);

    const groups = new Map<string, AttemptRow[]>();
    attempts.forEach((a) => {
      const subj = a.practice_tests?.subjects?.name ?? "Other";
      const arr = groups.get(subj) ?? [];
      arr.push(a);
      groups.set(subj, arr);
    });

    const bySubject = Array.from(groups.entries()).map(([subject, arr]) => {
      // arr already ordered desc by completed_at
      const ordered = [...arr].reverse(); // oldest first
      const pcts = ordered.map((a) => (a.score / Math.max(1, a.total_questions)) * 100);
      const avg = Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length);
      const latest = Math.round(pcts[pcts.length - 1]);
      const first = Math.round(pcts[0]);
      const trend: "up" | "down" | "flat" = pcts.length < 2 ? "flat" : latest > first ? "up" : latest < first ? "down" : "flat";
      return { subject, avg, latest, count: arr.length, trend };
    });
    return { overall, bySubject };
  }, [attempts]);

  if (authLoading || !user) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link to="/dashboard" className="font-bold">Grade 12 Success Hub</Link>
          <Link to="/practice"><Button size="sm">Practice tests</Button></Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">My progress</h1>
          <p className="text-muted-foreground text-sm mt-1">Your scores and trends across all subjects.</p>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : attempts.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-muted-foreground mb-4">You haven't completed any tests yet.</p>
              <Link to="/practice"><Button>Start your first test</Button></Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardDescription>Overall average</CardDescription>
                <CardTitle className="text-4xl">{overall}%</CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={overall} />
                <p className="text-xs text-muted-foreground mt-2">Across {attempts.length} test{attempts.length === 1 ? "" : "s"}.</p>
              </CardContent>
            </Card>

            <div>
              <h2 className="font-semibold mb-3">By subject</h2>
              <div className="grid gap-3">
                {bySubject.map((s) => {
                  const Icon = s.trend === "up" ? TrendingUp : s.trend === "down" ? TrendingDown : Minus;
                  const color = s.trend === "up" ? "text-green-600" : s.trend === "down" ? "text-destructive" : "text-muted-foreground";
                  return (
                    <Card key={s.subject}>
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-medium">{s.subject}</p>
                            <p className="text-xs text-muted-foreground">{s.count} attempt{s.count === 1 ? "" : "s"}</p>
                          </div>
                          <div className={`flex items-center gap-1 text-sm ${color}`}>
                            <Icon className="h-4 w-4" />
                            <span>{s.trend === "up" ? "Improving" : s.trend === "down" ? "Slipping" : "Steady"}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Average</span>
                          <span className="font-medium">{s.avg}%</span>
                        </div>
                        <Progress value={s.avg} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-2">Latest: {s.latest}%</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            <div>
              <h2 className="font-semibold mb-3">Recent attempts</h2>
              <div className="space-y-2">
                {attempts.slice(0, 20).map((a) => {
                  const pct = Math.round((a.score / Math.max(1, a.total_questions)) * 100);
                  const date = a.completed_at ? new Date(a.completed_at).toLocaleDateString() : "";
                  return (
                    <Link
                      key={a.id}
                      to="/practice/$testId/results/$attemptId"
                      params={{ testId: a.test_id, attemptId: a.id }}
                    >
                      <Card className="hover:border-primary transition-colors">
                        <CardContent className="py-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{a.practice_tests?.title ?? "Test"}</p>
                            <p className="text-xs text-muted-foreground">{a.practice_tests?.subjects?.name} · {date}</p>
                          </div>
                          <Badge variant={pct >= 80 ? "default" : pct >= 50 ? "secondary" : "destructive"}>
                            {pct}%
                          </Badge>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
