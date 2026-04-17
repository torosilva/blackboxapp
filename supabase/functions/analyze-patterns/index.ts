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

interface StrategicProfile {
  cognitive_summary: string;
  recurring_themes: string[];
  key_goals: string[];
  identified_biases: string[];
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
  openLoopsCount: number,
  strategicProfile?: StrategicProfile | null
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
Eres un analista de patrones cognitivos y conductuales de élite. Tu trabajo es leer el historial longitudinal de un usuario y hacer dos cosas:
1. Detectar patrones reales, repetidos y accionables.
2. Sintetizar el Perfil Estratégico de largo plazo del usuario basado en todas estas entradas.

DATOS DEL USUARIO (últimas ${entries.length} entradas):
${entrySummaries}

LOOPS ABIERTOS SIN CERRAR: ${openLoopsCount}

RESUMEN ESTRATÉGICO ACTUAL (MEMORIA): ${strategicProfile?.cognitive_summary || 'N/A'}
TEMAS RECURRENTES ACTUALES: ${(strategicProfile?.recurring_themes ?? []).join(', ') || 'N/A'}

INSTRUCCIÓN:
- Identifica entre 2 y 5 patrones concretos.
- Cruza toda la información para actualizar el Perfil Estratégico. Si notas que el usuario es resiliente, tiene miedo al fracaso o es excelente delegando, regístralo en el resumen cognitivo.

FORMATO DE RESPUESTA (JSON ESTRICTO):
{
  "patterns": [
    {
      "pattern_type": "cognitive_bias",
      "title": "Título directo",
      "description": "Descripción clínica y directa.",
      "frequency": 4,
      "supporting_entry_ids": ["uuid-1", "uuid-2"]
    }
  ],
  "strategic_profile_update": {
    "cognitive_summary": "Sintetiza quién es este usuario, sus fortalezas evolutivas y sus mayores bloqueos psicológicos detectados a lo largo de estas ${entries.length} memorias.",
    "recurring_themes": ["Lista de 3-5 temas que dominan su narrativa a largo plazo"],
    "key_goals": ["Objetivos de alta escala detectados"],
    "identified_biases": ["Lista de sesgos que aparecen repetidamente"]
  }
}

Responde SOLO con el JSON. Sin texto adicional.
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
    const now = new Date().toISOString();

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

    // 3. Fetch Strategic Profile
    const { data: profile } = await supabase
      .from("strategic_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    // 4. Build prompt and call Gemini
    const prompt = buildPatternPrompt(entries as EntrySnapshot[], openLoopsCount ?? 0, profile);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;

    const geminiRes = await withRetry(
      () => fetchWithStatus(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            response_mime_type: "application/json",
            temperature: 0.4,
            maxOutputTokens: 8192,
          },
        }),
      }),
      { maxAttempts: 3, baseDelayMs: 800 }
    );

    const geminiData: any = await geminiRes.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

    let patterns: GeminiPattern[] = [];
    let profileUpdate: any = null;

    try {
      const match = rawText.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(match ? match[0] : rawText);
      patterns = Array.isArray(parsed.patterns) ? parsed.patterns : [];
      profileUpdate = parsed.strategic_profile_update || null;
    } catch (parseErr) {
      console.error("[analyze-patterns] JSON parse error:", parseErr);
    }

    // 5. Update Strategic Profile (The Deep Memory)
    if (userId && profileUpdate) {
      try {
        const { data: current } = await supabase
          .from('strategic_profiles')
          .select('data_points_count')
          .eq('user_id', userId)
          .maybeSingle();

        const newCount = (current?.data_points_count ?? 0) + 1;
        
        await supabase.from('strategic_profiles').upsert({
          user_id: userId,
          cognitive_summary: profileUpdate.cognitive_summary,
          recurring_themes: profileUpdate.recurring_themes,
          key_goals: profileUpdate.key_goals,
          identified_biases: profileUpdate.identified_biases,
          data_points_count: newCount,
          last_updated_at: now
        });
        console.log(`[analyze-patterns] Global Strategic Profile synchronized for ${userId}`);
      } catch (profileErr) {
        console.error("[analyze-patterns] Profile sync error:", profileErr);
      }
    }

    // 6. Upsert individual patterns into user_patterns table
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const VALID_TYPES = ["emotional", "procrastination", "cognitive_bias", "productivity"];

    console.log(`[analyze-patterns] Gemini returned ${patterns.length} patterns, starting upsert...`);

    const upsertResults = [];
    for (const p of patterns.slice(0, 5)) {
      if (!p.pattern_type || !p.title || !p.description) {
        console.warn("[analyze-patterns] Skipping pattern — missing required fields:", JSON.stringify(p));
        continue;
      }

      // Sanitize pattern_type against DB CHECK constraint
      if (!VALID_TYPES.includes(p.pattern_type)) {
        console.warn(`[analyze-patterns] Invalid pattern_type '${p.pattern_type}', mapping to cognitive_bias`);
        p.pattern_type = "cognitive_bias";
      }

      // Sanitize supporting_entry_ids — only keep valid UUIDs
      const safeEntryIds = (p.supporting_entry_ids ?? []).filter((id: string) => UUID_REGEX.test(id));

      const { data: existing, error: selectErr } = await supabase
        .from("user_patterns")
        .select("id, frequency, first_seen_at")
        .eq("user_id", userId)
        .eq("pattern_type", p.pattern_type)
        .eq("title", p.title)
        .maybeSingle();

      if (selectErr) {
        console.error("[analyze-patterns] Select error (table may not exist):", selectErr.message);
        continue;
      }

      const row = {
        user_id: userId,
        pattern_type: p.pattern_type,
        title: p.title,
        description: p.description,
        frequency: existing ? existing.frequency + 1 : (p.frequency ?? 1),
        first_seen_at: existing ? existing.first_seen_at : now,
        last_seen_at: now,
        supporting_entry_ids: safeEntryIds,
        is_active: true,
        updated_at: now,
      };

      const { data: upserted, error: upsertErr } = existing
        ? await supabase.from("user_patterns").update(row).eq("id", existing.id).select().single()
        : await supabase.from("user_patterns").insert({ ...row, created_at: now }).select().single();

      if (upsertErr) {
        console.error(`[analyze-patterns] Upsert error for pattern '${p.title}':`, upsertErr.message);
      } else {
        upsertResults.push(upserted);
      }
    }

    console.log(`[analyze-patterns] Done — ${upsertResults.length}/${patterns.length} patterns saved for ${userId}`);

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
