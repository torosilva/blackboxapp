import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callClaude, parseJsonLoose } from "../_shared/claude.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Sonnet 4.6: rápido + suficiente capacidad para el primer reflejo
// (no requiere razonamiento longitudinal todavía).
const MODEL_NAME = "claude-sonnet-4-6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Prompt estático — idéntico cada llamada, va al cache.
const STATIC_INITIAL_SYSTEM = `
ROL: Eres BlackBoxMind. Es el primer día del usuario contigo. Acaba
de responderte 5 preguntas. NO tienes historial longitudinal todavía.
Tu trabajo: hacer un primer reflejo confrontativo PERO honesto sobre
los límites de lo que puedes ver con solo 5 capturas.

REGLAS:
1. Identifica el HILO COMÚN entre las 5 capturas (si lo hay). NO inventes
   un hilo si las capturas son temáticamente diversas — sé honesto.
2. Predice qué pasaría si el patrón detectado no se rompe en 30 días.
3. Cierra con: "Este es el día 1. Mañana, con más data, te diré si
   avanzaste o sigues dándole vueltas."
4. Identifica entre 2 y 3 patrones específicos. Nombres clínico-
   estratégicos (ej: "Postergación táctica", "Validación ritualizada").
5. Tono: socio estratégico senior. Directo, sin clichés terapéuticos.
   Máximo 4-5 oraciones para el reflejo principal.

FORMATO RESPUESTA (JSON estricto):
{
  "reflejo": "Texto del reflejo principal, 3-5 oraciones.",
  "patterns": [
    {
      "title": "Postergación táctica",
      "description": "Lo que viste en 2 de las 5 capturas."
    },
    {
      "title": "Validación externa como sustituto",
      "description": "Lo que viste en otra captura."
    }
  ]
}

Responde SOLO con el JSON. Sin texto adicional.
`.trim();

function buildInitialUser(entries: { content: string; created_at: string }[]): string {
  const block = entries
    .map((e, i) => `[Captura ${i + 1}] ${e.content.trim()}`)
    .join("\n\n");
  return `Estas son las 5 capturas que el usuario soltó en su primer onboarding:

${block}

Analízalas y devuelve el JSON con reflejo + 2-3 patrones.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const { userId, entryIds } = await req.json();
    if (!userId || !Array.isArray(entryIds) || entryIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "userId and entryIds[] are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date().toISOString();

    // 1. Fetch raw content de las entries del onboarding
    const { data: entries, error: entriesErr } = await supabase
      .from("entries")
      .select("id, content, original_text, created_at")
      .eq("user_id", userId)
      .in("id", entryIds)
      .order("created_at", { ascending: true });

    if (entriesErr) throw new Error(`Entries fetch error: ${entriesErr.message}`);
    if (!entries || entries.length === 0) {
      return new Response(
        JSON.stringify({ error: "No matching entries found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const normalized = entries.map((e: any) => ({
      content: (e.original_text || e.content || "").trim(),
      created_at: e.created_at,
    }));

    // 2. Llamar a Claude
    const rawText = await callClaude({
      apiKey: ANTHROPIC_API_KEY!,
      model: MODEL_NAME,
      system: [{ type: "text", text: STATIC_INITIAL_SYSTEM, cache_control: { type: "ephemeral" } }],
      userContent: buildInitialUser(normalized),
      maxTokens: 1200,
      temperature: 0.6,
    });

    let reflejo = "";
    let patterns: { title: string; description: string }[] = [];

    try {
      const parsed = parseJsonLoose(rawText);
      reflejo = typeof parsed.reflejo === "string" ? parsed.reflejo : "";
      patterns = Array.isArray(parsed.patterns)
        ? parsed.patterns
            .filter((p: any) => p?.title && p?.description)
            .slice(0, 3)
        : [];
    } catch (parseErr) {
      console.error("[generate-initial-reflejo] JSON parse error:", parseErr);
    }

    if (!reflejo) {
      reflejo = "No pude sintetizar un patrón claro de tus 5 capturas todavía. Sigue capturando — mañana tendré más con qué cruzar.";
    }

    // 3. Persistir patrones en user_patterns (best-effort)
    if (patterns.length > 0) {
      try {
        const rows = patterns.map((p) => ({
          user_id: userId,
          pattern_type: "cognitive_bias",
          title: p.title,
          description: p.description,
          frequency: 1,
          first_seen_at: now,
          last_seen_at: now,
          supporting_entry_ids: entryIds,
          is_active: true,
          created_at: now,
          updated_at: now,
        }));
        const { error: upsertErr } = await supabase.from("user_patterns").insert(rows);
        if (upsertErr) {
          console.warn("[generate-initial-reflejo] user_patterns insert warn:", upsertErr.message);
        }
      } catch (e: any) {
        console.warn("[generate-initial-reflejo] persist patterns error:", e?.message);
      }
    }

    return new Response(
      JSON.stringify({ reflejo, patterns }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[generate-initial-reflejo] Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
