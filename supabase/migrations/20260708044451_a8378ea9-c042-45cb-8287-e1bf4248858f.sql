ALTER TYPE public.opportunity_status ADD VALUE IF NOT EXISTS 'Waiting for Clarification';

DROP FUNCTION IF EXISTS public.get_status_board();

CREATE FUNCTION public.get_status_board()
RETURNS TABLE(
  id uuid, crm_number text, customer_name text, project_name text,
  opportunity_type text, status text, approx_submission_date date,
  has_architect boolean, architect_names text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    o.id,
    o.crm_number,
    o.customer_name,
    o.project_name,
    o.opportunity_type::text,
    o.status::text,
    o.approx_submission_date,
    EXISTS (SELECT 1 FROM public.opportunity_architects oa WHERE oa.opportunity_id = o.id) AS has_architect,
    COALESCE(
      (SELECT string_agg(COALESCE(p.full_name, p.email, 'Unknown'), ', ' ORDER BY COALESCE(p.full_name, p.email))
         FROM public.opportunity_architects oa
         JOIN public.profiles p ON p.id = oa.user_id
        WHERE oa.opportunity_id = o.id),
      ''
    ) AS architect_names
  FROM public.opportunities o
  WHERE o.status <> 'Completed'
    AND o.status <> 'On Hold'
    AND COALESCE(o.on_hold, false) = false
  ORDER BY o.crm_number ASC
$$;