
DROP FUNCTION IF EXISTS public.get_status_board();

CREATE FUNCTION public.get_status_board()
RETURNS TABLE(
  id uuid,
  crm_number text,
  customer_name text,
  project_name text,
  opportunity_type text,
  status text,
  approx_submission_date date,
  has_architect boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.crm_number,
    o.customer_name,
    o.project_name,
    o.opportunity_type::text,
    o.status::text,
    o.approx_submission_date,
    EXISTS (
      SELECT 1 FROM public.opportunity_architects oa
       WHERE oa.opportunity_id = o.id
    ) AS has_architect
  FROM public.opportunities o
  WHERE o.status <> 'Completed'
    AND o.status <> 'On Hold'
    AND COALESCE(o.on_hold, false) = false
  ORDER BY o.crm_number ASC
$$;
