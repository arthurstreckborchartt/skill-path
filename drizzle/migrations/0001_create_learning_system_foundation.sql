CREATE TABLE public.pathly_learning_activity_progress (
  user_id uuid NOT NULL,
  route_signature text NOT NULL,
  activity_id text NOT NULL,
  step_id text NOT NULL,
  skill_names text[] NOT NULL DEFAULT '{}',
  activity_type text NOT NULL DEFAULT 'lesson' CHECK (activity_type IN ('lesson', 'quiz', 'challenge', 'review', 'project')),
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_progress', 'completed')),
  score integer CHECK (score IS NULL OR score BETWEEN 0 AND 100),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  minutes_spent integer NOT NULL DEFAULT 0 CHECK (minutes_spent >= 0),
  confidence integer CHECK (confidence IS NULL OR confidence BETWEEN 1 AND 5),
  completed_at timestamptz,
  review_due_at timestamptz,
  last_answer_correct boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, route_signature, activity_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pathly_learning_activity_progress TO authenticated;
GRANT ALL ON public.pathly_learning_activity_progress TO service_role;
ALTER TABLE public.pathly_learning_activity_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "learning_activity_select_own" ON public.pathly_learning_activity_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "learning_activity_insert_own" ON public.pathly_learning_activity_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "learning_activity_update_own" ON public.pathly_learning_activity_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "learning_activity_delete_own" ON public.pathly_learning_activity_progress FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX pathly_learning_activity_due_idx ON public.pathly_learning_activity_progress (user_id, route_signature, review_due_at) WHERE review_due_at IS NOT NULL;
CREATE INDEX pathly_learning_activity_step_idx ON public.pathly_learning_activity_progress (user_id, route_signature, step_id);

CREATE TABLE public.pathly_xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  route_signature text NOT NULL,
  event_key text NOT NULL,
  source text NOT NULL CHECK (source IN ('lesson', 'quiz', 'challenge', 'review', 'project', 'mastery', 'consistency')),
  amount integer NOT NULL CHECK (amount > 0 AND amount <= 5000),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, route_signature, event_key)
);
GRANT SELECT, INSERT ON public.pathly_xp_events TO authenticated;
GRANT ALL ON public.pathly_xp_events TO service_role;
ALTER TABLE public.pathly_xp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "xp_events_select_own" ON public.pathly_xp_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "xp_events_insert_own" ON public.pathly_xp_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX pathly_xp_events_route_idx ON public.pathly_xp_events (user_id, route_signature, created_at DESC);

CREATE TABLE public.pathly_skill_mastery (
  user_id uuid NOT NULL,
  route_signature text NOT NULL,
  skill_key text NOT NULL,
  skill_name text NOT NULL,
  mastery integer NOT NULL DEFAULT 0 CHECK (mastery BETWEEN 0 AND 100),
  evidence_count integer NOT NULL DEFAULT 0 CHECK (evidence_count >= 0),
  last_practiced_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, route_signature, skill_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pathly_skill_mastery TO authenticated;
GRANT ALL ON public.pathly_skill_mastery TO service_role;
ALTER TABLE public.pathly_skill_mastery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "skill_mastery_select_own" ON public.pathly_skill_mastery FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "skill_mastery_insert_own" ON public.pathly_skill_mastery FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "skill_mastery_update_own" ON public.pathly_skill_mastery FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "skill_mastery_delete_own" ON public.pathly_skill_mastery FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX pathly_skill_mastery_route_idx ON public.pathly_skill_mastery (user_id, route_signature, mastery);

CREATE TABLE public.pathly_project_progress (
  user_id uuid NOT NULL,
  route_signature text NOT NULL,
  project_id text NOT NULL,
  step_id text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'submitted', 'completed')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  evidence_url text,
  reflection text,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, route_signature, project_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pathly_project_progress TO authenticated;
GRANT ALL ON public.pathly_project_progress TO service_role;
ALTER TABLE public.pathly_project_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_progress_select_own" ON public.pathly_project_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "project_progress_insert_own" ON public.pathly_project_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "project_progress_update_own" ON public.pathly_project_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "project_progress_delete_own" ON public.pathly_project_progress FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX pathly_project_progress_route_idx ON public.pathly_project_progress (user_id, route_signature, status);