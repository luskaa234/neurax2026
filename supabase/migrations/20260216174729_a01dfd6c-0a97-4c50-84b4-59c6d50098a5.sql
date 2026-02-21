
-- Build files table (stores individual files from builds)
CREATE TABLE public.build_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id uuid NOT NULL REFERENCES public.builds(id) ON DELETE CASCADE,
  path text NOT NULL,
  content_text text NOT NULL DEFAULT '',
  content_hash text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(build_id, path)
);

ALTER TABLE public.build_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own build files"
  ON public.build_files FOR ALL
  USING (EXISTS (SELECT 1 FROM public.builds WHERE builds.id = build_files.build_id AND builds.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.builds WHERE builds.id = build_files.build_id AND builds.user_id = auth.uid()));

CREATE TRIGGER update_build_files_updated_at
  BEFORE UPDATE ON public.build_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Build previews table
CREATE TABLE public.build_previews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id uuid NOT NULL REFERENCES public.builds(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'manual',
  preview_url text,
  status text NOT NULL DEFAULT 'pending',
  last_deployed_at timestamptz,
  logs_text text,
  UNIQUE(build_id)
);

ALTER TABLE public.build_previews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own build previews"
  ON public.build_previews FOR ALL
  USING (EXISTS (SELECT 1 FROM public.builds WHERE builds.id = build_previews.build_id AND builds.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.builds WHERE builds.id = build_previews.build_id AND builds.user_id = auth.uid()));

-- Add account_status to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS grace_until timestamptz,
  ADD COLUMN IF NOT EXISTS theme_preference text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS language_preference text NOT NULL DEFAULT 'pt-BR';
