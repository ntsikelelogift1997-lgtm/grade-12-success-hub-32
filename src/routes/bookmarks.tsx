import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/bookmarks")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Bookmarked questions | Grade 12 Success Hub" },
      { name: "description", content: "Revisit questions you've starred for later." },
    ],
  }),
  component: BookmarksPage,
});

type Row = {
  id: string;
  question_id: string;
  questions: {
    id: string;
    question_text: string;
    explanation: string | null;
    question_options: { id: string; option_text: string; order_index: number }[];
    practice_tests: { id: string; title: string; subjects: { name: string } | null } | null;
  } | null;
};

function BookmarksPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  const load = () => {
    if (!user) return;
    supabase
      .from("question_bookmarks")
      .select("id, question_id, questions ( id, question_text, explanation, question_options ( id, option_text, order_index ), practice_tests ( id, title, subjects ( name ) ) )")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const list = (data ?? []) as unknown as Row[];
        list.forEach((r) => r.questions?.question_options.sort((a, b) => a.order_index - b.order_index));
        setRows(list);
        setLoading(false);
      });
  };

  useEffect(load, [user]);

  async function remove(bookmarkId: string) {
    const prev = rows;
    setRows((r) => r.filter((x) => x.id !== bookmarkId));
    const { error } = await supabase.from("question_bookmarks").delete().eq("id", bookmarkId);
    if (error) {
      setRows(prev);
      toast.error("Could not remove bookmark");
    } else {
      toast.success("Bookmark removed");
    }
  }

  if (authLoading || !user) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;

  // Group by subject
  const groups = new Map<string, Row[]>();
  rows.forEach((r) => {
    const subj = r.questions?.practice_tests?.subjects?.name ?? "Other";
    const arr = groups.get(subj) ?? [];
    arr.push(r);
    groups.set(subj, arr);
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link to="/dashboard" className="font-bold">Grade 12 Success Hub</Link>
          <Link to="/practice"><Button variant="ghost" size="sm">Practice tests</Button></Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Star className="h-6 w-6 fill-amber-400 text-amber-500" />
            Bookmarked questions
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Tricky questions you've saved for revision.</p>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-muted-foreground mb-4">No bookmarks yet. Star a question during a test to save it here.</p>
              <Link to="/practice"><Button>Browse tests</Button></Link>
            </CardContent>
          </Card>
        ) : (
          Array.from(groups.entries()).map(([subject, items]) => (
            <div key={subject}>
              <h2 className="font-semibold mb-3">{subject} <span className="text-muted-foreground font-normal text-sm">· {items.length}</span></h2>
              <div className="space-y-3">
                {items.map((row) => {
                  if (!row.questions) return null;
                  return (
                    <Card key={row.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            {row.questions.practice_tests && (
                              <Badge variant="secondary" className="mb-2">{row.questions.practice_tests.title}</Badge>
                            )}
                            <CardTitle className="text-sm leading-relaxed">{row.questions.question_text}</CardTitle>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => remove(row.id)} aria-label="Remove bookmark">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {row.questions.question_options.map((opt) => (
                          <div
                            key={opt.id}
                            className="rounded-md border border-input px-3 py-2 text-sm"
                          >
                            {opt.option_text}
                          </div>
                        ))}
                        {row.questions.explanation && (
                          <div className="mt-3 rounded-md bg-muted px-3 py-2 text-sm">
                            <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">Explanation</p>
                            <p>{row.questions.explanation}</p>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground italic">
                          Take the test to see which option is correct in the answer review.
                        </p>
                      </CardContent>

                    </Card>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
