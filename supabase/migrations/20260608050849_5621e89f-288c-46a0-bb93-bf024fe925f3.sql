GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_approved(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ignore_revision_breach(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_revision_breach(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_opportunity_request(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.email_exists(text) FROM anon, authenticated, PUBLIC;