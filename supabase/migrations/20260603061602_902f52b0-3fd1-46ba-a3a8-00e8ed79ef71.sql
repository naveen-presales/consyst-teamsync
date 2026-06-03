-- Fix 1: Restrict notifications insert to prevent spoofing arbitrary recipients
DROP POLICY IF EXISTS "approved users create notifications" ON public.notifications;

CREATE POLICY "users insert self notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  is_approved(auth.uid())
  AND (actor_id IS NULL OR actor_id = auth.uid())
  AND recipient_id = auth.uid()
);

-- Fix 2: Only admins can manage user_roles (prevent VP privilege escalation)
DROP POLICY IF EXISTS "admins or vps manage roles" ON public.user_roles;

CREATE POLICY "admins manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));