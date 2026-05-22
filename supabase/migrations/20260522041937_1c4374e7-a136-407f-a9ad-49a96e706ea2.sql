
-- 1) Tighten rating_answers SELECT policy to mirror ratings access
DROP POLICY IF EXISTS "view answers if can view rating" ON public.rating_answers;

CREATE POLICY "view answers if can view rating"
ON public.rating_answers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.ratings r
    LEFT JOIN public.opportunities o ON o.id = r.opportunity_id
    WHERE r.id = rating_answers.rating_id
      AND (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'vp'::app_role)
        OR is_assigned(auth.uid(), r.opportunity_id)
        OR o.created_by = auth.uid()
      )
  )
);

-- 2) Add RLS on realtime.messages so users can only subscribe to their own notification channel
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users subscribe own notif channel" ON realtime.messages;
CREATE POLICY "users subscribe own notif channel"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = ('notifs-' || auth.uid()::text)
);

DROP POLICY IF EXISTS "users broadcast own notif channel" ON realtime.messages;
CREATE POLICY "users broadcast own notif channel"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() = ('notifs-' || auth.uid()::text)
);

-- 3) Fix mutable search_path on helper functions
ALTER FUNCTION public.touch_updated_at() SET search_path = public;
ALTER FUNCTION public.validate_opportunity_dates() SET search_path = public;
