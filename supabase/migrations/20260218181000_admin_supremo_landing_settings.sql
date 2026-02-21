CREATE TABLE IF NOT EXISTS public.landing_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hero_badge text NOT NULL DEFAULT 'Orquestração de IA para SaaS',
  hero_title text NOT NULL DEFAULT 'Neurax AI transforma prompts em sistemas reais.',
  hero_subtitle text NOT NULL DEFAULT 'Crie especificações técnicas impecáveis, gere sistemas completos e mantenha a governança de ponta a ponta.',
  cta_primary_text text NOT NULL DEFAULT 'Começar agora',
  cta_secondary_text text NOT NULL DEFAULT 'Ver templates',
  install_banner_enabled boolean NOT NULL DEFAULT true,
  starter_price text NOT NULL DEFAULT 'R$ 97 / mês',
  starter_credits integer NOT NULL DEFAULT 50,
  pro_price text NOT NULL DEFAULT 'R$ 197 / mês',
  pro_credits integer NOT NULL DEFAULT 150,
  elite_price text NOT NULL DEFAULT 'R$ 397 / mês',
  elite_credits integer NOT NULL DEFAULT 500,
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.landing_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active landing settings" ON public.landing_settings;
CREATE POLICY "Public can read active landing settings"
  ON public.landing_settings FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage landing settings" ON public.landing_settings;
CREATE POLICY "Admins can manage landing settings"
  ON public.landing_settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

DROP TRIGGER IF EXISTS update_landing_settings_updated_at ON public.landing_settings;
CREATE TRIGGER update_landing_settings_updated_at
  BEFORE UPDATE ON public.landing_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.landing_settings (is_active)
SELECT true
WHERE NOT EXISTS (SELECT 1 FROM public.landing_settings);
