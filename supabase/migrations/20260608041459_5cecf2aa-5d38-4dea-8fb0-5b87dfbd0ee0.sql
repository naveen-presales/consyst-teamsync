-- Lock down SECURITY DEFINER functions: revoke broad EXECUTE, grant only what app needs.

-- Internal helpers used only inside RLS / other functions — no API exposure
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_approved(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_assigned(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Trigger functions — never called via API
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_opportunity_dates() FROM PUBLIC, anon, authenticated;

-- email_exists: used by forgot-password flow (anonymous). Keep anon access only.
REVOKE ALL ON FUNCTION public.email_exists(text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.email_exists(text) TO anon;

-- VP/Admin RPCs — authenticated only (function enforces role check internally)
REVOKE ALL ON FUNCTION public.approve_opportunity_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_opportunity_request(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.ignore_revision_breach(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ignore_revision_breach(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.restore_revision_breach(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_revision_breach(uuid, text) TO authenticated;