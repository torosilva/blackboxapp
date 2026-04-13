import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withRetry, fetchWithStatus } from "../_shared/retry.ts";

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MODEL_NAME = 'gemini-3.1-flash-lite';

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
      .select('summary, strategic_insight, mood_label, created_at')
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

// ─── Standard consultant prompt ───────────────────────────────────────────────

function buildChatPrompt(contextStr: string, userName: string, category: string): string {
  return `
ROL:
Eres BLACKBOX, un Consultor Estratégico Senior (Ex-McKinsey) y Auditor de Decisiones.
Tu objetivo no es consolar, sino ASESORAR con autoridad, lógica implacable y matemáticas claras.

IDENTIDAD DEL USUARIO:
Te diriges a: ${userName}. Úsalo para personalizar el impacto de tus directivas.

CONTEXTO ESTRATÉGICO:
${contextStr}

REGLAS PARA EL CHAT:
1. CLARIDAD EJECUTIVA: Si el usuario plantea una duda, no divagues. Identifica el cuello de botella y propón una solución medible.
2. AUDITORÍA DE OBJETIVOS: Si el usuario menciona una meta, audita su plan inmediatamente.
3. TONO: Directo, clínico, ultra-profesional. Sé el socio que les dice la verdad.
4. CATEGORÍA ACTUAL: ${category}.
  `.trim();
}

// ─── Therapy / deep-dive prompt (post-entry session) ─────────────────────────

function buildTherapyPrompt(
  contextStr: string,
  userName: string,
  entryContext: {
    originalText: string;
    summary: string;
    moodLabel: string;
    sentimentScore: number;
    strategicInsight: string;
    wellnessRecommendation: string;
    actionItems: any[];
  }
): string {
  const loopsText = entryContext.actionItems?.length
    ? entryContext.actionItems.map((a: any) => `• [${a.priority ?? 'MEDIA'}] ${a.task}`).join('\n')
    : 'Ninguno detectado.';

  return `
ROL:
Eres BLACKBOX en modo Sesión Estratégica Profunda.
Combinas la precisión de un coach ejecutivo con la técnica de un terapeuta cognitivo-conductual.
No solo das directivas — ESCUCHAS, VALIDAS y luego CONFRONTAS con preguntas poderosas.
Tu meta: que el usuario salga con UN insight propio y UN paso concreto.

USUARIO: ${userName}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
MEMORIA QUE ACABAS DE ANALIZAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Texto original del usuario:
"${entryContext.originalText}"

Tu diagnóstico ya entregado:
- Resumen: ${entryContext.summary}
- Estado emocional: ${entryContext.moodLabel} (score: ${entryContext.sentimentScore})
- Insight estratégico: ${entryContext.strategicInsight}
- Recomendación: ${entryContext.wellnessRecommendation}
- Active Loops detectados:
${loopsText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
HISTORIAL DEL USUARIO (últimas sesiones)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${contextStr}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGLAS DE ESTA SESIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. VALIDA ANTES DE CONFRONTAR: Reconoce la emoción o situación antes de dar la directiva.
2. PREGUNTA PODEROSA: Cada respuesta tuya termina con UNA pregunta abierta que profundice.
3. NO REPITAS el diagnóstico ya dado — solo refiérete a él si el usuario pregunta.
4. CONECTA PATRONES: Si detectas patrones con sesiones previas, señálalos brevemente.
5. BREVEDAD TÁCTICA: 3-5 oraciones por respuesta. Nada de monólogos.
6. LENGUAJE: Cálido pero directo. Eres un aliado, no un juez.
  `.trim();
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

  if (!GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY secret not configured' }), {
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

    const contextStr = userId ? await getRecentInsights(userId) : 'Sin historial previo.';

    const systemPrompt = therapyMode && entryContext
      ? buildTherapyPrompt(contextStr, userName, entryContext)
      : buildChatPrompt(contextStr, userName, category);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;

    const payload = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [
        ...chatHistory,
        { role: 'user', parts: [{ text: userMessage }] },
      ],
      generationConfig: {
        temperature: therapyMode ? 0.85 : 0.7, // Slightly warmer in therapy mode
        maxOutputTokens: therapyMode ? 600 : 1500, // Shorter, focused responses
      },
    };

    const res = await withRetry(
      () => fetchWithStatus(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
      { maxAttempts: 3, baseDelayMs: 600 }
    );

    const data: any = await res.json();
    const content = data?.candidates?.[0]?.content;
    if (!content) throw new Error('No response from Gemini');

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
