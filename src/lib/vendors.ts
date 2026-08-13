import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

export const ENQUIRY_STATUSES = [
  "Pending",
  "Quote requested",
  "Quote received",
  "On hold",
  "Regret",
] as const;

export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export interface Vendor {
  id: string;
  name: string;
}

export interface VendorContact {
  id: string;
  vendor_id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  is_primary: boolean;
}

export interface VendorCustomField {
  id: string;
  vendor_id: string;
  field_key: string;
  field_value: string | null;
}

export interface VendorEnquiry {
  id: string;
  opportunity_id: string;
  vendor_id: string;
  contact_id: string | null;
  requirement: string | null;
  make: string | null;
  shared_by: string | null;
  enquiry_date: string;
  last_contact_date: string | null;
  status: EnquiryStatus;
  item_added_erp: boolean;
  supplier_quotation_added: boolean;
  consyst_final_response: string | null;
  created_at: string;
}

export interface OpportunityRef {
  id: string;
  crm_number: string;
  project_name: string;
  customer_name: string;
}

/** All opportunities (id + CRM) visible for linking/labelling, regardless of assignment. */
export async function fetchOpportunityRefs(): Promise<OpportunityRef[]> {
  const { data, error } = await supabase.rpc("opportunity_refs");
  if (error) throw error;
  return ((data ?? []) as OpportunityRef[]).sort((a, b) => a.crm_number.localeCompare(b.crm_number));
}

/** Whether the signed-in user is allowed to open a given opportunity. */
export async function canViewOpportunity(oppId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("can_view_opportunity", { _opp_id: oppId });
  if (error) return false;
  return Boolean(data);
}

export async function fetchVendors(): Promise<Vendor[]> {
  const { data, error } = await supabase.from("vendors").select("id, name").order("name");
  if (error) throw error;
  return (data ?? []) as Vendor[];
}

export async function fetchVendorContacts(vendorId?: string): Promise<VendorContact[]> {
  let q = supabase
    .from("vendor_contacts")
    .select("id, vendor_id, name, role, phone, email, is_primary")
    .order("is_primary", { ascending: false })
    .order("name");
  if (vendorId) q = q.eq("vendor_id", vendorId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as VendorContact[];
}

export async function fetchEnquiries(filter?: { vendorId?: string; opportunityId?: string }): Promise<VendorEnquiry[]> {
  let q = supabase.from("vendor_enquiries").select("*").order("enquiry_date", { ascending: false });
  if (filter?.vendorId) q = q.eq("vendor_id", filter.vendorId);
  if (filter?.opportunityId) q = q.eq("opportunity_id", filter.opportunityId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as VendorEnquiry[];
}

export function logEnquiryActivity(oppId: string, userId: string, eventType: string, message: string) {
  return supabase
    .from("opportunity_activity_log")
    .insert({ opportunity_id: oppId, user_id: userId, event_type: eventType, message });
}

export function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}-${m}-${y}`;
}

/** Downloads every vendor enquiry in the system as an Excel workbook. */
export async function exportAllEnquiries() {
  const [enquiries, vendors, contacts, opps, profilesRes] = await Promise.all([
    fetchEnquiries(),
    fetchVendors(),
    fetchVendorContacts(),
    fetchOpportunityRefs(),
    supabase.from("profiles").select("id, full_name, email"),
  ]);

  const vendorById = new Map(vendors.map((v) => [v.id, v]));
  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const oppById = new Map(opps.map((o) => [o.id, o]));
  const profileById = new Map(
    ((profilesRes.data ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((p) => [
      p.id,
      p.full_name || p.email || "",
    ]),
  );

  const rows = enquiries.map((e, i) => {
    const c = e.contact_id ? contactById.get(e.contact_id) : undefined;
    return {
      "Sl no": i + 1,
      CRM: oppById.get(e.opportunity_id)?.crm_number ?? "",
      "Enquiry shared by": e.shared_by ? profileById.get(e.shared_by) ?? "" : "",
      Requirement: e.requirement ?? "",
      Make: e.make ?? "",
      "Supplier name": vendorById.get(e.vendor_id)?.name ?? "",
      "Contact person": c?.name ?? "",
      "Contact no": c?.phone ?? "",
      Email: c?.email ?? "",
      "Last contact date": e.last_contact_date ?? "",
      "Date of enquiry": e.enquiry_date ?? "",
      Status: e.status,
      "Item added in ERP": e.item_added_erp ? "Yes" : "No",
      "Supplier quotation added": e.supplier_quotation_added ? "Yes" : "No",
      "Consyst final response": e.consyst_final_response ?? "",
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows, {
    header: [
      "Sl no",
      "CRM",
      "Enquiry shared by",
      "Requirement",
      "Make",
      "Supplier name",
      "Contact person",
      "Contact no",
      "Email",
      "Last contact date",
      "Date of enquiry",
      "Status",
      "Item added in ERP",
      "Supplier quotation added",
      "Consyst final response",
    ],
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Vendor enquiries");
  XLSX.writeFile(wb, `vendor-enquiries-${new Date().toISOString().slice(0, 10)}.xlsx`);
  return rows.length;
}
