import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotionEditor } from "@/components/NotionEditor";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, FileText, Plus, Save, Trash2, AlertTriangle, Star, CheckCircle2, Lock, Circle, PauseCircle, PlayCircle, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/_app/opportunities/$id")({ component: OppDetail });

function OppDetail() {
  const { id } = useParams({ from: "/_app/opportunities/$id" });
  const { user, isAdmin, isVp } = useAuth();
  const qc = useQueryClient();

  const oppQ = useQuery({
    queryKey: ["opp", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("opportunities").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const profilesQ = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email, status").eq("status", "approved");
      return (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
    },
  });

  const assignedQ = useQuery({
    queryKey: ["opp-assigned", id],
    queryFn: async () => {
      const { data } = await supabase.from("opportunity_architects").select("user_id").eq("opportunity_id", id);
      return ((data ?? []) as { user_id: string }[]).map((r) => r.user_id);
    },
  });

  const docsQ = useQuery({
    queryKey: ["docs", id],
    queryFn: async () => {
      const { data } = await supabase.from("documents").select("*").eq("opportunity_id", id).order("created_at");
      return (data ?? []) as { id: string; name: string; content: string }[];
    },
  });

  const [activeDoc, setActiveDoc] = useState<string | null>(null);
  useEffect(() => { if (!activeDoc && docsQ.data?.[0]) setActiveDoc(docsQ.data[0].id); }, [docsQ.data, activeDoc]);

  if (oppQ.isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!oppQ.data) return <div className="p-8 text-sm">Not found.</div>;
  const opp = oppQ.data;

  const updateOpp = async (patch: any) => {
    const { error } = await supabase.from("opportunities").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["opp", id] });
    qc.invalidateQueries({ queryKey: ["opps"] });
  };

  const toggleArchitect = async (uid: string, on: boolean) => {
    if (on) {
      const { error } = await supabase.from("opportunity_architects").insert({ opportunity_id: id, user_id: uid });
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("opportunity_architects").delete().eq("opportunity_id", id).eq("user_id", uid);
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["opp-assigned", id] });
  };

  const newDoc = async () => {
    const name = prompt("Document name:");
    if (!name) return;
    const { data, error } = await supabase.from("documents").insert({ opportunity_id: id, name, content: "", created_by: user!.id }).select().single();
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["docs", id] });
    setActiveDoc(data.id);
  };

  const deleteDoc = async (did: string) => {
    if (!confirm("Delete this document?")) return;
    await supabase.from("documents").delete().eq("id", did);
    qc.invalidateQueries({ queryKey: ["docs", id] });
    if (activeDoc === did) setActiveDoc(null);
  };

  const isManager = isVp || isAdmin;
  const progressPct = computeProgress(opp);

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <Link to="/opportunities" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> All opportunities
      </Link>

      <header className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{opp.project_name}</h1>
            <p className="text-sm text-muted-foreground">{opp.customer_name} · CRM <span className="font-mono">{opp.crm_number}</span></p>
          </div>
          <div className="flex items-center gap-2">
            {opp.revision_count > 2 && (
              <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Revision breach</Badge>
            )}
            <Badge variant="secondary">{opp.opportunity_type}</Badge>
            <Badge>{opp.status}</Badge>
          </div>
        </div>
      </header>

      {opp.on_hold && (
        <Card className="mb-4 p-4 border-amber-500/40 bg-amber-500/10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <PauseCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <div className="font-medium text-sm">On Hold</div>
                <div className="text-sm text-muted-foreground">{opp.hold_reason}</div>
                {opp.hold_started_at && <div className="text-xs text-muted-foreground mt-1">Since {new Date(opp.hold_started_at).toLocaleString()}</div>}
              </div>
            </div>
            <ResumeButton opp={opp} userId={user!.id} />
          </div>
        </Card>
      )}

      <PhaseTracker opp={opp} userId={user!.id} isManager={isManager} disabled={opp.on_hold} progressPct={progressPct} />

      <Tabs defaultValue="details" className="mt-6">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="docs">Documents</TabsTrigger>
          <TabsTrigger value="ratings">VP Ratings</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <Card className="p-5 grid grid-cols-2 md:grid-cols-3 gap-4">
            <DetailField label="Status">
              <Select value={opp.status} onValueChange={(v) => updateOpp({ status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </DetailField>
            <DetailField label="Type">
              <Select value={opp.opportunity_type} onValueChange={(v) => updateOpp({ opportunity_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Budgetary">Budgetary</SelectItem>
                  <SelectItem value="JIH">JIH</SelectItem>
                  <SelectItem value="Firm Budgetary">Firm Budgetary</SelectItem>
                  <SelectItem value="Tender">Tender</SelectItem>
                </SelectContent>
              </Select>
            </DetailField>
            <DetailField label="Revisions">
              {isManager ? (
                <Input type="number" min={0} defaultValue={opp.revision_count} onBlur={(e) => updateOpp({ revision_count: parseInt(e.target.value) || 0 })} />
              ) : (
                <Input type="number" value={opp.revision_count} disabled title="Only VP/Admin can edit revisions" />
              )}
            </DetailField>
            <DetailField label="Received"><Input type="date" defaultValue={opp.received_date ?? ""} onBlur={(e) => updateOpp({ received_date: e.target.value || null })} /></DetailField>
            <DetailField label="Start"><Input type="date" defaultValue={opp.start_date ?? ""} onBlur={(e) => updateOpp({ start_date: e.target.value || null })} /></DetailField>
            <DetailField label="Deadline"><Input type="date" defaultValue={opp.deadline ?? ""} onBlur={(e) => updateOpp({ deadline: e.target.value || null })} /></DetailField>
            <DetailField label="Completed"><Input type="date" defaultValue={opp.completed_date ?? ""} onBlur={(e) => updateOpp({ completed_date: e.target.value || null })} /></DetailField>
          </Card>

          <Card className="p-5 mt-4">
            <h3 className="text-sm font-medium mb-3">Assigned Architects</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {(profilesQ.data ?? []).map((p) => {
                const on = assignedQ.data?.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggleArchitect(p.id, !on)}
                    className={`text-left text-sm p-2.5 rounded-md border transition-colors ${on ? "border-accent bg-accent/10" : "border-border hover:bg-muted/50"}`}
                  >
                    <div className="font-medium truncate">{p.full_name || p.email}</div>
                    <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                  </button>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="docs" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
            <Card className="p-3">
              <Button size="sm" className="w-full mb-2" onClick={newDoc}><Plus className="h-4 w-4 mr-1.5" /> New document</Button>
              <div className="space-y-1">
                {(docsQ.data ?? []).map((d) => (
                  <div key={d.id} className={`group flex items-center gap-1.5 px-2 py-1.5 rounded text-sm cursor-pointer ${activeDoc === d.id ? "bg-accent/15 text-foreground" : "hover:bg-muted"}`} onClick={() => setActiveDoc(d.id)}>
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1">{d.name}</span>
                    <Trash2 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive" onClick={(e) => { e.stopPropagation(); deleteDoc(d.id); }} />
                  </div>
                ))}
                {(docsQ.data ?? []).length === 0 && <div className="text-xs text-muted-foreground p-2">No documents yet.</div>}
              </div>
            </Card>
            <Card className="p-5">
              {activeDoc ? <DocEditor key={activeDoc} doc={docsQ.data!.find((d) => d.id === activeDoc)!} oppId={id} /> : <div className="text-sm text-muted-foreground">Select or create a document.</div>}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ratings" className="mt-4">
          <RatingsPanel oppId={id} canRate={isVp} />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <ActivityPanel oppId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const PHASES = [
  { key: "phase1_completed_at", title: "Phase 1 — RFQ Review & Requirement Capture", desc: "Understand customer scope, constraints, and intent from the RFQ." },
  { key: "phase2_completed_at", title: "Phase 2 — Internal Brief & Go-Ahead", desc: "Summarise findings, present to Manager / Team Lead, receive go-ahead to proceed." },
  { key: "phase3_completed_at", title: "Phase 3 — Solution Design", desc: "Select PLC/system, build architecture, complete BOM." },
  { key: "phase4_completed_at", title: "Phase 4 — Review & Approval", desc: "Present to Manager / Team Lead for sign-off, then submit to sales team." },
] as const;

export function computeProgress(opp: any): number {
  return PHASES.filter((p) => opp[p.key]).length * 25;
}

function logActivity(oppId: string, userId: string, eventType: string, message: string) {
  return supabase.from("opportunity_activity_log").insert({ opportunity_id: oppId, user_id: userId, event_type: eventType, message });
}

function PhaseTracker({ opp, userId, isManager, disabled, progressPct }: { opp: any; userId: string; isManager: boolean; disabled: boolean; progressPct: number }) {
  const qc = useQueryClient();
  const [holdOpen, setHoldOpen] = useState(false);
  const completed = PHASES.map((p) => !!opp[p.key]);
  const activeIdx = completed.findIndex((c) => !c);
  const allDone = activeIdx === -1;

  const markComplete = async (idx: number) => {
    const patch: any = { [PHASES[idx].key]: new Date().toISOString() };
    if (idx === 3) patch.status = "Submitted to Sales";
    else if (opp.status === "Pending") patch.status = "In Progress";
    const { error } = await supabase.from("opportunities").update(patch).eq("id", opp.id);
    if (error) return toast.error(error.message);
    await logActivity(opp.id, userId, "phase_complete", `Marked ${PHASES[idx].title} complete`);
    qc.invalidateQueries({ queryKey: ["opp", opp.id] });
    qc.invalidateQueries({ queryKey: ["opp-activity", opp.id] });
    qc.invalidateQueries({ queryKey: ["opps"] });
  };

  const sendBackToPhase3 = async () => {
    if (!confirm("Send back to Phase 3 for revision? This will reset Phase 3 & 4 and increment the revision counter.")) return;
    const { error } = await supabase.from("opportunities").update({
      phase3_completed_at: null,
      phase4_completed_at: null,
      revision_count: (opp.revision_count || 0) + 1,
      status: "In Progress",
    }).eq("id", opp.id);
    if (error) return toast.error(error.message);
    await logActivity(opp.id, userId, "revision_requested", "Sent back to Phase 3 — revision required");
    qc.invalidateQueries({ queryKey: ["opp", opp.id] });
    qc.invalidateQueries({ queryKey: ["opp-activity", opp.id] });
    qc.invalidateQueries({ queryKey: ["opps"] });
    toast.success("Sent back to Phase 3");
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-medium">Workflow phases</h3>
          <div className="text-xs text-muted-foreground mt-0.5">{progressPct}% complete · {completed.filter(Boolean).length} of 4 phases</div>
        </div>
        <div className="flex gap-2">
          {!opp.on_hold && (
            <Button size="sm" variant="outline" onClick={() => setHoldOpen(true)}>
              <PauseCircle className="h-4 w-4 mr-1.5" /> On Hold
            </Button>
          )}
          {isManager && allDone && opp.phase4_completed_at && (
            <Button size="sm" variant="outline" onClick={sendBackToPhase3} disabled={disabled}>
              <RotateCcw className="h-4 w-4 mr-1.5" /> Send back to Phase 3
            </Button>
          )}
        </div>
      </div>

      <Progress value={progressPct} className="mb-5 h-1.5" />

      <ol className="space-y-3">
        {PHASES.map((p, idx) => {
          const isDone = completed[idx];
          const isActive = !isDone && idx === activeIdx;
          const isLocked = !isDone && !isActive;
          const ts = opp[p.key];
          return (
            <li key={p.key} className="flex gap-3">
              <div className="flex flex-col items-center pt-1">
                <span className={`flex items-center justify-center h-7 w-7 rounded-full border-2 ${isDone ? "border-primary bg-primary/10" : isActive ? "border-accent bg-accent/10" : "border-border bg-muted"}`}>
                  {isDone ? <CheckCircle2 className="h-4 w-4 text-primary" /> : isLocked ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : <Circle className="h-3 w-3 text-accent fill-accent" />}
                </span>
                {idx < PHASES.length - 1 && <span className="w-0.5 flex-1 bg-border mt-1 min-h-4" />}
              </div>
              <div className={`flex-1 rounded-md border p-3 ${isActive ? "border-accent bg-accent/5" : isDone ? "border-primary/30" : "opacity-60"}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{p.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{p.desc}</div>
                    {isDone && <div className="text-xs text-primary mt-1.5">Completed {new Date(ts).toLocaleString()}</div>}
                  </div>
                  {isActive && (
                    <Button size="sm" onClick={() => markComplete(idx)} disabled={disabled}>
                      Mark as Complete
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <HoldDialog open={holdOpen} onOpenChange={setHoldOpen} opp={opp} userId={userId} />
    </Card>
  );
}

function HoldDialog({ open, onOpenChange, opp, userId }: { open: boolean; onOpenChange: (o: boolean) => void; opp: any; userId: string }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return toast.error("Reason required");
    setSaving(true);
    const { error } = await supabase.from("opportunities").update({
      on_hold: true,
      hold_reason: reason.trim(),
      hold_started_at: new Date().toISOString(),
      pre_hold_status: opp.status,
      status: "On Hold",
    }).eq("id", opp.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    await logActivity(opp.id, userId, "on_hold", `Placed on hold: ${reason.trim()}`);
    qc.invalidateQueries({ queryKey: ["opp", opp.id] });
    qc.invalidateQueries({ queryKey: ["opp-activity", opp.id] });
    qc.invalidateQueries({ queryKey: ["opps"] });
    onOpenChange(false);
    setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Place opportunity on hold</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Label className="text-xs">Reason</Label>
          <Textarea required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Brief reason for hold…" />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Confirm hold"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResumeButton({ opp, userId }: { opp: any; userId: string }) {
  const qc = useQueryClient();
  const resume = async () => {
    const { error } = await supabase.from("opportunities").update({
      on_hold: false,
      hold_reason: null,
      hold_started_at: null,
      status: opp.pre_hold_status || "In Progress",
      pre_hold_status: null,
    }).eq("id", opp.id);
    if (error) return toast.error(error.message);
    await logActivity(opp.id, userId, "resumed", "Resumed from hold");
    qc.invalidateQueries({ queryKey: ["opp", opp.id] });
    qc.invalidateQueries({ queryKey: ["opp-activity", opp.id] });
    qc.invalidateQueries({ queryKey: ["opps"] });
  };
  return <Button size="sm" onClick={resume}><PlayCircle className="h-4 w-4 mr-1.5" /> Resume</Button>;
}

function ActivityPanel({ oppId }: { oppId: string }) {
  const q = useQuery({
    queryKey: ["opp-activity", oppId],
    queryFn: async () => {
      const { data } = await supabase.from("opportunity_activity_log").select("*").eq("opportunity_id", oppId).order("created_at", { ascending: false });
      return (data ?? []) as { id: string; event_type: string; message: string | null; created_at: string; user_id: string | null }[];
    },
  });
  return (
    <Card className="p-5">
      <h3 className="text-sm font-medium mb-3">Activity log</h3>
      <div className="space-y-2">
        {(q.data ?? []).map((e) => (
          <div key={e.id} className="text-sm border-l-2 border-border pl-3 py-1">
            <div>{e.message || e.event_type}</div>
            <div className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</div>
          </div>
        ))}
        {q.data?.length === 0 && <div className="text-sm text-muted-foreground">No activity yet.</div>}
      </div>
    </Card>
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}

function DocEditor({ doc, oppId }: { doc: { id: string; name: string; content: string }; oppId: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState(doc.name);
  const [content, setContent] = useState(doc.content);
  const timer = useRef<any>(null);

  useEffect(() => { setName(doc.name); setContent(doc.content); }, [doc.id]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (name === doc.name && content === doc.content) return;
      await supabase.from("documents").update({ name, content }).eq("id", doc.id);
      qc.invalidateQueries({ queryKey: ["docs", oppId] });
    }, 600);
    return () => clearTimeout(timer.current);
  }, [name, content]);

  return (
    <div className="space-y-2">
      <Input className="text-3xl font-bold border-0 px-0 focus-visible:ring-0 shadow-none h-auto py-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Untitled" />
      <NotionEditor value={content} onChange={setContent} placeholder="Write about the solution, meeting notes, decisions…" />
      <div className="text-xs text-muted-foreground flex items-center gap-1 pt-2"><Save className="h-3 w-3" /> Auto-saved</div>
    </div>
  );
}

function RatingsPanel({ oppId, canRate }: { oppId: string; canRate: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const qsQ = useQuery({
    queryKey: ["rating-questions"],
    queryFn: async () => {
      const { data } = await supabase.from("rating_questions").select("*").eq("active", true).order("sort_order");
      return (data ?? []) as { id: string; text: string }[];
    },
  });

  const ratingsQ = useQuery({
    queryKey: ["opp-ratings", oppId],
    queryFn: async () => {
      const { data } = await supabase.from("ratings").select("id, vp_user_id, notes, created_at").eq("opportunity_id", oppId);
      return (data ?? []) as { id: string; vp_user_id: string; notes: string | null; created_at: string }[];
    },
  });

  const answersQ = useQuery({
    queryKey: ["opp-rating-answers", oppId, ratingsQ.data?.map((r) => r.id).join(",")],
    enabled: !!ratingsQ.data && ratingsQ.data.length > 0,
    queryFn: async () => {
      const ids = ratingsQ.data!.map((r) => r.id);
      const { data } = await supabase.from("rating_answers").select("rating_id, question_id, score").in("rating_id", ids);
      return (data ?? []) as { rating_id: string; question_id: string; score: number }[];
    },
  });

  const myRating = ratingsQ.data?.find((r) => r.vp_user_id === user?.id);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (myRating && answersQ.data) {
      const init: Record<string, number> = {};
      answersQ.data.filter((a) => a.rating_id === myRating.id).forEach((a) => init[a.question_id] = a.score);
      setScores(init);
      setNotes(myRating.notes ?? "");
    }
  }, [myRating?.id, answersQ.data]);

  const submit = async () => {
    if (!user || !qsQ.data) return;
    if (qsQ.data.some((q) => !scores[q.id])) return toast.error("Rate all questions");
    let ratingId = myRating?.id;
    if (!ratingId) {
      const { data, error } = await supabase.from("ratings").insert({ opportunity_id: oppId, vp_user_id: user.id, notes }).select().single();
      if (error) return toast.error(error.message);
      ratingId = data.id;
    } else {
      await supabase.from("ratings").update({ notes }).eq("id", ratingId);
      await supabase.from("rating_answers").delete().eq("rating_id", ratingId);
    }
    const rows = qsQ.data.map((q) => ({ rating_id: ratingId!, question_id: q.id, score: scores[q.id] }));
    const { error } = await supabase.from("rating_answers").insert(rows);
    if (error) return toast.error(error.message);
    toast.success("Rating saved");
    qc.invalidateQueries({ queryKey: ["opp-ratings", oppId] });
    qc.invalidateQueries({ queryKey: ["opp-rating-answers", oppId] });
  };

  const allAvg = useMemo(() => {
    if (!answersQ.data?.length) return 0;
    const s = answersQ.data.reduce((a, b) => a + b.score, 0) / answersQ.data.length;
    return Math.round(s * 10) / 10;
  }, [answersQ.data]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">Average rating</h3>
          <div className={`flex items-center gap-1 ${allAvg > 0 && allAvg < 4 ? "text-destructive" : ""}`}>
            <Star className="h-4 w-4" />
            <span className="text-2xl font-semibold">{allAvg || "—"}</span>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">{ratingsQ.data?.length || 0} VP review(s). Threshold: 4.0</div>
      </Card>

      {canRate ? (
        <Card className="p-5">
          <h3 className="text-sm font-medium mb-3">{myRating ? "Update your rating" : "Submit rating"}</h3>
          <div className="space-y-3">
            {qsQ.data?.map((q) => (
              <div key={q.id}>
                <Label className="text-xs">{q.text}</Label>
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setScores((s) => ({ ...s, [q.id]: n }))}
                      className={`h-8 w-8 rounded text-sm font-medium border ${scores[q.id] === n ? "bg-accent text-accent-foreground border-accent" : "border-border hover:bg-muted"}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <Textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="text-sm" />
            <Button onClick={submit} className="w-full">{myRating ? "Update rating" : "Submit rating"}</Button>
          </div>
        </Card>
      ) : (
        <Card className="p-5 text-sm text-muted-foreground">Only VPs can submit ratings.</Card>
      )}
    </div>
  );
}
