import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withRetry, fetchWithStatus } from "../_shared/retry.ts";
import { logUsage } from "../_shared/usage.ts";

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Sonnet 4.6: balance de calidad y costo, óptimo para la conversación principal.
const MODEL_NAME = 'claude-sonnet-4-6';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Fetch recent insights for longitudinal context ───────────────────────────

async function getRecentInsights(userId: string): Promise<string> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data } = await supabase
      .from('entries')
      .select('summary, mood_label, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!data || data.length === 0) return 'Sin historial previo.';

    return data.map((e: any) =>
      `[${e.created_at?.slice(0, 10)}] ${e.mood_label ?? ''}: ${e.summary ?? ''}`
    ).join('\n');
  } catch {
    return 'Sin historial previo.';
  }
}

// Pulls the user's OPEN loops / action items so the assistant already knows
// the backlog and never has to ask "dame tu lista de tareas".
// Reads both sources: recent entries' JSONB action_items (where new items
// live) and the normalized action_items table (backfilled legacy data).
async function getOpenLoops(userId: string): Promise<string> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const loops: { task: string; priority: string; category: string }[] = [];

    const { data: entryRows } = await supabase
      .from('entries')
      .select('action_items, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(25);

    for (const row of entryRows ?? []) {
      const items = Array.isArray(row.action_items) ? row.action_items : [];
      for (const it of items) {
        if (it && !it.is_completed && (it.task || it.description)) {
          loops.push({
            task: String(it.task ?? it.description).trim(),
            priority: String(it.priority ?? 'MEDIUM').toUpperCase(),
            category: String(it.category ?? 'PERSONAL').toUpperCase(),
          });
        }
      }
    }

    try {
      const { data: tableRows } = await supabase
        .from('action_items')
        .select('task, priority, category')
        .eq('user_id', userId)
        .eq('is_completed', false)
        .order('created_at', { ascending: false })
        .limit(50);
      for (const r of tableRows ?? []) {
        if (r?.task) {
          loops.push({
            task: String(r.task).trim(),
            priority: String(r.priority ?? 'MEDIUM').toUpperCase(),
            category: String(r.category ?? 'PERSONAL').toUpperCase(),
          });
        }
      }
    } catch {
      // action_items table may not exist on this project — ignore.
    }

    // Dedupe by normalized task text, keep highest priority seen.
    const rank: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    const byTask = new Map<string, { task: string; priority: string; category: string }>();
    for (const l of loops) {
      const key = l.task.toLowerCase().slice(0, 120);
      const existing = byTask.get(key);
      if (!existing || (rank[l.priority] ?? 2) > (rank[existing.priority] ?? 2)) {
        byTask.set(key, l);
      }
    }

    const merged = [...byTask.values()]
      .sort((a, b) => (rank[b.priority] ?? 2) - (rank[a.priority] ?? 2))
      .slice(0, 30);

    if (merged.length === 0) return 'Sin loops abiertos registrados.';

    return merged
      .map((l) => `• [${l.priority}/${l.category}] ${l.task}`)
      .join('\n');
  } catch {
    return 'Loops no disponibles.';
  }
}

async function getStrategicProfile(userId: string): Promise<string> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data } = await supabase
      .from('strategic_profiles')
      .select('cognitive_summary, recurring_themes, key_goals, identified_biases')
      .eq('user_id', userId)
      .maybeSingle();

    if (!data) return 'Perfil estratégico aún en construcción.';

    return `RESUMEN COGNITIVO: ${data.cognitive_summary ?? 'N/A'}
TEMAS RECURRENTES: ${(data.recurring_themes ?? []).join(', ') || 'Ninguno aún'}
METAS CLAVE: ${(data.key_goals ?? []).join(', ') || 'Ninguna detectada'}
SESGOS IDENTIFICADOS: ${(data.identified_biases ?? []).join(', ') || 'Ninguno aún'}`;
  } catch {
    return 'Perfil estratégico no disponible.';
  }
}

// ─── Tool definitions + executor (search_memories) ───────────────────────────

const SEARCH_MEMORIES_TOOL = {
  name: 'search_memories',
  description: `Busca en las memorias pasadas del usuario por similitud semántica (cosine over embeddings). Úsala cuando:
- El usuario menciona o pregunta sobre algo que ya capturó antes ("¿qué pensé sobre X?", "¿he hablado de Y?").
- Necesitas EVIDENCIA específica para confrontar un patrón con sus propias palabras pasadas.
- La pregunta es vaga y necesitas grounding histórico antes de opinar.
- Quieres demostrar continuidad temporal de un patrón ("llevas 3 meses con esto, mira").

NO la uses cuando:
- La info ya está en el PERFIL ESTRATÉGICO, los LOOPS ABIERTOS o el HISTORIAL RECIENTE (10 entradas) que ya tienes en el contexto.
- Solo se necesita opinión, no evidencia.
- El usuario está pidiendo acción inmediata, no análisis.

Cada resultado incluye: id, title, summary, content, mood_label, category, created_at, similarity (0-1). Cita evidencia integrándola naturalmente en tu respuesta — NO listes resultados crudos.

TAMBIÉN úsala cuando el usuario pida listar, sumar, inventariar o ver panorámica completa de sus loops/pendientes/memorias — los 25 pre-cargados NO son su lista completa. Haz búsquedas amplias con queries simples como 'pendientes activos', 'loops abiertos sin avance', 'memorias sobre [tema]'. Combina 2-3 búsquedas si una sola no rinde suficiente cobertura.`,
  input_schema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Búsqueda en lenguaje natural sobre lo que quieres encontrar en la historia del usuario. Específico, no genérico.',
      },
      limit: {
        type: 'integer',
        description: 'Cantidad máxima de memorias a devolver (1-10). Default 5.',
      },
    },
    required: ['query'],
  },
};

async function executeToolCall(
  toolName: string,
  toolInput: any,
  userId: string,
): Promise<{ content: string; isError: boolean }> {
  if (toolName !== 'search_memories') {
    return { content: `Unknown tool: ${toolName}`, isError: true };
  }

  if (!userId) {
    return { content: 'No userId available for search.', isError: true };
  }

  try {
    const query = String(toolInput?.query ?? '').trim();
    if (!query) {
      return { content: 'Empty query.', isError: true };
    }
    const limit = Math.min(Math.max(Number(toolInput?.limit ?? 5), 1), 10);

    const url = `${SUPABASE_URL}/functions/v1/search-entries`;
    const res = await fetchWithStatus(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Service role allows EF-to-EF internal call without user JWT
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ userId, query, threshold: 0.5, limit }),
    });

    const data: any = await res.json();
    const results = data?.results ?? [];

    // Compact format: keep only fields the model actually needs.
    const compact = results.map((r: any) => ({
      id: r.id,
      title: r.title,
      summary: r.summary?.slice(0, 300),
      mood: r.mood_label,
      category: r.category,
      date: r.created_at?.slice(0, 10),
      similarity: r.similarity ? Number(r.similarity.toFixed(3)) : null,
    }));

    return {
      content: JSON.stringify({ query, results: compact, count: compact.length }),
      isError: false,
    };
  } catch (e: any) {
    console.error('[ai-chat] executeToolCall error:', e.message);
    return { content: `Search failed: ${e.message}`, isError: true };
  }
}

// ─── Cached SYSTEM blocks (static — no user-specific data here) ──────────────

const STATIC_RULES_STANDARD = `
ROL:
Eres BLACKBOX. Un amigo con experiencia en negocios, claro y directo. Hablas como mentor sensato en una mesa de café, no como consultor McKinsey ni psicólogo clínico.
Tu objetivo no es consolar — es DAR CLARIDAD. Hablas con autoridad pero en lenguaje normal. La claridad gana sobre la sofisticación.

ESTILO DE VOZ (no negociable):
- Frases cortas. Sujeto-verbo-objeto.
- Cero diagnóstico clínico ni etiquetas pseudo-psicológicas.
- Cero jerga consultora McKinsey ni anglicismos vestidos de español.
- Habla como tu mejor amiga directora de ops a las 9pm de un martes — no como un PDF de Bain.

REGLAS NO NEGOCIABLES:
1. OPINIÓN > DESCRIPCIÓN. Nunca solo describas lo que ya sabe el usuario. Toma postura.
2. PREDICCIÓN > DIAGNÓSTICO. Si detectas un patrón, predice qué pasará si no se rompe.
3. CLARIDAD EJECUTIVA. Identifica el cuello de botella. Propón una solución medible.
4. AUDITORÍA DE METAS. Si el usuario menciona un objetivo, audita su plan inmediatamente — embudos, CAC, tiempos.
5. TONO. Directo, clínico, ultra-profesional. Eres el socio que dice la verdad incómoda.
6. BREVEDAD. 3-6 oraciones máximo por respuesta. Sin relleno corporativo.
7. EVITA "es importante", "podrías considerar", "tal vez". Habla con autoridad.
8. CONTEXTO YA DISPONIBLE. Tienes el perfil estratégico, el historial reciente y los LOOPS/TAREAS ABIERTAS del usuario en este prompt. NUNCA pidas "tu lista de tareas", "los proyectos activos" ni contexto que ya tienes. Úsalo directamente: nombra sus loops reales por su nombre y proponle accionables concretos sobre ELLOS. Si los loops están vacíos, infiere del historial — no preguntes.
9. HERRAMIENTA search_memories. Tienes acceso a búsqueda semántica sobre TODA la historia del usuario (no solo las últimas 10). Úsala cuando: (a) el usuario menciona algo del pasado que no está en el contexto, (b) necesitas evidencia específica para confrontar un patrón con sus propias palabras, (c) quieres demostrar continuidad temporal ("llevas 3 meses con esto"). NO la uses para info que ya tienes en el perfil/loops/historial reciente. Cuando cites una memoria, intégrala naturalmente en tu respuesta — no listes resultados crudos.
10. INVENTARIO Y LISTADOS. Cuando el usuario pida LISTAR, SUMAR, ENUMERAR, INVENTARIAR o ver una PANORÁMICA COMPLETA de sus loops, pendientes o memorias: SIEMPRE invoca search_memories ANTES de responder. Los LOOPS / TAREAS ABIERTAS pre-cargadas en este prompt son SOLO las 25 más recientes — el usuario tiene típicamente muchos más. NUNCA le pidas al usuario que reescriba info que ya está en su historia. Si no encuentras suficiente con un solo search, haz 2-3 búsquedas con queries distintas (ej: "pendientes activos", "loops sin avance", "decisiones aplazadas"). Tienes hasta 4 iteraciones de tool — úsalas cuando aporte.
11. LENGUAJE NATURAL (OBLIGATORIO — testers reales reportaron NO ENTENDER). PROHIBIDO (sustituye SIEMPRE):
JERGA CONSULTORA/ANGLICISMOS: "triaja", "línea de dolor", "backlog operativo", "decisión binaria/binariar", "propietario explícito", "stakeholder", "deliverable", "deep dive", "low hanging fruit", "Active Loops"/"loops" (label), "pipeline" (en cualquier sentido), "framework"/"paradigma"/"ecosistema" (cuando no son técnicos), "claridad táctica/operativa", "ejecución personal/operativa".
PSEUDO-CLÍNICO: "catastrofismo anticipatorio", "fusión emocional-operativa", "disonancia ejecutiva", "parálisis táctica", "control mental", "loop de control mental", "sustituto de delegación".
Sustituye por el equivalente NORMAL: "ordena/prioriza", "qué le duele", "pendientes acumulados", "sí o no", "quién se hace cargo", "involucrado", "entregable", "profundizar", "lo fácil primero", "pendientes", "lista de prospectos", "saber qué hacer", "lo que estás haciendo", "te estás imaginando lo peor", "le sigues dando vueltas". Habla como tu mejor amiga directora de ops a las 9pm de un martes.
`.trim();

const STATIC_RULES_THERAPY = `
ROL:
Eres BLACKBOX en modo conversación profunda. Un amigo con experiencia que escucha primero y después confronta con cariño. NO eres terapeuta, NO eres coach ejecutivo, NO eres consultor McKinsey. Hablas como un mentor sensato y cálido en una mesa de café.
No solo das directivas — ESCUCHAS, VALIDAS y luego CONFRONTAS con preguntas claras.
Tu meta: que el usuario salga con UN insight propio y UN paso concreto.

ESTILO DE VOZ (no negociable):
- Frases cortas. Lenguaje normal.
- Cero diagnóstico clínico ni etiquetas pseudo-psicológicas.
- Cero jerga de consultor ni anglicismos.
- Habla como tu mejor amiga le habla a otra a las 10pm de un domingo.

REGLAS NO NEGOCIABLES:
1. VALIDA ANTES DE CONFRONTAR. Reconoce la emoción o situación primero (1 oración).
2. OPINIÓN > DESCRIPCIÓN. No repitas lo que ya sabe. Toma postura sobre qué está pasando realmente.
3. PREDICCIÓN. Si detectas un patrón con sesiones previas, di qué pasará si no se rompe.
4. PREGUNTA PODEROSA. Cada respuesta termina con UNA pregunta abierta que profundice.
5. NO REPITAS el diagnóstico ya dado — solo refiérete a él si el usuario pregunta.
6. CONECTA PATRONES. Si detectas correlación con el historial, señálalo brevemente.
7. BREVEDAD TÁCTICA. 3-5 oraciones. Cero monólogos. Cero clichés terapéuticos.
8. LENGUAJE. Cálido pero directo. Aliado, no juez. Honesto, no condescendiente.
9. CONTEXTO YA DISPONIBLE. Tienes el perfil, el historial y los LOOPS/TAREAS ABIERTAS del usuario en este prompt. NUNCA pidas su lista de tareas ni contexto que ya tienes. Refiérete a sus loops reales por nombre. Si están vacíos, infiere del historial — no preguntes.
10. HERRAMIENTA search_memories. Igual que en modo estándar — búscalo cuando necesites evidencia histórica para validar/confrontar. En modo terapia, la cita debe sentirse como un descubrimiento conjunto, no como una sentencia: "hace dos meses escribías esto mismo de otra manera — ¿qué cambió, o qué no cambió?".
11. INVENTARIO Y LISTADOS. Igual que en modo estándar — si el usuario pide ver una panorámica de sus loops/pendientes, invoca search_memories antes de pedirle que reescriba nada. En modo terapia, la presentación de la lista debe ser conversacional: "Mira lo que vi en tu historia — hay 8 cosas similares a la que mencionas, déjame contártelas en orden de cuál te frena más", no como bullet list seca.
12. LENGUAJE NATURAL (OBLIGATORIO — feedback directo de testers reales). Escribe en español natural y cálido pero claro. NUNCA jerga consultora ni anglicismos. PROHIBIDO: "triaja", "línea de dolor", "backlog operativo", "decisión binaria", "propietario explícito", "stakeholder", "deliverable", "deep dive". En modo terapia el lenguaje debe ser aún más natural — habla como un amigo sabio, no como manual de coaching. Sustituye: "ordena/prioriza", "qué te duele", "lo que cargas", "sí o no", "quién se hace cargo", "involucrado", "entregable", "profundizar". Cero anglicismos vestidos de español.
`.trim();

// ─── Dynamic context blocks (user-specific — NOT cached) ─────────────────────

function buildDynamicContext_Standard(userName: string, category: string, history: string, profile: string, loops: string): string {
  return `
USUARIO: ${userName}
CATEGORÍA DE SESIÓN: ${category}

━━━ PERFIL ESTRATÉGICO LARGO PLAZO ━━━
${profile}

━━━ LOOPS / TAREAS ABIERTAS DEL USUARIO ━━━
${loops}
(Nota: estos son SOLO los 25 más recientes. Si el usuario pide 'todos', 'la lista completa', 'sumar', o cualquier panorámica amplia — invoca search_memories ANTES de responder.)

━━━ HISTORIAL RECIENTE (10 entradas) ━━━
${history}
`.trim();
}

function buildDynamicContext_Therapy(
  userName: string,
  history: string,
  profile: string,
  loops: string,
  entryContext: any
): string {
  const loopsText = entryContext?.actionItems?.length
    ? entryContext.actionItems.map((a: any) => `• [${a.priority ?? 'MEDIA'}] ${a.task}`).join('\n')
    : 'Ninguno detectado.';

  return `
USUARIO: ${userName}

━━━ MEMORIA QUE ACABAS DE ANALIZAR ━━━
Texto original:
"${entryContext?.originalText ?? ''}"

Tu diagnóstico previo:
- Resumen: ${entryContext?.summary ?? ''}
- Estado emocional: ${entryContext?.moodLabel ?? ''} (score: ${entryContext?.sentimentScore ?? 0})
- Insight estratégico: ${entryContext?.strategicInsight ?? ''}
- Recomendación: ${entryContext?.wellnessRecommendation ?? ''}
- Active Loops detectados:
${loopsText}

━━━ PERFIL ESTRATÉGICO LARGO PLAZO ━━━
${profile}

━━━ LOOPS / TAREAS ABIERTAS DEL USUARIO ━━━
${loops}
(Nota: estos son SOLO los 25 más recientes. Si el usuario pide 'todos', 'la lista completa', 'sumar', o cualquier panorámica amplia — invoca search_memories ANTES de responder.)

━━━ HISTORIAL RECIENTE (10 entradas) ━━━
${history}
`.trim();
}

// ─── Convert Gemini-style history to Claude-style messages ───────────────────
// Client sends: [{ role: 'user'|'model', parts: [{ text: '...' }] }, ...]
// Claude wants: [{ role: 'user'|'assistant', content: '...' }, ...]

function convertHistory(history: any[]): { role: 'user' | 'assistant'; content: string }[] {
  if (!Array.isArray(history)) return [];
  return history
    .map((m) => {
      const text = m?.parts?.[0]?.text ?? m?.content ?? '';
      if (!text) return null;
      const role = m.role === 'model' || m.role === 'assistant' ? 'assistant' : 'user';
      return { role: role as 'user' | 'assistant', content: text };
    })
    .filter(Boolean) as { role: 'user' | 'assistant'; content: string }[];
}

// ─── Handler ─────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'No authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY secret not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const {
      userMessage,
      chatHistory = [],
      userId,
      userName = 'Explorador',
      category = 'General',
      therapyMode = false,
      entryContext,
      image,
    } = await req.json();

    if (!userMessage) {
      return new Response(JSON.stringify({ error: 'userMessage is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch context in parallel
    const [history, profile, loops] = userId
      ? await Promise.all([getRecentInsights(userId), getStrategicProfile(userId), getOpenLoops(userId)])
      : ['Sin historial previo.', 'Perfil no disponible.', 'Loops no disponibles.'];

    const staticBlock = therapyMode ? STATIC_RULES_THERAPY : STATIC_RULES_STANDARD;
    const dynamicBlock = therapyMode && entryContext
      ? buildDynamicContext_Therapy(userName, history, profile, loops, entryContext)
      : buildDynamicContext_Standard(userName, category, history, profile, loops);

    // Last user turn: plain text, or image + text when an image is attached
    // (Claude Sonnet has vision).
    const lastUserContent = image?.data && image?.mediaType
      ? [
          { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } },
          { type: 'text', text: userMessage },
        ]
      : userMessage;

    // Claude messages array — exclude system, that goes in its own field.
    const messages = [
      ...convertHistory(chatHistory),
      { role: 'user' as const, content: lastUserContent },
    ];

    // Two cache breakpoints: the static rules (reused across all users)
    // and the static+dynamic prefix (strategic_profile + historical
    // context + loops — stable within a chat session, reused turn-to-turn).
    // Tool-use loop: Claude may call search_memories one or more times
    // before producing a final text answer. We cap at MAX_TOOL_ITERATIONS
    // to bound latency and cost.
    const MAX_TOOL_ITERATIONS = 4;
    let iterationMessages: any[] = [...messages];
    let finalText = '';
    let aggregatedUsage = {
      input_tokens: 0,
      output_tokens: 0,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    };
    let toolCallsExecuted = 0;

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const payload = {
        model: MODEL_NAME,
        max_tokens: therapyMode ? 600 : 1500,
        temperature: therapyMode ? 0.85 : 0.7,
        system: [
          { type: 'text', text: staticBlock, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: dynamicBlock, cache_control: { type: 'ephemeral' } },
        ],
        tools: [SEARCH_MEMORIES_TOOL],
        messages: iterationMessages,
      };

      const res = await withRetry(
        () => fetchWithStatus(ANTHROPIC_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(payload),
        }),
        { maxAttempts: 3, baseDelayMs: 600 }
      );

      const data: any = await res.json();

      // Aggregate usage across iterations
      const u = data?.usage ?? {};
      aggregatedUsage.input_tokens += u.input_tokens ?? 0;
      aggregatedUsage.output_tokens += u.output_tokens ?? 0;
      aggregatedUsage.cache_read_input_tokens += u.cache_read_input_tokens ?? 0;
      aggregatedUsage.cache_creation_input_tokens += u.cache_creation_input_tokens ?? 0;

      const stopReason = data?.stop_reason;
      const contentBlocks = data?.content ?? [];

      if (stopReason === 'tool_use') {
        // Append assistant turn (with tool_use blocks) to messages
        iterationMessages.push({ role: 'assistant', content: contentBlocks });

        // Execute every tool_use block; collect results
        const toolResultBlocks: any[] = [];
        for (const block of contentBlocks) {
          if (block.type !== 'tool_use') continue;
          toolCallsExecuted++;
          const result = await executeToolCall(block.name, block.input, userId);
          toolResultBlocks.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result.content,
            is_error: result.isError,
          });
        }

        // Append tool results as next user turn
        iterationMessages.push({ role: 'user', content: toolResultBlocks });

        // Continue loop for Claude to incorporate results
        continue;
      }

      // Terminal: extract text from final assistant turn
      const textBlock = contentBlocks.find((b: any) => b.type === 'text');
      finalText = textBlock?.text ?? '';
      break;
    }

    if (!finalText) {
      console.error('[ai-chat] No final text after', MAX_TOOL_ITERATIONS, 'iterations');
      throw new Error('No response from Claude after tool use loop');
    }

    console.log(`[ai-chat] tokens — input: ${aggregatedUsage.input_tokens}, output: ${aggregatedUsage.output_tokens}, cache_read: ${aggregatedUsage.cache_read_input_tokens}, cache_write: ${aggregatedUsage.cache_creation_input_tokens}, tool_calls: ${toolCallsExecuted}`);

    await logUsage({
      req,
      userId,
      component: image?.data ? 'image_vision' : 'ai_chat',
      provider: 'anthropic',
      model: MODEL_NAME,
      inputTokens: aggregatedUsage.input_tokens,
      outputTokens: aggregatedUsage.output_tokens,
      cacheReadTokens: aggregatedUsage.cache_read_input_tokens,
      cacheWriteTokens: aggregatedUsage.cache_creation_input_tokens,
      meta: { therapyMode: !!therapyMode, hasImage: !!image?.data, toolCalls: toolCallsExecuted },
    });

    // Return shape compatible with existing client code (parts[0].text).
    const responseContent = {
      role: 'model',
      parts: [{ text: finalText }],
    };

    return new Response(JSON.stringify({ content: responseContent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[ai-chat] error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
