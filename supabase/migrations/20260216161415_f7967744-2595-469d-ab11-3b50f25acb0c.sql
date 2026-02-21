
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT,
  full_name TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own projects" ON public.projects FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Templates table
CREATE TABLE public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  fields JSONB NOT NULL DEFAULT '[]',
  prompt_template TEXT NOT NULL DEFAULT '',
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view system or own templates" ON public.templates FOR SELECT USING (is_system = true OR auth.uid() = user_id);
CREATE POLICY "Users can insert own templates" ON public.templates FOR INSERT WITH CHECK (auth.uid() = user_id AND is_system = false);
CREATE POLICY "Users can update own templates" ON public.templates FOR UPDATE USING (auth.uid() = user_id AND is_system = false);
CREATE POLICY "Users can delete own templates" ON public.templates FOR DELETE USING (auth.uid() = user_id AND is_system = false);

-- Generations table
CREATE TABLE public.generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.templates(id) ON DELETE SET NULL,
  input_data JSONB NOT NULL DEFAULT '{}',
  result TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own generations" ON public.generations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- User quotas table
CREATE TABLE public.user_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free',
  monthly_limit INTEGER NOT NULL DEFAULT 50,
  generations_used INTEGER NOT NULL DEFAULT 0,
  reset_date DATE NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month')::date
);

ALTER TABLE public.user_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quota" ON public.user_quotas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own quota" ON public.user_quotas FOR UPDATE USING (auth.uid() = user_id);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON public.templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile and quota on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  
  INSERT INTO public.user_quotas (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed system templates
INSERT INTO public.templates (name, description, category, fields, prompt_template, is_system) VALUES
('Blog Post', 'Generate a complete blog post with title, introduction, body, and conclusion.', 'content', '[{"name":"topic","label":"Topic","type":"text","required":true},{"name":"tone","label":"Tone","type":"select","options":["professional","casual","technical","creative"],"required":true},{"name":"length","label":"Length","type":"select","options":["short","medium","long"],"required":true}]', 'Write a {{length}} blog post about {{topic}} in a {{tone}} tone.', true),
('Social Media Post', 'Create engaging social media content for multiple platforms.', 'social', '[{"name":"platform","label":"Platform","type":"select","options":["Instagram","Twitter","LinkedIn","Facebook"],"required":true},{"name":"topic","label":"Topic","type":"text","required":true},{"name":"cta","label":"Call to Action","type":"text","required":false}]', 'Create a {{platform}} post about {{topic}}. Include call to action: {{cta}}.', true),
('Email Marketing', 'Draft professional marketing emails with subject lines and body content.', 'email', '[{"name":"product","label":"Product/Service","type":"text","required":true},{"name":"audience","label":"Target Audience","type":"text","required":true},{"name":"goal","label":"Email Goal","type":"select","options":["awareness","conversion","retention","announcement"],"required":true}]', 'Write a marketing email for {{product}} targeting {{audience}} with the goal of {{goal}}.', true),
('Product Description', 'Generate compelling product descriptions for e-commerce.', 'ecommerce', '[{"name":"product_name","label":"Product Name","type":"text","required":true},{"name":"features","label":"Key Features","type":"textarea","required":true},{"name":"audience","label":"Target Audience","type":"text","required":true}]', 'Write a product description for {{product_name}} highlighting features: {{features}}, targeting {{audience}}.', true),
('Landing Page Copy', 'Create persuasive landing page copy with headlines and CTAs.', 'marketing', '[{"name":"product","label":"Product/Service","type":"text","required":true},{"name":"usp","label":"Unique Selling Point","type":"text","required":true},{"name":"target","label":"Target Audience","type":"text","required":true}]', 'Write landing page copy for {{product}} with USP: {{usp}}, targeting {{target}}.', true),
('SEO Meta Tags', 'Generate optimized meta titles and descriptions for web pages.', 'seo', '[{"name":"page_topic","label":"Page Topic","type":"text","required":true},{"name":"keywords","label":"Target Keywords","type":"text","required":true},{"name":"brand","label":"Brand Name","type":"text","required":false}]', 'Generate SEO meta title and description for a page about {{page_topic}} targeting keywords: {{keywords}} for brand {{brand}}.', true);
