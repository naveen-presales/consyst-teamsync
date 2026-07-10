
ALTER TABLE public.opportunity_architects
  DROP CONSTRAINT IF EXISTS opportunity_architects_one_per_opp;

DROP POLICY IF EXISTS "admins delete opps" ON public.opportunities;
CREATE POLICY "vp/admin delete opps" ON public.opportunities
  FOR DELETE
  USING (
    app_private.has_role(auth.uid(), 'admin'::app_role)
    OR app_private.has_role(auth.uid(), 'vp'::app_role)
  );
