import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withRetry, fetchWithStatus } from "../_shared/retry.ts";

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const MODEL_NAME = 'gemini-2.0-flash';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Prompts ────────────────────────────────────────────────────────────────

function buildAnalysisPrompt(userText: string, historicalContext?: string): string {
  return `
ROL:
Eres BLACKBOX, un Consultor Estratégico Senior (Ex-McKinsey), Auditor de Decisiones y Coach de Alto Rendimiento.
Tu objetivo es convertir el caos o las metas del usuario en CLARIDAD TÁCTICA.

CONTEXTO HISTÓRICO:
${historicalContext ?? 'Sin contexto previo.'}

REGLAS DE OPERACIÓN:
1. CERO OBVIEDADES: Si el usuario plantea una meta, dile CÓMO (embudos, canales, CAC).
2. PUNTO CIEGO ESTRATÉGICO: Encuentra el riesgo o error de cálculo que el usuario NO está viendo.
3. SESGOS COGNITIVOS: Identifica sesgos (Costo Hundido, Confirmación, etc.) en problemas operativos.
4. TITULACIÓN AUTOMÁTICA: Genera un título militar, clínico y directo basado en el contenido (máx 5 palabras). No uses emojis. Ej: 'Falla Operativa: Proveedor' o 'Auditoría: Expansión Q3'.
5. TONO: Directo, clínico, objetivo. No busques consolar, busca dar ventaja competitiva.
6. VALORACIÓN DE METAS: Analiza si el usuario plantea un objetivo de largo alcance (ej: "Lanzar producto", "Duplicar ventas", "Correr maratón"). Si es así, lístalo en 'suggested_goals'.

FORMATO DE RESPUESTA (JSON ESTRICTO):
{
  "title": "Título táctico y contundente",
  "summary": "Resumen ejecutivo crudo (máx 2 líneas).",
  "mood_label": "Frustrado | En Flow | Agotado | Disperso | Ansioso | Satisfecho | Estratégico",
  "sentiment_score": 0.0,
  "category": "BUSINESS | PERSONAL | DEVELOPMENT | WELLNESS",
  "strategic_insight": {
    "detected_bias": "Nombre del sesgo cognitivo, O 'Punto Ciego Estratégico' si es una meta de negocio",
    "warning_message": "La cruda realidad: el riesgo principal, el cuello de botella, o el error de cálculo.",
    "counter_thought": "MOVIMIENTO TÁCTICO: La directiva exacta para resolver el cuello de botella o neutralizar el sesgo."
  },
  "action_items": [
    { "description": "Verbo + Resultado", "priority": "HIGH | MEDIUM | LOW", "category": "BUSINESS | PERSONAL | HEALTH" }
  ],
  "wellness_recommendation": {
    "type": "FOCUS_TOOL | MEDITATION | EXERCISE",
    "title": "Protocolo de Ejecución",
    "description": "Herramienta mental o protocolo para asegurar la ejecución.",
    "duration_minutes": 15
  },
  "suggested_goals": ["Objetivo estratégico 1"]
}

Analiza esta entrada del usuario:
${userText}
  `.trim();
}

function buildWeeklyReportPrompt(entries: unknown[]): string {
  return `
ROL: Analista Estratégico. Genera un REPORTE DE EJECUCIÓN SEMANAL.

ESTRUCTURA OBLIGATORIA (En Markdown):
### 📊 Resumen de Rendimiento
[1 párrafo clínico]
### 🧠 Auditoría de Sesgos y Puntos Ciegos
[Qué falló o qué sesgo se repitió]
### ⚡ Outlook Táctico
- [Tarea crítica pendiente 1]
- [Tarea crítica pendiente 2]

Datos: ${JSON.stringify(entries)}
  `.trim();
}

// ─── Gemini caller ───────────────────────────────────────────────────────────

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

// ─── Handler ─────────────────────────────────────────────────────────────────

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Auth check
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
    const body = await req.json();
    const { mode, entries, historicalContext } = body;

    // ── Mode: weekly report ──────────────────────────────────────────────────
    if (mode === 'weekly') {
      const prompt = buildWeeklyReportPrompt(entries ?? []);
      const data: any = await callGemini({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 1500 },
      });
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No se pudo generar el reporte.';
      return new Response(JSON.stringify({ report: text }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Mode: analyze entry (default) ────────────────────────────────────────
    const userText = (entries ?? []).map((e: any) => {
      if (typeof e === 'string') return e;
      return `${e.title ? `Título: ${e.title}\n` : ''}Contenido: ${e.content}`;
    }).join('\n---\n');

    const prompt = buildAnalysisPrompt(userText, historicalContext);

    const data: any = await callGemini({
      system_instruction: { parts: [{ text: "Responde siempre con JSON válido y nada más." }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        response_mime_type: 'application/json',
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    });

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);

    return new Response(JSON.stringify({ analysis: parsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
