
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings read all" ON public.app_settings;
CREATE POLICY "app_settings read all" ON public.app_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "app_settings vp admin write" ON public.app_settings;
CREATE POLICY "app_settings vp admin write" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'vp'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'vp'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.get_status_board()
 RETURNS TABLE(id uuid, crm_number text, customer_name text, project_name text, opportunity_type text, status text, approx_submission_date date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, crm_number, customer_name, project_name,
         opportunity_type::text, status::text, approx_submission_date
  FROM public.opportunities
  WHERE status <> 'Completed'
    AND status <> 'On Hold'
    AND COALESCE(on_hold, false) = false
  ORDER BY crm_number ASC
$function$;
