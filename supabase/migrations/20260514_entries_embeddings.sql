-- ============================================================
-- Migration: entries embeddings + semantic search
-- Adds pgvector support and semantic similarity search over entries.
-- Embedding dim: 768 (Gemini text-embedding-004 default)
-- ============================================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add embedding column to entries
ALTER TABLE public.entries
    ADD COLUMN IF NOT EXISTS embedding vector(768);

-- 3. Add an IVFFlat index for fast cosine similarity search.
-- Tuning note: lists=100 is reasonable for up to ~100k rows. Bump later if needed.
CREATE INDEX IF NOT EXISTS idx_entries_embedding_cosine
    ON public.entries
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- 4. RPC function: match_entries
-- Given an embedding vector and a user_id, return the top-N most similar entries.
-- Returns id, title, summary, content snippet, similarity score (1 = identical, 0 = orthogonal).
CREATE OR REPLACE FUNCTION public.match_entries(
    p_user_id uuid,
    p_query_embedding vector(768),
    p_match_threshold float DEFAULT 0.5,
    p_match_count int DEFAULT 20
)
RETURNS TABLE (
    id uuid,
    title text,
    summary text,
    content text,
    mood_label text,
    sentiment_score float,
    category text,
    created_at timestamptz,
    similarity float
)
LANGUAGE sql STABLE
AS $$
    SELECT
        e.id,
        e.title,
        e.summary,
        e.content,
        e.mood_label,
        e.sentiment_score,
        e.category,
        e.created_at,
        1 - (e.embedding <=> p_query_embedding) AS similarity
    FROM public.entries e
    WHERE
        e.user_id = p_user_id
        AND e.embedding IS NOT NULL
        AND 1 - (e.embedding <=> p_query_embedding) > p_match_threshold
    ORDER BY e.embedding <=> p_query_embedding ASC
    LIMIT p_match_count;
$$;

-- 5. Grant execute to authenticated users (RLS still applies via user_id filter)
GRANT EXECUTE ON FUNCTION public.match_entries(uuid, vector(768), float, int) TO authenticated, service_role;
