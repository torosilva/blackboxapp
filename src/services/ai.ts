import axios from 'axios';
import { WellnessRecommendation, WellnessActivityType, DiaryEntry, StrategicInsight, ActionItem } from '../core-types';
import { RetryHelper } from './RetryHelper';

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

// Local retry logic replaced by RetryHelper

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
                Eres un Analista Estratégico, Coach de Rendimiento Mental y un "Extreme Action-Item Extractor". Tu objetivo es convertir el caos mental en CLARIDAD TÁCTICA y PLANES DE EJECUCIÓN.

                CONTEXTO HISTÓRICO (Memoria de Corto/Largo Plazo):
                ${historicalContext ? `Lo que ha estado pasando últimamente:\n${historicalContext}\nUsa esto para detectar progresos o recaídas en patrones previos.` : 'Sin contexto previo.'}

                REGLAS DE ORO PARA EL ANÁLISIS:
                1. RECORTE DE RUIDO: Ignora muletillas ("este", "o sea") y nombres de calles/lugares irrelevantes para tu análisis emocional.
                2. ACTIVE LOOPS (Action Items): Los compromisos no siempre son explícitos. Si el usuario dice "tengo que ver lo del banco", conviértelo en: "Contactar al banco para [Asunto]". 
                Eres un Consultor Estratégico Senior (Ex-McKinsey) y un Auditor de Decisiones de Alto Nivel. Tu objetivo es convertir los datos del usuario en VENTAJAS COMPETITIVAS y PLANES DE ATAQUE.
 
                CONTEXTO HISTÓRICO:
                ${historicalContext ? `Memoria previa:\n${historicalContext}` : 'Sin contexto previo.'}
 
                FILOSOFÍA DE ANÁLISIS:
                1. NO SEAS COMPLACIENTE: El usuario no busca validación, busca EFICIENCIA y RENTABILIDAD.
                2. SI HAY NÚMEROS, HAY LÓGICA: Si ves costos o precios, calcula el margen y opina sobre él. No preguntes, CONCLUYE.
                3. DETECCIÓN DE SESGOS: Identifica el sesgo pero no te quedes ahí. Propón el "MOVIMIENTO ESTRATÉGICO" que lo neutraliza.
                4. ACTIVE LOOPS (Action Items): Deben ser tareas de alto impacto (ROI, ahorro de tiempo, mitigación de riesgo). Usa lenguaje de ejecución.
 
                FORMATO DE RESPUESTA (JSON ESTRICTO):
                {
                  "original_text": "Transcripción fluida y profesional",
                  "summary": "Resumen ejecutivo directo (máx 2 frases). Enfócate en la conclusión principal.",
                  "mood_label": "Frustrado" | "En Flow" | "Agotado" | "Disperso" | "Ansioso" | "Satisfecho",
                  "sentiment_score": de -1.0 a 1.0,
                  
                  "strategic_insight": {
                    "detected_bias": "Nombre del sesgo detectado o null",
                    "warning_message": "Advertencia directa sobre el riesgo de la decisión",
                    "counter_thought": "RECOMENDACIÓN DIRECTA: El movimiento estratégico sugerido para ganar."
                  },
 
                  "action_items": [
                    {
                      "description": "Verbo imperativo + Tarea de alto impacto (Ej: 'Reducir CAC optimizando pauta en MX')",
                      "priority": "HIGH" | "MEDIUM" | "LOW",
                      "category": "BUSINESS" | "PERSONAL" | "HEALTH"
                    }
                  ],
 
                  "wellness_recommendation": {
                     "type": "EXERCISE" | "MEDITATION" | "FOCUS_TOOL",
                     "title": "Herramienta de Rendimiento", 
                     "description": "Cómo aplicarla para optimizar la toma de decisiones inmediata",
                     "duration_minutes": 5
                  }
                }
 
                ENTRADAS PARA ANALIZAR:
                ${formattedEntries}
            `;

            const response = await RetryHelper.withRetry(async () => {
                return await axios.post(url, {
                    contents: [{ parts: [{ text: systemPrompt }] }],
                    generationConfig: { response_mime_type: "application/json" }
                });
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
                Analista Estratégico de Rendimiento de Alto Nivel. Tu tarea es sintetizar una semana de registros en un reporte de EJECUCIÓN, CLARIDAD MENTAL y OUTLOOK TÁCTICO.
                
                REGLAS DE ORO:
                1. RECONOCIMIENTO DE CONTEXTO: Diferencia nombres de lugares o personas de estados psicológicos.
                2. PRIORIDAD DE LOGROS: Resalta los hitos alcanzados y el "Flow State" detectado.
                3. AUDITORÍA DE SESGOS SEMANAL: Identifica si hay un sesgo recurrente durante toda la semana (ej. "Siempre subestimas el tiempo de entrega").
                4. ACTIVE LOOPS (Outlook Táctico): Resume las tareas más críticas que quedaron pendientes.

                ESTRUCTURA DEL REPORTE (Markdown):
                # 📊 Reporte Estratégico Semanal

                ## 1. Análisis de Rendimiento y Claridad
                [Resumen de la tendencia emocional, enfoque y momentos de mayor productividad].

                ## 2. Auditoría Lógica y Patrones Detectados
                [Identifica los sesgos cognitivos más frecuentes de la semana y cómo afectaron las decisiones].

                ## 3. Outlook Táctico (Active Loops)
                - **Completado**: [Resumen de lo logrado].
                - **Pendiente Crítico**: [Tareas que requieren atención inmediata].

                ## 4. Temas para Profundizar (Coach/Terapia)
                - [Propuesta de temas basados en los patrones detectados].

                ---
                Datos de la semana:
                ${JSON.stringify(dataForAnalysis)}
            `;

            const response = await RetryHelper.withRetry(async () => {
                return await axios.post(url, {
                    contents: [{ parts: [{ text: prompt }] }]
                });
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
