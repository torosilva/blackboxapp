import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withRetry, fetchWithStatus } from "../_shared/retry.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EMBED_MODEL = "gemini-embedding-001";
const EMBED_DIMS = 768;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function l2normalize(v: number[]): number[] {
  let sum = 0;
  for (const x of v) sum += x * x;
  const norm = Math.sqrt(sum);
  if (norm === 0) return v;
  return v.map((x) => x / norm);
}

async function embedText(text: string): Promise<number[]> {
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
  if (!values || values.length === 0) return [];
  return l2normalize(values);
}

function composeEntryText(entry: any): string {
  const parts = [entry.title, entry.original_text || entry.content, entry.summary, entry.mood_label].filter(Boolean);
  return parts.join("\n").slice(0, 8000);
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
    const { userId, batchSize = 25 } = await req.json().catch(() => ({}));

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch entries without embedding (optionally scoped to a single user)
    let query = supabase
      .from("entries")
      .select("id, title, content, original_text, summary, mood_label")
      .is("embedding", null)
      .order("created_at", { ascending: false })
      .limit(batchSize);

    if (userId) query = query.eq("user_id", userId);

    const { data: rows, error } = await query;
    if (error) throw new Error(`Fetch error: ${error.message}`);
    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ processed: 0, done: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let failures = 0;

    for (const row of rows) {
      try {
        const text = composeEntryText(row);
        if (!text.trim()) continue;
        const embedding = await embedText(text);
        if (embedding.length === 0) {
          failures++;
          continue;
        }
        const { error: upErr } = await supabase
          .from("entries")
          .update({ embedding })
          .eq("id", row.id);
        if (upErr) {
          console.error(`[backfill] Update failed for ${row.id}:`, upErr.message);
          failures++;
        } else {
          processed++;
        }
      } catch (e: any) {
        console.error(`[backfill] Entry ${row.id} failed:`, e.message);
        failures++;
      }
    }

    return new Response(JSON.stringify({
      processed,
      failures,
      done: rows.length < batchSize,
      remaining_hint: rows.length === batchSize ? "call again to continue" : "all done",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[backfill-embeddings] error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
