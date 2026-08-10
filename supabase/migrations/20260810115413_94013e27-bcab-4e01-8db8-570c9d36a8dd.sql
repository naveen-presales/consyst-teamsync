
-- Helper accessors (private schema, not exposed to the API)
CREATE OR REPLACE FUNCTION app_private.profile_status(_user_id uuid)
RETURNS public.user_status
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT status FROM public.profiles WHERE id = _user_id $$;

CREATE OR REPLACE FUNCTION app_private.opp_breach_ignored(_opp_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT breach_ignored FROM public.opportunities WHERE id = _opp_id $$;

CREATE OR REPLACE FUNCTION app_private.opp_breach_meta(_opp_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT coalesce(breach_ignored_reason,'') || '|' || coalesce(breach_ignored_by::text,'') || '|' || coalesce(breach_ignored_at::text,'')
      FROM public.opportunities WHERE id = _opp_id $$;

CREATE OR REPLACE FUNCTION app_private.opp_revision_count(_opp_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT revision_count FROM public.opportunities WHERE id = _opp_id $$;

REVOKE EXECUTE ON FUNCTION app_private.profile_status(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app_private.opp_breach_ignored(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app_private.opp_breach_meta(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app_private.opp_revision_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.profile_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.opp_breach_ignored(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.opp_breach_meta(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.opp_revision_count(uuid) TO authenticated;

-- 1) Users cannot self-approve
DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
CREATE POLICY "users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND status = app_private.profile_status(auth.uid()));

-- 2) Architects cannot tamper with breach/revision tracking
DROP POLICY IF EXISTS "architects update assigned opps" ON public.opportunities;
CREATE POLICY "architects update assigned opps" ON public.opportunities
  FOR UPDATE TO authenticated
  USING (app_private.is_assigned(auth.uid(), id) OR created_by = auth.uid())
  WITH CHECK (
    (app_private.is_assigned(auth.uid(), id) OR created_by = auth.uid())
    AND (
      app_private.has_role(auth.uid(), 'admin'::public.app_role)
      OR app_private.has_role(auth.uid(), 'vp'::public.app_role)
      OR (
        breach_ignored IS NOT DISTINCT FROM app_private.opp_breach_ignored(id)
        AND (coalesce(breach_ignored_reason,'') || '|' || coalesce(breach_ignored_by::text,'') || '|' || coalesce(breach_ignored_at::text,''))
            = app_private.opp_breach_meta(id)
        AND revision_count >= app_private.opp_revision_count(id)
      )
    )
  );

-- Admin/VP full update path (unchanged intent, add explicit WITH CHECK)
DROP POLICY IF EXISTS "admins update opps" ON public.opportunities;
CREATE POLICY "admins update opps" ON public.opportunities
  FOR UPDATE TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::public.app_role) OR app_private.has_role(auth.uid(), 'vp'::public.app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'::public.app_role) OR app_private.has_role(auth.uid(), 'vp'::public.app_role));

-- 3) Status board no longer directly callable from the browser
REVOKE EXECUTE ON FUNCTION public.get_status_board() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_status_board() TO service_role;
