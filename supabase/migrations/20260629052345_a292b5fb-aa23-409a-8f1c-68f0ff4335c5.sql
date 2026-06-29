
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS approx_submission_date date;

CREATE OR REPLACE FUNCTION public.get_status_board()
RETURNS TABLE (
  id uuid,
  crm_number text,
  customer_name text,
  project_name text,
  opportunity_type text,
  status text,
  approx_submission_date date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, crm_number, customer_name, project_name,
         opportunity_type::text, status::text, approx_submission_date
  FROM public.opportunities
  ORDER BY COALESCE(approx_submission_date, '9999-12-31'::date) ASC, created_at DESC
$$;

REVOKE ALL ON FUNCTION public.get_status_board() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_status_board() TO anon, authenticated;
