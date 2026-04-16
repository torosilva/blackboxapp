import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withRetry, fetchWithStatus } from "../_shared/retry.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODEL_NAME = 'gemini-2.5-flash';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface EntrySnapshot {
  id: string;
  sentiment_score: number | null;
  mood_label: string | null;
  category: string | null;
  strategic_insight: any;
  created_at: string;
  summary: string | null;
}

interface GeminiPattern {
  pattern_type: "emotional" | "procrastination" | "cognitive_bias" | "productivity";
  title: string;
  description: string;
  frequency: number;
  supporting_entry_ids: string[];
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

function buildPatternPrompt(
  entries: EntrySnapshot[],
  openLoopsCount: number
): string {
  const entrySummaries = entries.map((e, i) => {
    let bias = "N/A";
    try {
      if (typeof e.strategic_insight === "string") {
        bias = JSON.parse(e.strategic_insight)?.detected_bias ?? "N/A";
      } else if (e.strategic_insight?.detected_bias) {
        bias = e.strategic_insight.detected_bias;
      }
    } catch { /* ignore */ }
    return `[${i + 1}] id=${e.id} | fecha=${e.created_at.slice(0, 10)} | mood=${e.mood_label ?? "?"} | score=${e.sentiment_score ?? "?"} | cat=${e.category ?? "?"} | sesgo=${bias} | resumen=${e.summary?.slice(0, 80) ?? "N/A"}`;
  }).join("\n");

  return `
ROL:
Eres un analista de patrones cognitivos y conductuales. Tu trabajo es leer el historial de un usuario y detectar patrones reales, repetidos y accionables. No inventes patrones — solo confirma lo que los datos muestran claramente.

DATOS DEL USUARIO (últimas ${entries.length} entradas):
${entrySummaries}

LOOPS ABIERTOS SIN CERRAR: ${openLoopsCount}

INSTRUCCIÓN:
Identifica entre 2 y 5 patrones concretos. Cada patrón debe:
- Basarse en al menos 2 entradas del historial.
- Ser accionable (el usuario puede hacer algo al respecto).
- Tener un título corto y directo (máx 6 palabras, sin emojis).
- Tener una descripción en 2-3 oraciones, en segunda persona, directa y clínica.
- Incluir los IDs de las entradas que lo evidencian en supporting_entry_ids.

TIPOS VÁLIDOS DE PATRÓN:
- "emotional": patrones en el estado emocional o mood recurrente.
- "procrastination": loops que se acumulan o tareas que nunca se cierran.
- "cognitive_bias": sesgo cognitivo que aparece en múltiples entradas.
- "productivity": caídas o picos de rendimiento en categorías específicas.

FORMATO DE RESPUESTA (JSON ESTRICTO, array de objetos):
[
  {
    "pattern_type": "cognitive_bias",
    "title": "Sesgo de Confirmación Recurrente",
    "description": "En 4 de tus últimas 8 sesiones el análisis detectó Sesgo de Confirmación. Tiendes a buscar evidencia que valide tus decisiones en lugar de cuestionarlas. Esto limita tu capacidad de detectar riesgos ocultos.",
    "frequency": 4,
    "supporting_entry_ids": ["uuid-1", "uuid-2", "uuid-3", "uuid-4"]
  }
]

Responde SOLO con el JSON array. Sin texto adicional.
`.trim();
}

// ─── Handler ─────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Optional auth check (Supabase handles JWT if configured)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    console.warn("[analyze-patterns] No authorization header present, proceeding with caution.");
  }

  if (!GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch last 20 entries
    const { data: entries, error: entriesErr } = await supabase
      .from("entries")
      .select("id, sentiment_score, mood_label, category, strategic_insight, created_at, summary")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (entriesErr) throw new Error(`Entries fetch error: ${entriesErr.message}`);
    if (!entries || entries.length < 2) {
      return new Response(JSON.stringify({ patterns: [], skipped: "Not enough entries" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Count open loops
    const { count: openLoopsCount } = await supabase
      .from("action_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_completed", false);

    // 3. Build prompt and call Gemini
    const prompt = buildPatternPrompt(entries as EntrySnapshot[], openLoopsCount ?? 0);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;

    const geminiRes = await withRetry(
      () => fetchWithStatus(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            response_mime_type: "application/json",
            temperature: 0.4,  // Low temp for factual pattern detection
            maxOutputTokens: 1500,
          },
        }),
      }),
      { maxAttempts: 3, baseDelayMs: 800 }
    );

    const geminiData: any = await geminiRes.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";

    let patterns: GeminiPattern[] = [];
    try {
      const arrayMatch = rawText.match(/\[[\s\S]*\]/);
      patterns = JSON.parse(arrayMatch ? arrayMatch[0] : rawText);
      if (!Array.isArray(patterns)) patterns = [];
    } catch (parseErr) {
      console.error("[analyze-patterns] JSON parse error:", parseErr);
      patterns = [];
    }

    // 4. Upsert patterns into user_patterns table
    const now = new Date().toISOString();
    const upsertResults = [];

    for (const p of patterns.slice(0, 5)) {
      if (!p.pattern_type || !p.title || !p.description) continue;

      // Try to find existing pattern for upsert
      const { data: existing } = await supabase
        .from("user_patterns")
        .select("id, frequency, first_seen_at")
        .eq("user_id", userId)
        .eq("pattern_type", p.pattern_type)
        .eq("title", p.title)
        .maybeSingle();

      const row = {
        user_id: userId,
        pattern_type: p.pattern_type,
        title: p.title,
        description: p.description,
        frequency: existing ? existing.frequency + 1 : (p.frequency ?? 1),
        first_seen_at: existing ? existing.first_seen_at : now,
        last_seen_at: now,
        supporting_entry_ids: p.supporting_entry_ids ?? [],
        is_active: true,
        updated_at: now,
      };

      const { data: upserted, error: upsertErr } = existing
        ? await supabase.from("user_patterns").update(row).eq("id", existing.id).select().single()
        : await supabase.from("user_patterns").insert({ ...row, created_at: now }).select().single();

      if (upsertErr) {
        console.error("[analyze-patterns] upsert error:", upsertErr.message);
      } else {
        upsertResults.push(upserted);
      }
    }

    console.log(`[analyze-patterns] Upserted ${upsertResults.length} patterns for user ${userId}`);

    return new Response(JSON.stringify({ patterns: upsertResults, count: upsertResults.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[analyze-patterns] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
