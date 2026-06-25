
CREATE POLICY "sales view opps" ON public.opportunities
FOR SELECT
USING (app_private.has_role(auth.uid(), 'sales'::app_role));
