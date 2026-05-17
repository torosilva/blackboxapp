# BLACKBOX MIND — Arquitectura, Flujos y Costos

> Documento técnico interno. Fuente: código en este repositorio.
> Última actualización: generado automáticamente a partir del estado actual del repo.

---

## 1. Stack tecnológico

### Cliente (app móvil)
- **Expo SDK 54** / **React Native 0.81.5** (iOS + Android)
- Navegación: React Navigation (stack)
- Voz: `expo-av` · Imágenes: `expo-image-picker` · Notificaciones locales: `expo-notifications`
- Suscripciones: `react-native-purchases` (RevenueCat) — *hoy con API keys placeholder, no activo*
- Build/distribución: **EAS Build** (perfiles `preview` y `production`), OTA con EAS Update

### Backend (Supabase)
- **PostgreSQL** + extensión **pgvector** (búsqueda semántica)
- **Edge Functions** (Deno) — toda la lógica de IA corre aquí, las API keys nunca tocan el cliente
- **Auth** (Supabase) + Storage
- Variables sensibles como **secrets de Supabase** (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)

### Proveedores de IA
| Función | Proveedor | Modelo |
|---|---|---|
| Chat conversacional | Anthropic | `claude-sonnet-4-6` (con prompt caching) |
| Análisis de memoria / resumen diario / reporte semanal | Anthropic | `claude-haiku-4-5` |
| Clasificación memoria vs consulta | Anthropic | `claude-haiku-4-5` |
| Análisis de patrones longitudinal (cada 5 memorias) | Anthropic | `claude-opus-4-7` |
| Embeddings (búsqueda semántica) | Google Gemini | `gemini-embedding-001` (768 dims, L2-normalizado) |
| Transcripción de audio | Google Gemini | `gemini-2.5-flash` |

---

## 2. Tablas principales (PostgreSQL)

- `profiles` — usuario, flags (is_pro, términos)
- `entries` — **memorias** (texto, análisis IA en `ai_analysis` + columnas planas, `embedding vector(768)`)
- `action_items` — loops normalizados (prioridad, categoría, `is_completed`)
- `goals` — metas detectadas
- `strategic_profiles` — memoria cognitiva de largo plazo (resumen, temas, sesgos, metas)
- `user_patterns` — patrones detectados longitudinalmente
- `chat_threads` / `chat_messages` — conversaciones (`chat_threads.entry_id` vincula hilo ↔ memoria)
- `summaries`, `feedback`, `images`

RPC: `match_entries(user_id, query_embedding, threshold, count)` — similitud coseno con índice IVFFlat.

---

## 3. Flujos del usuario

### F1 — Autenticación / Onboarding
Login/registro (Supabase Auth) → perfil → onboarding. **Costo IA: $0.**

### F2 — Captura de pensamiento (entrada principal)
Pantalla "¿Qué está en tu mente?". Tres modos:
- **Texto** → abre un chat continuo (no entrada de un solo tiro).
- **Voz** → graba audio → `transcribe-audio` (Gemini Flash) → texto → chat.
- **Imagen** → `expo-image-picker` → se adjunta como bloque de visión al primer mensaje del chat.

### F3 — Conversación (chat)
`ai-chat` (Claude Sonnet 4.6). El servidor inyecta contexto del usuario:
perfil estratégico + 10 memorias recientes + **loops abiertos**. Usa **prompt caching**
con 2 breakpoints (reglas estáticas globales + bloque contexto por sesión) → los
turnos siguientes leen caché y son mucho más baratos.

### F4 — Clasificación memoria vs consulta
Tras el primer intercambio, `classify-thread` (Haiku) decide:
- **journal** → se crea memoria.
- **assist** → solo queda en Historial de Chats (no ensucia patrones/perfil/loops).
- **uncertain** → se le pregunta al usuario en un banner.

### F5 — Creación / enriquecimiento de memoria
`analyze-entry` (Haiku) genera: título, resumen, mood, sentiment, sesgo,
`action_items`, `suggested_goals`, y actualiza `strategic_profile`.
- Action items y goals se espejean a tablas normalizadas (cerrables, sin duplicar).
- Al salir/Actualizar el chat se re-resume toda la conversación (merge no destructivo).
- Embedding generado en background (`embed-entry`, Gemini).

### F6 — Loops (accionables)
Bandeja con **foco Top 5** (HIGH/vencidos primero); loops >21 días no-HIGH se
relegan. Cierre con checkbox (persistente).

### F7 — Metas
`suggested_goals` se convierten en `goals` automáticamente (dedupe por título),
para cualquier memoria (chat o captura).

### F8 — Análisis de patrones (longitudinal)
Cada 5 memorias se dispara `analyze-patterns` (**Opus 4.7**) → detecta 2-5 patrones
y sincroniza el perfil estratégico profundo.

### F9 — Búsqueda semántica
Query → `search-entries` (embedding Gemini) → `match_entries` (pgvector coseno) →
resultados rankeados por relevancia.

### F10 — Reporte semanal
`analyze-entry` modo `weekly` (Haiku) → reporte ejecutivo en Markdown.

### F11 — Retención
Notificaciones locales: racha (días seguidos), aviso 9 PM personalizado (loop
HIGH más viejo / racha), push semanal del reporte. Sin backend de push.

### F12 — Dashboard / Memorias / Historial de Chats
- Dashboard ejecutivo: estado + 1 acción + detalle colapsado.
- Memorias: panel por categoría + tira "Recientes".
- Historial de Chats: conversaciones de consulta (separadas de memorias).

### F13 — Monetización
Gating PRO (`profile.is_pro`) para chat manual. RevenueCat para suscripción
(pendiente: poner API keys reales + productos en stores).

---

## 4. Modelo de costos por interacción

> ⚠️ **Precios = lista pública aproximada (USD por 1M tokens). Verificar antes de
> usar en proyecciones financieras.** El objetivo es la *estructura* de costo y
> las palancas, no centavos exactos.

**Supuestos de precio (editar aquí):**

| Modelo | Input | Output | Cache write | Cache read |
|---|---|---|---|---|
| Opus 4.7 | $15.00 | $75.00 | $18.75 | $1.50 |
| Sonnet 4.6 | $3.00 | $15.00 | $3.75 | $0.30 |
| Haiku 4.5 | $1.00 | $5.00 | $1.25 | $0.10 |
| Gemini embedding-001 | ~$0.15 | — | — | — |
| Gemini 2.5 Flash (texto) | ~$0.30 | ~$2.50 | — | — |
| Gemini 2.5 Flash (audio in) | ~$1.00 / 1M tokens audio (~aprox. $0.006/min) | | | |

### Costo por evento

| Evento | Modelo | Tokens aprox (in/out) | Costo estimado |
|---|---|---|---|
| Clasificar chat | Haiku | 1.5k / 0.05k | ~**$0.0017** |
| Crear memoria (analyze-entry) | Haiku | 3k / 1.5k | ~**$0.0105** |
| Embedding de memoria | Gemini emb | ~1k | ~**$0.00015** |
| Turno de chat (1er, cache write) | Sonnet | 3k ctx + 0.3k msg / 0.4k | ~**$0.018** |
| Turno de chat (siguientes, cache read) | Sonnet | 3k cache-read + 0.3k / 0.4k | ~**$0.008** |
| Imagen interpretada (extra por turno) | Sonnet | +~1.5k img | ~**+$0.005** |
| Transcripción de voz | Gemini Flash | ~1 min audio | ~**$0.006/min** |
| Análisis de patrones (cada 5 memorias) | **Opus** | 4k / 2k | ~**$0.21** → **$0.042/memoria amortizado** |
| Búsqueda semántica | Gemini emb | ~0.05k | ~**$0.00001** |
| Reporte semanal | Haiku | 4k / 1.2k | ~**$0.010** |

### Escenario: usuario activo típico (estimado)

Supuesto: **1 memoria/día**, **4 turnos de chat/día**, búsqueda ocasional,
1 reporte/semana, patrones cada 5 días.

| Concepto | Cálculo diario | Costo/día |
|---|---|---|
| Clasificación | 1 × $0.0017 | $0.002 |
| Memoria (analyze-entry) | 1 × $0.0105 | $0.011 |
| Embedding | 1 × $0.00015 | $0.0002 |
| Chat (1 write + 3 read) | $0.018 + 3×$0.008 | $0.042 |
| Patrones (amortizado) | $0.042 | $0.042 |
| **Total / día** | | **≈ $0.097** |
| **Total / mes (30 días)** | | **≈ $2.9 USD** |

- Sin Opus (patrones) → ~$1.7/mes. **Opus es la palanca de costo #1.**
- Voz añade ~$0.006 por minuto transcrito.
- El **prompt caching** ya reduce ~55% el costo de los turnos de chat posteriores.

### Palancas de optimización (orden de impacto)
1. **Patrones en Opus**: bajar a Sonnet (~5× más barato) o correr cada 10 memorias en vez de 5.
2. **Caching agresivo** del bloque de contexto (ya implementado, 2 breakpoints).
3. **Límite de turnos/contexto** por sesión para usuarios free.
4. Transcripción: lotear o limitar duración de audio.
5. Embeddings ya son ~gratis a esta escala.

### Margen unitario (referencia)
Con suscripción PRO objetivo de, p. ej., **$9.99/mes**:
costo IA ≈ $2.9 → **margen bruto IA ≈ 70%+** (antes de Supabase/infra/stores).
Supabase escala barato; Apple/Google se llevan 15–30% de la suscripción.

---

## 5. Riesgos técnicos / pendientes
- RevenueCat con keys placeholder → monetización no activa hasta configurar productos.
- Notificaciones: solo locales (Expo Go quitó push remoto) → re-engagement de usuarios totalmente inactivos requiere backend de push (Expo push tokens + cron).
- Costo dominado por Opus en `analyze-patterns`; vigilar a escala.
- Precios de modelos cambian: este documento usa lista pública, recalcular trimestralmente.
