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
import { toast } from "sonner";
import { AlertTriangle, Plus, Search, Download } from "lucide-react";

export const Route = createFileRoute("/_app/opportunities")({ component: OppsPage });

type OppRow = {
  id: string; customer_name: string; project_name: string; crm_number: string;
  received_date: string | null; start_date: string | null; deadline: string | null; completed_date: string | null;
  opportunity_type: string; revision_count: number; status: string; created_by: string | null;
};

function OppsPage() {
  const { user, isAdmin } = useAuth();
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

  const filtered = (oppsQ.data ?? []).filter((o) => {
    if (statusF !== "all" && o.status !== statusF) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return o.customer_name.toLowerCase().includes(s) || o.project_name.toLowerCase().includes(s) || o.crm_number.toLowerCase().includes(s);
  });

  const exportCsv = () => {
    const headers = ["CRM", "Customer", "Project", "Type", "Status", "Received", "Start", "Deadline", "Completed", "Revisions"];
    const rows = filtered.map((o) => [o.crm_number, o.customer_name, o.project_name, o.opportunity_type, o.status, o.received_date ?? "", o.start_date ?? "", o.deadline ?? "", o.completed_date ?? "", o.revision_count].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
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
          <p className="text-sm text-muted-foreground">All presales opportunities you have access to.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-1.5" /> CSV</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1.5" /> New opportunity</Button></DialogTrigger>
            <NewOppDialog onCreated={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["opps"] }); }} userId={user!.id} />
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
            <SelectItem value="Completed">Completed</SelectItem>
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
                <th className="text-left px-4 py-2.5 font-medium">Type</th>
                <th className="text-left px-4 py-2.5 font-medium">Deadline</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium">Rev</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-mono text-xs">
                    <Link to="/opportunities/$id" params={{ id: o.id }} className="hover:underline">{o.crm_number}</Link>
                  </td>
                  <td className="px-4 py-2.5">{o.customer_name}</td>
                  <td className="px-4 py-2.5"><Link to="/opportunities/$id" params={{ id: o.id }} className="hover:underline">{o.project_name}</Link></td>
                  <td className="px-4 py-2.5"><Badge variant="secondary">{o.opportunity_type}</Badge></td>
                  <td className="px-4 py-2.5">{o.deadline ?? "—"}</td>
                  <td className="px-4 py-2.5"><StatusBadge s={o.status} /></td>
                  <td className="px-4 py-2.5">
                    {o.revision_count > 2 ? (
                      <span className="inline-flex items-center gap-1 text-destructive font-medium">
                        <AlertTriangle className="h-3.5 w-3.5" />{o.revision_count}
                      </span>
                    ) : o.revision_count}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-sm">No opportunities yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = { Pending: "bg-muted text-muted-foreground", "In Progress": "bg-accent/15 text-accent-foreground border border-accent/30", Completed: "bg-success/15 text-success border border-success/30" };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs ${map[s] || "bg-muted"}`}>{s}</span>;
}

function NewOppDialog({ onCreated, userId }: { onCreated: () => void; userId: string }) {
  const [form, setForm] = useState({
    customer_name: "", project_name: "", crm_number: "",
    received_date: "", start_date: "", deadline: "", completed_date: "",
    opportunity_type: "Budgetary", revision_count: 0, status: "Pending",
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload: any = { ...form, created_by: userId };
    Object.keys(payload).forEach((k) => { if (payload[k] === "") payload[k] = null; });
    const { error } = await supabase.from("opportunities").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
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
        <Field label="Received"><Input type="date" value={form.received_date} onChange={(e) => set("received_date", e.target.value)} /></Field>
        <Field label="Start"><Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} /></Field>
        <Field label="Deadline"><Input type="date" value={form.deadline} onChange={(e) => set("deadline", e.target.value)} /></Field>
        <Field label="Completed"><Input type="date" value={form.completed_date} onChange={(e) => set("completed_date", e.target.value)} /></Field>
        <Field label="Revisions" className="col-span-2"><Input type="number" min={0} value={form.revision_count} onChange={(e) => set("revision_count", parseInt(e.target.value) || 0)} /></Field>
        <DialogFooter className="col-span-2">
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
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
