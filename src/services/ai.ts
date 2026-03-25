import axios from 'axios';
import { WellnessRecommendation, WellnessActivityType, DiaryEntry, StrategicInsight, ActionItem } from '../core-types';
import { RetryHelper } from './RetryHelper';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

export interface AIAnalysis {
    original_text?: string;
    summary: string;
    mood_label: string;
    sentiment_score: number;
    wellness_recommendation: WellnessRecommendation;
    strategic_insight: StrategicInsight;
    action_items: ActionItem[];
}

export const aiService = {
    generateDailySummary: async (entries: (string | { title: string, content: string })[], historicalContext?: string, base64Image?: string): Promise<AIAnalysis> => {
        const fallback: AIAnalysis = {
            summary: "Analizando rendimiento y enfoque...",
            mood_label: "Estratégico",
            sentiment_score: 0,
            wellness_recommendation: {
                type: 'FOCUS_TOOL',
                title: 'Protocolo de Ejecución',
                description: 'Define métricas claras para tu próximo movimiento.'
            },
            strategic_insight: {
                detected_bias: "Falta de contexto estratégico",
                warning_message: "Analizando punto ciego...",
                counter_thought: "Define el ROI de tu siguiente acción."
            },
            action_items: []
        };

        if (!GEMINI_API_KEY) return fallback;

        try {
            // 1. Extraer el texto del usuario limpiamente
            const userText = entries.map(e => {
                if (typeof e === 'string') return e;
                return `Título: ${e.title}\nContenido: ${e.content}`;
            }).join('\n---\n');

            // 2. PROMPT UNIFICADO Y ESTRICTO (Blackbox Persona)
            const systemPrompt = `
            ROL:
            Eres BLACKBOX, un Consultor Estratégico Senior (Ex-McKinsey), Auditor de Decisiones y Coach de Alto Rendimiento.
            Tu objetivo es convertir el caos o las metas del usuario en CLARIDAD TÁCTICA, identificando cuellos de botella y generando PLANES DE EJECUCIÓN implacables.

            CONTEXTO HISTÓRICO:
            ${historicalContext ? historicalContext : 'Sin contexto previo.'}

            REGLAS DE OPERACIÓN:
            1. CERO OBVIEDADES: Si el usuario plantea una meta (ej: "100 clientes"), no digas "necesitas vender". Dile CÓMO (embudos, canales, CAC).
            2. PUNTO CIEGO ESTRATÉGICO: Si el usuario plantea un negocio, tu trabajo es encontrar el riesgo o error de cálculo que NO está viendo.
            3. SESGOS COGNITIVOS: Si es un problema personal, busca sesgos (Costo Hundido, Confirmación, etc.).
            4. TONO: Directo, clínico, objetivo. No busques consolar, busca dar ventaja competitiva.

            FORMATO DE RESPUESTA (JSON ESTRICTO):
            {
              "summary": "Resumen ejecutivo crudo (máx 2 líneas).",
              "mood_label": "Estratégico" | "En Flow" | "Agotado" | "Disperso" | "Ansioso" | "Satisfecho",
              "sentiment_score": 1.0,
              "strategic_insight": {
                  "detected_bias": "Nombre del sesgo O 'Punto Ciego Estratégico'",
                  "warning_message": "La cruda realidad: El riesgo principal o cuello de botella.",
                  "counter_thought": "MOVIMIENTO TÁCTICO: La instrucción exacta para ejecutar."
              },
              "action_items": [
                  { "description": "Verbo + Resultado (Ej: 'Calcular CAC')", "priority": "HIGH", "category": "BUSINESS" }
              ],
              "wellness_recommendation": {
                  "type": "FOCUS_TOOL",
                  "title": "Protocolo Blackbox",
                  "description": "Protocolo mental para asegurar la ejecución.",
                  "duration_minutes": 15
              }
            }
            `;

            const currentModel = 'gemini-flash-latest';
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${GEMINI_API_KEY}`;
            
            const payload = {
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents: [{ parts: [{ text: `Analiza esta entrada del usuario:\n${userText}` }] }],
                generationConfig: { 
                    response_mime_type: "application/json",
                    temperature: 0.7,
                    maxOutputTokens: 2048,
                }
            };

            const response = await RetryHelper.withRetry(async () => {
                return await axios.post(apiUrl, payload);
            });

            if (response.data?.candidates?.[0]) {
                const text = response.data.candidates[0].content.parts[0].text;
                try {
                    const jsonMatch = text.match(/\{[\s\S]*\}/);
                    const cleanJson = jsonMatch ? jsonMatch[0] : text;
                    const parsed = JSON.parse(cleanJson);
                    
                    return {
                        original_text: userText,
                        summary: parsed.summary || fallback.summary,
                        mood_label: parsed.mood_label || fallback.mood_label,
                        sentiment_score: parsed.sentiment_score ?? 0.5,
                        wellness_recommendation: parsed.wellness_recommendation || fallback.wellness_recommendation,
                        strategic_insight: parsed.strategic_insight || fallback.strategic_insight,
                        action_items: parsed.action_items || []
                    };
                } catch (e) {
                    console.error('AI_SERVICE: JSON Parse Failed.', text);
                    return { ...fallback, summary: "Error de formato IA. Reintenta." };
                }
            }
        } catch (e: any) {
            console.error('AI_SERVICE: Critical failure:', e.message);
            return fallback;
        }
        return fallback;
    },

    generateWeeklyReport: async (entries: any[]): Promise<string> => {
        if (!GEMINI_API_KEY || entries.length === 0) return "Datos insuficientes.";
        try {
            const weeklyModel = 'gemini-flash-latest';
            const weeklyUrl = `https://generativelanguage.googleapis.com/v1beta/models/${weeklyModel}:generateContent?key=${GEMINI_API_KEY}`;
            const prompt = `Analiza esta semana de registros y genera un REPORTE ESTRATÉGICO DE EJECUCIÓN: ${JSON.stringify(entries)}`;
            const response = await axios.post(weeklyUrl, {
                contents: [{ parts: [{ text: prompt }] }]
            });
            return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "Error en reporte.";
        } catch (e) {
            return "Error al generar reporte.";
        }
    },

    searchByKeywords: async (entries: any[], keyword: string) => {
        if (!keyword) return entries;
        const lowKey = keyword.toLowerCase();
        return entries.filter(e => 
            (e.content || '').toLowerCase().includes(lowKey) || 
            (e.title || '').toLowerCase().includes(lowKey)
        );
    }
};
