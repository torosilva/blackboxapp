import { supabase } from './supabase';
import { WellnessRecommendation, DiaryEntry, StrategicInsight, ActionItem } from '../core-types';

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
    category: 'BUSINESS' | 'PERSONAL' | 'DEVELOPMENT' | 'WELLNESS';
}

const FALLBACK: AIAnalysis = {
    title: "Registro Estratégico",
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

export const aiService = {
    generateDailySummary: async (
        entries: (string | { title?: string; content: string })[],
        historicalContext?: string
    ): Promise<AIAnalysis> => {
        try {
            const { data, error } = await supabase.functions.invoke('analyze-entry', {
                body: { entries, historicalContext },
            });

            if (error) throw error;

            const parsed = data?.analysis;
            if (!parsed) return FALLBACK;

            const userText = entries.map(e => {
                if (typeof e === 'string') return e;
                return `${e.title ? `Título: ${e.title}\n` : ''}Contenido: ${e.content}`;
            }).join('\n---\n');

            return {
                title: parsed.title || FALLBACK.title,
                original_text: userText,
                summary: parsed.summary || FALLBACK.summary,
                mood_label: parsed.mood_label || FALLBACK.mood_label,
                sentiment_score: typeof parsed.sentiment_score === 'number' ? parsed.sentiment_score : 0.5,
                wellness_recommendation: parsed.wellness_recommendation || FALLBACK.wellness_recommendation,
                strategic_insight: parsed.strategic_insight || FALLBACK.strategic_insight,
                action_items: parsed.action_items || [],
                suggested_goals: parsed.suggested_goals || [],
                category: parsed.category || 'PERSONAL',
            };
        } catch (e: any) {
            console.error('AI_SERVICE: generateDailySummary failed:', e.message);
            return FALLBACK;
        }
    },

    generateWeeklyReport: async (entries: any[]): Promise<string> => {
        if (entries.length === 0) return "Datos insuficientes.";
        try {
            const { data, error } = await supabase.functions.invoke('analyze-entry', {
                body: { entries, mode: 'weekly' },
            });

            if (error) throw error;
            return data?.report || "No se pudo generar el reporte.";
        } catch (e: any) {
            console.error('AI_SERVICE: generateWeeklyReport failed:', e.message);
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
