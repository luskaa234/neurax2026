ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS creation_mode text,
  ADD COLUMN IF NOT EXISTS original_prompt text,
  ADD COLUMN IF NOT EXISTS parsed_prompt text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'projects_creation_mode_check'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_creation_mode_check
      CHECK (creation_mode IS NULL OR creation_mode IN ('intent', 'manual'));
  END IF;
END $$;
