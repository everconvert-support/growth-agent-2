DROP TABLE IF EXISTS public.candidates;
DROP TYPE IF EXISTS public.test_status;

CREATE TABLE public.trial_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  answer_found text NOT NULL DEFAULT '',
  answer_changed text NOT NULL DEFAULT '',
  answer_not_changed text NOT NULL DEFAULT '',
  answer_next_day text NOT NULL DEFAULT '',
  repo_url text,
  commit_sha text,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.trial_submissions TO authenticated;
GRANT ALL ON public.trial_submissions TO service_role;

ALTER TABLE public.trial_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY submissions_select_own ON public.trial_submissions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY submissions_insert_own ON public.trial_submissions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY submissions_update_own ON public.trial_submissions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trial_submissions_touch BEFORE UPDATE ON public.trial_submissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- The fictional PagePilot service's own token registry. Deliberately NOT the
-- same thing as integrations.status: our database can say "connected" while the
-- external service considers the token expired or revoked.
CREATE TABLE public.pagepilot_service_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  state text NOT NULL DEFAULT 'valid' CHECK (state IN ('valid', 'expired', 'revoked')),
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.pagepilot_service_tokens TO service_role;

ALTER TABLE public.pagepilot_service_tokens ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER pagepilot_service_tokens_touch BEFORE UPDATE ON public.pagepilot_service_tokens
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.pagepilot_service_tokens (token, state, expires_at)
SELECT i.access_token,
       CASE WHEN w.slug = 'brightlearn' THEN 'expired' ELSE 'valid' END,
       CASE WHEN w.slug = 'brightlearn' THEN now() - interval '2 days' ELSE now() + interval '30 days' END
FROM public.integrations i
JOIN public.workspaces w ON w.id = i.workspace_id
WHERE i.access_token IS NOT NULL
ON CONFLICT (token) DO NOTHING;
