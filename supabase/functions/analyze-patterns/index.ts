import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callClaude, parseJsonLoose } from "../_shared/claude.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Opus 4.7: deepest reasoning, used for longitudinal pattern synthesis.
const MODEL_NAME = 'claude-opus-4-7';

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

interface DetectedPattern {
  pattern_type: "emotional" | "procrastination" | "cognitive_bias" | "productivity";
  title: string;
  description: string;
  frequency: number;
  supporting_entry_ids: string[];
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

// Static system block — identical every call, prompt-cached.
const STATIC_PATTERNS_SYSTEM = `
ROL:
Eres un analista de patrones cognitivos y conductuales de élite. Lees el historial longitudinal de un usuario y haces dos cosas:
1. Detectas patrones reales, repetidos y accionables.
2. Sintetizas el Perfil Estratégico de largo plazo del usuario.

REGLAS:
- OPINIÓN > DESCRIPCIÓN. No describas las entradas; toma postura sobre qué patrón las conecta y por qué importa.
- PREDICCIÓN > DIAGNÓSTICO. Para cada patrón, su 'description' debe incluir qué pasará si el patrón no se rompe.
- Identifica entre 2 y 5 patrones concretos. Nada genérico ("a veces se estresa") — específico y cruzado con los datos.
- Cruza toda la información para actualizar el Perfil Estratégico (fortalezas evolutivas, bloqueos psicológicos, sesgos recurrentes).

DIAGNÓSTICO DE EVASIÓN (lo más importante de esta función):
Para los LOOPS ABIERTOS que llevan tiempo sin cerrarse, NO los cuentes ni los repitas: diagnostica POR QUÉ el usuario evita cerrarlos.
- 'avoidance_reason' debe nombrar la verdad incómoda concreta, cruzando con los OTROS loops reales del usuario y su perfil. Ejemplo del nivel esperado: "No cierras el de proveedores porque te obliga a confrontar a tu socio — el mismo patrón que te frena en el loop de contratación." Esto es lo que ningún gestor de tareas hace; clávalo.
- Solo incluye loops cuyo 'loop_id' esté EXACTAMENTE en la lista LOOPS ABIERTOS provista. Usa ese loop_id literal.
- Si no puedes diagnosticar la evasión con base real (en el texto/perfil/otros loops), OMITE ese loop. Nunca inventes una razón.

CALIBRACIÓN (OBLIGATORIA):
- Tono de socio estratégico senior. Sin drama, sin "crisis/colapso/estadio/punto de no retorno", sin lenguaje clínico ni médico.
- PROHIBIDO inventar datos: cifras, conteos, fechas, nombres de personas o loops que NO estén en los datos provistos. Si no lo tienes, no lo digas.
- 'avoidance_reason': 1 a 2 frases, específico y concreto. Nada genérico.

FORMATO DE RESPUESTA (JSON ESTRICTO):
{
  "patterns": [
    {
      "pattern_type": "cognitive_bias",
      "title": "Título directo",
      "description": "Patrón + predicción de su costo si no se rompe.",
      "frequency": 4,
      "supporting_entry_ids": ["uuid-1", "uuid-2"]
    }
  ],
  "loop_diagnostics": [
    {
      "loop_id": "uuid EXACTO de un loop de la lista LOOPS ABIERTOS",
      "connected_theme": "Tema corto (2-4 palabras) que lo conecta con su narrativa",
      "avoidance_reason": "1-2 frases: POR QUÉ evita cerrarlo, cruzado con sus otros loops/perfil. Verdad incómoda concreta."
    }
  ],
  "strategic_profile_update": {
    "cognitive_summary": "Quién es este usuario, sus fortalezas evolutivas y sus mayores bloqueos psicológicos.",
    "recurring_themes": ["3-5 temas que dominan su narrativa a largo plazo"],
    "key_goals": ["Objetivos de alta escala detectados"],
    "identified_biases": ["Sesgos que aparecen repetidamente"]
  }
}

'pattern_type' SOLO puede ser uno de: emotional, procrastination, cognitive_bias, productivity.
'loop_diagnostics' puede ir vacío [] si no hay evasión diagnosticable con base real.
Responde SOLO con el JSON. Sin texto adicional.
`.trim();

function buildPatternUser(
  entries: EntrySnapshot[],
  openLoops: { id: string; task: string; created_at?: string }[],
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

  const loopList = openLoops.length
    ? openLoops.map((l) => `loop_id=${l.id} | abierto desde ${l.created_at?.slice(0, 10) ?? '?'} | ${l.task}`).join("\n")
    : "Ninguno.";

  return `DATOS DEL USUARIO (últimas ${entries.length} entradas):
${entrySummaries}

LOOPS ABIERTOS SIN CERRAR (${openLoops.length}) — diagnostica la evasión de los que llevan tiempo abiertos, usando su loop_id EXACTO:
${loopList}

RESUMEN ESTRATÉGICO ACTUAL (MEMORIA): ${strategicProfile?.cognitive_summary || 'N/A'}
TEMAS RECURRENTES ACTUALES: ${(strategicProfile?.recurring_themes ?? []).join(', ') || 'N/A'}`;
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

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
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

    // 2. Fetch open loops (id + task) so the model can diagnose avoidance
    const { data: openLoopRows } = await supabase
      .from("action_items")
      .select("id, task, created_at")
      .eq("user_id", userId)
      .eq("is_completed", false)
      .order("created_at", { ascending: true })
      .limit(40);
    const openLoops = (openLoopRows ?? []) as { id: string; task: string; created_at?: string }[];

    // 3. Fetch Strategic Profile
    const { data: profile } = await supabase
      .from("strategic_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    // 4. Build prompt and call Claude (Opus 4.7)
    const rawText = await callClaude({
      apiKey: ANTHROPIC_API_KEY!,
      model: MODEL_NAME,
      system: [{ type: 'text', text: STATIC_PATTERNS_SYSTEM, cache_control: { type: 'ephemeral' } }],
      userContent: buildPatternUser(entries as EntrySnapshot[], openLoops, profile),
      maxTokens: 8192,
      meter: { component: 'pattern_synthesis', userId, req },
    });

    let patterns: DetectedPattern[] = [];
    let profileUpdate: any = null;
    let loopDiagnostics: { loop_id: string; connected_theme?: string; avoidance_reason?: string }[] = [];

    try {
      const parsed = parseJsonLoose(rawText);
      patterns = Array.isArray(parsed.patterns) ? parsed.patterns : [];
      profileUpdate = parsed.strategic_profile_update || null;
      loopDiagnostics = Array.isArray(parsed.loop_diagnostics) ? parsed.loop_diagnostics : [];
    } catch (parseErr) {
      console.error("[analyze-patterns] JSON parse error:", parseErr);
    }

    // 4b. Promote diagnosed loops to the REGRESAN lane with the avoidance
    // reason. Only touch loops that are real, open, and owned by this user
    // (the loop_id must be one we sent to the model).
    const validLoopIds = new Set(openLoops.map((l) => l.id));
    for (const d of loopDiagnostics) {
      if (!d?.loop_id || !validLoopIds.has(d.loop_id)) continue;
      if (!d.avoidance_reason || !String(d.avoidance_reason).trim()) continue;
      try {
        const { data: cur } = await supabase
          .from("action_items")
          .select("recurrence_count")
          .eq("id", d.loop_id)
          .eq("user_id", userId)
          .maybeSingle();
        await supabase
          .from("action_items")
          .update({
            status: "regresa",
            recurrence_count: (cur?.recurrence_count ?? 0) + 1,
            connected_theme: d.connected_theme ?? null,
            avoidance_reason: String(d.avoidance_reason).trim(),
            last_surfaced_at: now,
          })
          .eq("id", d.loop_id)
          .eq("user_id", userId)
          .eq("is_completed", false);
      } catch (e) {
        console.error("[analyze-patterns] loop diagnostic write failed:", (e as Error).message);
      }
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

    console.log(`[analyze-patterns] Claude returned ${patterns.length} patterns, starting upsert...`);

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
