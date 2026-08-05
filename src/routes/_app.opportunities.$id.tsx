import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { notify, getVpAdminIds, getOppArchitectRecipients } from "@/lib/notify";
import { ArrowLeft, FileText, Plus, Save, Trash2, AlertTriangle, Star, CheckCircle2, Lock, Circle, PauseCircle, PlayCircle, RotateCcw } from "lucide-react";
import { PriorityBadge } from "@/components/PriorityBadge";
import { HoldDialog } from "@/components/HoldDialog";



export const Route = createFileRoute("/_app/opportunities/$id")({ component: OppDetail });

function OppDetail() {
  const { id } = useParams({ from: "/_app/opportunities/$id" });
  const { user, isAdmin, isVp } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);

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
    const prev = opp;
    const { error } = await supabase.from("opportunities").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    const fields = Object.keys(patch).join(", ");
    await logActivity(id, user!.id, "edit", `Updated: ${fields}`);

    // Notify on status change
    if (patch.status && patch.status !== prev.status) {
      const link = `/opportunities/${id}`;
      const title = `Status changed: ${prev.project_name}`;
      const body = `${prev.crm_number} — ${prev.status} → ${patch.status}`;
      if (isVp || isAdmin) {
        const archs = await getOppArchitectRecipients(id, prev.created_by, user!.id);
        if (archs.length) {
          await notify(archs.map((rid) => ({
            recipient_id: rid, actor_id: user!.id, type: "opportunity_status_change",
            title, body, link, opportunity_id: id,
          })));
        }
      } else {
        const vps = await getVpAdminIds(user!.id);
        if (vps.length) {
          await notify(vps.map((rid) => ({
            recipient_id: rid, actor_id: user!.id, type: "opportunity_status_change",
            title, body, link, opportunity_id: id,
          })));
        }
      }
    }

    qc.invalidateQueries({ queryKey: ["opp", id] });
    qc.invalidateQueries({ queryKey: ["opp-activity", id] });
    qc.invalidateQueries({ queryKey: ["opps"] });
  };

  const changeArchitect = async (newId: string): Promise<void> => {
    const profName = profilesQ.data?.find((p) => p.id === newId);
    const newName = profName?.full_name || profName?.email || "architect";
    const oldIds = assignedQ.data ?? [];

    // Remove all current architects
    if (oldIds.length) {
      const { error: delErr } = await supabase
        .from("opportunity_architects")
        .delete()
        .eq("opportunity_id", id);
      if (delErr) { toast.error(delErr.message); return; }
    }

    // Insert the new one
    const { error: insErr } = await supabase
      .from("opportunity_architects")
      .insert({ opportunity_id: id, user_id: newId });
    if (insErr) { toast.error(insErr.message); return; }

    const oldNames = oldIds
      .map((uid) => {
        const p = profilesQ.data?.find((pp) => pp.id === uid);
        return p?.full_name || p?.email || "Unknown";
      })
      .join(", ");
    await logActivity(
      id,
      user!.id,
      "architect_changed",
      oldIds.length ? `Reassigned from ${oldNames} to ${newName}` : `Assigned ${newName}`,
    );

    const link = `/opportunities/${id}`;
    const body = `${opp.project_name} (${opp.crm_number})`;
    // Notify old architects (excluding the new one and the actor)
    const toNotifyOld = oldIds.filter((uid) => uid !== newId && uid !== user!.id);
    if (toNotifyOld.length) {
      await notify(
        toNotifyOld.map((rid) => ({
          recipient_id: rid,
          actor_id: user!.id,
          type: "opportunity_unassigned",
          title: "Removed from opportunity",
          body,
          link,
          opportunity_id: id,
        })),
      );
    }
    // Notify new architect (if not the actor and not already assigned)
    if (newId !== user!.id && !oldIds.includes(newId)) {
      await notify({
        recipient_id: newId,
        actor_id: user!.id,
        type: "opportunity_assigned",
        title: "Opportunity assigned to you",
        body,
        link,
        opportunity_id: id,
      });
    }

    qc.invalidateQueries({ queryKey: ["opp-assigned", id] });
    qc.invalidateQueries({ queryKey: ["opp-activity", id] });
    qc.invalidateQueries({ queryKey: ["opps"] });
    qc.invalidateQueries({ queryKey: ["opps-assigns"] });
    toast.success("Architect updated");
  };

  const shareOpportunity = async (newId: string): Promise<void> => {
    const already = (assignedQ.data ?? []).includes(newId);
    if (already) {
      toast.info("This architect is already assigned.");
      return;
    }
    const { error: insErr } = await supabase
      .from("opportunity_architects")
      .insert({ opportunity_id: id, user_id: newId });
    if (insErr) { toast.error(insErr.message); return; }

    const profName = profilesQ.data?.find((p) => p.id === newId);
    const newName = profName?.full_name || profName?.email || "architect";
    await logActivity(id, user!.id, "architect_shared", `Shared with ${newName}`);

    if (newId !== user!.id) {
      await notify({
        recipient_id: newId,
        actor_id: user!.id,
        type: "opportunity_shared",
        title: "Opportunity shared with you",
        body: `${opp.project_name} (${opp.crm_number})`,
        link: `/opportunities/${id}`,
        opportunity_id: id,
      });
    }

    qc.invalidateQueries({ queryKey: ["opp-assigned", id] });
    qc.invalidateQueries({ queryKey: ["opp-activity", id] });
    qc.invalidateQueries({ queryKey: ["opps"] });
    qc.invalidateQueries({ queryKey: ["opps-assigns"] });
    toast.success(`Shared with ${newName}`);
  };



  const newDoc = async () => {
    const name = prompt("Document name:");
    if (!name) return;
    const { data, error } = await supabase.from("documents").insert({ opportunity_id: id, name, content: "", created_by: user!.id }).select().single();
    if (error) return toast.error(error.message);
    await logActivity(id, user!.id, "document_created", `Created document "${name}"`);
    await qc.invalidateQueries({ queryKey: ["docs", id] });
    qc.invalidateQueries({ queryKey: ["opp-activity", id] });
    setActiveDoc(data.id);
  };

  const deleteDoc = async (did: string) => {
    if (!confirm("Delete this document?")) return;
    const docName = docsQ.data?.find((d) => d.id === did)?.name ?? "document";
    await supabase.from("documents").delete().eq("id", did);
    await logActivity(id, user!.id, "document_deleted", `Deleted document "${docName}"`);
    qc.invalidateQueries({ queryKey: ["docs", id] });
    qc.invalidateQueries({ queryKey: ["opp-activity", id] });
    if (activeDoc === did) setActiveDoc(null);
  };

  const isManager = isVp || isAdmin;
  const progressPct = computeProgress(opp);

  const deleteOpportunity = async () => {
    setDeleting(true);
    try {
      const architectIds = assignedQ.data ?? [];
      const link = `/opportunities/${id}`;
      const body = `${opp.project_name} (${opp.crm_number})`;

      // Clean up rows without ON DELETE FKs first (best-effort).
      await supabase.from("notifications").delete().eq("opportunity_id", id);
      await supabase.from("opportunity_breach_history").delete().eq("opportunity_id", id);

      const { error } = await supabase.from("opportunities").delete().eq("id", id);
      if (error) { toast.error(error.message); setDeleting(false); return; }

      // Notify previously assigned architects (skip actor).
      const recipients = architectIds.filter((uid) => uid !== user!.id);
      if (recipients.length) {
        await notify(recipients.map((rid) => ({
          recipient_id: rid,
          actor_id: user!.id,
          type: "opportunity_deleted",
          title: "Opportunity deleted",
          body,
          link: null,
          opportunity_id: null,
        })));
      }

      toast.success("Opportunity deleted");
      qc.invalidateQueries({ queryKey: ["opps"] });
      qc.invalidateQueries({ queryKey: ["status-board"] });
      navigate({ to: "/opportunities" });
    } finally {
      setDeleting(false);
    }
  };

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
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">{opp.opportunity_type}</Badge>
            <Badge>{opp.status}</Badge>
            <PriorityBadge value={(opp as any).priority} />
            {isManager && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive" disabled={deleting}>
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    {deleting ? "Deleting…" : "Delete"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this opportunity?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The action is irreversible and deleted opportunity will not be restored.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteOpportunity}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
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
              <Select
                value={opp.status}
                onValueChange={(v) => { if (v === "On Hold") setDetailHoldOpen(true); else updateOpp({ status: v }); }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Waiting for Clarification">Waiting for Clarification</SelectItem>
                  <SelectItem value="On Hold">On Hold</SelectItem>
                  <SelectItem value="Reopened">Reopened</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Closed Won">Closed Won</SelectItem>
                  <SelectItem value="Closed Lost">Closed Lost</SelectItem>
                  <SelectItem value="Regret">Regret</SelectItem>
                </SelectContent>
              </Select>
              <HoldDialog open={detailHoldOpen} onOpenChange={setDetailHoldOpen} opp={opp} userId={user!.id} />
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
            <DetailField label="Priority">
              <Select value={(opp as any).priority ?? "Medium"} onValueChange={(v) => updateOpp({ priority: v } as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                </SelectContent>
              </Select>
            </DetailField>

            <DetailField label="Revisions">
              <Input
                type="number"
                value={opp.revision_count}
                disabled
                title="Revision count auto-increments only when a completed opportunity is sent back to Phase 3."
              />
            </DetailField>
            <DetailField label="Assigned date"><Input type="date" defaultValue={opp.received_date ?? ""} onBlur={(e) => updateOpp({ received_date: e.target.value || null })} /></DetailField>
            <DetailField label="Start"><Input type="date" defaultValue={opp.start_date ?? ""} onBlur={(e) => updateOpp({ start_date: e.target.value || null })} /></DetailField>
            <DetailField label="Deadline"><Input type="date" defaultValue={opp.deadline ?? ""} onBlur={(e) => updateOpp({ deadline: e.target.value || null })} /></DetailField>
            <DetailField label="Approx Submission"><Input type="date" defaultValue={(opp as any).approx_submission_date ?? ""} onBlur={(e) => updateOpp({ approx_submission_date: e.target.value || null } as any)} /></DetailField>
            <DetailField label="Completed"><Input type="date" defaultValue={opp.completed_date ?? ""} onBlur={(e) => updateOpp({ completed_date: e.target.value || null })} /></DetailField>
            <DetailField label="Region"><Input defaultValue={opp.region ?? ""} placeholder="e.g. EMEA" onBlur={(e) => updateOpp({ region: e.target.value || null })} /></DetailField>
            <DetailField label="End user"><Input defaultValue={opp.end_user ?? ""} placeholder="End user / customer org" onBlur={(e) => updateOpp({ end_user: e.target.value || null })} /></DetailField>
            <DetailField label="Domain"><Input defaultValue={opp.domain ?? ""} placeholder="e.g. Oil & Gas, Power" onBlur={(e) => updateOpp({ domain: e.target.value || null })} /></DetailField>
            <DetailField label="RFQ reading time (hours)"><Input type="number" step="0.25" min={0} defaultValue={opp.rfq_reading_hours ?? ""} onBlur={(e) => updateOpp({ rfq_reading_hours: e.target.value === "" ? null : Number(e.target.value) })} /></DetailField>
            <DetailField label="Estimation time (hours)"><Input type="number" step="0.25" min={0} defaultValue={opp.estimation_hours ?? ""} onBlur={(e) => updateOpp({ estimation_hours: e.target.value === "" ? null : Number(e.target.value) })} /></DetailField>
            <DetailField label="Opportunity cost"><Input type="number" step="0.01" min={0} defaultValue={opp.opportunity_cost ?? ""} placeholder="Estimated value" onBlur={(e) => updateOpp({ opportunity_cost: e.target.value === "" ? null : Number(e.target.value) })} /></DetailField>
            <DetailField label="Final BOM" className="md:col-span-2"><Input defaultValue={opp.final_bom ?? ""} placeholder="Paste BOM link or enter a number" onBlur={(e) => updateOpp({ final_bom: e.target.value || null })} /></DetailField>
            <DetailField label="Solution proposed" className="col-span-2 md:col-span-3">
              <Textarea defaultValue={opp.system_details ?? ""} placeholder="Brief description of the proposed solution" onBlur={(e) => updateOpp({ system_details: e.target.value || null })} />
            </DetailField>
          </Card>

          <Card className="p-5 mt-4">
            <h3 className="text-sm font-medium mb-3">Assigned Architect</h3>
            <ArchitectAssignment
              assignedIds={assignedQ.data ?? []}
              profiles={profilesQ.data ?? []}
              canManage={isManager}
              onChange={changeArchitect}
              onShare={shareOpportunity}
            />
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
              {(() => {
                const active = activeDoc ? docsQ.data?.find((d) => d.id === activeDoc) : null;
                return active ? <DocEditor key={active.id} doc={active} oppId={id} /> : <div className="text-sm text-muted-foreground">Select or create a document.</div>;
              })()}
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

    const link = `/opportunities/${opp.id}`;
    // Always notify VPs/admins on every phase completion
    const vps = await getVpAdminIds(userId);
    if (vps.length) {
      const title = idx === 3 ? "Opportunity submitted to sales" : `Phase ${idx + 1} completed`;
      const body = idx === 3
        ? `${opp.project_name} (${opp.crm_number}) — all phases complete`
        : `${opp.project_name} (${opp.crm_number}) — ${PHASES[idx].title}`;
      await notify(vps.map((rid) => ({
        recipient_id: rid, actor_id: userId, type: idx === 3 ? "opportunity_submitted" : "phase_completed",
        title, body, link, opportunity_id: opp.id,
      })));
    }
    // If a VP/Admin marked it complete, also notify assigned architects + creator
    const archs = await getOppArchitectRecipients(opp.id, opp.created_by, userId);
    if (archs.length) {
      await notify(archs.map((rid) => ({
        recipient_id: rid, actor_id: userId, type: "phase_completed",
        title: `Phase ${idx + 1} marked complete`,
        body: `${opp.project_name} (${opp.crm_number}) — ${PHASES[idx].title}`,
        link, opportunity_id: opp.id,
      })));
    }

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

    // Notify assigned architects (and the creator) about the revision
    const { data: assigned } = await supabase.from("opportunity_architects").select("user_id").eq("opportunity_id", opp.id);
    const recipientIds = new Set<string>();
    (assigned ?? []).forEach((r: any) => { if (r.user_id && r.user_id !== userId) recipientIds.add(r.user_id); });
    if (opp.created_by && opp.created_by !== userId) recipientIds.add(opp.created_by);
    if (recipientIds.size) {
      await notify(Array.from(recipientIds).map((rid) => ({
        recipient_id: rid, actor_id: userId, type: "opportunity_revision",
        title: "Revision required — back to Phase 3",
        body: `${opp.project_name} (${opp.crm_number}) was sent back for revision.`,
        link: `/opportunities/${opp.id}`, opportunity_id: opp.id,
      })));
    }

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
          {allDone && opp.phase4_completed_at && (
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

    const link = `/opportunities/${opp.id}`;
    const archs = await getOppArchitectRecipients(opp.id, opp.created_by, userId);
    const vps = await getVpAdminIds(userId);
    const recipients = Array.from(new Set([...archs, ...vps]));
    if (recipients.length) {
      await notify(recipients.map((rid) => ({
        recipient_id: rid, actor_id: userId, type: "opportunity_resumed",
        title: "Opportunity resumed",
        body: `${opp.project_name} (${opp.crm_number})`,
        link, opportunity_id: opp.id,
      })));
    }

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
  const userIds = Array.from(new Set((q.data ?? []).map((e) => e.user_id).filter(Boolean) as string[]));
  const profilesQ = useQuery({
    queryKey: ["activity-profiles", userIds.sort().join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
      const map: Record<string, string> = {};
      (data ?? []).forEach((p: any) => { map[p.id] = p.full_name || p.email || "Unknown"; });
      return map;
    },
  });
  const nameFor = (uid: string | null) => uid ? (profilesQ.data?.[uid] || "…") : "System";
  return (
    <Card className="p-5">
      <h3 className="text-sm font-medium mb-3">Activity log</h3>
      <div className="space-y-2">
        {(q.data ?? []).map((e) => (
          <div key={e.id} className="text-sm border-l-2 border-border pl-3 py-1">
            <div>{e.message || e.event_type}</div>
            <div className="text-xs text-muted-foreground">
              by <span className="font-medium text-foreground/80">{nameFor(e.user_id)}</span> · {new Date(e.created_at).toLocaleString()}
            </div>
          </div>
        ))}
        {q.data?.length === 0 && <div className="text-sm text-muted-foreground">No activity yet.</div>}
      </div>
    </Card>
  );
}

function DetailField({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-1.5 ${className}`}><Label className="text-xs">{label}</Label>{children}</div>;
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

    // Activity log + notify assigned architects/creator
    const { data: oppMeta } = await supabase
      .from("opportunities")
      .select("project_name, crm_number, created_by")
      .eq("id", oppId)
      .single();
    await supabase.from("opportunity_activity_log").insert({
      opportunity_id: oppId, user_id: user.id, event_type: "rating_submitted",
      message: myRating ? "Updated VP rating" : "Submitted VP rating",
    });
    if (oppMeta) {
      const archs = await getOppArchitectRecipients(oppId, oppMeta.created_by, user.id);
      if (archs.length) {
        await notify(archs.map((rid) => ({
          recipient_id: rid, actor_id: user.id, type: "rating_submitted",
          title: myRating ? "VP rating updated" : "New VP rating",
          body: `${oppMeta.project_name} (${oppMeta.crm_number})`,
          link: `/opportunities/${oppId}`, opportunity_id: oppId,
        })));
      }
    }

    qc.invalidateQueries({ queryKey: ["opp-ratings", oppId] });
    qc.invalidateQueries({ queryKey: ["opp-rating-answers", oppId] });
    qc.invalidateQueries({ queryKey: ["opp-activity", oppId] });
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
          <div className={`flex items-center gap-1 ${allAvg > 0 && allAvg < 8 ? "text-destructive" : ""}`}>
            <Star className="h-4 w-4" />
            <span className="text-2xl font-semibold">{allAvg || "—"}</span>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">{ratingsQ.data?.length || 0} VP review(s). Threshold: 8.0 / 10</div>
      </Card>

      {canRate ? (
        <Card className="p-5">
          <h3 className="text-sm font-medium mb-3">{myRating ? "Update your rating" : "Submit rating"}</h3>
          <div className="space-y-3">
            {qsQ.data?.map((q) => (
              <div key={q.id}>
                <Label className="text-xs">{q.text}</Label>
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
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

function ArchitectAssignment({
  assignedIds, profiles, canManage, onChange, onShare,
}: {
  assignedIds: string[];
  profiles: { id: string; full_name: string | null; email: string | null }[];
  canManage: boolean;
  onChange: (newId: string) => Promise<void>;
  onShare?: (newId: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<null | "change" | "share">(null);
  const [pick, setPick] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const current = assignedIds[0]
    ? profiles.find((p) => p.id === assignedIds[0]) ?? null
    : null;
  const assignedSet = new Set(assignedIds);
  const shareOptions = profiles.filter((p) => !assignedSet.has(p.id));

  const submit = async () => {
    if (!pick) return setMode(null);
    if (mode === "change") {
      if (pick === assignedIds[0]) return setMode(null);
      setSaving(true);
      await onChange(pick);
    } else if (mode === "share" && onShare) {
      setSaving(true);
      await onShare(pick);
    }
    setSaving(false);
    setMode(null);
    setPick("");
  };

  if (!mode) {
    return (
      <div className="space-y-2">
        {assignedIds.length === 0 ? (
          <div className="text-sm text-muted-foreground">No architect assigned.</div>
        ) : (
          <ul className="space-y-1">
            {assignedIds.map((uid) => {
              const p = profiles.find((pp) => pp.id === uid);
              return (
                <li key={uid} className="text-sm">
                  <div className="font-medium">{p?.full_name || p?.email || "Unknown"}</div>
                  {p?.email && <div className="text-xs text-muted-foreground">{p.email}</div>}
                </li>
              );
            })}
          </ul>
        )}
        {canManage && (
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => { setPick(assignedIds[0] ?? ""); setMode("change"); }}>
              {current ? "Change architect" : "Assign architect"}
            </Button>
            {onShare && current && (
              <Button size="sm" variant="outline" onClick={() => { setPick(""); setMode("share"); }}>
                Share opportunity
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  const options = mode === "share" ? shareOptions : profiles;

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium text-muted-foreground">
        {mode === "share" ? "Share with another architect" : "Change assigned architect"}
      </div>
      <Select value={pick} onValueChange={setPick}>
        <SelectTrigger><SelectValue placeholder="Select an architect…" /></SelectTrigger>
        <SelectContent>
          {options.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={saving || !pick}>
          {saving ? "Saving…" : mode === "share" ? "Confirm share" : "Save"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setMode(null); setPick(""); }} disabled={saving}>
          Cancel
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {mode === "share"
          ? "The opportunity will also appear in the selected architect's list, and they will be notified."
          : "The new architect will be notified, and the previous architect will be notified that they are no longer assigned."}
      </p>
    </div>
  );
}



function BreachPanel({ opp, canManage, userId }: { opp: any; canManage: boolean; userId: string }) {
  const qc = useQueryClient();

  const [mode, setMode] = useState<null | "ignore" | "restore">(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const ignoredByQ = useQuery({
    queryKey: ["profile-mini", opp.breach_ignored_by],
    enabled: !!opp.breach_ignored_by,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name, email").eq("id", opp.breach_ignored_by).single();
      return data as { full_name: string | null; email: string | null } | null;
    },
  });

  const historyQ = useQuery({
    queryKey: ["breach-history", opp.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("opportunity_breach_history")
        .select("id, action, reason, acted_at, acted_by, revision_count_at_action")
        .eq("opportunity_id", opp.id)
        .order("acted_at", { ascending: false });
      return (data ?? []) as { id: string; action: string; reason: string; acted_at: string; acted_by: string; revision_count_at_action: number }[];
    },
  });

  const actorIds = useMemo(() => Array.from(new Set((historyQ.data ?? []).map((h) => h.acted_by))), [historyQ.data]);
  const actorsQ = useQuery({
    queryKey: ["breach-actors", actorIds.join(",")],
    enabled: actorIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", actorIds);
      return (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
    },
  });
  const actorMap = new Map((actorsQ.data ?? []).map((a) => [a.id, a.full_name || a.email || "Unknown"]));

  const submit = async () => {
    if (reason.trim().length < 5) {
      toast.error("Please provide a reason (at least 5 characters)");
      return;
    }
    setBusy(true);
    try {
      const fn = mode === "ignore" ? "ignore_revision_breach" : "restore_revision_breach";
      const { error } = await supabase.rpc(fn, { _opp_id: opp.id, _reason: reason.trim() });
      if (error) throw error;
      toast.success(mode === "ignore" ? "Breach ignored" : "Breach restored");
      await logActivity(opp.id, userId, mode === "ignore" ? "breach_ignored" : "breach_restored", reason.trim());

      const archs = await getOppArchitectRecipients(opp.id, opp.created_by, userId);
      if (archs.length) {
        await notify(archs.map((rid) => ({
          recipient_id: rid, actor_id: userId,
          type: mode === "ignore" ? "breach_ignored" : "breach_restored",
          title: mode === "ignore" ? "Revision breach ignored" : "Revision breach restored",
          body: `${opp.project_name} (${opp.crm_number}) — ${reason.trim()}`,
          link: `/opportunities/${opp.id}`, opportunity_id: opp.id,
        })));
      }
      qc.invalidateQueries({ queryKey: ["opp", opp.id] });
      qc.invalidateQueries({ queryKey: ["breach-history", opp.id] });
      qc.invalidateQueries({ queryKey: ["opps"] });
      qc.invalidateQueries({ queryKey: ["dashboard-opps"] });
      setMode(null);
      setReason("");
    } catch (err: any) {
      toast.error(err?.message || "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={`mt-4 p-4 ${opp.breach_ignored ? "border-muted bg-muted/30" : "border-destructive/40 bg-destructive/5"}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <AlertTriangle className={`h-5 w-5 mt-0.5 ${opp.breach_ignored ? "text-muted-foreground" : "text-destructive"}`} />
          <div className="min-w-0">
            <div className="text-sm font-medium">
              {opp.breach_ignored ? "Revision breach ignored" : "Revision breach active"}
            </div>
            <div className="text-xs text-muted-foreground">
              {opp.revision_count} revisions (threshold: 2).
              {opp.breach_ignored && opp.breach_ignored_at && (
                <> Ignored by {ignoredByQ.data?.full_name || ignoredByQ.data?.email || "VP"} on {new Date(opp.breach_ignored_at).toLocaleString()}.</>
              )}
            </div>
            {opp.breach_ignored && opp.breach_ignored_reason && (
              <div className="text-xs mt-1.5 italic">"{opp.breach_ignored_reason}"</div>
            )}
          </div>
        </div>
        {canManage && (
          opp.breach_ignored ? (
            <Button size="sm" variant="outline" onClick={() => { setMode("restore"); setReason(""); }}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore breach
            </Button>
          ) : (
            <Button size="sm" variant="default" onClick={() => { setMode("ignore"); setReason(""); }}>
              Ignore breach
            </Button>
          )
        )}
      </div>

      {(historyQ.data?.length ?? 0) > 0 && (
        <details className="mt-3">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">History ({historyQ.data!.length})</summary>
          <ul className="mt-2 space-y-1.5">
            {historyQ.data!.map((h) => (
              <li key={h.id} className="text-xs border-l-2 border-border pl-2">
                <span className="font-medium capitalize">{h.action}</span> by {actorMap.get(h.acted_by) || "Unknown"} · {new Date(h.acted_at).toLocaleString()} · rev {h.revision_count_at_action}
                <div className="text-muted-foreground italic">"{h.reason}"</div>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Dialog open={!!mode} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === "ignore" ? "Ignore revision breach" : "Restore revision breach"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {mode === "ignore"
                ? "Provide a reason for ignoring this breach (e.g. customer-driven revisions). This will be retained in history for audit."
                : "Provide a reason for restoring this breach so it counts against the architect again."}
            </p>
            <div>
              <Label htmlFor="breach-reason" className="text-xs">Reason <span className="text-destructive">*</span></Label>
              <Textarea
                id="breach-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Customer changed scope after Phase 3 sign-off"
                rows={4}
                maxLength={1000}
                className="mt-1"
              />
              <div className="text-[10px] text-muted-foreground mt-1">{reason.length}/1000 · minimum 5 characters</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)} disabled={busy}>Cancel</Button>
            <Button onClick={submit} disabled={busy || reason.trim().length < 5}>
              {busy ? "Saving…" : (mode === "ignore" ? "Ignore breach" : "Restore breach")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

