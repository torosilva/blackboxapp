import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withRetry, fetchWithStatus } from "../_shared/retry.ts";
import { logUsage } from "../_shared/usage.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EMBED_MODEL = "gemini-embedding-001";
const EMBED_DIMS = 768;

function l2normalize(v: number[]): number[] {
  let sum = 0;
  for (const x of v) sum += x * x;
  const norm = Math.sqrt(sum);
  if (norm === 0) return v;
  return v.map((x) => x / norm);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export async function embedText(text: string): Promise<number[]> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${GEMINI_API_KEY}`;

  const res = await withRetry(
    () => fetchWithStatus(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text }] },
        outputDimensionality: EMBED_DIMS,
      }),
    }),
    { maxAttempts: 3, baseDelayMs: 500 },
  );

  const data: any = await res.json();
  const values: number[] | undefined = data?.embedding?.values;
  if (!values || values.length === 0) {
    throw new Error("Gemini returned no embedding values");
  }
  return l2normalize(values);
}

// Builds a single text blob from an entry, prioritizing the user's own words.
function composeEntryText(entry: any): string {
  const parts = [
    entry.title,
    entry.original_text || entry.content,
    entry.summary,
    entry.mood_label,
  ].filter(Boolean);
  return parts.join("\n").slice(0, 8000); // safety cap on token cost
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { entryId, text } = await req.json();
    if (!entryId) {
      return new Response(JSON.stringify({ error: "entryId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // If caller didn't provide text, fetch the entry and compose it.
    let textToEmbed = text;
    if (!textToEmbed) {
      const { data: entry, error } = await supabase
        .from("entries")
        .select("title, content, original_text, summary, mood_label")
        .eq("id", entryId)
        .maybeSingle();
      if (error || !entry) throw new Error(`Entry not found: ${entryId}`);
      textToEmbed = composeEntryText(entry);
    }

    if (!textToEmbed || textToEmbed.trim().length === 0) {
      return new Response(JSON.stringify({ skipped: "empty text" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const embedding = await embedText(textToEmbed);

    const { error: updateErr } = await supabase
      .from("entries")
      .update({ embedding })
      .eq("id", entryId);

    if (updateErr) throw new Error(`Update failed: ${updateErr.message}`);

    const { data: owner } = await supabase
      .from("entries")
      .select("user_id")
      .eq("id", entryId)
      .maybeSingle();

    await logUsage({
      userId: owner?.user_id ?? null,
      component: "embedding",
      provider: "gemini",
      model: EMBED_MODEL,
      units: textToEmbed.length,
      unitType: "chars",
      meta: { entryId },
    });

    console.log(`[embed-entry] Embedded entry ${entryId} (${embedding.length} dims)`);

    return new Response(JSON.stringify({ ok: true, dims: embedding.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[embed-entry] error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
