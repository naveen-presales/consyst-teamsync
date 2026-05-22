CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE user_count INTEGER;
BEGIN
  IF NEW.email IS NULL OR lower(NEW.email) NOT LIKE '%@consyst.biz' THEN
    RAISE EXCEPTION 'invalid credentials';
  END IF;

  SELECT COUNT(*) INTO user_count FROM public.profiles;
  IF user_count = 0 THEN
    INSERT INTO public.profiles (id, full_name, email, status)
      VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email, 'approved');
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.profiles (id, full_name, email, status)
      VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email, 'pending');
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'architect');
  END IF;
  RETURN NEW;
END; $function$;