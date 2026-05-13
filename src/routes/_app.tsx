import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/_app")({ component: AppShell });

function AppShell() {
  const { loading, session, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/login" });
    } else if (profile && profile.status !== "approved") {
      navigate({ to: "/pending" });
    }
  }, [loading, session, profile, navigate]);

  if (loading || !session || !profile) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (profile.status !== "approved") return null;

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
