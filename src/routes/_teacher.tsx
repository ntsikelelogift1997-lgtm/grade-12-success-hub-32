import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_teacher")({
  ssr: false,
  component: TeacherGuard,
});

function TeacherGuard() {
  const navigate = useNavigate();
  const { loading, rolesLoaded, isAuthenticated, hasAnyRole } = useAuth();

  const allowed = hasAnyRole(["teacher", "school_admin"]);

  useEffect(() => {
    if (loading || !rolesLoaded) return;
    if (!isAuthenticated) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    if (!allowed) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, rolesLoaded, isAuthenticated, allowed, navigate]);

  if (loading || !rolesLoaded || !isAuthenticated || !allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  return <Outlet />;
}
