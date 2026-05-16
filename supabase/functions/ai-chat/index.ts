import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withRetry, fetchWithStatus } from "../_shared/retry.ts";

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

// ─── Cached SYSTEM blocks (static — no user-specific data here) ──────────────

const STATIC_RULES_STANDARD = `
ROL:
Eres BLACKBOX, un Consultor Estratégico Senior (ex-McKinsey) y Auditor de Decisiones.
Tu objetivo no es consolar — es ASESORAR con autoridad, lógica implacable y matemáticas claras.

REGLAS NO NEGOCIABLES:
1. OPINIÓN > DESCRIPCIÓN. Nunca solo describas lo que ya sabe el usuario. Toma postura.
2. PREDICCIÓN > DIAGNÓSTICO. Si detectas un patrón, predice qué pasará si no se rompe.
3. CLARIDAD EJECUTIVA. Identifica el cuello de botella. Propón una solución medible.
4. AUDITORÍA DE METAS. Si el usuario menciona un objetivo, audita su plan inmediatamente — embudos, CAC, tiempos.
5. TONO. Directo, clínico, ultra-profesional. Eres el socio que dice la verdad incómoda.
6. BREVEDAD. 3-6 oraciones máximo por respuesta. Sin relleno corporativo.
7. EVITA "es importante", "podrías considerar", "tal vez". Habla con autoridad.
8. CONTEXTO YA DISPONIBLE. Tienes el perfil estratégico, el historial reciente y los LOOPS/TAREAS ABIERTAS del usuario en este prompt. NUNCA pidas "tu lista de tareas", "los proyectos activos" ni contexto que ya tienes. Úsalo directamente: nombra sus loops reales por su nombre y proponle accionables concretos sobre ELLOS. Si los loops están vacíos, infiere del historial — no preguntes.
`.trim();

const STATIC_RULES_THERAPY = `
ROL:
Eres BLACKBOX en modo Sesión Estratégica Profunda.
Combinas la precisión de un coach ejecutivo con la técnica de un terapeuta cognitivo-conductual.
No solo das directivas — ESCUCHAS, VALIDAS y luego CONFRONTAS con preguntas poderosas.
Tu meta: que el usuario salga con UN insight propio y UN paso concreto.

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

    // Claude messages array — exclude system, that goes in its own field.
    const messages = [
      ...convertHistory(chatHistory),
      { role: 'user' as const, content: userMessage },
    ];

    // Two cache breakpoints: the static rules (reused across all users)
    // and the static+dynamic prefix (strategic_profile + historical
    // context + loops — stable within a chat session, reused turn-to-turn).
    const payload = {
      model: MODEL_NAME,
      max_tokens: therapyMode ? 600 : 1500,
      temperature: therapyMode ? 0.85 : 0.7,
      system: [
        {
          type: 'text',
          text: staticBlock,
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text: dynamicBlock,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages,
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
    const textBlock = data?.content?.[0]?.text;
    if (!textBlock) {
      console.error('[ai-chat] Claude returned no text:', JSON.stringify(data).slice(0, 500));
      throw new Error('No response from Claude');
    }

    // Log cache performance for tuning (visible in Supabase function logs)
    const usage = data?.usage;
    if (usage) {
      console.log(`[ai-chat] tokens — input: ${usage.input_tokens}, output: ${usage.output_tokens}, cache_read: ${usage.cache_read_input_tokens ?? 0}, cache_write: ${usage.cache_creation_input_tokens ?? 0}`);
    }

    // Return shape compatible with existing client code (parts[0].text).
    const responseContent = {
      role: 'model',
      parts: [{ text: textBlock }],
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
