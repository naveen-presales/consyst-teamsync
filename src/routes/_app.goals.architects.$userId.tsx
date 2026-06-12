import { createFileRoute, Link, useParams, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User as UserIcon } from "lucide-react";
import { useMemo } from "react";
import {
  format,
  parseISO,
  startOfMonth,
  addMonths,
  isBefore,
  isEqual,
} from "date-fns";

export const Route = createFileRoute("/_app/goals/architects/$userId")({
  component: ArchitectGoalsPage,
});

type Measurement = "numeric" | "percentage" | "currency" | "boolean";
type Operator = "gte" | "gt" | "eq" | "lte" | "lt";

type Goal = {
  id: string;
  title: string;
  description: string | null;
  target_metric: string | null;
  measurement_type: Measurement;
  operator: Operator;
  target_value: number;
  due_date: string;
  start_date: string;
  duration: string | null;
};
type Progress = {
  id: string;
  goal_id: string;
  period_month: string;
  value: number;
  note: string | null;
};

const OP: Record<Operator, string> = {
  gte: "≥",
  gt: ">",
  eq: "=",
  lte: "≤",
  lt: "<",
};

const MEAS_LABEL: Record<Measurement, string> = {
  numeric: "Numeric",
  percentage: "Percentage",
  currency: "Currency",
  boolean: "Yes/No",
};

function fmt(v: number, m: Measurement) {
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
        .select("*")
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

      <div className="space-y-4">
        {(goalsQ.data ?? []).map((g) => (
          <ReadOnlyGoalCard
            key={g.id}
            goal={g}
            progress={(progressQ.data ?? []).filter((p) => p.goal_id === g.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ReadOnlyGoalCard({ goal, progress }: { goal: Goal; progress: Progress[] }) {
  const months = useMemo(() => {
    const start = startOfMonth(parseISO(goal.start_date));
    const end = startOfMonth(parseISO(goal.due_date));
    const out: Date[] = [];
    let cur = start;
    while (isBefore(cur, end) || isEqual(cur, end)) {
      out.push(cur);
      cur = addMonths(cur, 1);
      if (out.length > 36) break;
    }
    return out;
  }, [goal.start_date, goal.due_date]);

  const latest = progress
    .slice()
    .sort((a, b) => (a.period_month < b.period_month ? 1 : -1))[0];

  return (
    <Card className="overflow-hidden border-l-4 border-l-primary">
      <div className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-lg">{goal.title}</h3>
              <Badge variant="secondary">{MEAS_LABEL[goal.measurement_type]}</Badge>
            </div>
            {goal.description && (
              <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>
            )}
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground">Target</div>
            <div className="text-primary font-semibold">
              {OP[goal.operator]} {fmt(goal.target_value, goal.measurement_type)}
            </div>
            {goal.target_metric && (
              <div className="text-xs text-muted-foreground">{goal.target_metric}</div>
            )}
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground">Deadline</div>
            <div className="font-semibold">{format(parseISO(goal.due_date), "d MMM yy")}</div>
            {goal.duration && (
              <Badge variant="outline" className="mt-1 text-[10px]">
                {goal.duration}
              </Badge>
            )}
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground">Latest</div>
            <div className="font-semibold">
              {latest ? fmt(latest.value, goal.measurement_type) : "—"}
            </div>
          </div>
        </div>
      </div>
      <div className="border-t bg-muted/30 p-5">
        <div className="text-sm font-semibold mb-3">Monthly Progress</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {months.map((m) => {
            const iso = format(m, "yyyy-MM-dd");
            const entry = progress.find((p) => p.period_month === iso);
            return (
              <div key={iso} className="text-center">
                <div className="text-[11px] text-muted-foreground">{format(m, "MMM yyyy")}</div>
                <div
                  className="mt-1 w-full h-10 rounded-md border bg-background text-sm font-medium grid place-items-center"
                  title={entry?.note ?? ""}
                >
                  {entry ? fmt(entry.value, goal.measurement_type) : "—"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
