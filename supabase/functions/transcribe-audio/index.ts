import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withRetry, fetchWithStatus } from "../_shared/retry.ts";

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const MODEL_NAME = 'gemini-2.5-flash';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const { audioBase64, mimeType = 'audio/mp4' } = await req.json();

    if (!audioBase64) {
      return new Response(JSON.stringify({ error: 'audioBase64 is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;

    const response = await withRetry(
      () => fetchWithStatus(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "Verbatim transcription of this audio. Return ONLY the spoken text or '[No speech detected]'." },
              { inline_data: { mime_type: mimeType, data: audioBase64 } }
            ]
          }]
        }),
      }),
      { maxAttempts: 3, baseDelayMs: 800 }  // Slightly longer base for audio payloads
    );

    const data: any = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    const transcription = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[No speech detected]';

    return new Response(JSON.stringify({ transcription: transcription.trim() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
