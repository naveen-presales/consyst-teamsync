-- 1) Prevent self-approval of profile status
CREATE OR REPLACE FUNCTION public.guard_profile_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (app_private.has_role(auth.uid(), 'admin'::public.app_role)
            OR app_private.has_role(auth.uid(), 'vp'::public.app_role)) THEN
      RAISE EXCEPTION 'Only VP or Admin can change account status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_profile_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_profile_status ON public.profiles;
CREATE TRIGGER trg_guard_profile_status
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_status();

-- 2) Prevent breach-flag tampering on opportunities
CREATE OR REPLACE FUNCTION public.guard_opportunity_breach_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  is_privileged boolean;
BEGIN
  is_privileged := app_private.has_role(auth.uid(), 'admin'::public.app_role)
                   OR app_private.has_role(auth.uid(), 'vp'::public.app_role);

  IF is_privileged THEN
    RETURN NEW;
  END IF;

  IF NEW.breach_ignored IS DISTINCT FROM OLD.breach_ignored
     OR NEW.breach_ignored_at IS DISTINCT FROM OLD.breach_ignored_at
     OR NEW.breach_ignored_by IS DISTINCT FROM OLD.breach_ignored_by
     OR NEW.breach_ignored_reason IS DISTINCT FROM OLD.breach_ignored_reason THEN
    RAISE EXCEPTION 'Only VP or Admin can change breach status';
  END IF;

  IF COALESCE(NEW.revision_count, 0) < COALESCE(OLD.revision_count, 0) THEN
    RAISE EXCEPTION 'Only VP or Admin can lower the revision count';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_opportunity_breach_fields() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_opportunity_breach_fields ON public.opportunities;
CREATE TRIGGER trg_guard_opportunity_breach_fields
BEFORE UPDATE ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION public.guard_opportunity_breach_fields();

-- 3) Fix mutable search_path on trigger function + revoke direct execute
CREATE OR REPLACE FUNCTION public.normalize_crm_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.crm_number := upper(trim(NEW.crm_number));
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_crm_number() FROM PUBLIC, anon, authenticated;

-- 4) Internal security-definer helpers must not be callable by anonymous visitors
REVOKE ALL ON FUNCTION app_private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.is_approved(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.is_assigned(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.ignore_revision_breach(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.restore_revision_breach(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.approve_opportunity_request(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.is_approved(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.is_assigned(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.ignore_revision_breach(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.restore_revision_breach(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.approve_opportunity_request(uuid) TO authenticated;