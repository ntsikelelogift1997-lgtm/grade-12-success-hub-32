import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, ChevronRight, PlayCircle } from "lucide-react";

export const Route = createFileRoute("/practice/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Practice tests | Grade 12 Success Hub" },
      { name: "description", content: "Timed practice tests with instant marks and answer review." },
    ],
  }),
  component: PracticeList,
});

type TestRow = {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  subjects: { name: string; slug: string } | null;
};
type InProgress = {
  id: string;
  test_id: string;
  seconds_remaining: number | null;
  last_question_index: number;
  practice_tests: { title: string; duration_minutes: number } | null;
};

function PracticeList() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [tests, setTests] = useState<TestRow[]>([]);
  const [inProgress, setInProgress] = useState<InProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase
        .from("practice_tests")
        .select("id, title, description, duration_minutes, subjects ( name, slug )")
        .order("created_at"),
      supabase
        .from("test_attempts")
        .select("id, test_id, seconds_remaining, last_question_index, practice_tests ( title, duration_minutes )")
        .eq("user_id", user.id)
        .eq("status", "in_progress")
        .order("started_at", { ascending: false }),
    ]).then(([t, ip]) => {
      setTests((t.data ?? []) as unknown as TestRow[]);
      setInProgress((ip.data ?? []) as unknown as InProgress[]);
      setLoading(false);
    });
  }, [user]);

  if (authLoading || !user) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link to="/dashboard" className="font-bold">Grade 12 Success Hub</Link>
          <div className="flex items-center gap-2">
            <Link to="/bookmarks"><Button variant="ghost" size="sm">Bookmarks</Button></Link>
            <Link to="/progress"><Button variant="ghost" size="sm">Progress</Button></Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Practice tests</h1>
          <p className="text-muted-foreground text-sm mt-1">Pick a test, beat the clock, get instant feedback.</p>
        </div>

        {!loading && inProgress.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Resume</h2>
            <div className="space-y-2">
              {inProgress.map((ip) => {
                const mins = Math.floor((ip.seconds_remaining ?? 0) / 60);
                const secs = (ip.seconds_remaining ?? 0) % 60;
                return (
                  <Link key={ip.id} to="/practice/$testId" params={{ testId: ip.test_id }}>
                    <Card className="border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors">
                      <CardContent className="py-4 flex items-center gap-3">
                        <PlayCircle className="h-8 w-8 text-primary shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{ip.practice_tests?.title}</p>
                          <p className="text-xs text-muted-foreground">
                            On question {ip.last_question_index + 1} · {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")} left
                          </p>
                        </div>
                        <Badge>Resume</Badge>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-muted-foreground">Loading tests...</p>
        ) : tests.length === 0 ? (
          <p className="text-muted-foreground">No tests available yet.</p>
        ) : (
          <div className="grid gap-4">
            {tests.map((t) => (
              <Link key={t.id} to="/practice/$testId" params={{ testId: t.id }}>
                <Card className="hover:border-primary transition-colors cursor-pointer">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        {t.subjects && <Badge variant="secondary" className="mb-2">{t.subjects.name}</Badge>}
                        <CardTitle className="text-lg">{t.title}</CardTitle>
                        {t.description && <CardDescription className="mt-1">{t.description}</CardDescription>}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{t.duration_minutes} min</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
