-- ============================================================
-- Migration: loop lanes + avoidance diagnosis
-- Adds the 3-lane state (hoy / rondando / regresa / hecha) to
-- action_items plus the differentiator field: avoidance_reason
-- (WHY the user keeps not closing this loop).
-- ============================================================

ALTER TABLE public.action_items
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'hoy'
        CHECK (status IN ('hoy', 'rondando', 'regresa', 'hecha')),
    ADD COLUMN IF NOT EXISTS recurrence_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS connected_theme text,
    ADD COLUMN IF NOT EXISTS avoidance_reason text,
    ADD COLUMN IF NOT EXISTS last_surfaced_at timestamptz;

-- Backfill: completed loops → 'hecha'; everything else stays 'hoy'
-- (analyze-entry will start tagging new ones hoy/rondando).
UPDATE public.action_items
    SET status = 'hecha'
    WHERE is_completed = true AND status <> 'hecha';

CREATE INDEX IF NOT EXISTS idx_action_items_user_status
    ON public.action_items(user_id, status);
