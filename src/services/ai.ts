import axios from 'axios';
import { WellnessRecommendation, WellnessActivityType, DiaryEntry, StrategicInsight, ActionItem } from '../core-types';
import { RetryHelper } from './RetryHelper';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

export interface AIAnalysis {
    title: string;
    original_text?: string;
    summary: string;
    mood_label: string;
    sentiment_score: number;
    wellness_recommendation: WellnessRecommendation;
    strategic_insight: StrategicInsight;
    action_items: ActionItem[];
    suggested_goals: string[];
    category: 'BUSINESS' | 'PERSONAL' | 'DEVELOPMENT' | 'WELLNESS'; // <--- NUEVO
}

export const aiService = {
    generateDailySummary: async (entries: (string | { title?: string, content: string })[], historicalContext?: string, base64Image?: string): Promise<AIAnalysis> => {
        const fallback: AIAnalysis = {
            title: "Registro Estratégico", // <--- NUEVO VALOR POR DEFECTO
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
            action_items: [],
            suggested_goals: [],
            category: 'PERSONAL'
        };

        if (!GEMINI_API_KEY) return fallback;

        try {
            // 1. Extraer el texto del usuario limpiamente
            const userText = entries.map(e => {
                if (typeof e === 'string') return e;
                return `${e.title ? `Título: ${e.title}\n` : ''}Contenido: ${e.content}`;
            }).join('\n---\n');

            // 2. PROMPT UNIFICADO Y ESTRICTO (Blackbox Persona + Titulación)
            const systemPrompt = `
            ROL:
            Eres BLACKBOX, un Consultor Estratégico Senior (Ex-McKinsey), Auditor de Decisiones y Coach de Alto Rendimiento.
            Tu objetivo es convertir el caos o las metas del usuario en CLARIDAD TÁCTICA.

            CONTEXTO HISTÓRICO:
            ${historicalContext ? historicalContext : 'Sin contexto previo.'}

            REGLAS DE OPERACIÓN:
            1. CERO OBVIEDADES: Si el usuario plantea una meta, dile CÓMO (embudos, canales, CAC).
            2. PUNTO CIEGO ESTRATÉGICO: Encuentra el riesgo o error de cálculo que el usuario NO está viendo.
            3. SESGOS COGNITIVOS: Identifica sesgos (Costo Hundido, Confirmación, etc.) en problemas operativos.
            4. TITULACIÓN AUTOMÁTICA: Genera un título militar, clínico y directo basado en el contenido (máx 5 palabras). No uses emojis. Ej: 'Falla Operativa: Proveedor' o 'Auditoría: Expansión Q3'.
            5. TONO: Directo, clínico, objetivo. No busques consolar, busca dar ventaja competitiva.
            6. VALORACIÓN DE METAS: Analiza si el usuario plantea un objetivo de largo alcance (ej: "Lanzar producto", "Duplicar ventas", "Correr maratón"). Si es así, lístalo en 'suggested_goals'.

            FORMATO DE RESPUESTA (JSON ESTRICTO):
            {
              "title": "Título táctico y contundente",
              "summary": "Resumen ejecutivo crudo (máx 2 líneas).",
              "mood_label": "Frustrado" | "En Flow" | "Agotado" | "Disperso" | "Ansioso" | "Satisfecho" | "Estratégico",
              "sentiment_score": "Número decimal entre -1.0 y 1.0",
              "category": "BUSINESS | PERSONAL | DEVELOPMENT | WELLNESS",
              
              "strategic_insight": {
                  "detected_bias": "Nombre del sesgo cognitivo, O escribe 'Punto Ciego Estratégico' si es una meta de negocio",
                  "warning_message": "La cruda realidad: El riesgo principal, el cuello de botella operativo, o el error de cálculo en su plan.",
                  "counter_thought": "MOVIMIENTO TÁCTICO: La directiva exacta para resolver el cuello de botella o neutralizar el sesgo."
              },

              "action_items": [
                  { 
                    "description": "Verbo + Resultado", 
                    "priority": "HIGH | MEDIUM | LOW", 
                    "category": "BUSINESS | PERSONAL | HEALTH" 
                  }
              ],

              "wellness_recommendation": {
                  "type": "FOCUS_TOOL" | "MEDITATION" | "EXERCISE",
                  "title": "Protocolo de Ejecución",
                  "description": "Herramienta mental o protocolo de tiempo para asegurar la ejecución de este plan.",
                  "duration_minutes": 15
              },

              "suggested_goals": ["Objetivo estratégico 1", "Objetivo estratégico 2"]
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
                        title: parsed.title || "Registro Estratégico", 
                        original_text: userText,
                        summary: parsed.summary || fallback.summary,
                        mood_label: parsed.mood_label || fallback.mood_label,
                        sentiment_score: typeof parsed.sentiment_score === 'number' ? parsed.sentiment_score : 0.5,
                        wellness_recommendation: parsed.wellness_recommendation || fallback.wellness_recommendation,
                        strategic_insight: parsed.strategic_insight || fallback.strategic_insight,
                        action_items: parsed.action_items || [],
                        suggested_goals: parsed.suggested_goals || [],
                        category: parsed.category || 'PERSONAL'
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
            const prompt = `
ROL: Analista Estratégico. Genera un REPORTE DE EJECUCIÓN SEMANAL.
ESTRUCTURA OBLIGATORIA (En Markdown):
### 📊 Resumen de Rendimiento
[1 párrafo clínico]
### 🧠 Auditoría de Sesgos y Puntos Ciegos
[Qué falló o qué sesgo se repitió]
### ⚡ Outlook Táctico
- [Tarea crítica pendiente 1]
- [Tarea crítica pendiente 2]

Datos: ${JSON.stringify(entries)}
`;
            const response = await RetryHelper.withRetry(async () => {
                return await axios.post(weeklyUrl, {
                    contents: [{ parts: [{ text: prompt }] }]
                });
            });
            return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudo generar el reporte.";
        } catch (e: any) {
            console.error('AI_SERVICE: Weekly report failure:', e.message);
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
