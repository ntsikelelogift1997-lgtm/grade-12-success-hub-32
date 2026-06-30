import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, LineChart } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dashboard | Grade 12 Success Hub" },
      { name: "description", content: "Your personalised Grade 12 study dashboard." },
    ],
  }),
  component: Dashboard,
});

const ROLE_LABELS: Record<AppRole, string> = {
  student: "Student",
  teacher: "Teacher",
  parent: "Parent",
  school_admin: "School Administrator",
};

type Profile = { full_name: string | null; school: string | null; grade: string | null; email: string | null };

function Dashboard() {
  const navigate = useNavigate();
  const { user, roles, loading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name, school, grade, email")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data as Profile | null));
  }, [user]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth" });
  }

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <h1 className="text-lg font-bold">Grade 12 Success Hub</h1>
          <Button variant="outline" size="sm" onClick={handleSignOut}>Sign out</Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}!</h2>
          <p className="text-muted-foreground mt-1">You're signed in to your account.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Link to="/practice">
            <Card className="hover:border-primary transition-colors h-full">
              <CardHeader>
                <BookOpen className="h-6 w-6 text-primary mb-2" />
                <CardTitle className="text-base">Practice tests</CardTitle>
                <CardDescription>Timed tests with instant marks and answer review.</CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link to="/progress">
            <Card className="hover:border-primary transition-colors h-full">
              <CardHeader>
                <LineChart className="h-6 w-6 text-primary mb-2" />
                <CardTitle className="text-base">My progress</CardTitle>
                <CardDescription>Track your scores and improvement over time.</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your account</CardTitle>
            <CardDescription>Profile and role information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Email" value={profile?.email ?? user.email ?? "—"} />
            <Row label="Name" value={profile?.full_name ?? "—"} />
            {profile?.school && <Row label="School" value={profile.school} />}
            {profile?.grade && <Row label="Grade" value={profile.grade} />}
            <div className="flex items-start justify-between gap-4 pt-2 border-t">
              <span className="text-muted-foreground">Roles</span>
              <div className="flex flex-wrap gap-2 justify-end">
                {roles.length === 0 ? (
                  <span className="text-muted-foreground">No role assigned</span>
                ) : (
                  roles.map((r) => <Badge key={r}>{ROLE_LABELS[r]}</Badge>)
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
