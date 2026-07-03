DROP POLICY IF EXISTS "vp/admin insert opps" ON public.opportunities;
CREATE POLICY "approved insert opps" ON public.opportunities
FOR INSERT TO authenticated
WITH CHECK (
  app_private.is_approved(auth.uid())
  AND created_by = auth.uid()
);