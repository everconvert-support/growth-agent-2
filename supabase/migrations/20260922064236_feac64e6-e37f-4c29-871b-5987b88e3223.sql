
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin');
CREATE TYPE public.workspace_role AS ENUM ('owner','member');
CREATE TYPE public.rec_status AS ENUM ('open','approved','rejected','executed');
CREATE TYPE public.action_status AS ENUM ('proposed','approved','rejected','executed','failed');
CREATE TYPE public.exec_status AS ENUM ('pending','succeeded','failed');
CREATE TYPE public.integration_status AS ENUM ('connected','disconnected');
CREATE TYPE public.test_status AS ENUM ('not_started','in_progress','submitted','expired');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_self" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_self" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- WORKSPACES
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.workspace_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
GRANT SELECT ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_select_self" ON public.workspace_members FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id
  )
$$;

CREATE POLICY "workspaces_select_member" ON public.workspaces FOR SELECT TO authenticated
  USING (public.is_workspace_member(id, auth.uid()));

-- INTEGRATIONS
CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'pagepilot',
  status public.integration_status NOT NULL DEFAULT 'disconnected',
  access_token TEXT,
  connected_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  UNIQUE (workspace_id, provider)
);
GRANT SELECT, UPDATE ON public.integrations TO authenticated;
GRANT ALL ON public.integrations TO service_role;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "integrations_select" ON public.integrations FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

-- RECOMMENDATIONS
CREATE TABLE public.recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces ON DELETE CASCADE,
  title TEXT NOT NULL,
  finding TEXT NOT NULL,
  why_it_matters TEXT NOT NULL,
  page_url TEXT NOT NULL,
  status public.rec_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.recommendations TO authenticated;
GRANT ALL ON public.recommendations TO service_role;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recommendations_select" ON public.recommendations FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

-- PROPOSED ACTIONS
CREATE TABLE public.proposed_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces ON DELETE CASCADE,
  recommendation_id UUID NOT NULL REFERENCES public.recommendations ON DELETE CASCADE,
  action_type TEXT NOT NULL DEFAULT 'change_cta',
  input JSONB NOT NULL,
  status public.action_status NOT NULL DEFAULT 'proposed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.proposed_actions TO authenticated;
GRANT ALL ON public.proposed_actions TO service_role;
ALTER TABLE public.proposed_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "actions_select" ON public.proposed_actions FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

-- APPROVALS
CREATE TABLE public.approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces ON DELETE CASCADE,
  action_id UUID NOT NULL UNIQUE REFERENCES public.proposed_actions ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('approved','rejected')),
  decided_by UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  note TEXT,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.approvals TO authenticated;
GRANT ALL ON public.approvals TO service_role;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approvals_select" ON public.approvals FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

-- EXECUTIONS
CREATE TABLE public.executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces ON DELETE CASCADE,
  action_id UUID NOT NULL REFERENCES public.proposed_actions ON DELETE CASCADE,
  approval_id UUID NOT NULL REFERENCES public.approvals ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL UNIQUE,
  attempts INTEGER NOT NULL DEFAULT 0,
  status public.exec_status NOT NULL DEFAULT 'pending',
  provider_response JSONB,
  verified_at TIMESTAMPTZ,
  verification_result TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.executions TO authenticated;
GRANT ALL ON public.executions TO service_role;
ALTER TABLE public.executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "executions_select" ON public.executions FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

-- AUDIT LOG
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_id UUID REFERENCES auth.users ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_select" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

-- CANDIDATES (admin area)
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  status public.test_status NOT NULL DEFAULT 'not_started',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  repo_url TEXT,
  commit_sha TEXT,
  answer_found TEXT,
  answer_changed TEXT,
  answer_not_changed TEXT,
  answer_next_day TEXT,
  evaluator_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidates TO authenticated;
GRANT ALL ON public.candidates TO service_role;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "candidates_admin_all" ON public.candidates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "candidates_select_own" ON public.candidates FOR SELECT TO authenticated
  USING (email = (SELECT email FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "candidates_update_own" ON public.candidates FOR UPDATE TO authenticated
  USING (email = (SELECT email FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (email = (SELECT email FROM public.profiles WHERE id = auth.uid()));

-- DEMO ACCOUNT MAPPING (fake sign-up emails -> workspace / admin)
CREATE TABLE public.demo_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  workspace_slug TEXT,
  workspace_role public.workspace_role NOT NULL DEFAULT 'member',
  UNIQUE (email, workspace_slug)
);
GRANT SELECT ON public.demo_accounts TO authenticated, anon;
GRANT ALL ON public.demo_accounts TO service_role;
ALTER TABLE public.demo_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo_accounts_read" ON public.demo_accounts FOR SELECT TO authenticated, anon USING (true);

-- SIGNUP HANDLER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  SELECT NEW.id, 'admin'::public.app_role
  FROM public.demo_accounts d
  WHERE lower(d.email) = lower(NEW.email) AND d.is_admin
  ON CONFLICT DO NOTHING;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  SELECT w.id, NEW.id, d.workspace_role
  FROM public.demo_accounts d
  JOIN public.workspaces w ON w.slug = d.workspace_slug
  WHERE lower(d.email) = lower(NEW.email)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER executions_touch BEFORE UPDATE ON public.executions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER candidates_touch BEFORE UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- SEED: fictional workspaces
INSERT INTO public.workspaces (id, name, slug) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Acme Fitness', 'acme-fitness'),
  ('22222222-2222-4222-8222-222222222222', 'BrightLearn', 'brightlearn'),
  ('33333333-3333-4333-8333-333333333333', 'Northstar Commerce', 'northstar-commerce');

INSERT INTO public.integrations (workspace_id, provider, status, access_token, connected_at, last_checked_at) VALUES
  ('11111111-1111-4111-8111-111111111111', 'pagepilot', 'connected', 'pp_fake_acme_7f3a', now() - interval '9 days', now()),
  ('22222222-2222-4222-8222-222222222222', 'pagepilot', 'connected', 'pp_fake_bright_2c19', now() - interval '3 days', now()),
  ('33333333-3333-4333-8333-333333333333', 'pagepilot', 'disconnected', NULL, NULL, now());

INSERT INTO public.recommendations (id, workspace_id, title, finding, why_it_matters, page_url) VALUES
  ('aaaa1111-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'Landing page CTA may be underperforming',
   'The hero CTA "Learn More" has a 1.2% click-through rate across 8,400 fake sessions, well below the 3.1% benchmark for comparable pages.',
   'The hero CTA is the primary conversion path. A clearer, action-led label typically lifts trial starts without any additional traffic spend.',
   'https://acmefitness.example.com/'),
  ('aaaa1111-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222',
   'Course signup CTA is vague',
   'The "Learn More" button on the course overview page is clicked by 0.9% of visitors in synthetic data, while the secondary link outperforms it.',
   'Prospective learners need an explicit next step. A direct CTA reduces drop-off before the enrolment form.',
   'https://brightlearn.example.com/courses'),
  ('aaaa1111-0000-4000-8000-000000000003', '33333333-3333-4333-8333-333333333333',
   'Checkout page CTA wording is unclear',
   'The "Learn More" label appears on the pricing page where visitors expect a purchase action; synthetic exit rate is 71%.',
   'Wording mismatch at purchase intent is one of the cheapest conversion fixes available.',
   'https://northstar.example.com/pricing');

INSERT INTO public.proposed_actions (id, workspace_id, recommendation_id, action_type, input) VALUES
  ('bbbb1111-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'aaaa1111-0000-4000-8000-000000000001', 'change_cta',
   '{"page_url":"https://acmefitness.example.com/","existing_cta":"Learn More","new_cta":"Start Free Trial"}'::jsonb),
  ('bbbb1111-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'aaaa1111-0000-4000-8000-000000000002', 'change_cta',
   '{"page_url":"https://brightlearn.example.com/courses","existing_cta":"Learn More","new_cta":"Enrol Today"}'::jsonb),
  ('bbbb1111-0000-4000-8000-000000000003', '33333333-3333-4333-8333-333333333333', 'aaaa1111-0000-4000-8000-000000000003', 'change_cta',
   '{"page_url":"https://northstar.example.com/pricing","existing_cta":"Learn More","new_cta":"Start Free Trial"}'::jsonb);

INSERT INTO public.audit_logs (workspace_id, event_type, entity_type, entity_id, details) VALUES
  ('11111111-1111-4111-8111-111111111111', 'recommendation.created', 'recommendation', 'aaaa1111-0000-4000-8000-000000000001', '{"source":"synthetic detector"}'::jsonb),
  ('11111111-1111-4111-8111-111111111111', 'action.proposed', 'proposed_action', 'bbbb1111-0000-4000-8000-000000000001', '{"action_type":"change_cta"}'::jsonb),
  ('22222222-2222-4222-8222-222222222222', 'recommendation.created', 'recommendation', 'aaaa1111-0000-4000-8000-000000000002', '{"source":"synthetic detector"}'::jsonb),
  ('22222222-2222-4222-8222-222222222222', 'action.proposed', 'proposed_action', 'bbbb1111-0000-4000-8000-000000000002', '{"action_type":"change_cta"}'::jsonb),
  ('33333333-3333-4333-8333-333333333333', 'recommendation.created', 'recommendation', 'aaaa1111-0000-4000-8000-000000000003', '{"source":"synthetic detector"}'::jsonb),
  ('33333333-3333-4333-8333-333333333333', 'action.proposed', 'proposed_action', 'bbbb1111-0000-4000-8000-000000000003', '{"action_type":"change_cta"}'::jsonb);

INSERT INTO public.demo_accounts (email, is_admin, workspace_slug, workspace_role) VALUES
  ('dana@acmefitness.example.com', false, 'acme-fitness', 'owner'),
  ('sam@brightlearn.example.com', false, 'brightlearn', 'owner'),
  ('kim@northstar.example.com', false, 'northstar-commerce', 'owner'),
  ('multi@growthagent.example.com', false, 'acme-fitness', 'member'),
  ('multi@growthagent.example.com', false, 'brightlearn', 'member'),
  ('admin@growthagent.example.com', true, NULL, 'member');
