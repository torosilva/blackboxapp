/**
 * Shared Anthropic (Claude) caller for Supabase Edge Functions.
 * Mirrors the retry/caching approach used by ai-chat.
 */
import { withRetry, fetchWithStatus } from "./retry.ts";
import { logUsage } from "./usage.ts";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export type SystemBlock = {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
};

export interface ClaudeCallOpts {
  apiKey: string;
  model: string;
  system: SystemBlock[];
  userContent: string;
  maxTokens: number;
  temperature?: number;
  /** When set, the call's token usage is logged to usage_events. */
  meter?: {
    component: string;
    userId?: string | null;
    req?: Request;
    meta?: Record<string, unknown>;
  };
}

export async function callClaude(o: ClaudeCallOpts): Promise<string> {
  const payload = {
    model: o.model,
    max_tokens: o.maxTokens,
    temperature: o.temperature ?? 0.7,
    system: o.system,
    messages: [{ role: "user", content: o.userContent }],
  };

  const res = await withRetry(
    () =>
      fetchWithStatus(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": o.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(payload),
      }),
    { maxAttempts: 3, baseDelayMs: 700 },
  );

  const data: any = await res.json();
  const usage = data?.usage;
  if (usage) {
    console.log(
      `[claude] ${o.model} tokens — input: ${usage.input_tokens}, output: ${usage.output_tokens}, cache_read: ${usage.cache_read_input_tokens ?? 0}, cache_write: ${usage.cache_creation_input_tokens ?? 0}`,
    );
    if (o.meter) {
      await logUsage({
        req: o.meter.req,
        userId: o.meter.userId,
        component: o.meter.component,
        provider: "anthropic",
        model: o.model,
        inputTokens: usage.input_tokens ?? 0,
        outputTokens: usage.output_tokens ?? 0,
        cacheReadTokens: usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
        meta: o.meter.meta,
      });
    }
  }
  const text = data?.content?.[0]?.text;
  if (!text) {
    throw new Error(
      "Claude returned no text: " + JSON.stringify(data).slice(0, 300),
    );
  }
  return text;
}

// Tolerant JSON extraction — strips ``` fences and grabs the outermost object.
export function parseJsonLoose<T = any>(raw: string): T {
  let s = (raw ?? "").trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  const match = s.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : s) as T;
}
