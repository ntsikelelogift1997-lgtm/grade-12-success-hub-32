import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_admin/admin")({
  head: () => ({ meta: [{ title: "Admin | Grade 12 Success Hub" }] }),
  component: AdminHome,
});

function AdminHome() {
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
            <ShieldCheck className="h-6 w-6 text-primary mb-2" />
            <CardTitle>School administrator</CardTitle>
            <CardDescription>
              This area is only visible to school administrators. User provisioning, role
              management, and school-wide reporting will appear here.
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
