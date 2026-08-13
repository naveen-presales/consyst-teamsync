import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ENQUIRY_STATUSES,
  EnquiryStatus,
  canViewOpportunity,
  fetchEnquiries,
  fetchOpportunityRefs,
  fetchVendorContacts,
  fmtDate,
  logEnquiryActivity,
} from "@/lib/vendors";

interface Props {
  vendorId?: string;
  opportunityId?: string;
  /** Hide the CRM column when the list already sits inside an opportunity. */
  showCrm?: boolean;
}

export function EnquiryList({ vendorId, opportunityId, showCrm = true }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [denied, setDenied] = useState(false);

  const enquiriesQ = useQuery({
    queryKey: ["vendor-enquiries", { vendorId, opportunityId }],
    queryFn: () => fetchEnquiries({ vendorId, opportunityId }),
  });
  const oppsQ = useQuery({ queryKey: ["opp-refs"], queryFn: fetchOpportunityRefs });
  const contactsQ = useQuery({ queryKey: ["vendor-contacts", vendorId ?? "all"], queryFn: () => fetchVendorContacts(vendorId) });
  const profilesQ = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").eq("status", "approved");
      return (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
    },
  });

  const oppById = new Map((oppsQ.data ?? []).map((o) => [o.id, o]));
  const contactById = new Map((contactsQ.data ?? []).map((c) => [c.id, c]));
  const profileName = (id: string | null) =>
    id ? (profilesQ.data ?? []).find((p) => p.id === id)?.full_name ?? (profilesQ.data ?? []).find((p) => p.id === id)?.email ?? "—" : "—";

  const openOpportunity = async (oppId: string) => {
    const ok = await canViewOpportunity(oppId);
    if (!ok) {
      setDenied(true);
      return;
    }
    navigate({ to: "/opportunities/$id", params: { id: oppId } });
  };

  const changeStatus = async (enqId: string, oppId: string, next: EnquiryStatus, prev: EnquiryStatus) => {
    const { error } = await supabase.from("vendor_enquiries").update({ status: next }).eq("id", enqId);
    if (error) return toast.error(error.message);
    await logEnquiryActivity(oppId, user!.id, "vendor_enquiry_status_change", `Vendor enquiry status: ${prev} → ${next}`);
    qc.invalidateQueries({ queryKey: ["vendor-enquiries"] });
    qc.invalidateQueries({ queryKey: ["opp-activity", oppId] });
  };

  const rows = enquiriesQ.data ?? [];

  return (
    <>
      <div className="space-y-2">
        {rows.length === 0 && <div className="text-sm text-muted-foreground">No enquiries yet.</div>}
        {rows.map((e, i) => {
          const opp = oppById.get(e.opportunity_id);
          const c = e.contact_id ? contactById.get(e.contact_id) : undefined;
          return (
            <Card key={e.id} className="p-4">
              <div className="flex flex-wrap items-start gap-3">
                <span className="text-xs text-muted-foreground w-6 shrink-0 pt-1">{i + 1}</span>
                <div className="min-w-0 flex-1 space-y-1">
                  {showCrm && (
                    <button
                      type="button"
                      className="text-sm font-medium text-primary hover:underline"
                      onClick={() => openOpportunity(e.opportunity_id)}
                    >
                      {opp?.crm_number ?? "Opportunity"}
                    </button>
                  )}
                  <div className="text-sm">{e.requirement || <span className="text-muted-foreground">No requirement noted</span>}</div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                    <span>Date of enquiry: {fmtDate(e.enquiry_date)}</span>
                    {e.last_contact_date && <span>Last contact: {fmtDate(e.last_contact_date)}</span>}
                    <span>Shared by: {profileName(e.shared_by)}</span>
                    <span>Contact used: {c?.name ?? "—"}</span>
                    {e.make && <span>Make: {e.make}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {e.item_added_erp && <Badge variant="secondary">Item in ERP</Badge>}
                    {e.supplier_quotation_added && <Badge variant="secondary">Quotation added</Badge>}
                  </div>
                  {e.consyst_final_response && (
                    <div className="text-xs pt-1">
                      <span className="text-muted-foreground">Consyst final response: </span>
                      {e.consyst_final_response}
                    </div>
                  )}
                </div>
                <Select value={e.status} onValueChange={(v) => changeStatus(e.id, e.opportunity_id, v as EnquiryStatus, e.status)}>
                  <SelectTrigger className="w-44 shrink-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENQUIRY_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={denied} onOpenChange={setDenied}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Access restricted</DialogTitle>
            <DialogDescription>You don't have access to this opportunity.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
