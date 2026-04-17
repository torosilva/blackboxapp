import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withRetry, fetchWithStatus } from "../_shared/retry.ts";

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const MODEL_NAME = 'gemini-2.5-flash';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Prompts ────────────────────────────────────────────────────────────────

interface HistoricalContext {
  recentMoods?: { date: string; score: number; label: string }[];
  dominantCategories?: { category: string; count: number }[];
  recurringBiases?: { bias: string; count: number }[];
  openLoopsCount?: number;
  avgSentimentLast7Days?: number | null;
  totalEntries?: number;
  dataMaturity?: 'none' | 'building' | 'ready';
  strategic_profile?: StrategicProfile;
}

interface StrategicProfile {
  cognitive_summary: string;
  recurring_themes: string[];
  key_goals: string[];
  identified_biases: string[];
}

function buildContextBlock(ctx: HistoricalContext | string | null | undefined): string {
  if (typeof ctx === 'string') return ctx || 'Sin historial previo.';
  if (!ctx) return 'Sin historial previo.';

  const { dataMaturity, avgSentimentLast7Days, openLoopsCount, recurringBiases,
          dominantCategories, recentMoods, totalEntries, strategic_profile } = ctx;

  if (dataMaturity === 'none' || !totalEntries) {
    return `[PRIMER ANÁLISIS] Este es el primer registro del usuario. No hay patrones previos disponibles. Enfócate exclusivamente en el contenido actual sin mencionar tendencias.`;
  }

  const avgStr = avgSentimentLast7Days !== null ? avgSentimentLast7Days.toFixed(2) : 'N/A';
  const topBias = (recurringBiases ?? []).map(b => b.bias).join(', ') || 'ninguno identificado';
  const topCats = (dominantCategories ?? []).slice(0, 2).map(c => c.category).join(', ') || 'N/A';
  const moodHistory = (recentMoods ?? []).slice(0, 5).map(m => `${m.label}(${m.score.toFixed(1)})`).join(' → ');

  let context = `EL USUARIO TIENE UN HISTORIAL DE ${totalEntries} ENTRADAS.
- Sentimiento promedio (7 días): ${avgStr} (rango: -1.0 a +1.0).
- Loops abiertos (tareas sin completar): ${openLoopsCount ?? 0}.
- Sesgo más recurrente: ${topBias}.
- Áreas de enfoque recientes: ${topCats}.
- Secuencia de ánimo reciente: ${moodHistory}.
- PERFIL ESTRATÉGICO LARGO PLAZO: ${strategic_profile?.cognitive_summary || 'En proceso de síntesis...'}
- TEMAS RECURRENTES: ${(strategic_profile?.recurring_themes ?? []).join(', ') || 'Pendiente'}.
- METAS CLAVE: ${(strategic_profile?.key_goals ?? []).join(', ') || 'Pendiente'}.

DIRECTIVA DE INTEGRACIÓN:
Usa esta "memoria a largo plazo" para que tu insight no sea aislado. 
Ejemplo: "El usuario ha tenido sentiment promedio de ${avgStr} esta semana, sus loops sin cerrar son ${openLoopsCount}, y su sesgo más recurrente es ${topBias}. Considera esto al generar el insight estratégico."`;

  if (dataMaturity === 'building') {
    const missing = 5 - totalEntries;
    context = `[HISTORIAL EN CONSTRUCCIÓN — Faltan ${missing} entradas para perfil completo]
${context}
INSTRUCCIÓN: Menciona brevemente que estás empezando a notar patrones pero que aún necesitas ${missing} entradas más para un perfil estratégico estadísticamente sólido.`;
  } else if (dataMaturity === 'ready') {
    context = `[PERFIL ESTRATÉGICO LISTO]
${context}
INSTRUCCIÓN: Tienes datos suficientes. Cruza el contenido de hoy con el sesgo más recurrente (${topBias}) y el sentimiento promedio (${avgStr}) para dar un insight longitudinal.`;
  }

  return context;
}

function buildAnalysisPrompt(userText: string, historicalContext?: HistoricalContext | string | null): string {
  const contextBlock = buildContextBlock(historicalContext);
  return `
ROL:
Eres BLACKBOX, un Consultor Estratégico Senior (Ex-McKinsey), Auditor de Decisiones y Coach de Alto Rendimiento.
Tu objetivo es convertir el caos o las metas del usuario en CLARIDAD TÁCTICA.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTEXTO HISTÓRICO DEL USUARIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${contextBlock}

REGLAS DE OPERACIÓN:
1. CERO OBVIEDADES: Si el usuario plantea una meta, dile CÓMO (embudos, canales, CAC).
2. PUNTO CIEGO ESTRATÉGICO: Encuentra el riesgo o error de cálculo que el usuario NO está viendo.
3. SESGOS COGNITIVOS: Identifica sesgos (Costo Hundido, Confirmación, etc.) en problemas operativos.
4. TITULACIÓN AUTOMÁTICA: Genera un título militar, clínico y directo basado en el contenido (máx 5 palabras). No uses emojis. Ej: 'Falla Operativa: Proveedor' o 'Auditoría: Expansión Q3'.
5. TONO: Directo, clínico, objetivo. No busques consolar, busca dar ventaja competitiva.
6. VALORACIÓN DE METAS: Analiza si el usuario plantea un objetivo de largo alcance. Si es así, lístalo en 'suggested_goals'.
7. USA EL CONTEXTO HISTÓRICO: Si hay patrones disponibles, intégralos en el insight.

FORMATO DE RESPUESTA (JSON ESTRICTO):
{
  "title": "Título táctico",
  "summary": "Resumen ejecutivo",
  "mood_label": "Neutral",
  "sentiment_score": 0.0,
  "category": "BUSINESS | PERSONAL | DEVELOPMENT | WELLNESS | HEALTH",
  "strategic_insight": {
    "detected_bias": "Nombre del sesgo",
    "warning_message": "Riesgo principal",
    "counter_thought": "Movimiento táctico"
  },
  "action_items": [
    { "task": "Verbo + Resultado", "priority": "HIGH", "category": "BUSINESS" }
  ],
  "wellness_recommendation": {
    "type": "FOCUS_TOOL",
    "title": "Protocolo",
    "description": "Herramienta",
    "duration_minutes": 15
  },
  "suggested_goals": ["Objetivo"],
  "strategic_profile_update": {
    "cognitive_summary": "Actualización del perfil longitudinal (quién es el usuario, qué le preocupa, cómo decide)",
    "recurring_themes": ["Temas nuevos o reforzados"],
    "key_goals": ["Metas detectadas"],
    "identified_biases": ["Sesgos acumulados"]
  }
}

REGLA DE ORO: En 'category' SOLO puedes usar uno de los siguientes valores exactos: BUSINESS, PERSONAL, DEVELOPMENT, WELLNESS, HEALTH. Cualquier otro valor hará que el sistema falle.

Responde SOLO con el JSON. Sin texto adicional.

Analiza esta entrada:
${userText}
`.trim();
}

async function callGemini(payload: unknown): Promise<unknown> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;
  return withRetry(
    async () => {
      const res = await fetchWithStatus(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.json();
    },
    { maxAttempts: 3, baseDelayMs: 600 }
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) console.warn('[analyze-entry] No authorization header - continuing');
  if (!GEMINI_API_KEY) {
    const diag = { title: "ERROR INTERNO", summary: "Falta GEMINI_API_KEY en Supabase Vault", mood_label: "Error", category: "PERSONAL" };
    return new Response(JSON.stringify({ analysis: diag }), { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { mode, entries, historicalContext, entryId, userId } = body;

    if (mode === 'weekly') {
      const entryTexts = (entries ?? []).map((e: any) =>
        typeof e === 'string' ? e : `[${e.created_at?.split('T')[0] ?? 'sin fecha'}] Título: ${e.title ?? 'Sin título'}\n${e.content ?? ''}`
      ).join('\n---\n');

      const strategicProfile = buildContextBlock(historicalContext);

      const weeklyPrompt = `
ROL: Eres BLACKBOX, un Analista Estratégico Senior. Tu tarea es generar un REPORTE SEMANAL de alto nivel.

CONTEXTO ESTRATÉGICO LARGO PLAZO (MEMORIA):
${strategicProfile}

ENTRADAS DE LA SEMANA:
${entryTexts}

INSTRUCCIONES:
Genera un reporte ejecutivo en Markdown con estas secciones:
1. ## Resumen Ejecutivo (Cruza la memoria a largo plazo con lo ocurrido esta semana)
2. ## Estado Emocional General (sentimiento dominante y tendencia)
3. ## Patrones Identificados (¿Son nuevos o son los mismos de tu historial?)
4. ## Victorias de la Semana (logros mencionados)
5. ## Riesgos y Puntos Ciegos (basado en tus sesgos recurrentes)
6. ## Directiva para la Próxima Semana (3 acciones concretas con verbos de acción)

Sé directo, clínico y sin relleno. Máximo 400 palabras.
      `.trim();

      const weeklyData: any = await callGemini({
        contents: [{ parts: [{ text: weeklyPrompt }] }],
        generationConfig: { temperature: 0.6 }
      });

      const weeklyReport = weeklyData?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No se pudo generar el reporte.';
      return new Response(JSON.stringify({ report: weeklyReport }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userText = (entries ?? []).map((e: any) => typeof e === 'string' ? e : `Contenido: ${e.content}`).join('\n---\n');
    const prompt = buildAnalysisPrompt(userText, historicalContext);

    const data: any = await callGemini({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { response_mime_type: 'application/json', temperature: 0.7 }
    });

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      const finishReason = data?.candidates?.[0]?.finishReason ?? 'unknown';
      const promptFeedback = data?.promptFeedback?.blockReason ?? null;
      throw new Error(`Gemini returned no content. finishReason=${finishReason}${promptFeedback ? `, blocked=${promptFeedback}` : ''}`);
    }
    const parsed = JSON.parse(rawText);

    // ─── Sanitize Category (Avoid DB Constraints violation) ──────────────
    const VALID_CATEGORIES = ['BUSINESS', 'PERSONAL', 'DEVELOPMENT', 'WELLNESS', 'HEALTH'];
    if (parsed.category) {
      const upper = parsed.category.toString().toUpperCase();
      parsed.category = VALID_CATEGORIES.includes(upper) ? upper : 'PERSONAL';
    } else {
      parsed.category = 'PERSONAL';
    }

    // ─── Update Strategic Profile (The Cognitive Memory) ───────────────────
    if (userId && parsed.strategic_profile_update && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      (async () => {
        try {
          const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          
          // Fetch existing profile count to keep track of evolution
          const { data: current } = await supabase
            .from('strategic_profiles')
            .select('data_points_count')
            .eq('user_id', userId)
            .maybeSingle();
            
          const newCount = (current?.data_points_count ?? 0) + 1;

          await supabase.from('strategic_profiles').upsert({
            user_id: userId,
            cognitive_summary: parsed.strategic_profile_update.cognitive_summary,
            recurring_themes: parsed.strategic_profile_update.recurring_themes,
            key_goals: parsed.strategic_profile_update.key_goals,
            identified_biases: parsed.strategic_profile_update.identified_biases,
            data_points_count: newCount,
            last_updated_at: new Date().toISOString()
          });
          console.log(`[analyze-entry] Strategic Profile updated for ${userId} (Point #${newCount})`);
        } catch (e) {
          console.error('[analyze-entry] Strategic Profile update error:', e);
        }
      })();
    }

    // FIX: Guardado de Action Items usando el 'body' ya leído
    if (entryId && userId && parsed.action_items && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      (async () => {
        try {
          const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          const VALID_CAT = ['BUSINESS', 'PERSONAL', 'DEVELOPMENT', 'WELLNESS', 'HEALTH'];
          const rows = parsed.action_items.map((item: any) => {
            const upCat = (item.category || 'PERSONAL').toUpperCase();
            return {
              user_id: userId,
              entry_id: entryId,
              task: item.task || 'Tarea',
              priority: (item.priority || 'MEDIUM').toUpperCase(),
              category: VALID_CAT.includes(upCat) ? upCat : 'PERSONAL'
            };
          });
          await supabase.from('action_items').insert(rows);
        } catch (e) { console.error('BG_INSERT_ERROR:', e); }
      })();
    }

    return new Response(JSON.stringify({ analysis: parsed }), { headers: corsHeaders });

  } catch (error: any) {
    console.error('[analyze-entry] fatal runtime error:', error.message);
    const diagnosticAnalysis = {
      title: "ERROR INTERNO",
      summary: "Falló la función: " + error.message,
      mood_label: "Error",
      sentiment_score: 0,
      category: "PERSONAL",
      action_items: [],
      suggested_goals: [],
      wellness_recommendation: { type: "FOCUS", title: "N/A", description: "N/A", duration_minutes: 0 },
      strategic_insight: { detected_bias: "N/A", warning_message: "Error de ejecución", counter_thought: "N/A" }
    };
    return new Response(JSON.stringify({ analysis: diagnosticAnalysis, error_debug: error.message }), { status: 200, headers: corsHeaders });
  }
});
