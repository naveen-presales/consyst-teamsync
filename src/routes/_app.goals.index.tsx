import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Target, Users, Building2, User as UserIcon, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_app/goals/")({ component: GoalsHub });

type GoalRow = { id: string; scope: "team" | "department" | "individual"; owner_id: string | null };
type ProfileLite = { id: string; full_name: string | null; email: string | null };

function GoalsHub() {
  const { isVp, isAdmin, user } = useAuth();
  const canManageShared = isVp || isAdmin;

  const goalsQ = useQuery({
    queryKey: ["goals-summary"],
    queryFn: async () => {
      const { data } = await supabase.from("goals").select("id, scope, owner_id");
      return (data ?? []) as GoalRow[];
    },
  });

  const architectsQ = useQuery({
    enabled: canManageShared,
    queryKey: ["goals-architects"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "architect");
      const ids = (roles ?? []).map((r: any) => r.user_id);
      if (!ids.length) return [] as ProfileLite[];
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      return (data ?? []) as ProfileLite[];
    },
  });

  const counts = {
    team: (goalsQ.data ?? []).filter((g) => g.scope === "team").length,
    department: (goalsQ.data ?? []).filter((g) => g.scope === "department").length,
    individual: (goalsQ.data ?? []).filter(
      (g) => g.scope === "individual" && g.owner_id === user?.id,
    ).length,
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Goals</h1>
        <p className="text-sm text-muted-foreground">Plan, track, and review goals across the team.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {canManageShared && (
          <ScopeCard
            to="/goals/team"
            icon={<Users className="h-5 w-5" />}
            title="Team Goals"
            description="Shared goals for the whole team"
            count={counts.team}
          />
        )}
        {canManageShared && (
          <ScopeCard
            to="/goals/department"
            icon={<Building2 className="h-5 w-5" />}
            title="Department Goals"
            description="Department-level objectives"
            count={counts.department}
          />
        )}
        {!canManageShared && (
          <ScopeCard
            to="/goals/team"
            icon={<Users className="h-5 w-5" />}
            title="Team Goals"
            description="View team goals"
            count={counts.team}
          />
        )}
        <ScopeCard
          to="/goals/individual"
          icon={<Target className="h-5 w-5" />}
          title="My Goals"
          description="Your personal goals"
          count={counts.individual}
        />
      </div>

      {canManageShared && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Architects</h2>
            <span className="text-xs text-muted-foreground">Click to view their individual goals</span>
          </div>
          <Card className="divide-y">
            {(architectsQ.data ?? []).length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">No architects yet.</div>
            )}
            {(architectsQ.data ?? []).map((a) => {
              const count = (goalsQ.data ?? []).filter(
                (g) => g.scope === "individual" && g.owner_id === a.id,
              ).length;
              return (
                <Link
                  key={a.id}
                  to="/goals/architects/$userId"
                  params={{ userId: a.id }}
                  className="flex items-center gap-3 p-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="h-9 w-9 rounded-full bg-muted grid place-items-center">
                    <UserIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{a.full_name || a.email}</div>
                    <div className="text-xs text-muted-foreground truncate">{a.email}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{count} goals</div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              );
            })}
          </Card>
        </section>
      )}
    </div>
  );
}

function ScopeCard({
  to,
  icon,
  title,
  description,
  count,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  count: number;
}) {
  return (
    <Link to={to} className="group">
      <Card className="p-5 h-full hover:shadow-md transition-all hover:-translate-y-0.5">
        <div className="flex items-start justify-between">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
            {icon}
          </div>
          <span className="text-2xl font-semibold tabular-nums">{count}</span>
        </div>
        <div className="mt-3 font-medium">{title}</div>
        <div className="text-xs text-muted-foreground mt-1">{description}</div>
      </Card>
    </Link>
  );
}
