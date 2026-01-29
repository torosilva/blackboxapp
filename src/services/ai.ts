import axios from 'axios';
import { WellnessRecommendation, WellnessActivityType, DiaryEntry, StrategicInsight, ActionItem } from '../core-types';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
let cachedModel: string | null = null;

export interface AIAnalysis {
    original_text?: string;
    summary: string;
    mood_label: string;
    sentiment_score: number;
    wellness_recommendation: WellnessRecommendation;
    strategic_insight: StrategicInsight;
    action_items: ActionItem[];
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function callGeminiWithRetry(url: string, data: any, retries: number = 3): Promise<any> {
    try {
        return await axios.post(url, data);
    } catch (error: any) {
        const status = error.response?.status;
        const isRetryable = status === 429 || status === 503 || status === 504;

        if (isRetryable && retries > 0) {
            console.log(`AI_SERVICE: Server busy or limited (${status}). Retrying in 5s... (${retries} left)`);
            await delay(5000);
            return callGeminiWithRetry(url, data, retries - 1);
        }
        throw error;
    }
}

export const aiService = {
    generateDailySummary: async (entries: (string | { title: string, content: string })[], historicalContext?: string, base64Image?: string): Promise<AIAnalysis> => {
        const fallback: AIAnalysis = {
            summary: "Analizando rendimiento y enfoque...",
            mood_label: "Disperso",
            sentiment_score: 0,
            wellness_recommendation: {
                type: 'FOCUS_TOOL',
                title: 'Reflexión Estratégica',
                description: 'Registra tus avances para identificar patrones de rendimiento.'
            },
            strategic_insight: {
                detected_bias: null,
                warning_message: "Sin anomalías detectadas.",
                counter_thought: "Sigue operando con claridad."
            },
            action_items: []
        };

        if (!GEMINI_API_KEY) return fallback;

        try {
            // gemini-flash-latest is stable and future-proof
            const modelName = 'gemini-flash-latest';
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;
            console.log('AI_SERVICE: Invoking target model for Active Loops (with Memory):', modelName);

            // Format entries for the prompt, including titles if available
            const formattedEntries = entries.map(e => {
                if (typeof e === 'string') return e;
                return `Título: ${e.title}\nContenido: ${e.content}`;
            }).join('\n---\n');

            const systemPrompt = `
                ROL: 
                Eres un Estratega de Negocios y Coach de Rendimiento Mental de alto nivel. Tu objetivo es convertir el caos mental en PLANES DE EJECUCIÓN y CLARIDAD.

                MEMORIA DE LARGO PLAZO (CONTEXTO):
                ${historicalContext ? `Aquí tienes un resumen de lo que ha estado pasando últimamente:\n${historicalContext}\nUsa esto para detectar patrones recurrentes o progreso.` : 'No hay contexto previo disponible todavía.'}

                REGLAS CRÍTICAS DE INTERPRETACIÓN:
                1. CONTEXTO CULTURAL Y LUGARES: Distingue nombres propios de calles de estados emocionales.
                2. JERARQUÍA DE SENTIMIENTO: Prioriza el TÍTULO y afirmaciones explícitas.
                3. AUDITORÍA LÓGICA: Identifica sesgos como Falacia de Costo Hundido o Sobregeneralización.
                4. PATRONES RECURRENTES: Si el contexto muestra que el usuario ha tenido el mismo problema o sesgo varias veces, menciónalo en el summary o strategic_insight.
                5. EXTRACCIÓN TÁCTICA (ACTIVE LOOPS): Identifica compromisos explícitos o implícitos. Formato: Verbo + Tarea.

                Devuelve UN ÚNICO objeto JSON con esta estructura ESTRICTA:
                {
                  "original_text": "Transcripción corregida verbatim",
                  "summary": "Resumen ejecutivo balanceado (máx 2 frases). Si detectas un patrón histórico, menciónalo.",
                  "mood_label": "Frustrado" | "En Flow" | "Agotado" | "Disperso" | "Ansioso" | "Satisfecho",
                  "sentiment_score": de -1.0 a 1.0,
                  
                  "strategic_insight": {
                    "detected_bias": "string" | null,
                    "warning_message": "string (breve advertencia estratégica)",
                    "counter_thought": "string (pensamiento para neutralizar el sesgo)"
                  },

                  "action_items": [
                    {
                      "description": "Verbo + Tarea (Ej: Revisar presupuesto)",
                      "priority": "HIGH" | "MEDIUM" | "LOW",
                      "category": "BUSINESS" | "PERSONAL" | "HEALTH"
                    }
                  ],

                  "wellness_recommendation": {
                     "type": "EXERCISE" | "MEDITATION" | "FOCUS_TOOL",
                     "title": "string", 
                     "description": "string",
                     "duration_minutes": 5
                  }
                }

                Entradas para analizar hoy:
                ${formattedEntries}
            `;

            const response = await callGeminiWithRetry(url, {
                contents: [{ parts: [{ text: systemPrompt }] }],
                generationConfig: { response_mime_type: "application/json" }
            });

            if (response.data?.candidates?.[0]) {
                const text = response.data.candidates[0].content.parts[0].text;
                try {
                    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
                    let parsed = JSON.parse(cleanJson);
                    if (Array.isArray(parsed)) parsed = parsed[0];

                    return {
                        original_text: parsed.original_text || (typeof entries[0] === 'string' ? entries[0] : entries[0].content),
                        summary: parsed.summary || fallback.summary,
                        mood_label: parsed.mood_label || fallback.mood_label,
                        sentiment_score: parsed.sentiment_score ?? fallback.sentiment_score,
                        wellness_recommendation: parsed.wellness_recommendation || fallback.wellness_recommendation,
                        strategic_insight: parsed.strategic_insight || fallback.strategic_insight,
                        action_items: parsed.action_items || fallback.action_items
                    };
                } catch (e) {
                    console.log('AI_SERVICE: Parse failed, using raw fallback summary');
                    return { ...fallback, summary: text.substring(0, 150) };
                }
            }
        } catch (e: any) {
            console.log('AI_SERVICE: Error in generateDailySummary:', e.response?.data?.error?.message || e.message);
        }
        return fallback;
    },

    generateWeeklyReport: async (entries: any[]): Promise<string> => {
        if (!GEMINI_API_KEY || entries.length === 0) return "No hay datos suficientes para generar el reporte semanal.";

        try {
            const dataForAnalysis = entries.map(e => ({
                date: e.created_at,
                title: e.title,
                mood: e.mood_label,
                summary: e.summary,
                action_items: e.action_items,
                strategic_insight: e.strategic_insight
            }));

            const modelName = 'gemini-flash-latest';
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;
            console.log('AI_SERVICE: Invoking Weekly Report with Tactical Outlook:', modelName);

            const prompt = `
                ROL: 
                Analista Estratégico de Rendimiento de Alto Nivel. Tu tarea es sintetizar una semana de registros en un reporte de EJECUCIÓN y CLARIDAD MENTAL.
                
                REGLAS DE ORO:
                - RECONOCIMIENTO DE LUGARES: No confundas nombres de calles mexicanas o lugares geográficos con estados psicológicos.
                - PRIORIDAD SUBJETIVA: Prioriza el éxito reportado por el usuario sobre palabras aisladas.
                - ENFOQUE EN EJECUCIÓN: Resume el progreso en las tareas y el rendimiento estratégico.

                Genera un reporte estructurado en Markdown que incluya:
                1. **Análisis de Rendimiento Semanal**: Tendencia emocional y nivel de "Flow".
                2. **Auditoría Lógica & Sesgos**: Resumen de los sesgos cognitivos más frecuentes detectados en la semana.
                3. **Outlook Táctico (Active Loops)**: Resumen de tareas completadas vs pendientes y próximos pasos críticos.
                4. **Temas Críticos para Sesión**: Sugerencias para discutir con un coach o terapeuta.
                
                Datos de la semana:
                ${JSON.stringify(dataForAnalysis)}
            `;

            const response = await callGeminiWithRetry(url, {
                contents: [{ parts: [{ text: prompt }] }]
            });

            return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudo generar el reporte.";

        } catch (e: any) {
            if (e.response?.status === 429) {
                return "Reseteando cuota... por favor espera un minuto.";
            }
            console.error('AI_SERVICE: Weekly Report failed:', e.response?.data?.error?.message || e.message);
            return "Error al generar el reporte estratégico.";
        }
    },

    searchByKeywords: async (entries: any[], keyword: string) => {
        if (!keyword) return entries;
        return entries.filter(e =>
            (e.content || '').toLowerCase().includes((keyword || '').toLowerCase()) ||
            (e.title || '').toLowerCase().includes((keyword || '').toLowerCase())
        );
    }
};
