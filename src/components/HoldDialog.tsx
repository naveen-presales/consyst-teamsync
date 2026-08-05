import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { notify, getVpAdminIds, getOppArchitectRecipients } from "@/lib/notify";

export function HoldDialog({
  open,
  onOpenChange,
  opp,
  userId,
  onCancelled,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  opp: any;
  userId: string;
  onCancelled?: () => void;
}) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const cancel = () => {
    onOpenChange(false);
    setReason("");
    onCancelled?.();
  };

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
    await supabase.from("opportunity_activity_log").insert({
      opportunity_id: opp.id, user_id: userId, event_type: "on_hold",
      message: `Placed on hold: ${reason.trim()}`,
    });

    const link = `/opportunities/${opp.id}`;
    const archs = await getOppArchitectRecipients(opp.id, opp.created_by, userId);
    const vps = await getVpAdminIds(userId);
    const recipients = Array.from(new Set([...archs, ...vps]));
    if (recipients.length) {
      await notify(recipients.map((rid) => ({
        recipient_id: rid, actor_id: userId, type: "opportunity_on_hold",
        title: "Opportunity placed on hold",
        body: `${opp.project_name} (${opp.crm_number}) — ${reason.trim()}`,
        link, opportunity_id: opp.id,
      })));
    }

    qc.invalidateQueries({ queryKey: ["opp", opp.id] });
    qc.invalidateQueries({ queryKey: ["opp-activity", opp.id] });
    qc.invalidateQueries({ queryKey: ["opps"] });
    onOpenChange(false);
    setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) cancel(); else onOpenChange(true); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Place opportunity on hold</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Label className="text-xs">Reason</Label>
          <Textarea required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Brief reason for hold…" />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={cancel}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Confirm hold"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
