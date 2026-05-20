CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL,
  actor_id uuid,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  opportunity_id uuid,
  todo_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_recipient ON public.notifications(recipient_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications(recipient_id) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (recipient_id = auth.uid());

CREATE POLICY "update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (recipient_id = auth.uid());

CREATE POLICY "delete own notifications"
ON public.notifications FOR DELETE
TO authenticated
USING (recipient_id = auth.uid());

CREATE POLICY "approved users create notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (is_approved(auth.uid()) AND (actor_id IS NULL OR actor_id = auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;