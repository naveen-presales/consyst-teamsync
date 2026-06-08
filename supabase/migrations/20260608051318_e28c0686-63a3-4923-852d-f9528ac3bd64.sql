CREATE SCHEMA IF NOT EXISTS app_private;
GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT USAGE ON SCHEMA app_private TO service_role;

CREATE OR REPLACE FUNCTION app_private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION app_private.is_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND status = 'approved'
  )
$$;

CREATE OR REPLACE FUNCTION app_private.is_assigned(_user_id uuid, _opp_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.opportunity_architects
    WHERE opportunity_id = _opp_id
      AND user_id = _user_id
  )
$$;

GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.is_approved(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.is_assigned(uuid, uuid) TO authenticated, service_role;

DO $$
DECLARE
  rec record;
  using_expr text;
  check_expr text;
  sql text;
BEGIN
  FOR rec IN
    SELECT
      c.relname AS table_name,
      p.polname AS policy_name,
      pg_get_expr(p.polqual, p.polrelid) AS qual,
      pg_get_expr(p.polwithcheck, p.polrelid) AS with_check
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND (
        coalesce(pg_get_expr(p.polqual, p.polrelid), '') ~ '(^|[^A-Za-z0-9_.])(has_role|is_approved|is_assigned)\('
        OR coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') ~ '(^|[^A-Za-z0-9_.])(has_role|is_approved|is_assigned)\('
      )
  LOOP
    using_expr := rec.qual;
    check_expr := rec.with_check;

    IF using_expr IS NOT NULL THEN
      using_expr := replace(using_expr, 'has_role(', 'app_private.has_role(');
      using_expr := replace(using_expr, 'is_approved(', 'app_private.is_approved(');
      using_expr := replace(using_expr, 'is_assigned(', 'app_private.is_assigned(');
    END IF;

    IF check_expr IS NOT NULL THEN
      check_expr := replace(check_expr, 'has_role(', 'app_private.has_role(');
      check_expr := replace(check_expr, 'is_approved(', 'app_private.is_approved(');
      check_expr := replace(check_expr, 'is_assigned(', 'app_private.is_assigned(');
    END IF;

    sql := format('ALTER POLICY %I ON public.%I', rec.policy_name, rec.table_name);
    IF using_expr IS NOT NULL THEN
      sql := sql || ' USING (' || using_expr || ')';
    END IF;
    IF check_expr IS NOT NULL THEN
      sql := sql || ' WITH CHECK (' || check_expr || ')';
    END IF;
    EXECUTE sql;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION app_private.ignore_revision_breach(_opp_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  opp public.opportunities%ROWTYPE;
BEGIN
  IF NOT (app_private.has_role(auth.uid(), 'admin'::public.app_role) OR app_private.has_role(auth.uid(), 'vp'::public.app_role)) THEN
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

CREATE OR REPLACE FUNCTION app_private.restore_revision_breach(_opp_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  opp public.opportunities%ROWTYPE;
BEGIN
  IF NOT (app_private.has_role(auth.uid(), 'admin'::public.app_role) OR app_private.has_role(auth.uid(), 'vp'::public.app_role)) THEN
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

CREATE OR REPLACE FUNCTION app_private.approve_opportunity_request(_request_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.opportunity_requests%ROWTYPE;
  new_opp_id uuid;
BEGIN
  IF NOT (app_private.has_role(auth.uid(), 'admin'::public.app_role) OR app_private.has_role(auth.uid(), 'vp'::public.app_role)) THEN
    RAISE EXCEPTION 'Only VP or Admin can approve requests';
  END IF;

  SELECT * INTO req FROM public.opportunity_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'Request already %', req.status; END IF;

  INSERT INTO public.opportunities (
    customer_name, project_name, crm_number, received_date, start_date, deadline,
    opportunity_type, status, created_by
  ) VALUES (
    req.customer_name, req.project_name, req.crm_number, req.received_date, req.start_date, req.deadline,
    req.opportunity_type, 'Pending', req.requested_by
  ) RETURNING id INTO new_opp_id;

  INSERT INTO public.opportunity_architects (opportunity_id, user_id)
    VALUES (new_opp_id, req.requested_by);

  UPDATE public.opportunity_requests
    SET status = 'approved',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        created_opportunity_id = new_opp_id
    WHERE id = _request_id;

  RETURN new_opp_id;
END;
$$;

GRANT EXECUTE ON FUNCTION app_private.ignore_revision_breach(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.restore_revision_breach(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.approve_opportunity_request(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ignore_revision_breach(_opp_id uuid, _reason text)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, app_private
AS $$
  SELECT app_private.ignore_revision_breach(_opp_id, _reason)
$$;

CREATE OR REPLACE FUNCTION public.restore_revision_breach(_opp_id uuid, _reason text)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, app_private
AS $$
  SELECT app_private.restore_revision_breach(_opp_id, _reason)
$$;

CREATE OR REPLACE FUNCTION public.approve_opportunity_request(_request_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, app_private
AS $$
  SELECT app_private.approve_opportunity_request(_request_id)
$$;

GRANT EXECUTE ON FUNCTION public.ignore_revision_breach(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_revision_breach(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_opportunity_request(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_approved(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_assigned(uuid, uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_exists(text) FROM anon, authenticated, PUBLIC;