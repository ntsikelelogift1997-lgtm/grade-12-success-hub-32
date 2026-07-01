import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap } from "lucide-react";

export const Route = createFileRoute("/_teacher/teacher")({
  head: () => ({ meta: [{ title: "Teacher | Grade 12 Success Hub" }] }),
  component: TeacherHome,
});

function TeacherHome() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <h1 className="text-lg font-bold">Grade 12 Success Hub</h1>
          <Link to="/dashboard"><Button variant="outline" size="sm">Dashboard</Button></Link>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Card>
          <CardHeader>
            <GraduationCap className="h-6 w-6 text-primary mb-2" />
            <CardTitle>Teacher workspace</CardTitle>
            <CardDescription>
              This area is only visible to teachers and school administrators. Class rosters,
              assignments, and student progress reports will appear here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Coming soon.</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
