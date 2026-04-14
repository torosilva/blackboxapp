-- ============================================================
-- Migration: Normalize action_items from entries.action_items
-- JSONB array into its own relational table.
-- Run in Supabase SQL Editor → New Query
-- ============================================================

-- 1. Create the normalized table
CREATE TABLE IF NOT EXISTS public.action_items (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entry_id     uuid NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
    task         text NOT NULL,
    priority     text NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
    category     text NOT NULL DEFAULT 'PERSONAL' CHECK (category IN ('BUSINESS', 'PERSONAL', 'DEVELOPMENT', 'WELLNESS')),
    is_completed boolean NOT NULL DEFAULT false,
    completed_at timestamptz,
    created_at   timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_action_items_user_id  ON public.action_items(user_id);
CREATE INDEX IF NOT EXISTS idx_action_items_entry_id ON public.action_items(entry_id);
CREATE INDEX IF NOT EXISTS idx_action_items_open     ON public.action_items(user_id, is_completed) WHERE is_completed = false;

-- RLS: Users can only see and modify their own action items
ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own action items"
    ON public.action_items
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 2. Migrate existing JSONB data from entries.action_items
-- This reads each entry's action_items JSONB array and inserts
-- one row per item into the new table.
INSERT INTO public.action_items (user_id, entry_id, task, priority, category)
SELECT
    e.user_id,
    e.id AS entry_id,
    COALESCE(item->>'task', item->>'description', 'Sin descripción') AS task,
    UPPER(COALESCE(item->>'priority', 'MEDIUM'))::text              AS priority,
    UPPER(COALESCE(item->>'category', 'PERSONAL'))::text            AS category
FROM
    public.entries e,
    jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(e.action_items::jsonb) = 'array' THEN e.action_items::jsonb
            ELSE '[]'::jsonb
        END
    ) AS item
WHERE
    e.action_items IS NOT NULL
    AND jsonb_array_length(
        CASE
            WHEN jsonb_typeof(e.action_items::jsonb) = 'array' THEN e.action_items::jsonb
            ELSE '[]'::jsonb
        END
    ) > 0;

-- Verify migration result
SELECT COUNT(*) AS migrated_action_items FROM public.action_items;
