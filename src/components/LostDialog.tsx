import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { notify, getVpAdminIds, getOppArchitectRecipients } from "@/lib/notify";
import { LOST_CATEGORIES, lostCategoryLabel, HOLD_CLEAR } from "@/lib/lost";

export function LostDialog({
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
  const [category, setCategory] = useState("");
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);

  const cancel = () => {
    onOpenChange(false);
    setCategory("");
    setDetails("");
    onCancelled?.();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) return toast.error("Select a loss category");
    if (category === "other" && !details.trim()) return toast.error("Details required for other reasons");
    setSaving(true);
    const { error } = await supabase.from("opportunities").update({
      status: "Closed Lost",
      lost_category: category,
      lost_reason: details.trim() || null,
      lost_at: new Date().toISOString(),
      ...HOLD_CLEAR,
    } as any).eq("id", opp.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    await supabase.from("opportunity_activity_log").insert({
      opportunity_id: opp.id, user_id: userId, event_type: "closed_lost",
      message: `Closed Lost – ${lostCategoryLabel(category)}${details.trim() ? `: ${details.trim()}` : ""}`,
    });

    const link = `/opportunities/${opp.id}`;
    const archs = await getOppArchitectRecipients(opp.id, opp.created_by, userId);
    const vps = await getVpAdminIds(userId);
    const recipients = Array.from(new Set([...archs, ...vps]));
    if (recipients.length) {
      await notify(recipients.map((rid) => ({
        recipient_id: rid, actor_id: userId, type: "opportunity_closed_lost",
        title: "Opportunity closed lost",
        body: `${opp.project_name} (${opp.crm_number}) — ${lostCategoryLabel(category)}${details.trim() ? `: ${details.trim()}` : ""}`,
        link, opportunity_id: opp.id,
      })));
    }

    qc.invalidateQueries({ queryKey: ["opp", opp.id] });
    qc.invalidateQueries({ queryKey: ["opp-activity", opp.id] });
    qc.invalidateQueries({ queryKey: ["opps"] });
    onOpenChange(false);
    setCategory("");
    setDetails("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) cancel(); else onOpenChange(true); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Mark opportunity as Closed Lost</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Loss category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {LOST_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Details {category === "other" ? "" : "(optional)"}</Label>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={
                category === "other"
                  ? "Reason for loss (technical, competitor, client decision, project cancelled…)"
                  : "Optional: our price vs winning price, % gap, competitor…"
              }
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={cancel}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Confirm"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
