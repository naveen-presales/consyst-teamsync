import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { useMemo, useState } from "react";
import { differenceInCalendarDays } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Briefcase, CheckCircle2, Timer, Star } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/dashboard")({ component: DashboardPage });

type Opp = {
  id: string;
  customer_name: string;
  project_name: string;
  start_date: string | null;
  deadline: string | null;
  completed_date: string | null;
  opportunity_type: string;
  revision_count: number;
  status: string;
};

function DashboardPage() {
  const { isAdmin, isVp } = useAuth();
  const [type, setType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const oppsQ = useQuery({
    queryKey: ["dashboard-opps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select("id, customer_name, project_name, start_date, deadline, completed_date, opportunity_type, revision_count, status");
      if (error) throw error;
      return data as Opp[];
    },
  });

  const assignsQ = useQuery({
    queryKey: ["dashboard-assigns"],
    queryFn: async () => {
      const { data, error } = await supabase.from("opportunity_architects").select("opportunity_id, user_id");
      if (error) throw error;
      return (data ?? []) as { opportunity_id: string; user_id: string }[];
    },
  });

  const profilesQ = useQuery({
    queryKey: ["dashboard-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email");
      return (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
    },
  });

  const ratingsQ = useQuery({
    queryKey: ["dashboard-ratings"],
    queryFn: async () => {
      const { data } = await supabase.from("rating_answers").select("score, rating_id, ratings:ratings!inner(opportunity_id)");
      return (data ?? []) as { score: number; rating_id: string; ratings: { opportunity_id: string } }[];
    },
  });

  const opps = useMemo(() => {
    let list = oppsQ.data ?? [];
    if (type !== "all") list = list.filter((o) => o.opportunity_type === type);
    if (status !== "all") list = list.filter((o) => o.status === status);
    return list;
  }, [oppsQ.data, type, status]);

  const kpis = useMemo(() => {
    const completed = opps.filter((o) => o.status === "Completed");
    const turnaround = completed
      .filter((o) => o.start_date && o.completed_date)
      .map((o) => differenceInCalendarDays(new Date(o.completed_date!), new Date(o.start_date!)));
    const avgTurn = turnaround.length ? Math.round((turnaround.reduce((a, b) => a + b, 0) / turnaround.length) * 10) / 10 : 0;
    const onTime = completed.filter((o) => o.deadline && o.completed_date && new Date(o.completed_date) <= new Date(o.deadline)).length;
    const completionRate = completed.length ? Math.round((onTime / completed.length) * 100) : 0;
    const breaches = opps.filter((o) => o.revision_count > 2).length;

    // Avg rating per opp
    const byOpp: Record<string, number[]> = {};
    (ratingsQ.data ?? []).forEach((a) => {
      const oid = a.ratings?.opportunity_id;
      if (!oid) return;
      (byOpp[oid] ||= []).push(a.score);
    });
    const oppAvgs = Object.values(byOpp).map((arr) => arr.reduce((a, b) => a + b, 0) / arr.length);
    const avgRating = oppAvgs.length ? Math.round((oppAvgs.reduce((a, b) => a + b, 0) / oppAvgs.length) * 10) / 10 : 0;

    return { total: opps.length, avgTurn, completionRate, breaches, avgRating };
  }, [opps, ratingsQ.data]);

  const typeData = useMemo(() => {
    const counts: Record<string, number> = {};
    opps.forEach((o) => (counts[o.opportunity_type] = (counts[o.opportunity_type] || 0) + 1));
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [opps]);

  const workload = useMemo(() => {
    const byUser: Record<string, number> = {};
    (assignsQ.data ?? []).forEach((a) => {
      if (opps.find((o) => o.id === a.opportunity_id)) byUser[a.user_id] = (byUser[a.user_id] || 0) + 1;
    });
    const profMap = new Map((profilesQ.data ?? []).map((p) => [p.id, p.full_name || p.email || "Unknown"]));
    return Object.entries(byUser).map(([id, count]) => ({ name: profMap.get(id) || "Unknown", count })).sort((a, b) => b.count - a.count);
  }, [assignsQ.data, profilesQ.data, opps]);

  const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Performance across all presales opportunities.</p>
      </header>

      <div className="flex gap-3 mb-6">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="Budgetary">Budgetary</SelectItem>
            <SelectItem value="JIH">JIH</SelectItem>
            <SelectItem value="Firm Budgetary">Firm Budgetary</SelectItem>
            <SelectItem value="Tender">Tender</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Kpi icon={Briefcase} label="Opportunities" value={kpis.total} />
        <Kpi icon={Timer} label="Avg turnaround" value={`${kpis.avgTurn}d`} />
        <Kpi icon={CheckCircle2} label="On-time rate" value={`${kpis.completionRate}%`} />
        <Kpi icon={AlertTriangle} label="Revision breaches" value={kpis.breaches} flag={kpis.breaches > 0} />
        <Kpi icon={Star} label="Avg VP rating" value={kpis.avgRating || "—"} flag={kpis.avgRating > 0 && kpis.avgRating < 4} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-sm font-medium mb-4">Opportunity types</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={typeData} dataKey="value" nameKey="name" outerRadius={80} label>
                  {typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-medium mb-4">Architect workload</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workload}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {(isAdmin || isVp) && (
        <Card className="p-5 mt-4">
          <h3 className="text-sm font-medium mb-3">Flagged opportunities</h3>
          <div className="space-y-2">
            {opps.filter((o) => o.revision_count > 2).map((o) => (
              <div key={o.id} className="flex items-center justify-between text-sm border-b border-border last:border-0 py-2">
                <div>
                  <div className="font-medium">{o.customer_name} — {o.project_name}</div>
                  <div className="text-xs text-muted-foreground">Revisions: {o.revision_count}</div>
                </div>
                <Badge variant="destructive">Breach</Badge>
              </div>
            ))}
            {opps.filter((o) => o.revision_count > 2).length === 0 && (
              <div className="text-sm text-muted-foreground">No breaches.</div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, flag }: { icon: any; label: string; value: any; flag?: boolean }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${flag ? "text-destructive" : "text-muted-foreground"}`} />
      </div>
      <div className={`mt-2 text-2xl font-semibold ${flag ? "text-destructive" : ""}`}>{value}</div>
    </Card>
  );
}
