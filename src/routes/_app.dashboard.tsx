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
import { isActiveBreach, isAnyBreach, isIgnoredBreach } from "@/lib/breaches";

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
  const [breachOpen, setBreachOpen] = useState(false);
  const [drill, setDrill] = useState<null | {
    title: string;
    description?: string;
    items: Opp[];
  }>(null);

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

  const completedOpps = useMemo(() => opps.filter((o) => o.status === "Completed"), [opps]);
  const onTimeOpps = useMemo(
    () => completedOpps.filter((o) => o.deadline && o.completed_date && new Date(o.completed_date) <= new Date(o.deadline)),
    [completedOpps],
  );
  const lateOpps = useMemo(
    () => completedOpps.filter((o) => o.deadline && o.completed_date && new Date(o.completed_date) > new Date(o.deadline)),
    [completedOpps],
  );

  const byOppRating = useMemo(() => {
    const byOpp: Record<string, number[]> = {};
    (ratingsQ.data ?? []).forEach((a) => {
      const oid = a.ratings?.opportunity_id;
      if (!oid) return;
      (byOpp[oid] ||= []).push(a.score);
    });
    return byOpp;
  }, [ratingsQ.data]);

  const ratedOpps = useMemo(
    () => opps.filter((o) => byOppRating[o.id]?.length),
    [opps, byOppRating],
  );

  const kpis = useMemo(() => {
    const turnaround = completedOpps
      .filter((o) => o.start_date && o.completed_date)
      .map((o) => differenceInCalendarDays(new Date(o.completed_date!), new Date(o.start_date!)));
    const avgTurn = turnaround.length ? Math.round((turnaround.reduce((a, b) => a + b, 0) / turnaround.length) * 10) / 10 : 0;
    const completionRate = completedOpps.length ? Math.round((onTimeOpps.length / completedOpps.length) * 100) : 0;
    const breaches = opps.filter(isActiveBreach).length;

    const oppAvgs = Object.values(byOppRating).map((arr) => arr.reduce((a, b) => a + b, 0) / arr.length);
    const avgRating = oppAvgs.length ? Math.round((oppAvgs.reduce((a, b) => a + b, 0) / oppAvgs.length) * 10) / 10 : 0;

    const avgBomRev = opps.length
      ? Math.round((opps.reduce((a, o) => a + (o.revision_count || 0), 0) / opps.length) * 10) / 10
      : 0;

    return { total: opps.length, avgTurn, completionRate, breaches, avgRating, avgBomRev };
  }, [opps, completedOpps, onTimeOpps, byOppRating]);

  const typeData = useMemo(() => {
    const counts: Record<string, number> = {};
    opps.forEach((o) => (counts[o.opportunity_type] = (counts[o.opportunity_type] || 0) + 1));
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [opps]);

  const workload = useMemo(() => {
    const byUser: Record<string, { count: number; uid: string }> = {};
    (assignsQ.data ?? []).forEach((a) => {
      if (opps.find((o) => o.id === a.opportunity_id)) {
        const v = (byUser[a.user_id] ||= { count: 0, uid: a.user_id });
        v.count += 1;
      }
    });
    const profMap = new Map((profilesQ.data ?? []).map((p) => [p.id, p.full_name || p.email || "Unknown"]));
    return Object.values(byUser).map((b) => ({ name: profMap.get(b.uid) || "Unknown", count: b.count, uid: b.uid })).sort((a, b) => b.count - a.count);
  }, [assignsQ.data, profilesQ.data, opps]);

  const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Performance across all opportunities. Click any tile or chart for details.</p>
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

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <ClickableKpi onClick={() => setDrill({ title: "All opportunities", items: opps })}>
          <Kpi icon={Briefcase} label="Opportunities" value={kpis.total} />
        </ClickableKpi>
        <ClickableKpi
          onClick={() => setDrill({
            title: "Completed opportunities — turnaround",
            description: `Average ${kpis.avgTurn} day(s) from start to completion.`,
            items: completedOpps,
          })}
        >
          <Kpi icon={Timer} label="Avg turnaround" value={`${kpis.avgTurn}d`} />
        </ClickableKpi>
        <ClickableKpi
          onClick={() => setDrill({
            title: "On-time completions",
            description: `${onTimeOpps.length} on-time, ${lateOpps.length} late of ${completedOpps.length} completed.`,
            items: completedOpps,
          })}
        >
          <Kpi icon={CheckCircle2} label="On-time rate" value={`${kpis.completionRate}%`} />
        </ClickableKpi>
        <ClickableKpi onClick={() => setBreachOpen(true)}>
          <Kpi icon={AlertTriangle} label="Revision breaches" value={kpis.breaches} flag={kpis.breaches > 0} />
        </ClickableKpi>
        <ClickableKpi
          onClick={() => setDrill({
            title: "Rated opportunities",
            description: `Average score ${kpis.avgRating || "—"} across ${ratedOpps.length} opportunity(s).`,
            items: ratedOpps,
          })}
        >
          <Kpi icon={Star} label="Avg VP rating" value={kpis.avgRating || "—"} flag={kpis.avgRating > 0 && kpis.avgRating < 4} />
        </ClickableKpi>
        <ClickableKpi
          onClick={() => setDrill({
            title: "BOM revisions",
            description: `Average ${kpis.avgBomRev} revision(s) per opportunity across ${opps.length} record(s).`,
            items: [...opps].sort((a, b) => (b.revision_count || 0) - (a.revision_count || 0)),
          })}
        >
          <Kpi icon={AlertTriangle} label="Avg BOM revisions" value={kpis.avgBomRev} flag={kpis.avgBomRev > 2} />
        </ClickableKpi>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-sm font-medium mb-1">Opportunity types</h3>
          <p className="text-xs text-muted-foreground mb-3">Click a slice to drill into that type.</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={80}
                  label
                  onClick={(d: any) => {
                    const name = d?.name ?? d?.payload?.name;
                    if (!name) return;
                    setDrill({ title: `Type: ${name}`, items: opps.filter((o) => o.opportunity_type === name) });
                  }}
                  style={{ cursor: "pointer" }}
                >
                  {typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-medium mb-1">Architect workload</h3>
          <p className="text-xs text-muted-foreground mb-3">Click a bar to see that architect's opportunities.</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={workload}
                onClick={(state: any) => {
                  const uid = state?.activePayload?.[0]?.payload?.uid;
                  if (uid) setSelectedArchitect(uid);
                }}
              >
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--chart-1)" radius={[4, 4, 0, 0]} style={{ cursor: "pointer" }} />
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
                    if (isActiveBreach(o)) b.breaches++;
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
          <h3 className="text-sm font-medium mb-3">Flagged opportunities (active)</h3>
          <div className="space-y-2">
            {opps.filter(isActiveBreach).map((o) => (
              <Link key={o.id} to="/opportunities/$id" params={{ id: o.id }} className="flex items-center justify-between text-sm border-b border-border last:border-0 py-2 hover:bg-muted/30 -mx-2 px-2 rounded">
                <div>
                  <div className="font-medium">{o.customer_name} — {o.project_name}</div>
                  <div className="text-xs text-muted-foreground">Revisions: {o.revision_count}</div>
                </div>
                <Badge variant="destructive">Active breach</Badge>
              </Link>
            ))}
            {opps.filter(isActiveBreach).length === 0 && (
              <div className="text-sm text-muted-foreground">No active breaches.</div>
            )}
          </div>
        </Card>
      )}

      <OppDrilldownDialog drill={drill} onClose={() => setDrill(null)} />

      <BreachDrilldownDialog open={breachOpen} onClose={() => setBreachOpen(false)} opps={opps} />


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
    breaches: opps.filter(isActiveBreach).length,
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
                  <td className={`px-3 py-2 text-right ${isActiveBreach(o) ? "text-destructive font-medium" : ""}`}>{o.revision_count}</td>
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

  const [drill, setDrill] = useState<null | { title: string; description?: string; items: Opp[] }>(null);

  const opps = oppsQ.data ?? [];
  const completed = opps.filter((o) => o.status === "Completed" || o.status === "Submitted to Sales");
  const inProgress = opps.filter((o) => o.status === "In Progress");
  const pending = opps.filter((o) => o.status === "Pending");
  const onHold = opps.filter((o) => o.status === "On Hold");
  const breaches = opps.filter(isActiveBreach);

  // Avg rating per rating (avg of answers), then avg across ratings
  const byRating: Record<string, number[]> = {};
  (ratingsQ.data ?? []).forEach((a) => { (byRating[a.rating_id] ||= []).push(a.score); });
  const ratingAvgs = Object.values(byRating).map((arr) => arr.reduce((a, b) => a + b, 0) / arr.length);
  const avgRating = ratingAvgs.length ? Math.round((ratingAvgs.reduce((a, b) => a + b, 0) / ratingAvgs.length) * 10) / 10 : 0;

  const ratedOppIds = new Set(
    (ratingsQ.data ?? []).map((a) => a.ratings?.opportunity_id).filter(Boolean) as string[],
  );
  const ratedOpps = opps.filter((o) => ratedOppIds.has(o.id));

  const turnaround = completed
    .filter((o) => o.start_date && o.completed_date)
    .map((o) => differenceInCalendarDays(new Date(o.completed_date!), new Date(o.start_date!)));
  const avgTurn = turnaround.length ? Math.round((turnaround.reduce((a, b) => a + b, 0) / turnaround.length) * 10) / 10 : 0;
  const onTimeOpps = completed.filter((o) => o.deadline && o.completed_date && new Date(o.completed_date) <= new Date(o.deadline));
  const onTimeRate = completed.length ? Math.round((onTimeOpps.length / completed.length) * 100) : 0;

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
      return { date: meta?.created_at ?? "", avg: Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10, rid };
    })
    .filter((d) => d.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ ...d, date: d.date.slice(0, 10) }));

  const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

  const openStatus = (name: string) => {
    const items =
      name === "Pending" ? pending :
      name === "In Progress" ? inProgress :
      name === "On Hold" ? onHold :
      name === "Completed" ? completed : [];
    setDrill({ title: `Status: ${name}`, items });
  };

  const openType = (name: string) => {
    setDrill({ title: `Type: ${name}`, items: opps.filter((o) => o.opportunity_type === name) });
  };

  const openTrendDate = (date: string, rid: string) => {
    const oid = (ratingsQ.data ?? []).find((x) => x.rating_id === rid)?.ratings?.opportunity_id;
    const items = oid ? opps.filter((o) => o.id === oid) : [];
    setDrill({ title: `Rating on ${date}`, items });
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">My Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your personal performance and workload. Click any tile or chart for details.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
        <ClickableKpi onClick={() => setDrill({ title: "My rated opportunities", description: `Average score ${avgRating || "—"} across ${ratedOpps.length} opportunity(s).`, items: ratedOpps })}>
          <Kpi icon={Star} label="My VP rating" value={avgRating || "—"} flag={avgRating > 0 && avgRating < 4} />
        </ClickableKpi>
        <ClickableKpi onClick={() => setDrill({ title: "Completed opportunities", items: completed })}>
          <Kpi icon={CheckCircle2} label="Completed" value={completed.length} />
        </ClickableKpi>
        <ClickableKpi onClick={() => setDrill({ title: "Active workload", description: "Pending + In Progress", items: [...pending, ...inProgress] })}>
          <Kpi icon={Briefcase} label="Active workload" value={inProgress.length + pending.length} />
        </ClickableKpi>
        <ClickableKpi onClick={() => setDrill({ title: "Completed — turnaround", description: `Average ${avgTurn} day(s) from start to completion.`, items: completed })}>
          <Kpi icon={Timer} label="Avg turnaround" value={`${avgTurn}d`} />
        </ClickableKpi>
        <ClickableKpi onClick={() => setDrill({ title: "On-time completions", description: `${onTimeOpps.length} on-time of ${completed.length} completed.`, items: completed })}>
          <Kpi icon={AlertTriangle} label="On-time rate" value={`${onTimeRate}%`} />
        </ClickableKpi>
      </div>

      {breaches.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <ClickableKpi onClick={() => setDrill({ title: "My active revision breaches", items: breaches })}>
            <Kpi icon={AlertTriangle} label="Active breaches" value={breaches.length} flag />
          </ClickableKpi>
        </div>
      )}

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
                  <td className={`py-2.5 text-right ${isActiveBreach(o) ? "text-destructive font-medium" : ""}`}>{o.revision_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function BreachDrilldownDialog({ open, onClose, opps }: { open: boolean; onClose: () => void; opps: Opp[] }) {
  const [tab, setTab] = useState<"total" | "active" | "ignored">("active");
  const total = opps.filter(isAnyBreach);
  const active = opps.filter(isActiveBreach);
  const ignored = opps.filter(isIgnoredBreach);
  const list = tab === "total" ? total : tab === "active" ? active : ignored;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Revision Breaches</DialogTitle>
          <p className="text-xs text-muted-foreground">Click a card to filter the list. Click an opportunity to open its details.</p>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <BreachStatCard label="Total Breaches" value={total.length} active={tab === "total"} onClick={() => setTab("total")} />
          <BreachStatCard label="Active Breaches" value={active.length} active={tab === "active"} danger onClick={() => setTab("active")} />
          <BreachStatCard label="Ignored Breaches" value={ignored.length} active={tab === "ignored"} onClick={() => setTab("ignored")} />
        </div>
        <div className="max-h-96 overflow-y-auto border border-border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Customer / Project</th>
                <th className="text-left px-3 py-2 font-medium">Type</th>
                <th className="text-right px-3 py-2 font-medium">Rev</th>
                <th className="text-left px-3 py-2 font-medium">State</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No breaches in this category.</td></tr>
              )}
              {list.map((o) => (
                <tr key={o.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <Link to="/opportunities/$id" params={{ id: o.id }} onClick={onClose} className="hover:underline">
                      <div className="font-medium">{o.customer_name}</div>
                      <div className="text-xs text-muted-foreground">{o.project_name}</div>
                    </Link>
                  </td>
                  <td className="px-3 py-2"><Badge variant="secondary">{o.opportunity_type}</Badge></td>
                  <td className="px-3 py-2 text-right font-medium">{o.revision_count}</td>
                  <td className="px-3 py-2">
                    {o.breach_ignored ? (
                      <span title={o.breach_ignored_reason ?? ""}>
                        <Badge variant="secondary">Ignored</Badge>
                      </span>
                    ) : (
                      <Badge variant="destructive">Active</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BreachStatCard({ label, value, active, danger, onClick }: { label: string; value: number; active: boolean; danger?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-3 rounded-md border transition-colors ${active ? "border-accent bg-accent/10" : "border-border hover:bg-muted/40"}`}
    >
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${danger && value > 0 ? "text-destructive" : ""}`}>{value}</div>
    </button>
  );
}

function ClickableKpi({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg transition-transform hover:-translate-y-0.5"
    >
      {children}
    </button>
  );
}

function OppDrilldownDialog({
  drill, onClose,
}: {
  drill: { title: string; description?: string; items: Opp[] } | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!drill} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{drill?.title ?? ""}</DialogTitle>
          {drill?.description && <p className="text-xs text-muted-foreground">{drill.description}</p>}
        </DialogHeader>
        <div className="max-h-[28rem] overflow-y-auto border border-border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Customer / Project</th>
                <th className="text-left px-3 py-2 font-medium">Type</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium">Deadline</th>
                <th className="text-right px-3 py-2 font-medium">Rev</th>
              </tr>
            </thead>
            <tbody>
              {(drill?.items ?? []).length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Nothing here yet.</td></tr>
              )}
              {(drill?.items ?? []).map((o) => (
                <tr key={o.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <Link to="/opportunities/$id" params={{ id: o.id }} onClick={onClose} className="hover:underline">
                      <div className="font-medium">{o.customer_name}</div>
                      <div className="text-xs text-muted-foreground">{o.project_name}</div>
                    </Link>
                  </td>
                  <td className="px-3 py-2"><Badge variant="secondary">{o.opportunity_type}</Badge></td>
                  <td className="px-3 py-2"><Badge variant={o.status === "Completed" ? "default" : "secondary"}>{o.status}</Badge></td>
                  <td className="px-3 py-2 text-xs">{o.deadline ?? "—"}</td>
                  <td className={`px-3 py-2 text-right ${isActiveBreach(o) ? "text-destructive font-medium" : ""}`}>{o.revision_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}


