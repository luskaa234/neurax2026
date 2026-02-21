-- Align paid plans with new credit model used in app UX
-- Starter: 50 credits/month, Pro: 150 credits/month, Elite: 500 credits/month

UPDATE public.user_quotas
SET monthly_limit = CASE
  WHEN plan = 'starter' THEN 50
  WHEN plan = 'pro' THEN 150
  WHEN plan = 'elite' THEN 500
  ELSE monthly_limit
END
WHERE plan IN ('starter', 'pro', 'elite');
