-- ============================================================
-- Migration: link chat threads to their memoria (journal entry)
-- Lets a conversation map to a single entry so reopening a thread
-- updates that memoria instead of creating duplicates.
-- ============================================================

ALTER TABLE public.chat_threads
    ADD COLUMN IF NOT EXISTS entry_id uuid
    REFERENCES public.entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chat_threads_entry_id
    ON public.chat_threads(entry_id);
