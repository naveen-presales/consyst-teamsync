import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { notify, getVpAdminIds, getOppArchitectRecipients } from "@/lib/notify";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Plus, Search, Download, PauseCircle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_app/opportunities/")({ component: OppsPage });

type OppRow = {
  id: string; customer_name: string; project_name: string; crm_number: string;
  received_date: string | null; start_date: string | null; deadline: string | null; completed_date: string | null;
  opportunity_type: string; revision_count: number; status: string; created_by: string | null;
  phase1_completed_at: string | null; phase2_completed_at: string | null;
  phase3_completed_at: string | null; phase4_completed_at: string | null;
  on_hold: boolean;
  region: string | null;
  system_details: string | null;
  final_bom: string | null;
};

type Profile = { id: string; full_name: string | null; email: string | null };
type Role = { user_id: string; role: string };

function OppsPage() {
  const { user, isAdmin, isVp } = useAuth();
  const canAssign = isAdmin || isVp;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("all");

  const oppsQ = useQuery({
    queryKey: ["opps"],
    queryFn: async () => {
      const { data, error } = await supabase.from("opportunities").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as OppRow[];
    },
  });

  const assignsQ = useQuery({
    queryKey: ["opps-assigns"],
    enabled: canAssign,
    queryFn: async () => {
      const { data } = await supabase.from("opportunity_architects").select("opportunity_id, user_id");
      return (data ?? []) as { opportunity_id: string; user_id: string }[];
    },
  });

  const profilesQ = useQuery({
    queryKey: ["opps-profiles"],
    enabled: canAssign,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email");
      return (data ?? []) as Profile[];
    },
  });

  const archByOpp = (() => {
    const profMap = new Map((profilesQ.data ?? []).map((p) => [p.id, p.full_name || p.email || "Unknown"]));
    const m = new Map<string, string[]>();
    (assignsQ.data ?? []).forEach((a) => {
      const name = profMap.get(a.user_id) || "Unknown";
      const arr = m.get(a.opportunity_id) ?? [];
      arr.push(name);
      m.set(a.opportunity_id, arr);
    });
    return m;
  })();

  const filtered = (oppsQ.data ?? []).filter((o) => {
    if (statusF !== "all" && o.status !== statusF) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return o.customer_name.toLowerCase().includes(s) || o.project_name.toLowerCase().includes(s) || o.crm_number.toLowerCase().includes(s);
  });

  const exportCsv = () => {
    const headers = ["CRM", "Customer", "Project", "Region", "System Details", "Type", "Status", "Received", "Start", "Deadline", "Completed", "Revisions"];
    const rows = filtered.map((o) => [o.crm_number, o.customer_name, o.project_name, o.region ?? "", o.system_details ?? "", o.opportunity_type, o.status, o.received_date ?? "", o.start_date ?? "", o.deadline ?? "", o.completed_date ?? "", o.revision_count].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "opportunities.csv"; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Opportunities</h1>
          <p className="text-sm text-muted-foreground">
            {canAssign ? "Create opportunities and assign architects." : "Create and track your opportunities."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-1.5" /> CSV</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1.5" /> New opportunity</Button>
            </DialogTrigger>
            <CreateDialog
              canAssign={canAssign}
              userId={user!.id}
              onCreated={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["opps"] }); }}
            />
          </Dialog>
        </div>
      </header>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search customer, project, CRM…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusF} onValueChange={setStatusF}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="On Hold">On Hold</SelectItem>
            <SelectItem value="Submitted to Sales">Submitted to Sales</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="Closed Won">Closed Won</SelectItem>
            <SelectItem value="Closed Lost">Closed Lost</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">CRM</th>
                <th className="text-left px-4 py-2.5 font-medium">Customer</th>
                <th className="text-left px-4 py-2.5 font-medium">Project</th>
                <th className="text-left px-4 py-2.5 font-medium">Region</th>
                <th className="text-left px-4 py-2.5 font-medium">System Details</th>
                {canAssign && <th className="text-left px-4 py-2.5 font-medium">Architect</th>}
                <th className="text-left px-4 py-2.5 font-medium">Type</th>
                <th className="text-left px-4 py-2.5 font-medium">Deadline</th>
                <th className="text-left px-4 py-2.5 font-medium w-44">Progress</th>
                <th className="text-left px-4 py-2.5 font-medium">Rev</th>
                <th className="text-left px-4 py-2.5 font-medium w-40">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const done = [o.phase1_completed_at, o.phase2_completed_at, o.phase3_completed_at, o.phase4_completed_at].filter(Boolean).length;
                const pct = done * 25;
                const archs = archByOpp.get(o.id) ?? [];
                return (
                <tr key={o.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-mono text-xs">
                    <Link to="/opportunities/$id" params={{ id: o.id }} className="hover:underline">{o.crm_number}</Link>
                  </td>
                  <td className="px-4 py-2.5">{o.customer_name}</td>
                  <td className="px-4 py-2.5"><Link to="/opportunities/$id" params={{ id: o.id }} className="hover:underline">{o.project_name}</Link></td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{o.region || "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[220px] truncate" title={o.system_details ?? ""}>{o.system_details || "—"}</td>
                  {canAssign && (
                    <td className="px-4 py-2.5 text-xs">
                      {archs.length === 0 ? <span className="text-muted-foreground">Unassigned</span> : archs.join(", ")}
                    </td>
                  )}
                  <td className="px-4 py-2.5"><Badge variant="secondary">{o.opportunity_type}</Badge></td>
                  <td className="px-4 py-2.5">{o.deadline ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {o.on_hold ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 border border-amber-500/30">
                        <PauseCircle className="h-3 w-3" /> On Hold
                      </span>
                    ) : pct === 100 ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-success/15 text-success border border-success/30">
                        <CheckCircle2 className="h-3 w-3" /> 100%
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground tabular-nums w-9 text-right">{pct}%</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {o.revision_count > 2 ? (
                      <span className="inline-flex items-center gap-1 text-destructive font-medium">
                        <AlertTriangle className="h-3.5 w-3.5" />{o.revision_count}
                      </span>
                    ) : o.revision_count}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusSelect opp={o} />
                  </td>
                </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={canAssign ? 11 : 10} className="px-4 py-10 text-center text-muted-foreground text-sm">No opportunities yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

const STATUS_OPTIONS = ["Pending", "In Progress", "Completed", "Closed Won", "Closed Lost"] as const;

function StatusSelect({ opp }: { opp: OppRow }) {
  const qc = useQueryClient();
  const { user, isVp, isAdmin } = useAuth();
  const [value, setValue] = useState(opp.status);
  const onChange = async (v: string) => {
    const prev = value;
    setValue(v);
    const { error } = await supabase.from("opportunities").update({ status: v as any }).eq("id", opp.id);
    if (error) {
      setValue(prev);
      return toast.error(error.message);
    }
    toast.success("Status updated");

    if (user) {
      await supabase.from("opportunity_activity_log").insert({
        opportunity_id: opp.id, user_id: user.id, event_type: "status_change",
        message: `Status changed from ${prev} to ${v}`,
      });

      // Notify the other side
      const link = `/opportunities/${opp.id}`;
      const title = `Status changed: ${opp.project_name}`;
      const body = `${opp.crm_number} — ${prev} → ${v}`;
      if (isVp || isAdmin) {
        const archs = await getOppArchitectRecipients(opp.id, opp.created_by, user.id);
        if (archs.length) {
          await notify(archs.map((rid) => ({
            recipient_id: rid, actor_id: user.id, type: "opportunity_status_change",
            title, body, link, opportunity_id: opp.id,
          })));
        }
      } else {
        const vps = await getVpAdminIds(user.id);
        if (vps.length) {
          await notify(vps.map((rid) => ({
            recipient_id: rid, actor_id: user.id, type: "opportunity_status_change",
            title, body, link, opportunity_id: opp.id,
          })));
        }
      }
    }

    qc.invalidateQueries({ queryKey: ["opps"] });
    qc.invalidateQueries({ queryKey: ["opp", opp.id] });
    qc.invalidateQueries({ queryKey: ["opp-activity", opp.id] });
  };
  const inList = (STATUS_OPTIONS as readonly string[]).includes(value);
  return (
    <Select value={inList ? value : ""} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder={value || "Set status"} />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((s) => (
          <SelectItem key={s} value={s}>{s}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function CreateDialog({ canAssign, userId, onCreated }: { canAssign: boolean; userId: string; onCreated: () => void }) {
  const [form, setForm] = useState({
    customer_name: "", project_name: "", crm_number: "", region: "",
    end_user: "", domain: "",
    rfq_reading_hours: "", estimation_hours: "", opportunity_cost: "",
    received_date: "", start_date: "", deadline: "",
    opportunity_type: "Budgetary", status: "Pending",
    architect_id: "",
  });
  const [saving, setSaving] = useState(false);

  const architectsQ = useQuery({
    queryKey: ["architects-list"],
    enabled: canAssign,
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const archIds = (roles ?? []).filter((r: Role) => r.role === "architect").map((r: Role) => r.user_id);
      if (archIds.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email, status")
        .in("id", archIds)
        .eq("status", "approved");
      return (profs ?? []) as Profile[];
    },
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { architect_id, ...rest } = form;
    const payload: any = { ...rest, created_by: userId };
    Object.keys(payload).forEach((k) => { if (payload[k] === "") payload[k] = null; });
    ["rfq_reading_hours", "estimation_hours", "opportunity_cost"].forEach((k) => {
      if (payload[k] != null) payload[k] = Number(payload[k]);
    });
    const { data: opp, error } = await supabase.from("opportunities").insert(payload).select("id, project_name, customer_name, crm_number").single();
    if (error) {
      setSaving(false);
      const msg = /duplicate key|unique/i.test(error.message)
        ? `An opportunity with CRM number "${form.crm_number}" already exists.`
        : error.message;
      return toast.error(msg);
    }


    const assignTo = canAssign ? architect_id : userId;
    if (assignTo) {
      const { error: aerr } = await supabase.from("opportunity_architects").insert({ opportunity_id: opp.id, user_id: assignTo });
      if (aerr) { setSaving(false); return toast.error(aerr.message); }
    }

    // Notifications
    const link = `/opportunities/${opp.id}`;
    const title = `${opp.project_name} (${opp.crm_number})`;
    if (canAssign && assignTo && assignTo !== userId) {
      // VP/Admin assigned an opportunity to an architect
      await notify({
        recipient_id: assignTo, actor_id: userId, type: "opportunity_assigned",
        title: "New opportunity assigned to you", body: title, link, opportunity_id: opp.id,
      });
    } else if (!canAssign) {
      // Architect created an opportunity → notify VPs/Admins
      const vps = await getVpAdminIds(userId);
      if (vps.length) {
        await notify(vps.map((rid) => ({
          recipient_id: rid, actor_id: userId, type: "opportunity_created",
          title: "New opportunity added by architect", body: title, link, opportunity_id: opp.id,
        })));
      }
    }

    await supabase.from("opportunity_activity_log").insert({
      opportunity_id: opp.id, user_id: userId, event_type: "created",
      message: `Opportunity created${assignTo ? assignTo === userId ? " and self-assigned" : " and architect assigned" : ""}`,
    });

    setSaving(false);
    toast.success("Opportunity created");
    onCreated();
  };

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>New opportunity</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <Field label="Customer name" className="col-span-2"><Input required value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} /></Field>
        <Field label="Project name" className="col-span-2"><Input required value={form.project_name} onChange={(e) => set("project_name", e.target.value)} /></Field>
        <Field label="CRM number" className="col-span-2"><Input required value={form.crm_number} onChange={(e) => set("crm_number", e.target.value)} /></Field>
        <Field label="Region" className="col-span-2"><Input placeholder="e.g. North America, EMEA, Mumbai" value={form.region} onChange={(e) => set("region", e.target.value)} /></Field>
        <Field label="End user"><Input placeholder="End user / customer org" value={form.end_user} onChange={(e) => set("end_user", e.target.value)} /></Field>
        <Field label="Domain"><Input placeholder="e.g. Oil & Gas, Power" value={form.domain} onChange={(e) => set("domain", e.target.value)} /></Field>
        <Field label="RFQ reading (hrs)"><Input type="number" step="0.25" min={0} value={form.rfq_reading_hours} onChange={(e) => set("rfq_reading_hours", e.target.value)} /></Field>
        <Field label="Estimation (hrs)"><Input type="number" step="0.25" min={0} value={form.estimation_hours} onChange={(e) => set("estimation_hours", e.target.value)} /></Field>
        <Field label="Opportunity cost" className="col-span-2"><Input type="number" step="0.01" min={0} placeholder="Estimated value" value={form.opportunity_cost} onChange={(e) => set("opportunity_cost", e.target.value)} /></Field>
        {canAssign && (
          <Field label="Assign architect (optional)" className="col-span-2">
            <Select value={form.architect_id} onValueChange={(v) => set("architect_id", v)}>
              <SelectTrigger><SelectValue placeholder="Select architect…" /></SelectTrigger>
              <SelectContent>
                {(architectsQ.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <Field label="Type">
          <Select value={form.opportunity_type} onValueChange={(v) => set("opportunity_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Budgetary">Budgetary</SelectItem>
              <SelectItem value="JIH">JIH</SelectItem>
              <SelectItem value="Firm Budgetary">Firm Budgetary</SelectItem>
              <SelectItem value="Tender">Tender</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Status">
          <Select value={form.status} onValueChange={(v) => set("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Assigned date"><Input type="date" value={form.received_date} onChange={(e) => set("received_date", e.target.value)} /></Field>
        <Field label="Start"><Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} /></Field>
        <Field label="Deadline"><Input type="date" value={form.deadline} onChange={(e) => set("deadline", e.target.value)} /></Field>
        <DialogFooter className="col-span-2">
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
