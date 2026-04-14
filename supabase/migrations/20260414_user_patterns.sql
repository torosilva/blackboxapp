-- ============================================================
-- Migration: user_patterns — AI-detected behavioural patterns
-- Run in Supabase SQL Editor → New Query
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_patterns (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pattern_type        text NOT NULL CHECK (pattern_type IN ('emotional', 'procrastination', 'cognitive_bias', 'productivity')),
    title               text NOT NULL,
    description         text NOT NULL,
    frequency           integer NOT NULL DEFAULT 1,
    first_seen_at       timestamptz NOT NULL DEFAULT now(),
    last_seen_at        timestamptz NOT NULL DEFAULT now(),
    supporting_entry_ids uuid[] DEFAULT '{}',
    is_active           boolean NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_patterns_user_id   ON public.user_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_user_patterns_active     ON public.user_patterns(user_id, is_active) WHERE is_active = true;
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_pattern       ON public.user_patterns(user_id, pattern_type, title);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_user_patterns_updated_at ON public.user_patterns;
CREATE TRIGGER trg_user_patterns_updated_at
    BEFORE UPDATE ON public.user_patterns
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS
ALTER TABLE public.user_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own patterns"
    ON public.user_patterns
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
