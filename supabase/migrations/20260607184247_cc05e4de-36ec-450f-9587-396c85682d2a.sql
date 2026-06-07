
-- Enums
CREATE TYPE public.goal_scope AS ENUM ('team', 'department', 'individual');
CREATE TYPE public.goal_measurement AS ENUM ('numeric', 'percentage', 'currency', 'boolean');
CREATE TYPE public.goal_operator AS ENUM ('gte', 'gt', 'eq', 'lte', 'lt');

-- Goals table
CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope public.goal_scope NOT NULL,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  target_metric text,
  measurement_type public.goal_measurement NOT NULL DEFAULT 'numeric',
  operator public.goal_operator NOT NULL DEFAULT 'gte',
  target_value numeric NOT NULL,
  start_date date NOT NULL,
  due_date date NOT NULL,
  duration text,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope = 'individual' AND owner_id IS NOT NULL) OR scope <> 'individual')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

-- View: team/department visible to all approved; individual visible to owner + vp/admin
CREATE POLICY "View goals"
ON public.goals FOR SELECT TO authenticated
USING (
  public.is_approved(auth.uid()) AND (
    scope IN ('team','department')
    OR owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'vp') OR public.has_role(auth.uid(), 'admin')
  )
);

-- Insert: vp/admin can create team/department; any approved user can create their own individual
CREATE POLICY "Create goals"
ON public.goals FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid() AND public.is_approved(auth.uid()) AND (
    (scope IN ('team','department') AND (public.has_role(auth.uid(), 'vp') OR public.has_role(auth.uid(), 'admin')))
    OR (scope = 'individual' AND owner_id = auth.uid())
  )
);

-- Update: vp/admin for team/dept; owner for their individual
CREATE POLICY "Update goals"
ON public.goals FOR UPDATE TO authenticated
USING (
  (scope IN ('team','department') AND (public.has_role(auth.uid(), 'vp') OR public.has_role(auth.uid(), 'admin')))
  OR (scope = 'individual' AND owner_id = auth.uid())
)
WITH CHECK (
  (scope IN ('team','department') AND (public.has_role(auth.uid(), 'vp') OR public.has_role(auth.uid(), 'admin')))
  OR (scope = 'individual' AND owner_id = auth.uid())
);

-- Delete: same rules
CREATE POLICY "Delete goals"
ON public.goals FOR DELETE TO authenticated
USING (
  (scope IN ('team','department') AND (public.has_role(auth.uid(), 'vp') OR public.has_role(auth.uid(), 'admin')))
  OR (scope = 'individual' AND owner_id = auth.uid())
);

CREATE TRIGGER goals_touch_updated_at BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Progress table
CREATE TABLE public.goal_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  period_month date NOT NULL, -- first day of the month
  value numeric NOT NULL,
  note text,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (goal_id, period_month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_progress TO authenticated;
GRANT ALL ON public.goal_progress TO service_role;
ALTER TABLE public.goal_progress ENABLE ROW LEVEL SECURITY;

-- View progress if user can view the goal
CREATE POLICY "View goal progress"
ON public.goal_progress FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.goals g
    WHERE g.id = goal_id AND (
      g.scope IN ('team','department')
      OR g.owner_id = auth.uid()
      OR public.has_role(auth.uid(), 'vp') OR public.has_role(auth.uid(), 'admin')
    )
  )
);

-- Insert/Update/Delete progress: same edit rules as the parent goal
CREATE POLICY "Manage goal progress insert"
ON public.goal_progress FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.goals g WHERE g.id = goal_id AND (
      (g.scope IN ('team','department') AND (public.has_role(auth.uid(),'vp') OR public.has_role(auth.uid(),'admin')))
      OR (g.scope = 'individual' AND g.owner_id = auth.uid())
    )
  )
);

CREATE POLICY "Manage goal progress update"
ON public.goal_progress FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.goals g WHERE g.id = goal_id AND (
      (g.scope IN ('team','department') AND (public.has_role(auth.uid(),'vp') OR public.has_role(auth.uid(),'admin')))
      OR (g.scope = 'individual' AND g.owner_id = auth.uid())
    )
  )
);

CREATE POLICY "Manage goal progress delete"
ON public.goal_progress FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.goals g WHERE g.id = goal_id AND (
      (g.scope IN ('team','department') AND (public.has_role(auth.uid(),'vp') OR public.has_role(auth.uid(),'admin')))
      OR (g.scope = 'individual' AND g.owner_id = auth.uid())
    )
  )
);

CREATE TRIGGER goal_progress_touch_updated_at BEFORE UPDATE ON public.goal_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX goals_scope_idx ON public.goals(scope);
CREATE INDEX goals_owner_idx ON public.goals(owner_id);
CREATE INDEX goal_progress_goal_idx ON public.goal_progress(goal_id);
