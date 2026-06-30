import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Grade 12 Success Hub" },
      { name: "description", content: "Lessons, practice tests, teacher consultations and exam prep for South African Grade 12 learners." },
      { property: "og:title", content: "Grade 12 Success Hub" },
      { property: "og:description", content: "Lessons, practice tests, teacher consultations and exam prep for South African Grade 12 learners." },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <span className="font-bold">Grade 12 Success Hub</span>
          <Link to="/auth"><Button size="sm">Sign in</Button></Link>
        </div>
      </header>
      <main className="container mx-auto px-4 py-16 max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Your Matric, mastered.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Lessons, practice tests, teacher consultations and exam prep — built for South African Grade 12 learners, teachers, parents and schools.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/auth"><Button size="lg">Get started</Button></Link>
          <Link to="/auth"><Button size="lg" variant="outline">Sign in</Button></Link>
        </div>
      </main>
    </div>
  );
}
