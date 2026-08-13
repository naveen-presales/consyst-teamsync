CREATE TYPE public.vendor_enquiry_status AS ENUM ('Pending','Quote requested','Quote received','On hold','Regret');

CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approved users read vendors" ON public.vendors FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "approved users insert vendors" ON public.vendors FOR INSERT TO authenticated WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "approved users update vendors" ON public.vendors FOR UPDATE TO authenticated USING (public.is_approved(auth.uid())) WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "approved users delete vendors" ON public.vendors FOR DELETE TO authenticated USING (public.is_approved(auth.uid()));
CREATE TRIGGER trg_vendors_updated BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.vendor_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  phone text,
  email text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vendor_contacts_vendor ON public.vendor_contacts(vendor_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_contacts TO authenticated;
GRANT ALL ON public.vendor_contacts TO service_role;
ALTER TABLE public.vendor_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approved users read vendor contacts" ON public.vendor_contacts FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "approved users insert vendor contacts" ON public.vendor_contacts FOR INSERT TO authenticated WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "approved users update vendor contacts" ON public.vendor_contacts FOR UPDATE TO authenticated USING (public.is_approved(auth.uid())) WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "approved users delete vendor contacts" ON public.vendor_contacts FOR DELETE TO authenticated USING (public.is_approved(auth.uid()));

CREATE TABLE public.vendor_custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  field_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vendor_custom_fields_vendor ON public.vendor_custom_fields(vendor_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_custom_fields TO authenticated;
GRANT ALL ON public.vendor_custom_fields TO service_role;
ALTER TABLE public.vendor_custom_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approved users read vendor fields" ON public.vendor_custom_fields FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "approved users insert vendor fields" ON public.vendor_custom_fields FOR INSERT TO authenticated WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "approved users update vendor fields" ON public.vendor_custom_fields FOR UPDATE TO authenticated USING (public.is_approved(auth.uid())) WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "approved users delete vendor fields" ON public.vendor_custom_fields FOR DELETE TO authenticated USING (public.is_approved(auth.uid()));

CREATE TABLE public.vendor_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.vendor_contacts(id) ON DELETE SET NULL,
  requirement text,
  make text,
  shared_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  enquiry_date date NOT NULL DEFAULT current_date,
  last_contact_date date,
  status public.vendor_enquiry_status NOT NULL DEFAULT 'Pending',
  item_added_erp boolean NOT NULL DEFAULT false,
  supplier_quotation_added boolean NOT NULL DEFAULT false,
  consyst_final_response text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vendor_enquiries_vendor ON public.vendor_enquiries(vendor_id);
CREATE INDEX idx_vendor_enquiries_opp ON public.vendor_enquiries(opportunity_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_enquiries TO authenticated;
GRANT ALL ON public.vendor_enquiries TO service_role;
ALTER TABLE public.vendor_enquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approved users read enquiries" ON public.vendor_enquiries FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "approved users insert enquiries" ON public.vendor_enquiries FOR INSERT TO authenticated WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "approved users update enquiries" ON public.vendor_enquiries FOR UPDATE TO authenticated USING (public.is_approved(auth.uid())) WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "approved users delete enquiries" ON public.vendor_enquiries FOR DELETE TO authenticated USING (public.is_approved(auth.uid()));
CREATE TRIGGER trg_vendor_enquiries_updated BEFORE UPDATE ON public.vendor_enquiries FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.can_view_opportunity(_opp_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $$
  SELECT app_private.has_role(auth.uid(), 'admin'::public.app_role)
      OR app_private.has_role(auth.uid(), 'vp'::public.app_role)
      OR app_private.has_role(auth.uid(), 'sales'::public.app_role)
      OR app_private.is_assigned(auth.uid(), _opp_id)
      OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = _opp_id AND o.created_by = auth.uid())
$$;
REVOKE ALL ON FUNCTION public.can_view_opportunity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_opportunity(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.opportunity_refs()
RETURNS TABLE(id uuid, crm_number text, project_name text, customer_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT o.id, o.crm_number, o.project_name, o.customer_name
  FROM public.opportunities o
  WHERE public.is_approved(auth.uid())
$$;
REVOKE ALL ON FUNCTION public.opportunity_refs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.opportunity_refs() TO authenticated;