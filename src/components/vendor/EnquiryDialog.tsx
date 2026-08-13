import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Plus } from "lucide-react";
import {
  ENQUIRY_STATUSES,
  EnquiryStatus,
  fetchOpportunityRefs,
  fetchVendorContacts,
  fetchVendors,
  logEnquiryActivity,
} from "@/lib/vendors";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Pre-selected opportunity (locks the opportunity picker). */
  opportunityId?: string;
  /** Pre-selected vendor. */
  vendorId?: string;
  onSaved?: () => void;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export function EnquiryDialog({ open, onOpenChange, opportunityId, vendorId, onSaved }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const oppsQ = useQuery({ queryKey: ["opp-refs"], queryFn: fetchOpportunityRefs, enabled: open });
  const vendorsQ = useQuery({ queryKey: ["vendors"], queryFn: fetchVendors, enabled: open });

  const [oppId, setOppId] = useState<string>(opportunityId ?? "");
  const [oppSearch, setOppSearch] = useState("");
  const [oppOpen, setOppOpen] = useState(false);

  const [vId, setVId] = useState<string>(vendorId ?? "");
  const [vendorSearch, setVendorSearch] = useState("");
  const [vendorOpen, setVendorOpen] = useState(false);
  const [newVendor, setNewVendor] = useState<null | { name: string; contact: string; phone: string; email: string }>(null);

  const [contactId, setContactId] = useState<string>("");
  const [requirement, setRequirement] = useState("");
  const [make, setMake] = useState("");
  const [sharedBy, setSharedBy] = useState<string>("");
  const [enquiryDate, setEnquiryDate] = useState(todayISO());
  const [lastContactDate, setLastContactDate] = useState("");
  const [status, setStatus] = useState<EnquiryStatus>("Pending");
  const [erp, setErp] = useState(false);
  const [quotation, setQuotation] = useState(false);
  const [response, setResponse] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOppId(opportunityId ?? "");
    setVId(vendorId ?? "");
    setNewVendor(null);
    setContactId("");
    setRequirement("");
    setMake("");
    setSharedBy(user?.id ?? "");
    setEnquiryDate(todayISO());
    setLastContactDate("");
    setStatus("Pending");
    setErp(false);
    setQuotation(false);
    setResponse("");
    setOppSearch("");
    setVendorSearch("");
  }, [open, opportunityId, vendorId, user?.id]);

  const profilesQ = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").eq("status", "approved");
      return (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
    },
    enabled: open,
  });

  const contactsQ = useQuery({
    queryKey: ["vendor-contacts", vId],
    queryFn: () => fetchVendorContacts(vId),
    enabled: open && !!vId,
  });

  useEffect(() => {
    const primary = contactsQ.data?.find((c) => c.is_primary) ?? contactsQ.data?.[0];
    if (primary && !contactId) setContactId(primary.id);
  }, [contactsQ.data, contactId]);

  const filteredOpps = useMemo(() => {
    const q = oppSearch.trim().toLowerCase();
    const list = oppsQ.data ?? [];
    if (!q) return list.slice(0, 30);
    return list
      .filter((o) => o.crm_number.toLowerCase().includes(q) || o.project_name.toLowerCase().includes(q))
      .slice(0, 30);
  }, [oppSearch, oppsQ.data]);

  const filteredVendors = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase();
    const list = vendorsQ.data ?? [];
    if (!q) return list.slice(0, 30);
    return list.filter((v) => v.name.toLowerCase().includes(q)).slice(0, 30);
  }, [vendorSearch, vendorsQ.data]);

  const exactVendorMatch = (vendorsQ.data ?? []).some(
    (v) => v.name.trim().toLowerCase() === vendorSearch.trim().toLowerCase(),
  );

  const selectedOpp = (oppsQ.data ?? []).find((o) => o.id === oppId);
  const selectedVendor = (vendorsQ.data ?? []).find((v) => v.id === vId);

  const save = async () => {
    if (!oppId) return toast.error("Select an opportunity");
    if (!vId && !newVendor?.name.trim()) return toast.error("Select or add a vendor");
    if (!enquiryDate) return toast.error("Date of enquiry is required");

    setSaving(true);
    try {
      let vendorIdToUse = vId;
      let contactToUse: string | null = contactId || null;

      if (!vendorIdToUse && newVendor) {
        const { data: v, error: vErr } = await supabase
          .from("vendors")
          .insert({ name: newVendor.name.trim(), created_by: user!.id })
          .select("id")
          .single();
        if (vErr) throw vErr;
        vendorIdToUse = v.id;
        if (newVendor.contact.trim()) {
          const { data: c, error: cErr } = await supabase
            .from("vendor_contacts")
            .insert({
              vendor_id: vendorIdToUse,
              name: newVendor.contact.trim(),
              phone: newVendor.phone.trim() || null,
              email: newVendor.email.trim() || null,
              is_primary: true,
            })
            .select("id")
            .single();
          if (cErr) throw cErr;
          contactToUse = c.id;
        }
      }

      const { error } = await supabase.from("vendor_enquiries").insert({
        opportunity_id: oppId,
        vendor_id: vendorIdToUse,
        contact_id: contactToUse,
        requirement: requirement.trim() || null,
        make: make.trim() || null,
        shared_by: sharedBy || user!.id,
        enquiry_date: enquiryDate,
        last_contact_date: lastContactDate || null,
        status,
        item_added_erp: erp,
        supplier_quotation_added: quotation,
        consyst_final_response: response.trim() || null,
        created_by: user!.id,
      });
      if (error) throw error;

      const vendorName = selectedVendor?.name ?? newVendor?.name ?? "vendor";
      await logEnquiryActivity(oppId, user!.id, "vendor_enquiry_created", `Vendor enquiry logged for ${vendorName}`);

      toast.success("Enquiry saved");
      qc.invalidateQueries({ queryKey: ["vendors"] });
      qc.invalidateQueries({ queryKey: ["vendor-enquiries"] });
      qc.invalidateQueries({ queryKey: ["opp-activity", oppId] });
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Could not save enquiry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New vendor enquiry</DialogTitle>
          <DialogDescription>Link this enquiry to an existing opportunity and vendor.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Opportunity */}
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Opportunity</Label>
            {opportunityId ? (
              <Input value={selectedOpp ? `${selectedOpp.crm_number} — ${selectedOpp.project_name}` : "Loading…"} disabled />
            ) : (
              <Popover open={oppOpen} onOpenChange={setOppOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal">
                    <span className="truncate">
                      {selectedOpp ? `${selectedOpp.crm_number} — ${selectedOpp.project_name}` : "Search CRM or project…"}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="p-2 w-[var(--radix-popover-trigger-width)]">
                  <Input
                    autoFocus
                    placeholder="Type CRM number or project name"
                    value={oppSearch}
                    onChange={(e) => setOppSearch(e.target.value)}
                  />
                  <div className="mt-2 max-h-60 overflow-y-auto">
                    {filteredOpps.map((o) => (
                      <button
                        type="button"
                        key={o.id}
                        className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted"
                        onClick={() => {
                          setOppId(o.id);
                          setOppOpen(false);
                        }}
                      >
                        <span className="font-medium">{o.crm_number}</span>{" "}
                        <span className="text-muted-foreground">— {o.project_name}</span>
                      </button>
                    ))}
                    {filteredOpps.length === 0 && (
                      <div className="px-2 py-3 text-xs text-muted-foreground">No matching opportunity.</div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Vendor */}
          <div className="space-y-1.5">
            <Label>Vendor</Label>
            {vendorId ? (
              <Input value={selectedVendor?.name ?? "Loading…"} disabled />
            ) : newVendor ? (
              <Button variant="outline" className="w-full justify-between font-normal" onClick={() => setNewVendor(null)}>
                <span className="truncate">New vendor</span>
                <span className="text-xs text-muted-foreground">change</span>
              </Button>
            ) : (
              <Popover open={vendorOpen} onOpenChange={setVendorOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal">
                    <span className="truncate">{selectedVendor?.name ?? "Search vendor…"}</span>
                    <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="p-2 w-[var(--radix-popover-trigger-width)]">
                  <Input
                    autoFocus
                    placeholder="Type vendor name"
                    value={vendorSearch}
                    onChange={(e) => setVendorSearch(e.target.value)}
                  />
                  <div className="mt-2 max-h-60 overflow-y-auto">
                    {filteredVendors.map((v) => (
                      <button
                        type="button"
                        key={v.id}
                        className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted"
                        onClick={() => {
                          setVId(v.id);
                          setContactId("");
                          setVendorOpen(false);
                        }}
                      >
                        {v.name}
                      </button>
                    ))}
                    {!exactVendorMatch && (
                      <button
                        type="button"
                        className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted flex items-center gap-1.5 text-primary"
                        onClick={() => {
                          setVId("");
                          setNewVendor({ name: vendorSearch.trim(), contact: "", phone: "", email: "" });
                          setVendorOpen(false);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" /> Add new vendor
                      </button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Contact used */}
          <div className="space-y-1.5">
            <Label>Contact used</Label>
            {newVendor ? (
              <Input value="New contact below" disabled />
            ) : (
              <Select value={contactId} onValueChange={setContactId} disabled={!vId}>
                <SelectTrigger>
                  <SelectValue placeholder={vId ? "Select contact" : "Select a vendor first"} />
                </SelectTrigger>
                <SelectContent>
                  {(contactsQ.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.is_primary ? " (primary)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {newVendor && (
            <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2 rounded-md border p-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>New vendor name</Label>
                <Input value={newVendor.name} onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Contact person</Label>
                <Input value={newVendor.contact} onChange={(e) => setNewVendor({ ...newVendor, contact: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={newVendor.phone} onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Email</Label>
                <Input value={newVendor.email} onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })} />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Requirement</Label>
            <Input value={requirement} onChange={(e) => setRequirement(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Make</Label>
            <Input value={make} onChange={(e) => setMake(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Enquiry shared by</Label>
            <Select value={sharedBy} onValueChange={setSharedBy}>
              <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
              <SelectContent>
                {(profilesQ.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as EnquiryStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ENQUIRY_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Date of enquiry</Label>
            <Input type="date" value={enquiryDate} onChange={(e) => setEnquiryDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Last contact date</Label>
            <Input type="date" value={lastContactDate} onChange={(e) => setLastContactDate(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={erp} onCheckedChange={(v) => setErp(Boolean(v))} /> Item added in ERP
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={quotation} onCheckedChange={(v) => setQuotation(Boolean(v))} /> Supplier quotation added
          </label>

          <div className="sm:col-span-2 space-y-1.5">
            <Label>Consyst final response</Label>
            <Textarea value={response} onChange={(e) => setResponse(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
