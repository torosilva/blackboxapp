-- ============================================================
-- Migration: strategic_profiles — Persistent Cognitive Memory
-- Stores longitudinal user context (traits, goals, biases)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.strategic_profiles (
    user_id             uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    cognitive_summary   text DEFAULT 'Analizando perfil...',
    recurring_themes    text[] DEFAULT '{}',
    key_goals           text[] DEFAULT '{}',
    identified_biases   text[] DEFAULT '{}',
    data_points_count   integer NOT NULL DEFAULT 0,
    last_updated_at     timestamptz NOT NULL DEFAULT now(),
    created_at          timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_strategic_profiles_updated ON public.strategic_profiles(last_updated_at);

-- RLS
ALTER TABLE public.strategic_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own strategic profile" ON public.strategic_profiles;
CREATE POLICY "Users view own strategic profile"
    ON public.strategic_profiles
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages strategic profiles" ON public.strategic_profiles;
CREATE POLICY "Service role manages strategic profiles"
    ON public.strategic_profiles
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.touch_strategic_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.last_updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_strategic_profiles_updated_at ON public.strategic_profiles;
CREATE TRIGGER trg_strategic_profiles_updated_at
    BEFORE UPDATE ON public.strategic_profiles
    FOR EACH ROW EXECUTE FUNCTION public.touch_strategic_updated_at();
