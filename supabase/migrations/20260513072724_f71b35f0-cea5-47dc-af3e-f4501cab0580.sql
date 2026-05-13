
-- Status enum for requests
CREATE TYPE public.request_status AS ENUM ('pending', 'approved', 'rejected');

-- Opportunity requests table
CREATE TABLE public.opportunity_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL,
  customer_name text NOT NULL,
  project_name text NOT NULL,
  crm_number text NOT NULL,
  received_date date,
  start_date date,
  deadline date,
  opportunity_type public.opportunity_type NOT NULL DEFAULT 'Budgetary',
  notes text,
  status public.request_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_opportunity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.opportunity_requests ENABLE ROW LEVEL SECURITY;

-- Architects: insert own
CREATE POLICY "architects insert own requests" ON public.opportunity_requests
  FOR INSERT TO authenticated
  WITH CHECK (is_approved(auth.uid()) AND requested_by = auth.uid());

-- Architects: view own
CREATE POLICY "view own requests" ON public.opportunity_requests
  FOR SELECT TO authenticated
  USING (requested_by = auth.uid());

-- VP/Admin: view all
CREATE POLICY "vps admins view all requests" ON public.opportunity_requests
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vp'));

-- VP/Admin: update (for reject; approve uses SECURITY DEFINER)
CREATE POLICY "vps admins update requests" ON public.opportunity_requests
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vp'));

-- updated_at trigger
CREATE TRIGGER opportunity_requests_touch
  BEFORE UPDATE ON public.opportunity_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Enforce single architect per opportunity
ALTER TABLE public.opportunity_architects
  ADD CONSTRAINT opportunity_architects_one_per_opp UNIQUE (opportunity_id);

-- Approve function: creates opp + assignment in one transaction
CREATE OR REPLACE FUNCTION public.approve_opportunity_request(_request_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.opportunity_requests%ROWTYPE;
  new_opp_id uuid;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vp')) THEN
    RAISE EXCEPTION 'Only VP or Admin can approve requests';
  END IF;

  SELECT * INTO req FROM public.opportunity_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'Request already %', req.status; END IF;

  INSERT INTO public.opportunities (
    customer_name, project_name, crm_number, received_date, start_date, deadline,
    opportunity_type, status, created_by
  ) VALUES (
    req.customer_name, req.project_name, req.crm_number, req.received_date, req.start_date, req.deadline,
    req.opportunity_type, 'Pending', req.requested_by
  ) RETURNING id INTO new_opp_id;

  INSERT INTO public.opportunity_architects (opportunity_id, user_id)
    VALUES (new_opp_id, req.requested_by);

  UPDATE public.opportunity_requests
    SET status = 'approved',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        created_opportunity_id = new_opp_id
    WHERE id = _request_id;

  RETURN new_opp_id;
END;
$$;
