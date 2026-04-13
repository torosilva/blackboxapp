import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MODEL_NAME = 'gemini-2.0-flash';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Fetch recent insights for context ──────────────────────────────────────

async function getRecentInsights(userId: string): Promise<string> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data } = await supabase
      .from('diary_entries')
      .select('summary, strategic_insight, mood_label, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!data || data.length === 0) return 'Sin contexto previo.';

    return data.map((e: any) =>
      `[${e.created_at?.slice(0, 10)}] ${e.mood_label ?? ''}: ${e.summary ?? ''}`
    ).join('\n');
  } catch {
    return 'Sin contexto previo.';
  }
}

// ─── Build system prompt ─────────────────────────────────────────────────────

function buildChatPrompt(contextStr: string, userName: string, category: string): string {
  return `
ROL:
Eres BLACKBOX, un Consultor Estratégico Senior (Ex-McKinsey) y Auditor de Decisiones.
Tu objetivo no es consolar, sino ASESORAR con autoridad, lógica implacable y matemáticas claras.

IDENTIDAD DEL USUARIO:
Te diriges a: ${userName}. Úsalo para personalizar el impacto de tus directivas.

CONTEXTO ESTRATÉGICO:
${contextStr}

REGLAS PARA EL CHAT:
1. CLARIDAD EJECUTIVA: Si el usuario plantea una duda, no divagues. Identifica el cuello de botella y propón una solución medible.
2. AUDITORÍA DE OBJETIVOS: Si el usuario menciona una meta (ej: "100 clientes"), audita su plan inmediatamente. Pregunta por CAC, canales o recursos.
3. TONO: Directo, clínico, ultra-profesional. Sé el socio que les dice la verdad.
4. CATEGORÍA ACTUAL: ${category}.
  `.trim();
}

// ─── Handler ─────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'No authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY secret not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { userMessage, chatHistory = [], userId, userName = 'Explorador', category = 'General' } = await req.json();

    if (!userMessage) {
      return new Response(JSON.stringify({ error: 'userMessage is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch contextual memory from Supabase (server-side, safe)
    const contextStr = userId
      ? await getRecentInsights(userId)
      : 'Sin contexto previo.';

    const systemPrompt = buildChatPrompt(contextStr, userName, category);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;

    const payload = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [
        ...chatHistory,
        { role: 'user', parts: [{ text: userMessage }] },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1500,
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini error ${res.status}: ${err}`);
    }

    const data: any = await res.json();
    const content = data?.candidates?.[0]?.content;

    if (!content) throw new Error('No response from Gemini');

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
