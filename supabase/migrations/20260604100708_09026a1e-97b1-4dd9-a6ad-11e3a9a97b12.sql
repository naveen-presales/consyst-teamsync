
-- Attach the missing trigger so new auth users get profile + role rows
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill the first existing user (no profile created because trigger was missing)
DO $$
DECLARE u RECORD;
BEGIN
  FOR u IN SELECT id, email, raw_user_meta_data FROM auth.users
           WHERE id NOT IN (SELECT id FROM public.profiles)
           ORDER BY created_at ASC
  LOOP
    IF (SELECT COUNT(*) FROM public.profiles) = 0 THEN
      INSERT INTO public.profiles (id, full_name, email, status)
        VALUES (u.id, COALESCE(u.raw_user_meta_data->>'full_name', u.email), u.email, 'approved');
      INSERT INTO public.user_roles (user_id, role) VALUES (u.id, 'admin')
        ON CONFLICT DO NOTHING;
    ELSE
      INSERT INTO public.profiles (id, full_name, email, status)
        VALUES (u.id, COALESCE(u.raw_user_meta_data->>'full_name', u.email), u.email, 'pending');
      INSERT INTO public.user_roles (user_id, role) VALUES (u.id, 'architect')
        ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;
