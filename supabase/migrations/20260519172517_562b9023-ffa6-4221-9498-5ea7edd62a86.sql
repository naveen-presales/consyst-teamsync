
-- TODOS table
CREATE TABLE public.todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, -- the architect who owns/works on the task
  assigned_by uuid, -- NULL = self-added; non-null = assigned by VP/Admin
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo', -- 'todo' | 'in_progress' | 'done'
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_todos_user ON public.todos(user_id);
CREATE INDEX idx_todos_assigned_by ON public.todos(assigned_by);

ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

-- Owners can view their own; VPs/Admins can view all
CREATE POLICY "view own or vp/admin all todos" ON public.todos
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR assigned_by = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'vp'::app_role)
  );

-- Owners can insert their own self-todos (assigned_by null)
CREATE POLICY "owners insert self todos" ON public.todos
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND assigned_by IS NULL);

-- VPs/Admins can insert assigned todos
CREATE POLICY "vp admin insert assigned todos" ON public.todos
  FOR INSERT TO authenticated
  WITH CHECK (
    assigned_by = auth.uid()
    AND (has_role(auth.uid(), 'vp'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  );

-- Owners can update status/completion of any of their todos; VP/Admin can update any
CREATE POLICY "update own or vp/admin todos" ON public.todos
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'vp'::app_role)
  );

-- Owners can delete own self todos; VP/Admin can delete any
CREATE POLICY "delete own self or vp/admin todos" ON public.todos
  FOR DELETE TO authenticated
  USING (
    (user_id = auth.uid() AND assigned_by IS NULL)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'vp'::app_role)
  );

CREATE TRIGGER trg_todos_touch BEFORE UPDATE ON public.todos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
