import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User as UserIcon } from "lucide-react";
import { format, parseISO } from "date-fns";

export const Route = createFileRoute("/_app/goals/architects/$userId")({
  component: ArchitectGoalsPage,
});

type Goal = {
  id: string;
  title: string;
  description: string | null;
  measurement_type: "numeric" | "percentage" | "currency" | "boolean";
  operator: "gte" | "gt" | "eq" | "lte" | "lt";
  target_value: number;
  due_date: string;
  start_date: string;
};
type Progress = { goal_id: string; period_month: string; value: number };

const OP: Record<Goal["operator"], string> = {
  gte: "≥",
  gt: ">",
  eq: "=",
  lte: "≤",
  lt: "<",
};

function fmt(v: number, m: Goal["measurement_type"]) {
  if (m === "percentage") return `${v}%`;
  if (m === "currency") return `$${v.toLocaleString()}`;
  if (m === "boolean") return v ? "Yes" : "No";
  return String(v);
}

function ArchitectGoalsPage() {
  const { userId } = useParams({ from: "/_app/goals/architects/$userId" });
  const { isVp, isAdmin } = useAuth();

  const profileQ = useQuery({
    queryKey: ["architect-profile", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", userId)
        .maybeSingle();
      return data as { id: string; full_name: string | null; email: string | null } | null;
    },
  });

  const goalsQ = useQuery({
    queryKey: ["architect-goals", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("goals")
        .select("*")
        .eq("scope", "individual")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false });
      return (data ?? []) as Goal[];
    },
  });

  const ids = (goalsQ.data ?? []).map((g) => g.id);
  const progressQ = useQuery({
    enabled: ids.length > 0,
    queryKey: ["architect-progress", ids.join(",")],
    queryFn: async () => {
      const { data } = await supabase
        .from("goal_progress")
        .select("goal_id, period_month, value")
        .in("goal_id", ids);
      return (data ?? []) as Progress[];
    },
  });

  if (!isVp && !isAdmin) {
    return <div className="p-6 text-sm text-muted-foreground">VPs only.</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/goals">
            <ArrowLeft className="h-4 w-4" /> Goals
          </Link>
        </Button>
      </div>
      <header className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary/10 text-primary grid place-items-center">
          <UserIcon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {profileQ.data?.full_name || profileQ.data?.email || "Architect"}
          </h1>
          <p className="text-sm text-muted-foreground">Individual goals (view only)</p>
        </div>
      </header>

      {(goalsQ.data ?? []).length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          This architect has no individual goals yet.
        </Card>
      )}

      <div className="space-y-3">
        {(goalsQ.data ?? []).map((g) => {
          const entries = (progressQ.data ?? [])
            .filter((p) => p.goal_id === g.id)
            .sort((a, b) => (a.period_month < b.period_month ? 1 : -1));
          const latest = entries[0];
          return (
            <Card key={g.id} className="p-4 border-l-4 border-l-primary">
              <div className="flex flex-wrap items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{g.title}</h3>
                    <Badge variant="secondary">{g.measurement_type}</Badge>
                  </div>
                  {g.description && (
                    <p className="text-sm text-muted-foreground mt-1">{g.description}</p>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Target</div>
                  <div className="font-semibold text-primary">
                    {OP[g.operator]} {fmt(g.target_value, g.measurement_type)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Deadline</div>
                  <div className="font-semibold">{format(parseISO(g.due_date), "d MMM yy")}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Latest</div>
                  <div className="font-semibold">
                    {latest ? fmt(latest.value, g.measurement_type) : "—"}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
