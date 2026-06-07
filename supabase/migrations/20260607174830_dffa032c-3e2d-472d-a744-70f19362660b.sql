DROP TABLE IF EXISTS public.todos CASCADE;
ALTER TABLE public.notifications DROP COLUMN IF EXISTS todo_id;