# claudeBBM.md — Operating Memory para BLACKBOX Mind

> Este archivo es la memoria estratégica del producto. Cualquier sesión futura con Claude (o cualquier colaborador) debe leerlo primero. No es un README técnico — eso ya existe. Esto es el "por qué" y el "para quién", más el estado honesto de avance.

**Última actualización:** 2026-05-11
**Branch activo:** `claude/review-progress-1J4Ep`

---

## 1. Qué es BLACKBOX Mind

Un **segundo cerebro estratégico con IA** para personas con mucha actividad mental que pierden ideas, compromisos y patrones por mala memoria operativa.

**No es:**
- Una app de journaling (Day One, Reflectly)
- Una app de wellness/terapia (Rosebud, Mindsera)
- Una app de notas (Notion, Mem)
- Un chatbot (ChatGPT, Claude.ai)

**Es la intersección:** captura sin fricción + memoria longitudinal estructurada + reflejo estratégico con opinión.

---

## 2. Para quién (persona única, no "todos los pensadores profundos")

**Persona objetivo — "El operador con demasiadas ideas":**

- Fundador, operador o creativo de alto output (25-45 años)
- Tiene 10 ideas al día y olvida 8
- Mezcla pensamientos personales y de trabajo (no quiere 2 apps)
- Ya paga por Notion / Things / Readwise / ChatGPT Plus (no es averso al precio)
- Quiere que algo lo **rete**, no que lo **valide**
- Conversación tipo ping-pong > diario contemplativo

**No es para:**
- Personas buscando journaling de gratitud
- Personas en proceso terapéutico activo (no somos terapia)
- Usuarios sensibles al precio (<$10/mo)

---

## 3. El Método BLACKBOX (framework propietario — pendiente de pulir)

> Versión 0.1 — necesita refinamiento y validación con usuarios reales antes de exponerlo en marketing.

```
CAPTURAR → PROCESAR → CERRAR LOOPS → REFLEJAR
```

1. **CAPTURAR sin filtro.** Voz o texto en <10 segundos. No edites. No pienses. Suelta.
2. **PROCESAR con IA.** El sistema clasifica cada captura como: idea / compromiso / preocupación / observación. Extrae mood, categoría, sesgo cognitivo.
3. **CERRAR LOOPS.** Todo compromiso se vuelve un loop trackeado. La app te pregunta proactivamente "dijiste que ibas a hacer X, ¿qué pasó?".
4. **REFLEJAR.** Reporte semanal con **opinión y predicción**, no descripción. Detección de patrones recurrentes con evidencia (entries específicos). Confronta, no consuela.

**Diferenciador clave vs ChatGPT:** la memoria longitudinal estructurada compone valor — mes 6 el sistema te conoce mejor que tú. ChatGPT no.

---

## 4. Estado real del producto (auditoría honesta — Mayo 2026)

| Capacidad | Estado | Score | Notas |
|---|---|---|---|
| Infraestructura técnica (RLS, retry, biometría, paywall, edge functions) | ✅ Sólido | 85% | Madurez de producción, no prototipo |
| Captura de entradas + análisis con IA | ✅ Funcional | 70% | Funciona, prompts mejorables |
| Therapy chat post-entry | ✅ Funcional | 65% | Buen insight, falta personalización profunda |
| Memoria largo plazo (`strategic_profiles`) | ✅ Funcional | 60% | Existe, pero no se "siente" en la UX |
| Detección de patrones (`user_patterns`) | ✅ Funcional | 55% | Backend ok, falta exponerla proactivamente |
| Active Loops como espina dorsal | ⚠️ Parcial | 40% | Tabla existe; notificación 72h frágil y genérica; pantalla principal no los muestra |
| Strategic Mirror semanal con opinión | ⚠️ Parcial | 60% | Reporte existe pero es descriptivo, no prescriptivo |
| Búsqueda semántica de entries (embeddings/pgvector) | ❌ No existe | 0% | Hoy solo `string.includes()`. **Brecha más crítica.** |
| Captura por voz "5 segundos" (widget/Siri/atajo) | ❌ No existe | 30% | Tiene mic pero flujo es 15-20s, no <5s |
| Metodología nombrada + posicionamiento | ❌ No existe | 20% | Tiene marca, no tiene framework citable |
| Validación de mercado (usuarios pagando) | ❌ Pre-revenue | — | Foco prioritario antes de seguir invirtiendo en código |

**Score global estimado: ~30/100** sobre lo necesario para defender precio $19.99-29.99/mo vs ChatGPT.

---

## 5. Modelo de negocio — números base

- **Precio objetivo:** $19.99-29.99 USD/mo (no bajar a $9.99 — no es rentable a escala alcanzable)
- **Costo variable estimado por usuario PRO:** $3-7/mes (Claude API con caching + transcripción + Supabase + RevenueCat)
- **Apple/Google fee:** 15% (Small Business Program primer año)
- **Meta:** $20K USD netos/mes después de costos
- **Subs necesarios:** ~1,000-1,700 PRO activos (alcanzable en 12-24 meses con ejecución continua)
- **Conversión free→paid estimada:** 3-5% (categoría productividad/prosumer)

---

## 6. Prioridades estratégicas (orden importa — no saltar pasos)

### Fase 0 — Validación de posicionamiento (ANTES de tocar código nuevo)
1. Definir "Método BLACKBOX" en 1 página (este doc es draft 0.1)
2. Entrevistar 10-20 personas perfil objetivo. Preguntas: "¿olvidas ideas?", "¿usarías esto?", "¿qué pagarías?"
3. Rediseñar landing/onboarding alrededor del método
4. Lanzar a 20-50 usuarios beta calificados

### Fase 1 — Cerrar las 3 brechas que matan retención
1. **Búsqueda semántica** sobre entries del usuario (pgvector + embeddings). Es lo que ChatGPT no puede hacer con TU historia.
2. **Pantalla principal centrada en Active Loops**, no en escribir. "Tienes 3 cosas abiertas: X, Y, Z" arriba; captura abajo.
3. **Reporte semanal con opinión + predicción**, no descripción. Cambiar prompt, no UI.

### Fase 2 — Pulir la conversación
1. Migrar Edge Functions de Gemini a Claude (Sonnet 4.6 default; Haiku 4.5 para summary diario; Opus 4.7 si necesitas para pattern analysis)
2. Implementar prompt caching del `strategic_profile` + historical context
3. Mantener `transcribe-audio` en Gemini o mover a Whisper (Claude no hace audio)
4. Re-escribir los 3 prompts core (`analyze-entry`, `analyze-patterns`, `ai-chat`) con foco en: opinión sobre descripción, confrontación útil sobre validación

### Fase 3 — Crecimiento (solo después de validar retención D30 > 40%)
1. Founder-led growth los primeros 100 paying
2. Contenido orgánico en LinkedIn/Twitter/podcasts
3. NO contratar marketing hasta tener PMF probado

---

## 7. Stack técnico (resumen rápido)

- **Mobile:** React Native 0.81.5 + Expo SDK 54 + TypeScript 5.3
- **Backend:** Supabase (Postgres + Auth + Storage + Edge Functions Deno)
- **IA actual:** Gemini 3.1 Flash-Lite (pendiente migración a Claude)
- **Pagos:** RevenueCat
- **Auth:** Supabase Auth (Email + Google + Apple OAuth)
- **Biometría:** `expo-local-authentication` con fallback progresivo

**Documentación técnica completa:** `README.md`

---

## 8. Convenciones de código y reglas

- Toda llamada a IA va por Edge Function, jamás desde cliente
- Edge Functions usan `withRetry` + `fetchWithStatus` de `_shared/retry.ts`
- Las migraciones son aditivas; no se borran columnas en uso
- Spanish-first en strings de UI; código y comentarios en español o inglés según prefiera el autor
- Doble navegador `MainTabNavigator` + `TabNavigator` → uno está muerto (limpieza pendiente; `CaptureScreen` es la ruta principal `Main`)

---

## 9. Reglas para sesiones futuras con Claude

1. **Leer este archivo antes de proponer cambios.** No reinventar contexto.
2. **No optimizar técnicamente antes de validar mercado.** Si el usuario está en pre-revenue, priorizar conversaciones de posicionamiento sobre features.
3. **No agregar features porque "estarían cool".** Solo si cierran una brecha de la tabla de auditoría (sección 4).
4. **Honestidad sobre validación.** Si una feature "ya existe" pero está al 40%, decirlo. No confundir "implementado" con "espina dorsal del producto".
5. **Brevedad sobre exhaustividad.** El founder pide respuestas, no ensayos.
6. **Spanish-first** en todo lo que vaya a la UI o documentación pública.
7. **No tocar `database.sql` directamente** — usar migraciones en `supabase/migrations/`.
8. **No crear documentación que el usuario no pidió.** Este archivo se crea porque fue pedido explícitamente.

---

## 10. Decisiones pendientes (a resolver con el founder)

- [ ] ¿Migrar `transcribe-audio` a Whisper o mantener Gemini?
- [ ] ¿Limpiar `MainTabNavigator` o `TabNavigator` (cuál muere)?
- [ ] ¿Borrar `HomeScreen.tsx` (timeline antiguo) o mantener como ruta secundaria?
- [ ] ¿Bilingüe ES/EN o Spanish-only para el lanzamiento?
- [ ] ¿Mercado primario: LATAM, US Hispanic, o US general?
- [ ] ¿Contratar marketing ahora o founder-led 6 meses?
- [ ] ¿Nombre final del método para marketing (revisar "BLACKBOX" suena pesado/oscuro para una app de bienestar mental)?

---

## 11. Historial de decisiones importantes

| Fecha | Decisión | Razón |
|---|---|---|
| 2026-04-16 | Phase 1 → bottom tab navigation + CaptureScreen | Foco en captura como acción principal |
| 2026-04-17 | Tab bar removido → CaptureScreen como pantalla única estilo Claude | Reducir fricción cognitiva al abrir la app |
| 2026-05-11 | Auditoría honesta del producto + creación de este doc | Pre-decisión de migración a Claude / pulido de prompts |
| 2026-05-26 | Hook `Stop` instalado en `.claude/settings.json` + `.claude/hooks/remind-bbm.sh` | Persistir disciplina entre sesiones: si Claude toca archivos fuera de `claudeBBM.md` y no actualiza el log, el hook bloquea el stop con un recordatorio. Sobrevive al ciclo de contenedores efímeros vía git. |
| 2026-05-26 | Privacidad Nivel 1 implementada en branch `claude/privacidad-nivel-1` | Responde a la objeción de privacidad reportada por 5 testers + pedido específico del Director Walmart de un "certificado BlackBoxMind de cifrado". Cuatro piezas: (1) sección humana "TU PRIVACIDAD EN 60 SEGUNDOS" arriba en PrivacyScreen, (2) generador `generatePrivacyPact.ts` que produce PDF firmado vía expo-print/sharing con ID único `BBM-<userId8>-<date>` y los 6 compromisos, (3) card visual personalizado al tope de PrivacyScreen con nombre + email + ID + fecha + badge "ACTIVO" + botón "Descargar PDF" (la pieza que faltaba para que el usuario SIENTA que el certificado es suyo), (4) Settings → "Aviso de Privacidad" ahora navega a PrivacyScreen in-app (antes abría URL web). NO es E2EE real — es Nivel 1: comunicación + certificado visible sobre los compromisos que ya existen (RLS, Anthropic ZDR, cifrado at rest). Nivel 2 (E2EE técnico) queda para futuro. |
| 2026-05-26 | Fix CaptureScreen: TextInput multiline tapaba botón de enviar con listas largas | Reportado por usuario juansebastianmunoz: al escribir listas largas en el modal de captura, el TextInput se expandía sin límite, levantaba el footer (47 palabras + botón ↑) fuera del viewport y el usuario perdía acceso a enviar. Fix de 1 línea: `maxHeight: 240` en el estilo `input` (CaptureScreen.tsx:990). El TextInput ahora scrollea internamente y el footer queda siempre visible sobre el teclado. Issue recurrente, ya reportado antes. |
| 2026-05-26 | Corrección honesta del claim "Zero Data Retention" en Privacidad N1 | Mario validó en Anthropic Console que ZDR NO está activo (estándar = 30 días). El copy original (PDF compromiso #3 + PrivacyScreen humanItem 02) prometía algo que no podemos respaldar técnicamente. Nuevo copy honesto y defendible: "logs temporales 30 días para abuse detection + NO entrenamiento de modelos + opt-in de prompts deshabilitado + no participamos en Development Partner Program". Cuando Mario active ZDR Enterprise con Anthropic, un mini-fix vuelve al claim fuerte. RESIDUAL: el aviso legal (PrivacyScreen sección 3 línea 110) aún menciona "acuerdos de cero retención de datos" — Mario decidió dejarlo por ahora, queda como deuda visible. |
| 2026-05-26 | Despersonalización del PDF del Certificado de Privacidad | Decisión de Mario: bajo ninguna circunstancia debe aparecer "Mario Toro Silva" en el PDF ni en la UI. La firma del certificado debe ser corporativa (Macarena Group PS Mexico), no personal. Cambios en 2 lugares: `generatePrivacyPact.ts:159` (firma del PDF: nombre/título/empresa ahora corporativos) y `PrivacyScreen.tsx:156` (footer note del card visual). Verificado con grep que no queda ninguna otra mención en src/. |
| 2026-05-26 | Creado `UPDATES.md` en raíz del repo — briefing para próximas sesiones de Claude | Archivo operacional/técnico complementario a `claudeBBM.md`. Estructura latest-first, audiencia = otra sesión de IA. Cubre estado actual del repo, branch strategy, qué se hizo en Privacidad N1 + hook + fix de captura, gotchas aprendidos, deuda residual de ZDR. Pensado para que cuando arranques una sesión nueva, otro Claude (o tú mismo en fresh container) se ponga al día en 2 minutos sin reconstruir contexto del git log. |
| 2026-05-26 | Feedback visual del micrófono en ChatScreen (paridad con CaptureScreen) | Mario reportó: al tap micrófono en chat no había feedback claro de "estoy escuchando", solo cambiaba placeholder y color del botón. Agregada barra superior al input row con dot rojo pulsante (animación 1.0↔1.4, 600ms) + texto "Escuchando MM:SS · toca el micrófono para enviar" + estado de transcripción. Mismo patrón que CaptureScreen (dotAnim, recordSecs, fmtSecs, useEffect setInterval). Toca: ChatScreen.tsx únicamente. |
| 2026-05-26 | Fix de privacidad del audio + player real en EntryDetailScreen | Descubierto mientras Mario preguntaba qué hacía el badge "Audio session recorded": el bucket `diaries` en Supabase era PÚBLICO y `uploadAudio` guardaba URLs públicas en `entries.audio_url` → cualquiera con el link descargaba el audio. Contradecía directamente el Privacy Pact que acabábamos de firmar. Fix de código (commit): (1) `uploadAudio` ahora retorna SOLO el path interno `<userId>/<timestamp>.m4a`, (2) nuevo método `getSignedAudioUrl(pathOrLegacyUrl, 3600)` que genera URL firmada de 1 hora — maneja ambos formatos (path nuevo y URL pública legacy), (3) EntryDetailScreen reemplaza badge pasivo con player real (expo-av): play/pause + contador `MM:SS / MM:SS`, signed URL on-demand en cada playback, cleanup automático del Sound en unmount. DEPS: usé `expo-av` que ya estaba. PENDIENTE MANUAL DE MARIO: dejado en `docs/audio-privacy-migration.md` — (a) cambiar bucket a privado en Supabase Dashboard, (b) correr SQL idempotente que normaliza URLs viejas a paths, (c) opcional: políticas RLS de storage para que solo el dueño pueda pedir signed URL. La interpretación errónea de prioridad — pensé que Mario quería pivotar al mic, pero seguía priorizando privacidad — me costó un round. Corregido. |
| 2026-05-26 | Fix #1 HomeScreen: card overflow del tag "Personal" + Fix #2 SearchScreen: búsqueda text-match | Issue #1 reportado por Mario: el catPill ("Personal") se salía visualmente del card cuando `mood_label` era largo (ej. "FALSE POSITIVE - TACTICAL COMPLIANCE MASKING STRATEGIC PARALYSIS"). Causa: inner View con date+moodBadge no era flex-shrinkable y moodBadge no tenía numberOfLines. Fix: wrap inner View con `flex:1 minWidth:0` + `numberOfLines={1}` en moodBadge. Issue #2 reportado: Mario buscó "Valida" y el entry "Validación Ritualizada Enmascarando Parálisis Ejecutiva" no aparecía aunque su título contiene "Validación". Causa: SearchScreen solo usa `semanticSearch` (threshold 0.5); queries cortas como "Valida" generan embeddings sparse que no alcanzan ese threshold contra entries de jerga densa. Fix: agregué `textSearchEntries` a SupabaseService (ILIKE con escape de wildcards en title y content) y en SearchScreen corro ambas búsquedas en paralelo + mergeo por id. Text-hit en título recibe similarity virtual 0.99, en content 0.85. Sort por similarity desc. Resultado: substring search + semántica complementarias. |
| 2026-05-26 | Bugfix del bugfix: `.or()` con ILIKE no funciona como `%pattern%` en Supabase JS | Mario probó la nueva búsqueda buscando "Ritualizada enmascarando" — palabras literales en el título — y no apareció. Mario tuvo razón en pedirme honestidad: shipié sin verificar. Causa real: usé `.or('title.ilike.%foo%,content.ilike.%foo%')` pero Supabase JS / PostgREST en `.or()` usa grammar URL distinta — `%` es char URL-reservado y se rompe el filter; debería ser `*` como wildcard. En lugar de adivinar la sintaxis exacta de `.or()`, refactoré a 2 llamadas `.ilike()` paralelas (una sobre title, otra sobre content) mergeadas por id. `.ilike()` directo es API documentada con encoding garantizado, sin riesgo sintáctico. Lección: NO shipear features que no probé end-to-end. El daño esta vez fue solo un round desperdiciado + bajar trust con Mario; pude haber arrojado console.log y verificado de mi lado antes de pushear. |
| 2026-05-26 | Branch `claude/home-day-1`: Camino A — re-copy + dual input + menú claro | Feedback brutal de 2 testers ICP reales (Director Creativo Galería de Arte + Luminitza López, Dir Comercial TikTok): Home abruma, solo hay micrófono sin opción de escribir, stat cards "CERRADOS/ABIERTOS/ESTANCADOS" no se entienden de qué, "LO QUE REGRESA" es vocabulario interno, menú "···" misterioso. Objetivo: un usuario que abre la app sin explicación de Mario entiende qué hacer en <30s. Camino quirúrgico, 1 archivo (CaptureScreen.tsx), 4 piezas: (1) stat labels → "COMPLETADAS/PENDIENTES/SIN AVANCE", (2) "LO QUE REGRESA" → "Lo que sigues postergando" + nuevo estilo conversacional (sin uppercase/letter-spacing, +2pt), (3) text capture card inline después del header que navega a NewEntry (TextInput existente, no se crea pantalla nueva) — FAB de mic SE MANTIENE como path rápido de voz, (4) icono "···" (MoreHorizontal) → engrane (Settings) con mismo tamaño/color que search. Mario validará con los 2 testers; si entienden, arrancamos Camino B. |
