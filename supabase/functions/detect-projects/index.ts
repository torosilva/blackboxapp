/**
 * Edge Function: detect-projects
 *
 * Reads the last 80 entries of a user and asks Claude Sonnet 4.6 to extract
 * 4–8 concrete projects / life areas (entities) with supporting entry_ids.
 * Results are upserted into public.user_projects.
 *
 * Designed to run on-demand from the MapasScreen (1x / 24h cache enforced
 * client-side). Static prompt block is cached via Anthropic prompt caching
 * to keep marginal cost low across repeated detections.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callClaude, parseJsonLoose, SystemBlock } from "../_shared/claude.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Sonnet 4.6 for the same reasons as analyze-patterns: long structured JSON
// output dominates latency; quality is plenty for entity extraction.
const MODEL_NAME = "claude-sonnet-4-6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface EntryRow {
  id: string;
  title: string | null;
  summary: string | null;
  content: string | null;
  category: string | null;
  created_at: string;
}

interface DetectedProject {
  name: string;
  description: string;
  entry_ids: string[];
}

// ─── Static system prompt (cached) ───────────────────────────────────────────

const STATIC_PROJECTS_SYSTEM = `
ROL: Eres un analizador de áreas de vida y proyectos.

TAREA: Analiza el historial del usuario y detecta los 4-8 PROYECTOS o ÁREAS DE VIDA recurrentes — cosas concretas que el usuario está construyendo o que aparecen como temas centrales. NO sesgos cognitivos, NO patrones de comportamiento — entidades concretas.

EJEMPLOS de lo que SÍ es un proyecto/área:
- "Fuxia" (un negocio mencionado)
- "Black Box v2" (un producto)
- "Aaron" (persona recurrente)
- "Salud" / "Bienestar físico" (área de vida)
- "Venture Logic" (empresa/proyecto)

EJEMPLOS de lo que NO es proyecto (omitir):
- "Validación Ritualizada" (eso es sesgo cognitivo, va en user_patterns)
- "Procrastinación" (patrón conductual)
- "Pensar más claro" (objetivo abstracto)

REGLAS:
1. Solo proyectos con 3+ entradas relacionadas. Menos = ruido.
2. Si hay variantes del mismo nombre ("Fuxia" / "fuxia" / "Proyecto Fuxia"), consolida a una sola.
3. Description: 1 línea concreta. NO genérica.
4. entry_ids: lista las id (UUID) literales de las entradas provistas que sostienen este proyecto. Solo UUIDs reales — nunca inventar.

FORMATO RESPUESTA (JSON estricto, sin Markdown, sin comentarios):
{
  "projects": [
    {
      "name": "Fuxia",
      "description": "Negocio en fase de lanzamiento con 40+ usuarios beta",
      "entry_ids": ["uuid1", "uuid2", "uuid3"]
    }
  ]
}
`.trim();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildUserContent(userId: string, entries: EntryRow[]): string {
  // Per entry: a compact line the model can scan quickly.
  const lines = entries.map((e) => {
    const snippet = (e.content ?? "").replace(/\s+/g, " ").slice(0, 300);
    return [
      `ID: ${e.id}`,
      `TITLE: ${e.title ?? ""}`,
      `CATEGORY: ${e.category ?? ""}`,
      `DATE: ${(e.created_at ?? "").slice(0, 10)}`,
      `SUMMARY: ${e.summary ?? ""}`,
      `CONTENT: ${snippet}`,
    ].join("\n");
  });
  return [
    `USUARIO: ${userId}`,
    `TOTAL ENTRADAS PROVISTAS: ${entries.length}`,
    "",
    "ENTRADAS (ordenadas por fecha, más recientes arriba):",
    "",
    lines.join("\n\n---\n\n"),
  ].join("\n");
}

async function fetchRecentEntries(supabase: any, userId: string): Promise<EntryRow[]> {
  const { data, error } = await supabase
    .from("entries")
    .select("id, title, summary, content, category, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) throw new Error(`fetch entries failed: ${error.message}`);
  return (data ?? []) as EntryRow[];
}

async function upsertProjects(
  supabase: any,
  userId: string,
  validEntryIdSet: Set<string>,
  projects: DetectedProject[],
): Promise<number> {
  let upserted = 0;
  for (const p of projects) {
    const name = (p.name ?? "").trim();
    if (!name) continue;
    const description = (p.description ?? "").trim();
    // Filter entry_ids to those actually present in the provided window —
    // never trust IDs the model echoed back without checking.
    const safeIds = (p.entry_ids ?? []).filter((id) => validEntryIdSet.has(id));
    if (safeIds.length < 3) continue; // threshold per spec

    // Upsert by (user_id, lower(name)) — using a delete+insert approach for
    // simplicity (Supabase upsert on case-insensitive unique index is fragile).
    await supabase
      .from("user_projects")
      .delete()
      .eq("user_id", userId)
      .ilike("name", name);

    const { error } = await supabase
      .from("user_projects")
      .insert({
        user_id: userId,
        name,
        description,
        entry_ids: safeIds,
        frequency: safeIds.length,
      });
    if (!error) upserted++;
    else console.warn(`[detect-projects] insert "${name}" failed:`, error.message);
  }
  return upserted;
}

// ─── HTTP handler ────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not set" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const userId: string | undefined = body?.userId;
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const entries = await fetchRecentEntries(supabase, userId);
    if (entries.length < 5) {
      return new Response(JSON.stringify({ success: true, count: 0, reason: "not enough entries" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userContent = buildUserContent(userId, entries);
    const system: SystemBlock[] = [
      { type: "text", text: STATIC_PROJECTS_SYSTEM, cache_control: { type: "ephemeral" } },
      { type: "text", text: `CONTEXTO USUARIO: ${userId}`, cache_control: { type: "ephemeral" } },
    ];

    const raw = await callClaude({
      apiKey: ANTHROPIC_API_KEY,
      model: MODEL_NAME,
      system,
      userContent,
      maxTokens: 2000,
      meter: { component: "project_detection", userId, req },
    });

    let parsed: { projects?: DetectedProject[] };
    try {
      parsed = parseJsonLoose(raw);
    } catch (e) {
      console.error("[detect-projects] JSON parse failed:", (e as Error).message, raw.slice(0, 300));
      return new Response(JSON.stringify({ success: false, error: "model returned invalid JSON" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const projects = Array.isArray(parsed.projects) ? parsed.projects : [];
    const validIdSet = new Set(entries.map((e) => e.id));
    const count = await upsertProjects(supabase, userId, validIdSet, projects);

    return new Response(JSON.stringify({ success: true, count }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[detect-projects] error:", err?.message ?? err);
    return new Response(JSON.stringify({ success: false, error: err?.message ?? String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
