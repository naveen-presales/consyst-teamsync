
ALTER TYPE opportunity_status ADD VALUE IF NOT EXISTS 'On Hold';
ALTER TYPE opportunity_status ADD VALUE IF NOT EXISTS 'Submitted to Sales';

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS phase1_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS phase2_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS phase3_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS phase4_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS on_hold boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hold_reason text,
  ADD COLUMN IF NOT EXISTS hold_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS pre_hold_status opportunity_status;

CREATE TABLE IF NOT EXISTS public.opportunity_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  user_id uuid,
  event_type text NOT NULL,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opp_activity_opp ON public.opportunity_activity_log(opportunity_id, created_at DESC);

ALTER TABLE public.opportunity_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view activity if can view opp"
  ON public.opportunity_activity_log FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vp')
    OR is_assigned(auth.uid(), opportunity_id)
    OR EXISTS (SELECT 1 FROM opportunities o WHERE o.id = opportunity_id AND o.created_by = auth.uid())
  );

CREATE POLICY "insert activity if can act on opp"
  ON public.opportunity_activity_log FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND (
      has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vp')
      OR is_assigned(auth.uid(), opportunity_id)
      OR EXISTS (SELECT 1 FROM opportunities o WHERE o.id = opportunity_id AND o.created_by = auth.uid())
    )
  );
