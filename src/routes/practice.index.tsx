import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, ChevronRight } from "lucide-react";

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

function PracticeList() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [tests, setTests] = useState<TestRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("practice_tests")
      .select("id, title, description, duration_minutes, subjects ( name, slug )")
      .order("created_at")
      .then(({ data }) => {
        setTests((data ?? []) as unknown as TestRow[]);
        setLoading(false);
      });
  }, [user]);

  if (authLoading || !user) return <Center>Loading...</Center>;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Practice tests</h1>
            <p className="text-muted-foreground text-sm mt-1">Pick a test, beat the clock, get instant feedback.</p>
          </div>
          <Link to="/progress"><Button variant="outline" size="sm">My progress</Button></Link>
        </div>

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

function Header() {
  return (
    <header className="border-b">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <Link to="/dashboard" className="font-bold">Grade 12 Success Hub</Link>
        <Link to="/dashboard"><Button variant="ghost" size="sm">Dashboard</Button></Link>
      </div>
    </header>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{children}</div>;
}
