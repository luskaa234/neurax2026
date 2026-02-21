ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS stack text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_provider text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'projects_status_check'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_status_check
      CHECK (status IN ('draft', 'parsing', 'generating', 'writing', 'building', 'ready', 'error'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.project_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  path text NOT NULL,
  content text NOT NULL DEFAULT '',
  hash text,
  size integer NOT NULL DEFAULT 0,
  is_dirty boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, path)
);

CREATE TABLE IF NOT EXISTS public.project_file_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES public.project_files(id) ON DELETE CASCADE,
  content text NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version integer NOT NULL,
  ai_provider text,
  build_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, version)
);

CREATE TABLE IF NOT EXISTS public.project_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  action text NOT NULL,
  file_path text,
  user_id uuid NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON public.project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_path ON public.project_files(path);
CREATE INDEX IF NOT EXISTS idx_project_file_versions_file_id ON public.project_file_versions(file_id);
CREATE INDEX IF NOT EXISTS idx_project_versions_project_id ON public.project_versions(project_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_project_logs_project_id ON public.project_logs(project_id, timestamp DESC);

ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_file_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'project_files' AND policyname = 'Users can manage own project files'
  ) THEN
    CREATE POLICY "Users can manage own project files"
      ON public.project_files FOR ALL
      USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_files.project_id AND p.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_files.project_id AND p.user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'project_file_versions' AND policyname = 'Users can manage own project file versions'
  ) THEN
    CREATE POLICY "Users can manage own project file versions"
      ON public.project_file_versions FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.project_files pf
          JOIN public.projects p ON p.id = pf.project_id
          WHERE pf.id = project_file_versions.file_id AND p.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.project_files pf
          JOIN public.projects p ON p.id = pf.project_id
          WHERE pf.id = project_file_versions.file_id AND p.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'project_versions' AND policyname = 'Users can manage own project versions'
  ) THEN
    CREATE POLICY "Users can manage own project versions"
      ON public.project_versions FOR ALL
      USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_versions.project_id AND p.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_versions.project_id AND p.user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'project_logs' AND policyname = 'Users can manage own project logs'
  ) THEN
    CREATE POLICY "Users can manage own project logs"
      ON public.project_logs FOR ALL
      USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_logs.project_id AND p.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_logs.project_id AND p.user_id = auth.uid()));
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_project_files_updated_at ON public.project_files;
CREATE TRIGGER update_project_files_updated_at
  BEFORE UPDATE ON public.project_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
SELECT 'project-artifacts', 'project-artifacts', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'project-artifacts');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can read own project artifacts'
  ) THEN
    CREATE POLICY "Users can read own project artifacts"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'project-artifacts' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Service can insert project artifacts'
  ) THEN
    CREATE POLICY "Service can insert project artifacts"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'project-artifacts');
  END IF;
END $$;
