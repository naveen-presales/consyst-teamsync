DROP POLICY IF EXISTS "approved insert opps" ON public.opportunities;
CREATE POLICY "vp/admin insert opps" ON public.opportunities
FOR INSERT TO authenticated
WITH CHECK (
  app_private.is_approved(auth.uid())
  AND created_by = auth.uid()
  AND (app_private.has_role(auth.uid(), 'vp'::app_role) OR app_private.has_role(auth.uid(), 'admin'::app_role))
);