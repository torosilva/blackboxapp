# Audio Privacy Migration — pasos manuales para Mario

Este documento describe los **2 pasos manuales** que Mario debe ejecutar en Supabase para que la corrección de privacidad del audio (commit que introduce este archivo) surta efecto. El código de la app ya está listo y maneja ambos formatos de `audio_url` (path nuevo y URL pública legacy) — pero hasta que estos pasos se ejecuten, el bucket sigue siendo público y la promesa del Privacy Pact no se cumple.

## Contexto

Hasta antes de esta corrección:
- El bucket `diaries` en Supabase Storage estaba configurado como **público**
- `SupabaseService.uploadAudio()` guardaba la **URL pública completa** en `entries.audio_url`
- Cualquiera con la URL podía descargar el audio sin auth

Después de esta corrección (código):
- `uploadAudio()` ahora guarda solo el **path interno** (`<userId>/<timestamp>.m4a`)
- `getSignedAudioUrl(path, 3600)` genera URLs firmadas temporales (expiran en 1 hora) para reproducción
- El player en EntryDetailScreen pide signed URL en cada playback

Pero la URL pública sigue funcionando hasta que **se cambie el bucket a privado** en Supabase. Y los entries existentes tienen URLs públicas en la DB que deberían normalizarse a paths.

---

## Paso 1 — Cambiar bucket `diaries` a privado

**Solo se puede hacer desde el dashboard de Supabase.**

1. Entra a https://supabase.com/dashboard → selecciona el proyecto de BlackBoxMind
2. Menú lateral → **Storage** → click en el bucket `diaries`
3. Click en el ícono de configuración (engrane) o pestaña **"Configuration"** del bucket
4. Toggle **"Public bucket"** → OFF (privado)
5. Save

**Verificación rápida:** después de hacer el cambio, abre una `audio_url` vieja en navegador (de un entry existente). Debe responder **403** o **error de acceso**. Si responde 200 con el audio, el cambio no se aplicó.

---

## Paso 2 — Normalizar `audio_url` existentes (opcional pero recomendado)

El runtime de la app maneja ambos formatos (URL pública legacy o path), pero por limpieza conviene normalizar la columna a paths.

**Ejecuta este SQL en el editor de Supabase** (SQL Editor → New query):

```sql
-- Convierte URLs públicas completas en paths internos
-- Idempotente: ejecutarlo dos veces no rompe nada
UPDATE public.entries
SET audio_url = regexp_replace(
    audio_url,
    '^.*/object/public/diaries/',
    ''
)
WHERE audio_url LIKE '%/object/public/diaries/%';
```

**Verificación:**

```sql
-- Debe retornar 0 (ya no quedan URLs públicas)
SELECT COUNT(*) FROM public.entries
WHERE audio_url LIKE '%/object/public/diaries/%';

-- Estos son los paths normalizados (formato esperado: "<uuid>/<timestamp>.m4a")
SELECT audio_url FROM public.entries
WHERE audio_url IS NOT NULL
LIMIT 5;
```

---

## Paso 3 (opcional) — Política RLS de Storage

Si quieres además garantizar que **solo el dueño** del archivo puede pedir signed URL (no cualquier usuario autenticado), agrega esta política. Sin ella, cualquier usuario logueado puede pedir signed URL de cualquier path si lo conoce.

**SQL Editor:**

```sql
-- Solo el usuario dueño del path puede pedir signed URLs
-- (los paths tienen formato "<userId>/<timestamp>.m4a")
CREATE POLICY "Users can read their own audio"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'diaries'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can upload their own audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'diaries'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own audio"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'diaries'
    AND (storage.foldername(name))[1] = auth.uid()::text
);
```

Si ya existen políticas anteriores que cubren `storage.objects` para el bucket `diaries`, primero revísalas en Dashboard → Storage → Policies y borra las que ya no apliquen para evitar conflictos.

---

## Verificación end-to-end después de los pasos 1+2

En la app:
1. Abre un entry con audio (cualquiera de los viejos)
2. Verás el player en lugar del badge `🔊 Audio session recorded`
3. Tap play → debe cargar (spinner brevemente) → reproducir
4. Si no carga: revisar en Supabase logs si las signed URLs se están generando OK

Si el paso 3 (RLS) también se ejecutó, prueba además:
1. Logueate con OTRA cuenta
2. Intenta abrir un entry de la primera cuenta (vía un user_id que conozcas — no UI, pero por SQL)
3. La signed URL debería fallar con 403

---

## Estado de cumplimiento del Privacy Pact

| Compromiso del PDF | Estado |
|---|---|
| #1 Acceso restringido al contenido | Cumplido para entries (RLS en tabla). Cumplido para audio **después del paso 1**. Cumplido para audio dueño-solo **después del paso 3**. |
| #2 Cifrado en reposo (AES-256) | Cumplido por Supabase por default. |
| #3 IA sin entrenamiento de modelos | Cumplido (configurado en Anthropic Console). |
