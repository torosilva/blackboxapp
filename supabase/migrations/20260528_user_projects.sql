-- ============================================================
-- Migration: user_projects — AI-detected projects & life areas
-- Run via `supabase db push` or in Supabase SQL Editor → New Query.
-- Pairs with: supabase/functions/detect-projects/index.ts
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_projects (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name            text NOT NULL,
    description     text NOT NULL DEFAULT '',
    entry_ids       uuid[] NOT NULL DEFAULT '{}',
    frequency       integer NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now(),
    last_updated    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_projects_user
    ON public.user_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_user_projects_user_updated
    ON public.user_projects(user_id, last_updated DESC);
-- Same user can't have two projects with the exact same name (case-insensitive
-- dedup happens in the EF, but enforce it at the storage layer too).
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_project_name
    ON public.user_projects(user_id, lower(name));

-- Auto-update last_updated on writes.
CREATE OR REPLACE FUNCTION public.touch_user_projects_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.last_updated = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_projects_updated ON public.user_projects;
CREATE TRIGGER trg_user_projects_updated
    BEFORE UPDATE ON public.user_projects
    FOR EACH ROW EXECUTE FUNCTION public.touch_user_projects_updated();

-- RLS: each user reads/writes only their own rows.
ALTER TABLE public.user_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own projects" ON public.user_projects;
CREATE POLICY "Users read own projects"
    ON public.user_projects
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own projects" ON public.user_projects;
CREATE POLICY "Users insert own projects"
    ON public.user_projects
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own projects" ON public.user_projects;
CREATE POLICY "Users update own projects"
    ON public.user_projects
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own projects" ON public.user_projects;
CREATE POLICY "Users delete own projects"
    ON public.user_projects
    FOR DELETE
    USING (auth.uid() = user_id);
