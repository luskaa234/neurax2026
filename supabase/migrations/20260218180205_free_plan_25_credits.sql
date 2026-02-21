-- Set free plan to 25 credits/month as default and current value

ALTER TABLE public.user_quotas
  ALTER COLUMN monthly_limit SET DEFAULT 25;

UPDATE public.user_quotas
SET monthly_limit = 25
WHERE plan = 'free';
