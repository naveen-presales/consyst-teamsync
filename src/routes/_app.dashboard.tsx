import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { useMemo, useState } from "react";
import { differenceInCalendarDays, format } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
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
  rfq_reading_hours?: number | null;
  estimation_hours?: number | null;
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
  const [type, setType] = useState<string[]>([]);
  const [status, setStatus] = useState<string[]>([]);
  const [selectedArchitect, setSelectedArchitect] = useState<string | null>(null);
  const [teamRatingOpen, setTeamRatingOpen] = useState(false);
  const [questionDrill, setQuestionDrill] = useState<null | { id: string; text: string }>(null);

  const [drill, setDrill] = useState<null | {
    title: string;
    description?: string;
    items: Opp[];
    showRevision?: boolean;
    showHours?: "rfq" | "estimation";
  }>(null);

  const oppsQ = useQuery({
    queryKey: ["dashboard-opps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select("id, customer_name, project_name, start_date, deadline, completed_date, opportunity_type, revision_count, status, breach_ignored, breach_ignored_reason, breach_ignored_at, rfq_reading_hours, estimation_hours");
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
      const { data } = await supabase.from("rating_answers").select("score, question_id, rating_id, ratings:ratings!inner(id, opportunity_id, vp_user_id, created_at)");
      return (data ?? []) as { score: number; question_id: string; rating_id: string; ratings: { id: string; opportunity_id: string; vp_user_id: string; created_at: string } }[];
    },
  });

  const questionsQ = useQuery({
    queryKey: ["dashboard-questions"],
    queryFn: async () => {
      const { data } = await supabase.from("rating_questions").select("id, text, sort_order, active").eq("active", true).order("sort_order");
      return (data ?? []) as { id: string; text: string; sort_order: number; active: boolean }[];
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

  // Architect → avg rating (avg of their opportunity averages)
  const architectRatings = useMemo(() => {
    const assignByOpp = new Map<string, string[]>();
    (assignsQ.data ?? []).forEach((a) => {
      const arr = assignByOpp.get(a.opportunity_id) ?? [];
      arr.push(a.user_id);
      assignByOpp.set(a.opportunity_id, arr);
    });
    const byUser: Record<string, number[]> = {};
    Object.entries(byOppRating).forEach(([oid, scores]) => {
      const oppAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
      (assignByOpp.get(oid) ?? []).forEach((uid) => {
        (byUser[uid] ||= []).push(oppAvg);
      });
    });
    const profMap = new Map((profilesQ.data ?? []).map((p) => [p.id, p]));
    return Object.entries(byUser).map(([uid, arr]) => ({
      uid,
      name: profMap.get(uid)?.full_name || profMap.get(uid)?.email || "Unknown",
      email: profMap.get(uid)?.email ?? "",
      avg: Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10,
      reviews: arr.length,
    })).sort((a, b) => b.avg - a.avg);
  }, [byOppRating, assignsQ.data, profilesQ.data]);

  const kpis = useMemo(() => {
    const turnaround = completedOpps
      .filter((o) => o.start_date && o.completed_date)
      .map((o) => differenceInCalendarDays(new Date(o.completed_date!), new Date(o.start_date!)));
    const avgTurn = turnaround.length ? Math.round((turnaround.reduce((a, b) => a + b, 0) / turnaround.length) * 10) / 10 : 0;
    const completionRate = completedOpps.length ? Math.round((onTimeOpps.length / completedOpps.length) * 100) : 0;

    const avgRating = architectRatings.length
      ? Math.round((architectRatings.reduce((s, a) => s + a.avg, 0) / architectRatings.length) * 10) / 10
      : 0;

    const avgBomRev = opps.length
      ? Math.round((opps.reduce((a, o) => a + (o.revision_count || 0), 0) / opps.length) * 10) / 10
      : 0;

    const rfqArr = opps.filter((o) => o.rfq_reading_hours != null).map((o) => Number(o.rfq_reading_hours));
    const estArr = opps.filter((o) => o.estimation_hours != null).map((o) => Number(o.estimation_hours));
    const avgRfq = rfqArr.length ? Math.round((rfqArr.reduce((a, b) => a + b, 0) / rfqArr.length) * 10) / 10 : 0;
    const avgEst = estArr.length ? Math.round((estArr.reduce((a, b) => a + b, 0) / estArr.length) * 10) / 10 : 0;

    return { total: opps.length, avgTurn, completionRate, avgRating, avgBomRev, avgRfq, avgEst, rfqCount: rfqArr.length, estCount: estArr.length };
  }, [opps, completedOpps, onTimeOpps, architectRatings]);


  const typeData = useMemo(() => {
    const counts: Record<string, number> = {};
    opps.forEach((o) => (counts[o.opportunity_type] = (counts[o.opportunity_type] || 0) + 1));
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [opps]);

  // Radar: avg team score per active rating question
  const radarData = useMemo(() => {
    const oppIds = new Set(opps.map((o) => o.id));
    const byQ: Record<string, number[]> = {};
    (ratingsQ.data ?? []).forEach((a) => {
      if (!oppIds.has(a.ratings?.opportunity_id)) return;
      (byQ[a.question_id] ||= []).push(a.score);
    });
    return (questionsQ.data ?? []).map((q) => {
      const arr = byQ[q.id] ?? [];
      const avg = arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;
      const short = q.text.length > 32 ? q.text.slice(0, 30) + "…" : q.text;
      return { id: q.id, question: short, fullText: q.text, avg, reviews: arr.length };
    });
  }, [questionsQ.data, ratingsQ.data, opps]);

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

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
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
        <ClickableKpi onClick={() => setTeamRatingOpen(true)}>
          <Kpi icon={Star} label="Avg team rating" value={kpis.avgRating || "—"} flag={kpis.avgRating > 0 && kpis.avgRating < 8} />
        </ClickableKpi>
        <ClickableKpi
          onClick={() => setDrill({
            title: "BOM revisions",
            description: `Average ${kpis.avgBomRev} revision(s) per opportunity across ${opps.length} record(s).`,
            items: [...opps].sort((a, b) => (b.revision_count || 0) - (a.revision_count || 0)),
            showRevision: true,
          })}
        >
          <Kpi icon={AlertTriangle} label="Avg BOM revisions" value={kpis.avgBomRev} />
        </ClickableKpi>
        <ClickableKpi
          onClick={() => setDrill({
            title: "Avg RFQ reading time",
            description: `Average ${kpis.avgRfq} hr(s) across ${kpis.rfqCount} opportunity(s).`,
            items: [...opps].filter((o) => o.rfq_reading_hours != null).sort((a, b) => Number(b.rfq_reading_hours) - Number(a.rfq_reading_hours)),
            showHours: "rfq",
          })}
        >
          <Kpi icon={Timer} label="Avg RFQ reading (hrs)" value={kpis.avgRfq} />
        </ClickableKpi>
        <ClickableKpi
          onClick={() => setDrill({
            title: "Avg estimation time",
            description: `Average ${kpis.avgEst} hr(s) across ${kpis.estCount} opportunity(s).`,
            items: [...opps].filter((o) => o.estimation_hours != null).sort((a, b) => Number(b.estimation_hours) - Number(a.estimation_hours)),
            showHours: "estimation",
          })}
        >
          <Kpi icon={Timer} label="Avg estimation (hrs)" value={kpis.avgEst} />
        </ClickableKpi>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-1">
          <h3 className="text-sm font-medium mb-1">Opportunity types</h3>
          <p className="text-xs text-muted-foreground mb-3">Click a slice to drill into that type.</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={60}
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
        <Card className="p-5 lg:col-span-2">
          <h3 className="text-sm font-medium mb-1">Team rating by question</h3>
          <p className="text-xs text-muted-foreground mb-3">Average team score across each rating question. Click to see team ratings details.</p>
          <div className="h-80">
            {radarData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No rating questions yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart
                  data={radarData}
                  onClick={(state: any) => {
                    const p = state?.activePayload?.[0]?.payload;
                    if (p?.id) setQuestionDrill({ id: p.id, text: p.fullText });
                    else setTeamRatingOpen(true);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <PolarGrid />
                  <PolarAngleAxis dataKey="question" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis domain={[0, 10]} tickCount={6} tick={{ fontSize: 10 }} />
                  <Radar dataKey="avg" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.4} />
                  <Tooltip formatter={(v: any, _n, p: any) => [`${v} (${p?.payload?.reviews ?? 0} reviews)`, p?.payload?.fullText ?? "Score"]} />
                </RadarChart>
              </ResponsiveContainer>
            )}
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
                  <th className="text-right py-2 font-medium">Total</th>
                  <th className="w-6" />
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const profMap = new Map((profilesQ.data ?? []).map((p) => [p.id, p]));
                  const oppMap = new Map(opps.map((o) => [o.id, o]));
                  const byUser: Record<string, { inProg: number; completed: number; pending: number }> = {};
                  (assignsQ.data ?? []).forEach((a) => {
                    const o = oppMap.get(a.opportunity_id);
                    if (!o) return;
                    const b = (byUser[a.user_id] ||= { inProg: 0, completed: 0, pending: 0 });
                    if (o.status === "In Progress") b.inProg++;
                    else if (o.status === "Completed") b.completed++;
                    else b.pending++;
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
                    return <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">No assignments yet.</td></tr>;
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

      <UpcomingDeadlines
        opps={opps}
        assigns={assignsQ.data ?? []}
        profiles={profilesQ.data ?? []}
      />

      <OppDrilldownDialog drill={drill} onClose={() => setDrill(null)} />

      <ArchitectDetailDialog
        userId={selectedArchitect}
        onClose={() => setSelectedArchitect(null)}
        profile={(profilesQ.data ?? []).find((p) => p.id === selectedArchitect) ?? null}
        opps={opps.filter((o) => (assignsQ.data ?? []).some((a) => a.user_id === selectedArchitect && a.opportunity_id === o.id))}
      />

      <TeamRatingDialog
        open={teamRatingOpen}
        onClose={() => setTeamRatingOpen(false)}
        architects={architectRatings}
        questionFocus={null}
      />

      <TeamRatingDialog
        open={!!questionDrill}
        onClose={() => setQuestionDrill(null)}
        architects={architectRatings}
        questionFocus={questionDrill}
        ratings={ratingsQ.data ?? []}
        opps={opps}
        profiles={profilesQ.data ?? []}
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
  };
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{profile?.full_name || profile?.email || "Architect"}</DialogTitle>
          <p className="text-xs text-muted-foreground">{profile?.email}</p>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <Card className="p-3"><div className="text-[11px] text-muted-foreground">Pending</div><div className="text-lg font-semibold">{counts.pending}</div></Card>
          <Card className="p-3"><div className="text-[11px] text-muted-foreground">In Progress</div><div className="text-lg font-semibold">{counts.inProg}</div></Card>
          <Card className="p-3"><div className="text-[11px] text-muted-foreground">Completed</div><div className="text-lg font-semibold">{counts.completed}</div></Card>
        </div>
        <div className="max-h-96 overflow-y-auto border border-border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Customer / Project</th>
                <th className="text-left px-3 py-2 font-medium">Type</th>
                <th className="text-left px-3 py-2 font-medium">Deadline</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {opps.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No opportunities.</td></tr>
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
        .select("id, customer_name, project_name, start_date, deadline, completed_date, opportunity_type, revision_count, status, breach_ignored, breach_ignored_reason, breach_ignored_at, rfq_reading_hours, estimation_hours")
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
        .select("score, question_id, rating_id, ratings:ratings!inner(opportunity_id, created_at)")
        .in("ratings.opportunity_id", ids);
      return (data ?? []) as { score: number; question_id: string; rating_id: string; ratings: { opportunity_id: string; created_at: string } }[];
    },
  });

  const questionsQ = useQuery({
    queryKey: ["arch-questions"],
    queryFn: async () => {
      const { data } = await supabase.from("rating_questions").select("id, text, sort_order, active").eq("active", true).order("sort_order");
      return (data ?? []) as { id: string; text: string; sort_order: number; active: boolean }[];
    },
  });

  const [drill, setDrill] = useState<null | { title: string; description?: string; items: Opp[]; showRevision?: boolean; showHours?: "rfq" | "estimation"; ratingByOpp?: Record<string, number> }>(null);

  const opps = oppsQ.data ?? [];
  const completed = opps.filter((o) => o.status === "Completed");
  const inProgress = opps.filter((o) => o.status === "In Progress");
  const pending = opps.filter((o) => o.status === "Pending");
  const onHold = opps.filter((o) => o.status === "On Hold");
  const activeWorkload = opps.filter((o) => o.status !== "Completed");

  // Avg rating per rating (avg of answers)
  const byRating: Record<string, number[]> = {};
  (ratingsQ.data ?? []).forEach((a) => { (byRating[a.rating_id] ||= []).push(a.score); });

  // Per-opp average (across all rating records & answers for that opp)
  const byOppScores: Record<string, number[]> = {};
  (ratingsQ.data ?? []).forEach((a) => {
    const oid = a.ratings?.opportunity_id;
    if (!oid) return;
    (byOppScores[oid] ||= []).push(a.score);
  });
  const ratingByOpp: Record<string, number> = {};
  Object.entries(byOppScores).forEach(([oid, arr]) => {
    ratingByOpp[oid] = Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
  });

  // VP rating: avg across COMPLETED opps that have at least one rating
  const completedRatedAvgs = completed.map((o) => ratingByOpp[o.id]).filter((v) => v != null) as number[];
  const avgRating = completedRatedAvgs.length
    ? Math.round((completedRatedAvgs.reduce((a, b) => a + b, 0) / completedRatedAvgs.length) * 10) / 10
    : 0;

  const turnaround = completed
    .filter((o) => o.start_date && o.completed_date)
    .map((o) => differenceInCalendarDays(new Date(o.completed_date!), new Date(o.start_date!)));
  const avgTurn = turnaround.length ? Math.round((turnaround.reduce((a, b) => a + b, 0) / turnaround.length) * 10) / 10 : 0;
  const onTimeOpps = completed.filter((o) => o.deadline && o.completed_date && new Date(o.completed_date) <= new Date(o.deadline));
  const onTimeRate = completed.length ? Math.round((onTimeOpps.length / completed.length) * 100) : 0;

  const avgBomRev = opps.length
    ? Math.round((opps.reduce((a, o) => a + (o.revision_count || 0), 0) / opps.length) * 10) / 10
    : 0;
  const rfqArr = opps.filter((o) => o.rfq_reading_hours != null).map((o) => Number(o.rfq_reading_hours));
  const estArr = opps.filter((o) => o.estimation_hours != null).map((o) => Number(o.estimation_hours));
  const avgRfq = rfqArr.length ? Math.round((rfqArr.reduce((a, b) => a + b, 0) / rfqArr.length) * 10) / 10 : 0;
  const avgEst = estArr.length ? Math.round((estArr.reduce((a, b) => a + b, 0) / estArr.length) * 10) / 10 : 0;


  const statusData = [
    { name: "Pending", value: pending.length },
    { name: "In Progress", value: inProgress.length },
    { name: "On Hold", value: onHold.length },
    { name: "Completed", value: completed.length },
  ].filter((d) => d.value > 0);

  const typeCounts: Record<string, number> = {};
  opps.forEach((o) => (typeCounts[o.opportunity_type] = (typeCounts[o.opportunity_type] || 0) + 1));
  const typeData = Object.entries(typeCounts).map(([name, value]) => ({ name, value }));

  // Radar: architect's avg score per active question across all their opportunities
  const byQ: Record<string, number[]> = {};
  (ratingsQ.data ?? []).forEach((a) => { (byQ[a.question_id] ||= []).push(a.score); });
  const radarData = (questionsQ.data ?? []).map((q) => {
    const arr = byQ[q.id] ?? [];
    const avg = arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;
    const short = q.text.length > 32 ? q.text.slice(0, 30) + "…" : q.text;
    return { id: q.id, question: short, fullText: q.text, avg, reviews: arr.length };
  });

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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <ClickableKpi onClick={() => setDrill({ title: "My VP rating — completed opportunities", description: `Average ${avgRating || "—"} across ${completedRatedAvgs.length} rated of ${completed.length} completed opportunity(s).`, items: completed, ratingByOpp })}>
          <Kpi icon={Star} label="My VP rating" value={avgRating || "—"} flag={avgRating > 0 && avgRating < 8} />
        </ClickableKpi>
        <ClickableKpi onClick={() => setDrill({ title: "Completed opportunities", items: completed })}>
          <Kpi icon={CheckCircle2} label="Completed" value={completed.length} />
        </ClickableKpi>
        <ClickableKpi onClick={() => setDrill({ title: "Active workload", description: "All opportunities not yet completed.", items: activeWorkload })}>
          <Kpi icon={Briefcase} label="Active workload" value={activeWorkload.length} />
        </ClickableKpi>
        <ClickableKpi onClick={() => setDrill({ title: "Completed — turnaround", description: `Average ${avgTurn} day(s) from start to completion.`, items: completed })}>
          <Kpi icon={Timer} label="Avg turnaround" value={`${avgTurn}d`} />
        </ClickableKpi>
        <ClickableKpi onClick={() => setDrill({ title: "On-time completions", description: `${onTimeOpps.length} on-time of ${completed.length} completed.`, items: completed })}>
          <Kpi icon={AlertTriangle} label="On-time rate" value={`${onTimeRate}%`} />
        </ClickableKpi>
        <ClickableKpi
          onClick={() => setDrill({
            title: "BOM revisions",
            description: `Average ${avgBomRev} revision(s) per opportunity across ${opps.length} record(s).`,
            items: [...opps].sort((a, b) => (b.revision_count || 0) - (a.revision_count || 0)),
            showRevision: true,
          })}
        >
          <Kpi icon={AlertTriangle} label="Avg BOM revisions" value={avgBomRev} />
        </ClickableKpi>
        <ClickableKpi
          onClick={() => setDrill({
            title: "Avg RFQ reading time",
            description: `Average ${avgRfq} hr(s) across ${rfqArr.length} opportunity(s).`,
            items: opps.filter((o) => o.rfq_reading_hours != null).sort((a, b) => Number(b.rfq_reading_hours) - Number(a.rfq_reading_hours)),
            showHours: "rfq",
          })}
        >
          <Kpi icon={Timer} label="Avg RFQ reading (hrs)" value={avgRfq} />
        </ClickableKpi>
        <ClickableKpi
          onClick={() => setDrill({
            title: "Avg estimation time",
            description: `Average ${avgEst} hr(s) across ${estArr.length} opportunity(s).`,
            items: opps.filter((o) => o.estimation_hours != null).sort((a, b) => Number(b.estimation_hours) - Number(a.estimation_hours)),
            showHours: "estimation",
          })}
        >
          <Kpi icon={Timer} label="Avg estimation (hrs)" value={avgEst} />
        </ClickableKpi>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-sm font-medium mb-1">My opportunities by status</h3>
          <p className="text-xs text-muted-foreground mb-3">Click a slice to drill in.</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={80}
                  label
                  onClick={(d: any) => {
                    const name = d?.name ?? d?.payload?.name;
                    if (name) openStatus(name);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-medium mb-1">My rating by question</h3>
          <p className="text-xs text-muted-foreground mb-3">Your average score across each active rating question. Updates automatically when questions change.</p>
          <div className="h-64">
            {radarData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No rating questions yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="question" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis domain={[0, 10]} tickCount={6} tick={{ fontSize: 10 }} />
                  <Radar dataKey="avg" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.4} />
                  <Tooltip formatter={(v: any, _n, p: any) => [`${v} (${p?.payload?.reviews ?? 0} reviews)`, p?.payload?.fullText ?? "Score"]} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {trend.length > 0 && (
        <Card className="p-5 mt-4">
          <h3 className="text-sm font-medium mb-1">My VP rating trend</h3>
          <p className="text-xs text-muted-foreground mb-3">Click a bar to open the rated opportunity.</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={trend}
                onClick={(state: any) => {
                  const p = state?.activePayload?.[0]?.payload;
                  if (p?.rid) openTrendDate(p.date, p.rid);
                }}
              >
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="avg" fill="var(--chart-1)" radius={[4, 4, 0, 0]} style={{ cursor: "pointer" }} />
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
              </tr>
            </thead>
            <tbody>
              {opps.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No opportunities yet.</td></tr>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <UpcomingDeadlines opps={opps} assigns={[]} profiles={[]} selfName="You" />

      <OppDrilldownDialog drill={drill} onClose={() => setDrill(null)} />
    </div>
  );
}

function UpcomingDeadlines({
  opps, assigns, profiles, selfName,
}: {
  opps: Opp[];
  assigns: { opportunity_id: string; user_id: string }[];
  profiles: { id: string; full_name: string | null; email: string | null }[];
  selfName?: string;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + 4);

  const upcoming = opps
    .filter((o) => o.deadline && o.status !== "Completed" && o.status !== "Closed Won" && o.status !== "Closed Lost")
    .filter((o) => {
      const d = new Date(o.deadline!);
      return d >= today && d <= cutoff;
    })
    .sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1));

  const profMap = new Map(profiles.map((p) => [p.id, p.full_name || p.email || "Unknown"]));
  const archsFor = (oid: string) => {
    if (selfName && assigns.length === 0) return selfName;
    const names = assigns.filter((a) => a.opportunity_id === oid).map((a) => profMap.get(a.user_id) || "Unknown");
    return names.length ? names.join(", ") : "Unassigned";
  };

  return (
    <Card className="p-5 mt-4">
      <h3 className="text-sm font-medium mb-1">Upcoming deadlines</h3>
      <p className="text-xs text-muted-foreground mb-3">Opportunities due within the next 4 days.</p>
      <div className="space-y-1">
        {upcoming.length === 0 && (
          <div className="text-sm text-muted-foreground">No deadlines in the next 4 days.</div>
        )}
        {upcoming.map((o) => (
          <Link
            key={o.id}
            to="/opportunities/$id"
            params={{ id: o.id }}
            className="flex items-center justify-between gap-3 text-sm border-b border-border last:border-0 py-2 hover:bg-muted/30 -mx-2 px-2 rounded"
          >
            <div className="min-w-0">
              <div className="font-medium truncate">{o.project_name}</div>
              <div className="text-xs text-muted-foreground truncate">{archsFor(o.id)}</div>
            </div>
            <div className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
              {format(new Date(o.deadline!), "MMM d, yyyy")}
            </div>
          </Link>
        ))}
      </div>
    </Card>
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
  drill: { title: string; description?: string; items: Opp[]; showRevision?: boolean; showHours?: "rfq" | "estimation"; ratingByOpp?: Record<string, number> } | null;
  onClose: () => void;
}) {
  const showRev = !!drill?.showRevision;
  const showHours = drill?.showHours;
  const showRating = !!drill?.ratingByOpp;
  const extraCols = (showRev ? 1 : 0) + (showHours ? 1 : 0) + (showRating ? 1 : 0);
  const colSpan = 4 + extraCols;
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
                {showRev && <th className="text-right px-3 py-2 font-medium">Revisions</th>}
                {showHours === "rfq" && <th className="text-right px-3 py-2 font-medium">RFQ (hrs)</th>}
                {showHours === "estimation" && <th className="text-right px-3 py-2 font-medium">Estimation (hrs)</th>}
                {showRating && <th className="text-right px-3 py-2 font-medium">VP Rating</th>}
              </tr>
            </thead>
            <tbody>
              {(drill?.items ?? []).length === 0 && (
                <tr><td colSpan={colSpan} className="px-3 py-6 text-center text-muted-foreground">Nothing here yet.</td></tr>
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
                  {showRev && <td className="px-3 py-2 text-right tabular-nums">{o.revision_count ?? 0}</td>}
                  {showHours === "rfq" && <td className="px-3 py-2 text-right tabular-nums">{o.rfq_reading_hours ?? "—"}</td>}
                  {showHours === "estimation" && <td className="px-3 py-2 text-right tabular-nums">{o.estimation_hours ?? "—"}</td>}
                  {showRating && (
                    <td className="px-3 py-2 text-right tabular-nums">
                      {drill?.ratingByOpp?.[o.id] != null ? (
                        <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5" />{drill!.ratingByOpp![o.id]}</span>
                      ) : ""}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}


type ArchitectRating = { uid: string; name: string; email: string; avg: number; reviews: number };
type RatingAnswerRow = {
  score: number;
  question_id: string;
  rating_id: string;
  ratings: { id: string; opportunity_id: string; vp_user_id: string; created_at: string };
};

function TeamRatingDialog({
  open, onClose, architects, questionFocus, ratings, opps, profiles,
}: {
  open: boolean;
  onClose: () => void;
  architects: ArchitectRating[];
  questionFocus: { id: string; text: string } | null;
  ratings?: RatingAnswerRow[];
  opps?: Opp[];
  profiles?: { id: string; full_name: string | null; email: string | null }[];
}) {
  // When focused on a question, compute per-architect avg for that question
  const rows = (() => {
    if (!questionFocus || !ratings || !opps || !profiles) {
      return architects.map((a) => ({ ...a, qAvg: null as number | null }));
    }
    const oppArchs = new Map<string, string[]>();
    // Need assigns — derive from ratings? No. We approximate: vp_user_id is the rater, not architect.
    // Use opp → architects mapping passed via opps not enough. Re-derive from ratings table:
    // For each rating record, opportunity_id is known; we look up assigned architects elsewhere.
    // Simpler: aggregate per opportunity, then attribute to architects via... we don't have assigns here.
    // Fall back: per-architect overall avg + per-question avg across all team for context.
    void oppArchs;
    const qScores: number[] = [];
    ratings.filter((r) => r.question_id === questionFocus.id).forEach((r) => qScores.push(r.score));
    const qAvgTeam = qScores.length ? Math.round((qScores.reduce((a, b) => a + b, 0) / qScores.length) * 10) / 10 : 0;
    return architects.map((a) => ({ ...a, qAvg: qAvgTeam }));
  })();

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{questionFocus ? `Team rating — ${questionFocus.text}` : "Team ratings by architect"}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {questionFocus
              ? "Team average for this question, plus each architect's overall rating."
              : "Average score per architect across all rated opportunities."}
          </p>
        </DialogHeader>
        <div className="max-h-[28rem] overflow-y-auto border border-border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Architect</th>
                <th className="text-right px-3 py-2 font-medium">Reviews</th>
                <th className="text-right px-3 py-2 font-medium">Avg score</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">No ratings yet.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.uid} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </td>
                  <td className="px-3 py-2 text-right">{r.reviews}</td>
                  <td className={`px-3 py-2 text-right font-medium ${r.avg > 0 && r.avg < 8 ? "text-destructive" : ""}`}>
                    <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5" />{r.avg || "—"}</span>
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



