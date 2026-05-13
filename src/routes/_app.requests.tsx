import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Check, X, Inbox } from "lucide-react";

export const Route = createFileRoute("/_app/requests")({ component: RequestsPage });

type Req = {
  id: string;
  requested_by: string;
  customer_name: string;
  project_name: string;
  crm_number: string;
  received_date: string | null;
  start_date: string | null;
  deadline: string | null;
  opportunity_type: string;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
};

function RequestsPage() {
  const { isVp, isAdmin, loading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [reject, setReject] = useState<Req | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");

  useEffect(() => {
    if (!loading && !isVp && !isAdmin) nav({ to: "/dashboard" });
  }, [loading, isVp, isAdmin]);

  const reqsQ = useQuery({
    queryKey: ["opp-requests"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("opportunity_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Req[];
    },
  });

  const profilesQ = useQuery({
    queryKey: ["profiles-for-requests"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email");
      return (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
    },
  });

  const profMap = new Map((profilesQ.data ?? []).map((p) => [p.id, p.full_name || p.email || "Unknown"]));

  const approve = async (r: Req) => {
    const { error } = await (supabase as any).rpc("approve_opportunity_request", { _request_id: r.id });
    if (error) return toast.error(error.message);
    toast.success("Request approved — opportunity created");
    qc.invalidateQueries({ queryKey: ["opp-requests"] });
    qc.invalidateQueries({ queryKey: ["opps"] });
  };

  const submitReject = async () => {
    if (!reject) return;
    const { error } = await (supabase as any)
      .from("opportunity_requests")
      .update({ status: "rejected", review_notes: rejectNotes || null, reviewed_at: new Date().toISOString() })
      .eq("id", reject.id);
    if (error) return toast.error(error.message);
    toast.success("Request rejected");
    setReject(null);
    setRejectNotes("");
    qc.invalidateQueries({ queryKey: ["opp-requests"] });
  };

  const list = reqsQ.data ?? [];
  const pending = list.filter((r) => r.status === "pending");
  const reviewed = list.filter((r) => r.status !== "pending");

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Opportunity requests</h1>
        <p className="text-sm text-muted-foreground">Review architect-submitted opportunity requests.</p>
      </header>

      <Card className="p-5 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Inbox className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Pending ({pending.length})</h3>
        </div>
        {pending.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">No pending requests.</div>
        ) : (
          <div className="space-y-3">
            {pending.map((r) => (
              <div key={r.id} className="border border-border rounded-md p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{r.customer_name} — {r.project_name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      CRM {r.crm_number} · {r.opportunity_type} · Requested by {profMap.get(r.requested_by) || "Unknown"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Received: {r.received_date ?? "—"} · Start: {r.start_date ?? "—"} · Deadline: {r.deadline ?? "—"}
                    </div>
                    {r.notes && <div className="text-sm mt-2 whitespace-pre-wrap">{r.notes}</div>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" onClick={() => approve(r)}>
                      <Check className="h-4 w-4 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setReject(r)}>
                      <X className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-medium mb-3">Reviewed</h3>
        {reviewed.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">No reviewed requests yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="text-left py-2 font-medium">Customer / Project</th>
                  <th className="text-left py-2 font-medium">Requested by</th>
                  <th className="text-left py-2 font-medium">CRM</th>
                  <th className="text-left py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {reviewed.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="py-2">{r.customer_name} — {r.project_name}</td>
                    <td className="py-2">{profMap.get(r.requested_by) || "Unknown"}</td>
                    <td className="py-2 font-mono text-xs">{r.crm_number}</td>
                    <td className="py-2">
                      <Badge variant={r.status === "approved" ? "default" : "destructive"}>{r.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!reject} onOpenChange={(o) => !o && setReject(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject request</DialogTitle></DialogHeader>
          <Textarea placeholder="Optional reason…" value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReject(null)}>Cancel</Button>
            <Button variant="destructive" onClick={submitReject}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
