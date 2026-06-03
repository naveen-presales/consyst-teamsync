-- Columns to track ignored revision breaches
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS breach_ignored boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS breach_ignored_at timestamptz,
  ADD COLUMN IF NOT EXISTS breach_ignored_by uuid,
  ADD COLUMN IF NOT EXISTS breach_ignored_reason text;

-- Immutable history of breach ignore/restore actions
CREATE TABLE IF NOT EXISTS public.opportunity_breach_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL,
  revision_count_at_action integer NOT NULL,
  action text NOT NULL CHECK (action IN ('ignored', 'restored')),
  acted_by uuid NOT NULL,
  acted_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_breach_history_opp ON public.opportunity_breach_history(opportunity_id);

GRANT SELECT, INSERT ON public.opportunity_breach_history TO authenticated;
GRANT ALL ON public.opportunity_breach_history TO service_role;

ALTER TABLE public.opportunity_breach_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view breach history if can view opp"
ON public.opportunity_breach_history
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'vp'::app_role)
  OR is_assigned(auth.uid(), opportunity_id)
  OR EXISTS (SELECT 1 FROM opportunities o WHERE o.id = opportunity_id AND o.created_by = auth.uid())
);

-- Inserts only via the SECURITY DEFINER RPCs (no direct client insert path needed beyond admin)
CREATE POLICY "admins insert breach history"
ON public.opportunity_breach_history
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RPC: ignore a revision breach
CREATE OR REPLACE FUNCTION public.ignore_revision_breach(_opp_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  opp public.opportunities%ROWTYPE;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'vp'::app_role)) THEN
    RAISE EXCEPTION 'Only VP or Admin can ignore breaches';
  END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 5 THEN
    RAISE EXCEPTION 'A reason of at least 5 characters is required';
  END IF;

  SELECT * INTO opp FROM public.opportunities WHERE id = _opp_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opportunity not found'; END IF;
  IF opp.revision_count <= 2 THEN RAISE EXCEPTION 'Opportunity has no breach to ignore'; END IF;
  IF opp.breach_ignored THEN RAISE EXCEPTION 'Breach already ignored'; END IF;

  UPDATE public.opportunities
    SET breach_ignored = true,
        breach_ignored_at = now(),
        breach_ignored_by = auth.uid(),
        breach_ignored_reason = btrim(_reason)
    WHERE id = _opp_id;

  INSERT INTO public.opportunity_breach_history (opportunity_id, revision_count_at_action, action, acted_by, reason)
    VALUES (_opp_id, opp.revision_count, 'ignored', auth.uid(), btrim(_reason));
END;
$$;

-- RPC: restore (un-ignore) a revision breach
CREATE OR REPLACE FUNCTION public.restore_revision_breach(_opp_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  opp public.opportunities%ROWTYPE;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'vp'::app_role)) THEN
    RAISE EXCEPTION 'Only VP or Admin can restore breaches';
  END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 5 THEN
    RAISE EXCEPTION 'A reason of at least 5 characters is required';
  END IF;

  SELECT * INTO opp FROM public.opportunities WHERE id = _opp_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opportunity not found'; END IF;
  IF NOT opp.breach_ignored THEN RAISE EXCEPTION 'Breach is not currently ignored'; END IF;

  UPDATE public.opportunities
    SET breach_ignored = false,
        breach_ignored_at = NULL,
        breach_ignored_by = NULL,
        breach_ignored_reason = NULL
    WHERE id = _opp_id;

  INSERT INTO public.opportunity_breach_history (opportunity_id, revision_count_at_action, action, acted_by, reason)
    VALUES (_opp_id, opp.revision_count, 'restored', auth.uid(), btrim(_reason));
END;
$$;