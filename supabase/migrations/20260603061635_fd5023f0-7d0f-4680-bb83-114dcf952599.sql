DROP POLICY IF EXISTS "users insert self notifications" ON public.notifications;

CREATE POLICY "approved users insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  is_approved(auth.uid())
  AND (actor_id IS NULL OR actor_id = auth.uid())
  AND (
    recipient_id = auth.uid()
    OR has_role(recipient_id, 'admin'::app_role)
    OR has_role(recipient_id, 'vp'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'vp'::app_role)
  )
);