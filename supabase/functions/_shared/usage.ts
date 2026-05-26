/**
 * Shared usage / cost metering for Supabase Edge Functions.
 *
 * Every billable AI call logs one row into public.usage_events with the USD
 * cost computed AT WRITE TIME (so history stays accurate even if prices change).
 *
 * Writes use the service-role client (RLS is bypassed). Never throws — a
 * metering failure must never break the user-facing call.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

/**
 * PRICING — USD per 1,000,000 tokens.
 * Adjust here if provider prices change; values are estimates and the single
 * source of truth for cost attribution.
 */
const ANTHROPIC_PRICING: Record<
  string,
  { input: number; output: number; cacheRead: number; cacheWrite: number }
> = {
  "claude-opus-4-7": { input: 15.0, output: 75.0, cacheRead: 1.5, cacheWrite: 18.75 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-haiku-4-5-20251001": { input: 1.0, output: 5.0, cacheRead: 0.1, cacheWrite: 1.25 },
};
const ANTHROPIC_FALLBACK = { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 };

// Gemini per 1M tokens (generateContent reports usageMetadata tokens).
const GEMINI_TOKEN_PRICING: Record<string, { input: number; output: number }> = {
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
};
const GEMINI_TOKEN_FALLBACK = { input: 0.3, output: 2.5 };

// Embeddings are metered by input characters (no token usage returned).
const GEMINI_EMBED_USD_PER_1M_TOKENS = 0.15;
const CHARS_PER_TOKEN = 4;

export type Provider = "anthropic" | "gemini";

export interface LogUsageInput {
  req?: Request;
  userId?: string | null;
  component: string;
  provider: Provider;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  units?: number;
  unitType?: "tokens" | "audio_seconds" | "chars" | "requests";
  meta?: Record<string, unknown>;
}

/** Decode the `sub` (user id) from the request's JWT. Supabase's gateway has
 *  already verified the token, so we only need to read the claim. */
export function userIdFromAuth(req?: Request): string | null {
  try {
    const h = req?.headers.get("Authorization") ?? "";
    const token = h.replace(/^Bearer\s+/i, "").trim();
    const payload = token.split(".")[1];
    if (!payload) return null;
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
    const json = JSON.parse(atob(b64 + pad));
    return typeof json?.sub === "string" ? json.sub : null;
  } catch {
    return null;
  }
}

function computeCostUSD(i: LogUsageInput): number {
  const inT = i.inputTokens ?? 0;
  const outT = i.outputTokens ?? 0;
  const crT = i.cacheReadTokens ?? 0;
  const cwT = i.cacheWriteTokens ?? 0;

  if (i.provider === "anthropic") {
    const p = ANTHROPIC_PRICING[i.model] ?? ANTHROPIC_FALLBACK;
    return (
      (inT * p.input + outT * p.output + crT * p.cacheRead + cwT * p.cacheWrite) /
      1_000_000
    );
  }

  // gemini
  if (i.unitType === "chars") {
    const tokens = (i.units ?? 0) / CHARS_PER_TOKEN;
    return (tokens * GEMINI_EMBED_USD_PER_1M_TOKENS) / 1_000_000;
  }
  const gp = GEMINI_TOKEN_PRICING[i.model] ?? GEMINI_TOKEN_FALLBACK;
  return (inT * gp.input + outT * gp.output) / 1_000_000;
}

function writeUsage(i: LogUsageInput): Promise<void> {
  return (async () => {
    try {
      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;
      const userId = i.userId ?? userIdFromAuth(i.req);
      const cost = computeCostUSD(i);
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { error } = await supabase.from("usage_events").insert({
        user_id: userId,
        component: i.component,
        provider: i.provider,
        model: i.model,
        input_tokens: i.inputTokens ?? 0,
        output_tokens: i.outputTokens ?? 0,
        cache_read_tokens: i.cacheReadTokens ?? 0,
        cache_write_tokens: i.cacheWriteTokens ?? 0,
        units: i.units ?? 0,
        unit_type: i.unitType ?? "tokens",
        cost_usd: cost,
        meta: i.meta ?? {},
      });
      if (error) console.error("[usage] insert error:", error.message);
    } catch (e) {
      console.error("[usage] log failed:", (e as Error).message);
    }
  })();
}

/**
 * Fire-and-forget usage logging. Resolves immediately for the caller; the
 * insert is kept alive past the response via EdgeRuntime.waitUntil when
 * available, otherwise it is awaited.
 */
export async function logUsage(i: LogUsageInput): Promise<void> {
  const p = writeUsage(i);
  // deno-lint-ignore no-explicit-any
  const er = (globalThis as any).EdgeRuntime;
  if (er?.waitUntil) {
    er.waitUntil(p);
    return;
  }
  await p;
}
