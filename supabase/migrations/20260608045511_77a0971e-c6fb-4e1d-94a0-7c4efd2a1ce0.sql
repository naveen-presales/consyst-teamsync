DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill any existing auth users missing a profile
DO $$
DECLARE
  u RECORD;
  is_first BOOLEAN;
BEGIN
  FOR u IN
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    WHERE p.id IS NULL
    ORDER BY au.created_at ASC
  LOOP
    is_first := (SELECT COUNT(*) FROM public.profiles) = 0;
    IF is_first THEN
      INSERT INTO public.profiles (id, full_name, email, status)
        VALUES (u.id, COALESCE(u.raw_user_meta_data->>'full_name', u.email), u.email, 'approved');
      INSERT INTO public.user_roles (user_id, role) VALUES (u.id, 'vp') ON CONFLICT DO NOTHING;
      INSERT INTO public.user_roles (user_id, role) VALUES (u.id, 'admin') ON CONFLICT DO NOTHING;
    ELSE
      INSERT INTO public.profiles (id, full_name, email, status)
        VALUES (u.id, COALESCE(u.raw_user_meta_data->>'full_name', u.email), u.email, 'pending');
      INSERT INTO public.user_roles (user_id, role) VALUES (u.id, 'architect') ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;