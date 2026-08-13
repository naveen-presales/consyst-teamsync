import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { EnquiryList } from "@/components/vendor/EnquiryList";
import { EnquiryDialog } from "@/components/vendor/EnquiryDialog";
import { fetchVendorContacts } from "@/lib/vendors";

export const Route = createFileRoute("/_app/vendor-enquiries/$vendorId")({
  head: () => ({
    meta: [
      { title: "Vendor details — TeamSync" },
      { name: "description", content: "Vendor contacts, custom fields and enquiry history." },
      { property: "og:title", content: "Vendor details — TeamSync" },
      { property: "og:description", content: "Vendor contacts, custom fields and enquiry history." },
    ],
  }),
  component: VendorDetail,
});

function VendorDetail() {
  const { vendorId } = useParams({ from: "/_app/vendor-enquiries/$vendorId" });
  const qc = useQueryClient();
  const { user } = useAuth();
  const [enquiryOpen, setEnquiryOpen] = useState(false);

  const vendorQ = useQuery({
    queryKey: ["vendor", vendorId],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendors").select("id, name").eq("id", vendorId).single();
      if (error) throw error;
      return data;
    },
  });

  const contactsQ = useQuery({
    queryKey: ["vendor-contacts", vendorId],
    queryFn: () => fetchVendorContacts(vendorId),
  });

  const fieldsQ = useQuery({
    queryKey: ["vendor-fields", vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_custom_fields")
        .select("id, vendor_id, field_key, field_value")
        .eq("vendor_id", vendorId)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [c, setC] = useState({ name: "", role: "", phone: "", email: "", is_primary: false });
  const [f, setF] = useState({ key: "", value: "" });

  const addContact = async () => {
    if (!c.name.trim()) return toast.error("Contact name is required");
    if (c.is_primary) {
      await supabase.from("vendor_contacts").update({ is_primary: false }).eq("vendor_id", vendorId);
    }
    const { error } = await supabase.from("vendor_contacts").insert({
      vendor_id: vendorId,
      name: c.name.trim(),
      role: c.role.trim() || null,
      phone: c.phone.trim() || null,
      email: c.email.trim() || null,
      is_primary: c.is_primary,
    });
    if (error) return toast.error(error.message);
    setC({ name: "", role: "", phone: "", email: "", is_primary: false });
    qc.invalidateQueries({ queryKey: ["vendor-contacts", vendorId] });
  };

  const deleteContact = async (id: string) => {
    const { error } = await supabase.from("vendor_contacts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["vendor-contacts", vendorId] });
  };

  const addField = async () => {
    if (!f.key.trim()) return toast.error("Field name is required");
    const { error } = await supabase
      .from("vendor_custom_fields")
      .insert({ vendor_id: vendorId, field_key: f.key.trim(), field_value: f.value.trim() || null });
    if (error) return toast.error(error.message);
    setF({ key: "", value: "" });
    qc.invalidateQueries({ queryKey: ["vendor-fields", vendorId] });
  };

  const deleteField = async (id: string) => {
    const { error } = await supabase.from("vendor_custom_fields").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["vendor-fields", vendorId] });
  };

  if (vendorQ.isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!vendorQ.data) return <div className="p-8 text-sm">Vendor not found.</div>;

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <Link to="/vendor-enquiries" className="text-sm text-muted-foreground inline-flex items-center gap-1.5 hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Vendor enquiries
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
        <h1 className="text-2xl font-semibold">{vendorQ.data.name}</h1>
        <Button onClick={() => setEnquiryOpen(true)}><Plus className="h-4 w-4 mr-1.5" /> New enquiry</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mt-6">
        <Card className="p-5">
          <h2 className="text-sm font-medium mb-3">Contacts</h2>
          <div className="space-y-2">
            {(contactsQ.data ?? []).map((ct) => (
              <div key={ct.id} className="flex items-start gap-2 border rounded-md p-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <span className="truncate">{ct.name}</span>
                    {ct.is_primary && <Badge variant="secondary">Primary</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {[ct.role, ct.phone, ct.email].filter(Boolean).join(" · ") || "No details"}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteContact(ct.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {(contactsQ.data ?? []).length === 0 && <div className="text-xs text-muted-foreground">No contacts yet.</div>}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Input placeholder="Name" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
            <Input placeholder="Role" value={c.role} onChange={(e) => setC({ ...c, role: e.target.value })} />
            <Input placeholder="Phone" value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} />
            <Input placeholder="Email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={c.is_primary} onCheckedChange={(v) => setC({ ...c, is_primary: Boolean(v) })} /> Primary contact
            </label>
            <Button variant="outline" onClick={addContact}><Plus className="h-4 w-4 mr-1.5" /> Add contact</Button>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-medium mb-3">Custom fields</h2>
          <div className="space-y-2">
            {(fieldsQ.data ?? []).map((fl) => (
              <div key={fl.id} className="flex items-center gap-2 border rounded-md p-2.5">
                <div className="min-w-0 flex-1 text-sm">
                  <span className="text-muted-foreground">{fl.field_key}: </span>
                  {fl.field_value || "—"}
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteField(fl.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {(fieldsQ.data ?? []).length === 0 && <div className="text-xs text-muted-foreground">No custom fields yet.</div>}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Input placeholder="Field name (e.g. GST number)" value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })} />
            <Input placeholder="Value" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} />
            <Button variant="outline" className="sm:col-span-2" onClick={addField}>
              <Plus className="h-4 w-4 mr-1.5" /> Add field
            </Button>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-medium mb-3">Enquiries</h2>
        <EnquiryList vendorId={vendorId} />
      </div>

      <EnquiryDialog open={enquiryOpen} onOpenChange={setEnquiryOpen} vendorId={vendorId} />
    </div>
  );
}
