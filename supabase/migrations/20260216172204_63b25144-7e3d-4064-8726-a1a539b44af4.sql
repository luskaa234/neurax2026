
-- Create builds table
CREATE TABLE public.builds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  template_id UUID REFERENCES public.templates(id),
  project_id UUID REFERENCES public.projects(id),
  input_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  build_json JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  artifact_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.builds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own builds"
ON public.builds FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Storage bucket for build artifacts
INSERT INTO storage.buckets (id, name, public) VALUES ('build-artifacts', 'build-artifacts', false);

CREATE POLICY "Users can read own build artifacts"
ON storage.objects FOR SELECT
USING (bucket_id = 'build-artifacts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Service can insert build artifacts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'build-artifacts');
