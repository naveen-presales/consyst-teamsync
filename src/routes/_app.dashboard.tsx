import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { useMemo, useState } from "react";
import { differenceInCalendarDays } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Briefcase, CheckCircle2, Timer, Star, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  breach_ignored?: boolean | null;
  breach_ignored_reason?: string | null;
  breach_ignored_at?: string | null;
};

function DashboardPage() {
  const { isAdmin, isVp, isArchitect, user } = useAuth();
  if (isArchitect && !isAdmin && !isVp && user) {
    return <ArchitectDashboard userId={user.id} />;
  }
  return <VpDashboard />;
}

function VpDashboard() {
  const { isAdmin, isVp } = useAuth();
  const [type, setType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [selectedArchitect, setSelectedArchitect] = useState<string | null>(null);

  const oppsQ = useQuery({
    queryKey: ["dashboard-opps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select("id, customer_name, project_name, start_date, deadline, completed_date, opportunity_type, revision_count, status, breach_ignored, breach_ignored_reason, breach_ignored_at");
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
        <p className="text-sm text-muted-foreground">Performance across all opportunities.</p>
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
          <h3 className="text-sm font-medium mb-3">Architect workload details</h3>
          <p className="text-xs text-muted-foreground mb-3">Click an architect to see their opportunities.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left py-2 font-medium">Architect</th>
                  <th className="text-left py-2 font-medium">Email</th>
                  <th className="text-right py-2 font-medium">Active</th>
                  <th className="text-right py-2 font-medium">In Progress</th>
                  <th className="text-right py-2 font-medium">Completed</th>
                  <th className="text-right py-2 font-medium">Breaches</th>
                  <th className="text-right py-2 font-medium">Total</th>
                  <th className="w-6" />
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const profMap = new Map((profilesQ.data ?? []).map((p) => [p.id, p]));
                  const oppMap = new Map(opps.map((o) => [o.id, o]));
                  const byUser: Record<string, { inProg: number; completed: number; pending: number; breaches: number }> = {};
                  (assignsQ.data ?? []).forEach((a) => {
                    const o = oppMap.get(a.opportunity_id);
                    if (!o) return;
                    const b = (byUser[a.user_id] ||= { inProg: 0, completed: 0, pending: 0, breaches: 0 });
                    if (o.status === "In Progress") b.inProg++;
                    else if (o.status === "Completed") b.completed++;
                    else b.pending++;
                    if (o.revision_count > 2) b.breaches++;
                  });
                  const rows = Object.entries(byUser).map(([uid, c]) => ({
                    uid,
                    name: profMap.get(uid)?.full_name || profMap.get(uid)?.email || "Unknown",
                    email: profMap.get(uid)?.email ?? "—",
                    active: c.pending + c.inProg,
                    ...c,
                    total: c.pending + c.inProg + c.completed,
                  })).sort((a, b) => b.active - a.active);

                  if (rows.length === 0) {
                    return <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">No assignments yet.</td></tr>;
                  }
                  return rows.map((r) => (
                    <tr
                      key={r.uid}
                      className="border-t border-border cursor-pointer hover:bg-muted/40"
                      onClick={() => setSelectedArchitect(r.uid)}
                    >
                      <td className="py-2.5 font-medium">{r.name}</td>
                      <td className="py-2.5 text-muted-foreground text-xs">{r.email}</td>
                      <td className="py-2.5 text-right">{r.active}</td>
                      <td className="py-2.5 text-right">{r.inProg}</td>
                      <td className="py-2.5 text-right">{r.completed}</td>
                      <td className={`py-2.5 text-right ${r.breaches > 0 ? "text-destructive font-medium" : ""}`}>{r.breaches}</td>
                      <td className="py-2.5 text-right font-semibold">{r.total}</td>
                      <td className="py-2.5 text-right text-muted-foreground"><ChevronRight className="h-4 w-4 inline" /></td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </Card>
      )}

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

      <ArchitectDetailDialog
        userId={selectedArchitect}
        onClose={() => setSelectedArchitect(null)}
        profile={(profilesQ.data ?? []).find((p) => p.id === selectedArchitect) ?? null}
        opps={opps.filter((o) => (assignsQ.data ?? []).some((a) => a.user_id === selectedArchitect && a.opportunity_id === o.id))}
      />
    </div>
  );
}

function ArchitectDetailDialog({
  userId, onClose, profile, opps,
}: {
  userId: string | null;
  onClose: () => void;
  profile: { id: string; full_name: string | null; email: string | null } | null;
  opps: Opp[];
}) {
  const open = !!userId;
  const counts = {
    pending: opps.filter((o) => o.status === "Pending").length,
    inProg: opps.filter((o) => o.status === "In Progress").length,
    completed: opps.filter((o) => o.status === "Completed").length,
    breaches: opps.filter((o) => o.revision_count > 2).length,
  };
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{profile?.full_name || profile?.email || "Architect"}</DialogTitle>
          <p className="text-xs text-muted-foreground">{profile?.email}</p>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-2 mb-3">
          <Card className="p-3"><div className="text-[11px] text-muted-foreground">Pending</div><div className="text-lg font-semibold">{counts.pending}</div></Card>
          <Card className="p-3"><div className="text-[11px] text-muted-foreground">In Progress</div><div className="text-lg font-semibold">{counts.inProg}</div></Card>
          <Card className="p-3"><div className="text-[11px] text-muted-foreground">Completed</div><div className="text-lg font-semibold">{counts.completed}</div></Card>
          <Card className="p-3"><div className="text-[11px] text-muted-foreground">Breaches</div><div className={`text-lg font-semibold ${counts.breaches > 0 ? "text-destructive" : ""}`}>{counts.breaches}</div></Card>
        </div>
        <div className="max-h-96 overflow-y-auto border border-border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Customer / Project</th>
                <th className="text-left px-3 py-2 font-medium">Type</th>
                <th className="text-left px-3 py-2 font-medium">Deadline</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-right px-3 py-2 font-medium">Rev</th>
              </tr>
            </thead>
            <tbody>
              {opps.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No opportunities.</td></tr>
              )}
              {opps.map((o) => (
                <tr key={o.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <Link to="/opportunities/$id" params={{ id: o.id }} onClick={onClose} className="hover:underline">
                      <div className="font-medium">{o.customer_name}</div>
                      <div className="text-xs text-muted-foreground">{o.project_name}</div>
                    </Link>
                  </td>
                  <td className="px-3 py-2"><Badge variant="secondary">{o.opportunity_type}</Badge></td>
                  <td className="px-3 py-2 text-xs">{o.deadline ?? "—"}</td>
                  <td className="px-3 py-2"><Badge variant={o.status === "Completed" ? "default" : "secondary"}>{o.status}</Badge></td>
                  <td className={`px-3 py-2 text-right ${o.revision_count > 2 ? "text-destructive font-medium" : ""}`}>{o.revision_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
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

function ArchitectDashboard({ userId }: { userId: string }) {
  // Opportunities assigned to this architect
  const assignsQ = useQuery({
    queryKey: ["arch-assigns", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("opportunity_architects")
        .select("opportunity_id")
        .eq("user_id", userId);
      return ((data ?? []) as { opportunity_id: string }[]).map((r) => r.opportunity_id);
    },
  });

  const oppsQ = useQuery({
    queryKey: ["arch-opps", userId, assignsQ.data?.length ?? 0],
    enabled: !!assignsQ.data,
    queryFn: async () => {
      const ids = assignsQ.data ?? [];
      if (ids.length === 0) return [] as Opp[];
      const { data } = await supabase
        .from("opportunities")
        .select("id, customer_name, project_name, start_date, deadline, completed_date, opportunity_type, revision_count, status, breach_ignored, breach_ignored_reason, breach_ignored_at")
        .in("id", ids);
      return (data ?? []) as Opp[];
    },
  });

  const ratingsQ = useQuery({
    queryKey: ["arch-ratings", userId, assignsQ.data?.length ?? 0],
    enabled: !!assignsQ.data,
    queryFn: async () => {
      const ids = assignsQ.data ?? [];
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from("rating_answers")
        .select("score, rating_id, ratings:ratings!inner(opportunity_id, created_at)")
        .in("ratings.opportunity_id", ids);
      return (data ?? []) as { score: number; rating_id: string; ratings: { opportunity_id: string; created_at: string } }[];
    },
  });

  const opps = oppsQ.data ?? [];
  const completed = opps.filter((o) => o.status === "Completed" || o.status === "Submitted to Sales");
  const inProgress = opps.filter((o) => o.status === "In Progress");
  const pending = opps.filter((o) => o.status === "Pending");
  const onHold = opps.filter((o) => o.status === "On Hold");

  // Avg rating per rating (avg of answers), then avg across ratings
  const byRating: Record<string, number[]> = {};
  (ratingsQ.data ?? []).forEach((a) => { (byRating[a.rating_id] ||= []).push(a.score); });
  const ratingAvgs = Object.values(byRating).map((arr) => arr.reduce((a, b) => a + b, 0) / arr.length);
  const avgRating = ratingAvgs.length ? Math.round((ratingAvgs.reduce((a, b) => a + b, 0) / ratingAvgs.length) * 10) / 10 : 0;

  const turnaround = completed
    .filter((o) => o.start_date && o.completed_date)
    .map((o) => differenceInCalendarDays(new Date(o.completed_date!), new Date(o.start_date!)));
  const avgTurn = turnaround.length ? Math.round((turnaround.reduce((a, b) => a + b, 0) / turnaround.length) * 10) / 10 : 0;
  const onTime = completed.filter((o) => o.deadline && o.completed_date && new Date(o.completed_date) <= new Date(o.deadline)).length;
  const onTimeRate = completed.length ? Math.round((onTime / completed.length) * 100) : 0;

  const statusData = [
    { name: "Pending", value: pending.length },
    { name: "In Progress", value: inProgress.length },
    { name: "On Hold", value: onHold.length },
    { name: "Completed", value: completed.length },
  ].filter((d) => d.value > 0);

  const typeCounts: Record<string, number> = {};
  opps.forEach((o) => (typeCounts[o.opportunity_type] = (typeCounts[o.opportunity_type] || 0) + 1));
  const typeData = Object.entries(typeCounts).map(([name, value]) => ({ name, value }));

  // Rating trend over time (per rating, avg)
  const trend = Object.entries(byRating)
    .map(([rid, arr]) => {
      const meta = (ratingsQ.data ?? []).find((x) => x.rating_id === rid)?.ratings;
      return { date: meta?.created_at ?? "", avg: Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 };
    })
    .filter((d) => d.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ ...d, date: d.date.slice(0, 10) }));

  const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">My Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your personal performance and workload.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Kpi icon={Star} label="My VP rating" value={avgRating || "—"} flag={avgRating > 0 && avgRating < 4} />
        <Kpi icon={CheckCircle2} label="Completed" value={completed.length} />
        <Kpi icon={Briefcase} label="Active workload" value={inProgress.length + pending.length} />
        <Kpi icon={Timer} label="Avg turnaround" value={`${avgTurn}d`} />
        <Kpi icon={AlertTriangle} label="On-time rate" value={`${onTimeRate}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-sm font-medium mb-4">My opportunities by status</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" outerRadius={80} label>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-medium mb-4">By opportunity type</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {trend.length > 0 && (
        <Card className="p-5 mt-4">
          <h3 className="text-sm font-medium mb-4">My VP rating trend</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="avg" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card className="p-5 mt-4">
        <h3 className="text-sm font-medium mb-3">My opportunities</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left py-2 font-medium">Customer / Project</th>
                <th className="text-left py-2 font-medium">Type</th>
                <th className="text-left py-2 font-medium">Deadline</th>
                <th className="text-left py-2 font-medium">Status</th>
                <th className="text-right py-2 font-medium">Rev</th>
              </tr>
            </thead>
            <tbody>
              {opps.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No opportunities yet.</td></tr>
              )}
              {opps.map((o) => (
                <tr key={o.id} className="border-t border-border hover:bg-muted/30">
                  <td className="py-2.5">
                    <Link to="/opportunities/$id" params={{ id: o.id }} className="hover:underline">
                      <div className="font-medium">{o.customer_name}</div>
                      <div className="text-xs text-muted-foreground">{o.project_name}</div>
                    </Link>
                  </td>
                  <td className="py-2.5"><Badge variant="secondary">{o.opportunity_type}</Badge></td>
                  <td className="py-2.5 text-xs">{o.deadline ?? "—"}</td>
                  <td className="py-2.5"><Badge variant={o.status === "Completed" ? "default" : "secondary"}>{o.status}</Badge></td>
                  <td className={`py-2.5 text-right ${o.revision_count > 2 ? "text-destructive font-medium" : ""}`}>{o.revision_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
