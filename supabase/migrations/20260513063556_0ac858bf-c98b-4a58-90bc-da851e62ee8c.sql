
-- Profiles: allow VPs to update any profile
DROP POLICY IF EXISTS "admins update any profile" ON public.profiles;
CREATE POLICY "admins or vps update any profile"
ON public.profiles FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vp'));

-- user_roles: allow VPs to manage roles
DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
CREATE POLICY "admins or vps manage roles"
ON public.user_roles FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vp'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vp'));

DROP POLICY IF EXISTS "admins view all roles" ON public.user_roles;
CREATE POLICY "admins or vps view all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'vp'));
