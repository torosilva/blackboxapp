-- ============================================================
-- Migration: usage_events — Per-user, per-component cost metering
-- One row per billable AI call. cost_usd is computed at write
-- time by the edge functions (see _shared/usage.ts).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.usage_events (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at          timestamptz NOT NULL DEFAULT now(),
    user_id             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    component           text NOT NULL,
    provider            text NOT NULL,
    model               text NOT NULL,
    input_tokens        integer NOT NULL DEFAULT 0,
    output_tokens       integer NOT NULL DEFAULT 0,
    cache_read_tokens   integer NOT NULL DEFAULT 0,
    cache_write_tokens  integer NOT NULL DEFAULT 0,
    units               numeric NOT NULL DEFAULT 0,
    unit_type           text NOT NULL DEFAULT 'tokens',
    cost_usd            numeric(14,8) NOT NULL DEFAULT 0,
    meta                jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_usage_events_user_created
    ON public.usage_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_component_created
    ON public.usage_events(component, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_created
    ON public.usage_events(created_at DESC);

-- RLS: enabled with NO public policies. The edge functions write with the
-- service-role key (which bypasses RLS). Normal users get NOTHING directly.
-- Admin reads happen only through the SECURITY DEFINER functions below.
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

-- ─── Admin flag ──────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = uid), false);
$$;

-- ─── Aggregated overview for the admin panel ─────────────────────────────────
-- Returns ONE json object: totals + breakdown by component (with %) +
-- top users + daily trend, for the given window.
CREATE OR REPLACE FUNCTION public.admin_usage_overview(
    p_from timestamptz DEFAULT (now() - interval '30 days'),
    p_to   timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_total numeric;
    result  jsonb;
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'not authorized';
    END IF;

    SELECT COALESCE(sum(cost_usd), 0) INTO v_total
    FROM public.usage_events
    WHERE created_at >= p_from AND created_at < p_to;

    result := jsonb_build_object(
        'from', p_from,
        'to', p_to,
        'total_cost', round(v_total, 4),
        'event_count', (
            SELECT count(*) FROM public.usage_events
            WHERE created_at >= p_from AND created_at < p_to
        ),
        'active_users', (
            SELECT count(DISTINCT user_id) FROM public.usage_events
            WHERE created_at >= p_from AND created_at < p_to
        ),
        'by_component', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'component', component,
                'cost', round(c, 4),
                'events', e,
                'pct', CASE WHEN v_total > 0 THEN round(100 * c / v_total, 1) ELSE 0 END
            ) ORDER BY c DESC)
            FROM (
                SELECT component, sum(cost_usd) c, count(*) e
                FROM public.usage_events
                WHERE created_at >= p_from AND created_at < p_to
                GROUP BY component
            ) q
        ), '[]'::jsonb),
        'top_users', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'user_id', u.user_id,
                'email', p.email,
                'cost', round(u.c, 4),
                'events', u.e
            ) ORDER BY u.c DESC)
            FROM (
                SELECT user_id, sum(cost_usd) c, count(*) e
                FROM public.usage_events
                WHERE created_at >= p_from AND created_at < p_to
                GROUP BY user_id
                ORDER BY c DESC
                LIMIT 50
            ) u
            LEFT JOIN public.profiles p ON p.id = u.user_id
        ), '[]'::jsonb),
        'daily', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('day', d, 'cost', round(c, 4)) ORDER BY d)
            FROM (
                SELECT date_trunc('day', created_at)::date d, sum(cost_usd) c
                FROM public.usage_events
                WHERE created_at >= p_from AND created_at < p_to
                GROUP BY 1
            ) dd
        ), '[]'::jsonb)
    );

    RETURN result;
END;
$$;

-- ─── Per-user drill-down ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_user_usage(
    p_user_id uuid,
    p_from timestamptz DEFAULT (now() - interval '30 days'),
    p_to   timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    result jsonb;
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'not authorized';
    END IF;

    SELECT jsonb_build_object(
        'user_id', p_user_id,
        'total_cost', round(COALESCE(sum(cost_usd), 0), 4),
        'by_component', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'component', component,
                'cost', round(c, 4),
                'events', e
            ) ORDER BY c DESC)
            FROM (
                SELECT component, sum(cost_usd) c, count(*) e
                FROM public.usage_events
                WHERE user_id = p_user_id AND created_at >= p_from AND created_at < p_to
                GROUP BY component
            ) q
        ), '[]'::jsonb)
    )
    INTO result
    FROM public.usage_events
    WHERE user_id = p_user_id AND created_at >= p_from AND created_at < p_to;

    RETURN COALESCE(result, jsonb_build_object('user_id', p_user_id, 'total_cost', 0, 'by_component', '[]'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_usage_overview(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_usage(uuid, timestamptz, timestamptz) TO authenticated;

-- ─── Promote the founder to admin (EDIT THE EMAIL, then it's idempotent) ─────
-- Replace the email with your account, or run this manually after deploy:
--   UPDATE public.profiles SET is_admin = true WHERE email = 'tu-correo@ejemplo.com';

-- Promote you to admin
UPDATE public.profiles SET is_admin = true WHERE email = 'torosilva@gmail.com';
