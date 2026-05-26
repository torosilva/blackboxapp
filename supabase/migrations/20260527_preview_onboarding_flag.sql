-- ============================================================
-- Migration: preview onboarding flag
-- Permite a usuarios existentes re-ejecutar el onboarding sin
-- perder data. Las entries generadas en preview mode se marcan
-- y pueden descartarse al final del flow.
-- ============================================================

ALTER TABLE public.entries
    ADD COLUMN IF NOT EXISTS is_preview_onboarding boolean DEFAULT false;

-- Index parcial para queries rápidas de cleanup
CREATE INDEX IF NOT EXISTS idx_entries_preview_onboarding
    ON public.entries (user_id, created_at)
    WHERE is_preview_onboarding = true;

-- Permite que el RootNavigator distinga usuario nuevo vs ya completado.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- Función para descartar entries de preview de un usuario
CREATE OR REPLACE FUNCTION public.discard_preview_onboarding_entries(p_user_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count int;
BEGIN
    DELETE FROM public.entries
    WHERE user_id = p_user_id
      AND is_preview_onboarding = true;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.discard_preview_onboarding_entries(uuid)
    TO authenticated;

-- Función para confirmar entries de preview (quitar flag — pasan a ser normales)
CREATE OR REPLACE FUNCTION public.confirm_preview_onboarding_entries(p_user_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    updated_count int;
BEGIN
    UPDATE public.entries
    SET is_preview_onboarding = false
    WHERE user_id = p_user_id
      AND is_preview_onboarding = true;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_preview_onboarding_entries(uuid)
    TO authenticated;
