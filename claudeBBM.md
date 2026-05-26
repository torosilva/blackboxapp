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
| 2026-05-26 | Camino A iteración: caja de texto inline editable + eliminar FAB de mic | Mi commit anterior dejó dos problemas visibles: (1) había 2 micrófonos — uno decorativo dentro del card de texto y otro FAB flotante, redundancia visual; (2) el card navegaba a otra pantalla cuando se tocaba, fricción innecesaria (el usuario espera escribir AHÍ). Fix en 1 archivo (CaptureScreen.tsx): card pasivo reemplazado por `<View>` con TextInput multiline editable + icono adaptativo a la derecha (Mic cuando draft vacío → calls toggleRecording; Send cuando hay texto → calls submitTextCapture). Nueva función `submitTextCapture(text)` reusa `analyzeAndOpenVerdict()` que ya existía (crea entry vía SupabaseService.createEntry, navega a EntryDetail). FAB flotante (TouchableOpacity con position:absolute + estilos micFab/micFabRec) eliminado completamente — su único path único era voz, ahora cubierto por el mic inline; long-press → modal de texto era para escribir, ahora cubierto por TextInput inline. Modal de texto NO eliminado: sigue siendo escape hatch del fallback de transcripción corta (línea 363). Indicador de recording `recPill` intacto (sigue mostrando dot+timer cuando isRecording). Resultado: un solo input visible en home, sin ambigüedad de "qué micrófono usar". |
| 2026-05-26 | Protección de costo: detectar gibberish + rate limit 50 entries/24h | Mario reportó: usuario tipeó "Nsnsnds Ssushdjd Sushsjsjdjd..." (gibberish puro), app procesó análisis completo de Claude → token cost real desperdiciado, ouput inútil ("Entrada Incoherente: Señal de Sobrecarga"). Fix combinado A+B: (A) Heurística client-side `isLikelyIncoherent(text)` en CaptureScreen — 3 reglas: (1) si solo consonantes sin vocales, (2) si ratio consonante/vocal > 3 (real ~1.5, gibberish 5+), (3) bigram repetido 4+ veces en texto corto o 6+ en cualquier longitud. Probada con 16 casos: 15/16 correctos, el único fallido es trivial-short que el check de longitud existente ya filtra. (B) Rate limit duro 50 entries por usuario en 24h (sliding window). Nuevo método `SupabaseService.countEntriesLast24h(userId)` con count head:true (consulta barata). Si el count falla por red, default-allow (no castigar usuarios legítimos por blip). Ambos checks viven en `analyzeAndOpenVerdict` después del check existente de longitud/palabras. Aplicado en mismo branch claude/home-day-1 por consistencia con fix de chat timeout. |
| 2026-05-26 | Camino A v1.2: eliminar tab bar inline + Centro Estratégico reordenado + polish premium | Mario detectó 4 problemas en v1.1: tab bar inferior (Mis memorias/Dashboard/Reporte/Chats/Mis sesgos) era ruido visual, Settings ordenado sin jerarquía, falta de aire entre input y stats, cards planas. Fix en 2 archivos: (1) CaptureScreen: eliminé array `shortcuts` + JSX render + 5 aliases (Br/LD/BC/MC/SA) + estilos chipsWrap/chipsRow/chip/chipText + imports lucide huérfanos (Brain, LayoutDashboard, BarChart2, MessageCircle, ShieldAlert, MoreHorizontal). Aumenté marginBottom de textCaptureCard 16→24 y agregué marginTop:8 al statsGrid. Agregué shadows premium: statCard y loopCard con shadow negro sutil (opacity 0.35, radius 8, offset 0/3, elevation 4), reflejoCard con shadow púrpura tinte (color #7C3AED, opacity 0.25, radius 12). Mount animation: Animated.parallel(timing opacity 0→1, timing translateY 8→0, duration 320ms, useNativeDriver) envuelve el bloque entero de cards (statusBlock + reflejoCard + loopsModule + memModule). activeOpacity ya estaba en 0.7-0.85 en cards tappables — no necesario bajar. (2) SettingsScreen: reorganización del viewMode hub en 4 grupos visuales con labels small-caps gris ('groupLabel' style nuevo): CONTENIDO (3 nav items NUEVOS: Mis Memorias→Home, Conversaciones→ChatHub, Análisis & Reportes→Dashboard) / PERFIL ESTRATÉGICO (Identidad, Metas, Loops Pendientes, Loops Realizados, Sesgos — orden actual) / HERRAMIENTAS (Manual, Feedback, Análisis Estratégico — reordenadas 5,4,3) / AJUSTES (Privacidad, Cuenta — Cuenta movida desde fuera del hub al final de AJUSTES). Imports nuevos en lucide: BookOpen, MessageCircle, BarChart2 + aliases BO/MCi/BC2. |
| 2026-05-26 | Branch `claude/chat-upgrade`: UI de adjuntar imágenes al chat (vision input) | La Edge Function `ai-chat` ya soportaba `image?: {data, mediaType}` y `ChatService.sendMessage` ya pasaba el param al payload — pero el cliente NO tenía UI para mandar imágenes desde el chat (solo desde el home via `initialImage`). Mario lo usa en producción real y le faltaba esta capacidad. Branch hijo de `claude/privacidad-nivel-1`, HEAD inicial `ab70c49`. Cambios en 2 archivos: (1) ChatScreen: agregué imports (ImagePicker, ImagePlus, X, Image), state `attachedImage` (data + mediaType + previewUri), handler `handleAttachImage` con permission check y ImagePicker.launchImageLibraryAsync (quality 0.7, base64 true, no editing, no exif). Botón attach con icono ImagePlus a la izquierda del TextInput del input row. Preview thumbnail (44x44) arriba del input row cuando hay imagen attached, con label + hint + X para quitar. Modifiqué `handleSend` para fallback a `attachedImage` del state si no se pasa image param, permitir enviar sin texto si hay imagen, clear del state después de commit. Userbubble renderiza imageUri (200x200) cuando existe. (2) ChatService: extendí `ChatMessage` con `imageUri?: string` opcional (in-memory only, no persistido). expo-image-picker ya estaba instalado (lo usa CaptureScreen). NO toqué la EF ai-chat (ya soporta vision con Claude Sonnet 4.6). NO persistencia de imágenes en Supabase storage en este spec — scope creep. NO Camera — solo galería. NO múltiples imágenes — 1 sola por mensaje. Voice y attach son flows independientes; si user pega imagen y graba voz, la imagen se mantiene para cuando termine la transcripción. |
| 2026-05-26 | Política nueva: una sola rama de trabajo (home-day-1), no más branches hijos | Después del desmadre con merges entre `home-day-1` y `chat-upgrade` (5 conflicts potenciales en rebase, 2 intentos de merge, 1 force-push evitado), reconocí que el modelo de branches paralelos era over-engineering para un solo developer. claudeBBM.md (append-only log) genera conflicts en cualquier merge porque ambos branches lo modifican. Política nueva: TODO va en `claude/home-day-1`. Nuevos specs aplican commits directos ahí. master sigue ceremonial hasta v1.0 TestFlight (squash merge). Si hay caso concreto para branch hijo, lo justifico antes — no por reflejo de "limpieza". |
| 2026-05-26 | EF ai-chat: prompt enseña tool use para inventario/listados (no más "escríbelos de nuevo") | Mario reportó regresión del moat: al pedir "súmame todos mis loops" o "lista mis pendientes", la IA solo veía los 25 pre-cargados (de ~360 totales) y respondía "no puedo sumar sin la lista completa, escríbelos de nuevo". Causa: el prompt no guiaba a invocar `search_memories` para vista panorámica/inventario, solo para evidencia puntual. Fix en `supabase/functions/ai-chat/index.ts` (1 archivo): (1) STATIC_RULES_STANDARD nueva regla #10 INVENTARIO Y LISTADOS — orden explícita de invocar tool antes de responder cuando user pide listar/sumar/enumerar/inventariar/panorámica, con sugerencia de 2-3 queries distintas si una sola no cubre. (2) STATIC_RULES_THERAPY regla #11 espejo de la #10 pero con presentación conversacional ("Mira lo que vi en tu historia — hay 8 cosas..."), no bullet list. (3) SEARCH_MEMORIES_TOOL.description ampliada con caso de uso "panorámica completa de loops/pendientes/memorias" y queries de ejemplo. (4) Ambos buildDynamicContext (Standard + Therapy) ahora incluyen nota directa debajo del bloque LOOPS: "estos son SOLO los 25 más recientes — si el usuario pide 'todos' o panorámica amplia, invoca search_memories ANTES de responder". DEPLOY: Mario tiene que correr `supabase functions deploy ai-chat` desde su Mac — yo no tengo credenciales en el contenedor. |
| 2026-05-26 | Polish v1.4: input prominente + stagger animation visible en stat cards | Mario reportó: el polish v1.3 quedó tan sutil que no lo percibe — el input "¿Qué tienes en mente?" se pierde visualmente, la animación de stat cards (scale 0.96→1.0, 380ms) es imperceptible. Fix en CaptureScreen.tsx (1 archivo): (1) textCaptureCard con bg #1A2236 (era #151B2C), border púrpura tinte rgba(192,132,252,0.25) borderWidth 1.5, padding 18, minHeight 64, shadow púrpura sutil (color #7C3AED opacity 0.15) — el input ahora llama a tap claramente. textCaptureInput fontSize 16 weight 500, placeholder color #94a3b8 (era #64748b). (2,3) Animación de stat cards: reemplacé el single statsOpacity/statsScale por 6 vars (3 cards × opacity+translateY 20→0) con stagger de 0/100/200ms — cada card aparece en cascada visible. timing duration 500ms + spring friction 7 tension 50. (4) statCard shadow opacity 0.6 (era 0.45), radius 14 (era 10), elevation 10 (era 6). REFLEJO y loops cards intactos. |
| 2026-05-26 | Fix v1.5: animación cascada de stat cards no se veía por race condition con loadHome | Mario validó v1.4 y reportó: cascada sigue sin verse. Diagnóstico: `useEffect` con deps `[]` disparaba las animaciones AL MOUNT del screen, pero `stats` llegaba ~50-200ms después desde `loadHome()`. Las animaciones (500ms + 200ms delay) terminaban EN EL VACÍO antes de que las stat cards se rendericen — cuando llegaban los datos, los Animated.Value ya estaban en valor final (opacity 1, translateY 0). Resultado: cards aparecían pegadas, sin entrada visible. Fix: split del useEffect en 2 — uno con deps `[]` para la fade general (cardsOpacity/Translate, que envuelve loops/reflejo/memorias que siempre renderizan), otro con deps `[stats]` para las 3 stat cards. Ref `statsAnimatedRef` evita re-animar en pull-to-refresh o cuando stats cambia. Ahora la animación dispara cuando los datos llegan, sincronizada con el primer render de las cards. |
| 2026-05-26 | Polish v1.6: input con fondo claro estilo iMessage/Linear (inverted contrast) | Mario validó v1.5 (cascada funciona) pero reportó: input "¿Qué tienes en mente?" se pierde entre las stat cards (que tienen números coloridos grandes) y las loops cards (que usan el mismo borde púrpura del input → repetición de color anula el llamado). Diagnóstico honesto: era problema de JERARQUÍA, no de decoración — más sombra/border no resolvía. Elegimos la opción de mayor impacto: invertir contraste. Fix en CaptureScreen.tsx (1 archivo): textCaptureCard ahora con bg #F1F5F9 (slate-100, off-white), borderWidth 0 (sin border colorido), shadow neutro negro (opacity 0.35 radius 12 offset 0/4 elevation 6). textCaptureInput text color #0F172A (slate-900, oscuro). placeholderTextColor #64748b (medium gray legible sobre blanco). Edit3 icon #64748b. Mic/Send icons mantienen #c084fc púrpura — accent del brand se ve crisp sobre blanco. Patrón visual conocido: iMessage/Slack/Linear usan inputs claros sobre fondos oscuros para invariablemente capturar atención. |
| 2026-05-26 | Dashboard refactor: "Vista Estratégica" — 6 secciones limpias en lugar de saludo + 4 cards duplicadas | Spec previa pidió quick-clean del Dashboard (eliminar saludo/PRO badge/cerebro, banner Capturar Pensamiento, INTERVENCIÓN ESTRATÉGICA, copy desactualizado). Este turno hizo el refactor mayor pendiente: reemplazo del JSX entero por 6 secciones compactas — ESTADO ACTUAL (one-liner), PROGRESO A METAS (big number + en curso/en riesgo), PATRONES DETECTADOS (lista simple), RITMO DE CAPTURA (esta semana/promedio/streak), USO ESTE MES (chats/búsquedas/reflejos), HISTORIAL DE CHATS (scroll horizontal preservado). Eliminado además: VER DETALLE toggle, Strategic Analysis Report, ANÁLISIS ESTRATÉGICO date picker, PERFIL ESTRATÉGICO box, GUÍA ESTRATÉGICA, todo el reanimated logo animation + state huérfano (showDetail, appointmentDate, isAnalyzingPatterns, strategicProfile, floatValue/pulseValue), 19 imports de iconos lucide unused. Archivo pasó de 1033 → 626 líneas. Agregué 2 métodos a SupabaseService: getCaptureRhythm (client-side aggregation de entries: thisWeek desde lunes, weeklyAverage rolling, streak consecutive-days), getMonthlyUsage (query a usage_events filtrado por mes con buckets: chats=ai_chat+image_vision, searches=semantic_search, reflexes=entry_analysis+pattern_synthesis+weekly_report). Commit directo a master por petición del spec. |
| 2026-05-26 | Settings menu split: "Análisis & Reportes" → 2 items separados (Dashboard Estratégico + Compartir mi Reporte) | El item único "Análisis & Reportes" confundía: el label sugería reporte pero el onPress navegaba a Dashboard. Fix de menú: renombrar a "Dashboard Estratégico" (matches el destino real) + agregar nuevo item "Compartir mi Reporte" que navega a WeeklyReport. Ambos en grupo CONTENIDO. Commit directo a master (mantenemos la política nueva post-merge mess). |
| 2026-05-26 | Home agrupado en cards + stat cards navegan a Loops con filter | Refactor visual del home (CaptureScreen) para alinear con Dashboard Estratégico: wrap del bloque ESTADO ACTUAL (3 stat cards) en homeCard con título small-caps, mismo treatment a loopsModule y memModule (bg #151B2C, border #1E293B 1.5px, radius 14, shadow negro sutil). REFLEJO intacto (mantiene tinte púrpura como diferenciador). Stat cards ahora son TouchableOpacity con activeOpacity 0.7 y navegan a Loops con route.params.initialFilter: COMPLETADAS→'closed', PENDIENTES→'open', SIN AVANCE→'stalled'. LoopsScreen extendido para leer route.params.initialFilter: 'open' (default 3 lanes), 'stalled' filtra items con created_at hace ≥14 días (1 lane sola "SIN AVANCE"), 'closed' muestra mensaje + botón a Settings 'Active Loops Realizados' (los cerrados no se guardan en LoopsScreen; redirige al historial). Side fix: agregué import Alert a DashboardScreen.tsx — otro agente agregó código que lo usa pero olvidó el import (TS error preexistente desbloqueado por mi refactor previo que eliminó el Alert unused). |
