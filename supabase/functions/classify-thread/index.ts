import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callClaude, parseJsonLoose } from "../_shared/claude.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL_NAME = "claude-haiku-4-5-20251001";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `
Clasificas una conversación entre un usuario y BLACKBOX (asistente estratégico).
Decide si vale la pena guardarla como MEMORIA (registro reflexivo de diario) o
si es solo una CONSULTA puntual de ayuda.

- "journal": el usuario reflexiona, narra su estado, decisiones, emociones,
  avances o bloqueos personales/de negocio. Vale la pena recordarlo y que
  alimente patrones, perfil y metas.
- "assist": el usuario solo pide información o ayuda operativa puntual
  ("¿qué loops cierro?", "¿cómo voy?", "explícame X") sin aportar reflexión
  ni contenido nuevo sobre sí mismo. NO debe ensuciar la línea de tiempo.
- "uncertain": genuinamente ambiguo o mixto.

Responde SOLO JSON: {"kind":"journal|assist|uncertain"}
`.trim();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ kind: "uncertain" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { transcript } = await req.json();
    if (!transcript || !String(transcript).trim()) {
      return new Response(JSON.stringify({ kind: "uncertain" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const raw = await callClaude({
      apiKey: ANTHROPIC_API_KEY,
      model: MODEL_NAME,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      userContent: `Conversación:\n${String(transcript).slice(0, 6000)}`,
      maxTokens: 50,
      temperature: 0,
      meter: { component: "thread_classification", req },
    });

    let kind = "uncertain";
    try {
      const parsed = parseJsonLoose(raw);
      if (["journal", "assist", "uncertain"].includes(parsed?.kind)) kind = parsed.kind;
    } catch { /* default uncertain */ }

    return new Response(JSON.stringify({ kind }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[classify-thread] error:", error.message);
    // On failure, ask the user rather than silently deciding.
    return new Response(JSON.stringify({ kind: "uncertain" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
