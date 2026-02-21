CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_status_check CHECK (status IN ('active', 'past_due', 'suspended'));
  END IF;
END $$;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS creation_mode text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS original_prompt text,
  ADD COLUMN IF NOT EXISTS parsed_prompt jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_provider text,
  ADD COLUMN IF NOT EXISTS stack text[] DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_creation_mode_check'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_creation_mode_check CHECK (creation_mode IN ('intent', 'manual'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  provider text NOT NULL DEFAULT 'manual',
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.preview_sandbox_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued',
  runtime_url text,
  runner_id text,
  started_at timestamptz,
  expires_at timestamptz,
  cpu_limit text,
  memory_limit text,
  timeout_seconds integer NOT NULL DEFAULT 120,
  logs jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  provider text NOT NULL,
  model text NOT NULL,
  task text NOT NULL,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  latency_ms integer NOT NULL DEFAULT 0,
  success boolean NOT NULL DEFAULT true,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preview_sandbox_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'billing_events' AND policyname = 'Users can view own billing events'
  ) THEN
    CREATE POLICY "Users can view own billing events"
      ON public.billing_events FOR SELECT
      USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'billing_events' AND policyname = 'Users can insert own billing events'
  ) THEN
    CREATE POLICY "Users can insert own billing events"
      ON public.billing_events FOR INSERT
      WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'preview_sandbox_instances' AND policyname = 'Users can manage own preview instances'
  ) THEN
    CREATE POLICY "Users can manage own preview instances"
      ON public.preview_sandbox_instances FOR ALL
      USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
      WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_usage_logs' AND policyname = 'Users can view own ai usage logs'
  ) THEN
    CREATE POLICY "Users can view own ai usage logs"
      ON public.ai_usage_logs FOR SELECT
      USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_usage_logs' AND policyname = 'Users can insert own ai usage logs'
  ) THEN
    CREATE POLICY "Users can insert own ai usage logs"
      ON public.ai_usage_logs FOR INSERT
      WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_billing_events_user_id ON public.billing_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_preview_instances_project_id ON public.preview_sandbox_instances(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_preview_instances_user_id ON public.preview_sandbox_instances(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id ON public.ai_usage_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_project_id ON public.ai_usage_logs(project_id, created_at DESC);

DROP TRIGGER IF EXISTS update_preview_sandbox_instances_updated_at ON public.preview_sandbox_instances;
CREATE TRIGGER update_preview_sandbox_instances_updated_at
  BEFORE UPDATE ON public.preview_sandbox_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
