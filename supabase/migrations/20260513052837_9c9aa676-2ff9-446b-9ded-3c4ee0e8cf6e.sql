
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'architect', 'vp');
CREATE TYPE public.user_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.opportunity_type AS ENUM ('Budgetary', 'JIH', 'Firm Budgetary', 'Tender');
CREATE TYPE public.opportunity_status AS ENUM ('Pending', 'In Progress', 'Completed');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  status public.user_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_approved(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND status = 'approved')
$$;

-- Opportunities
CREATE TABLE public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  project_name TEXT NOT NULL,
  crm_number TEXT NOT NULL UNIQUE,
  received_date DATE,
  start_date DATE,
  deadline DATE,
  completed_date DATE,
  opportunity_type public.opportunity_type NOT NULL DEFAULT 'Budgetary',
  revision_count INTEGER NOT NULL DEFAULT 0 CHECK (revision_count >= 0),
  status public.opportunity_status NOT NULL DEFAULT 'Pending',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- Validation: completed >= start
CREATE OR REPLACE FUNCTION public.validate_opportunity_dates()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.completed_date IS NOT NULL AND NEW.start_date IS NOT NULL AND NEW.completed_date < NEW.start_date THEN
    RAISE EXCEPTION 'Completed date cannot be earlier than start date';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_validate_opp_dates BEFORE INSERT OR UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.validate_opportunity_dates();

-- Architect assignments
CREATE TABLE public.opportunity_architects (
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (opportunity_id, user_id)
);
ALTER TABLE public.opportunity_architects ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_assigned(_user_id UUID, _opp_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.opportunity_architects WHERE opportunity_id = _opp_id AND user_id = _user_id)
$$;

-- Documents
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_documents_updated BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Rating questions
CREATE TABLE public.rating_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rating_questions ENABLE ROW LEVEL SECURITY;

INSERT INTO public.rating_questions (text, sort_order) VALUES
  ('Technical accuracy of the solution', 1),
  ('Quality of documentation', 2),
  ('Adherence to deadline', 3),
  ('Client communication quality', 4),
  ('Revision efficiency', 5);

-- Ratings
CREATE TABLE public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  vp_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(opportunity_id, vp_user_id)
);
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.rating_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rating_id UUID NOT NULL REFERENCES public.ratings(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.rating_questions(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  UNIQUE(rating_id, question_id)
);
ALTER TABLE public.rating_answers ENABLE ROW LEVEL SECURITY;

-- Trigger: new user -> profile + first user becomes admin & approved
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_count INTEGER;
BEGIN
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
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== RLS POLICIES =====

-- profiles
CREATE POLICY "view own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "admins/vps view all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vp'));
CREATE POLICY "approved users view profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.is_approved(auth.uid()));
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "admins update any profile" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admins view all roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "approved users view roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_approved(auth.uid()));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- opportunities
CREATE POLICY "admins/vps view opps" ON public.opportunities FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vp'));
CREATE POLICY "architects view assigned opps" ON public.opportunities FOR SELECT TO authenticated
  USING (public.is_assigned(auth.uid(), id) OR created_by = auth.uid());
CREATE POLICY "approved insert opps" ON public.opportunities FOR INSERT TO authenticated
  WITH CHECK (public.is_approved(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "admins update opps" ON public.opportunities FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "architects update assigned opps" ON public.opportunities FOR UPDATE TO authenticated
  USING (public.is_assigned(auth.uid(), id) OR created_by = auth.uid());
CREATE POLICY "admins delete opps" ON public.opportunities FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- opportunity_architects
CREATE POLICY "view assignments if can view opp" ON public.opportunity_architects FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vp')
    OR user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = opportunity_id AND o.created_by = auth.uid())
  );
CREATE POLICY "admins manage assignments" ON public.opportunity_architects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "creators manage assignments" ON public.opportunity_architects FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = opportunity_id AND o.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = opportunity_id AND o.created_by = auth.uid()));

-- documents
CREATE POLICY "view docs if can view opp" ON public.documents FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vp')
    OR public.is_assigned(auth.uid(), opportunity_id)
    OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = opportunity_id AND o.created_by = auth.uid())
  );
CREATE POLICY "manage docs if can view opp" ON public.documents FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.is_assigned(auth.uid(), opportunity_id)
    OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = opportunity_id AND o.created_by = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.is_assigned(auth.uid(), opportunity_id)
    OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = opportunity_id AND o.created_by = auth.uid())
  );

-- rating_questions
CREATE POLICY "approved view rating questions" ON public.rating_questions FOR SELECT TO authenticated
  USING (public.is_approved(auth.uid()));
CREATE POLICY "admins manage rating questions" ON public.rating_questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ratings
CREATE POLICY "admins/vps view all ratings" ON public.ratings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vp'));
CREATE POLICY "architects view ratings on their opps" ON public.ratings FOR SELECT TO authenticated
  USING (public.is_assigned(auth.uid(), opportunity_id)
         OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = opportunity_id AND o.created_by = auth.uid()));
CREATE POLICY "vps insert ratings" ON public.ratings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'vp') AND vp_user_id = auth.uid());
CREATE POLICY "vps update own ratings" ON public.ratings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'vp') AND vp_user_id = auth.uid());
CREATE POLICY "vps delete own ratings" ON public.ratings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'vp') AND vp_user_id = auth.uid());

-- rating_answers
CREATE POLICY "view answers if can view rating" ON public.rating_answers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ratings r WHERE r.id = rating_id));
CREATE POLICY "vps manage own answers" ON public.rating_answers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ratings r WHERE r.id = rating_id AND r.vp_user_id = auth.uid() AND public.has_role(auth.uid(), 'vp')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ratings r WHERE r.id = rating_id AND r.vp_user_id = auth.uid() AND public.has_role(auth.uid(), 'vp')));
