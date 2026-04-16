import { supabase } from './supabase';
import { SupabaseService } from './SupabaseService';
import { WellnessRecommendation, DiaryEntry, StrategicInsight, ActionItem } from '../core-types';
import { getGlobalAccessToken } from '../context/AuthContext';

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


export const aiService = {
    generateDailySummary: async (
        entries: (string | { title?: string; content: string })[],
        userId?: string,
        entryId?: string
    ): Promise<AIAnalysis> => {

        // Build structured historical context when we have a userId
        const historicalContext = userId
            ? await SupabaseService.getHistoricalContext(userId)
            : null;

        // ── Auto-trigger pattern analysis every 5 entries ─────────────────────
        if (
            userId &&
            historicalContext &&
            historicalContext.dataMaturity === 'ready' &&
            historicalContext.totalEntries > 0 &&
            (historicalContext.totalEntries + 1) % 5 === 0
        ) {
            console.log(`AI_SERVICE: Entry #${historicalContext.totalEntries + 1} milestone — triggering pattern analysis`);
            // Fire-and-forget: does not block or throw
            SupabaseService.triggerPatternAnalysis(userId).catch(e =>
                console.warn('AI_SERVICE: Pattern trigger failed (silent):', e.message)
            );
        }

        const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/analyze-entry`;
        const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
        
        const token = getGlobalAccessToken();
        const authHeader = `Bearer ${token || anonKey}`;
        console.log(`[AI_SERVICE DEBUG] Sending request to ${url}. Auth Header Length:`, authHeader.length, 'Token Preview:', authHeader.substring(0, 20) + '...');

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': anonKey,
                'Authorization': authHeader
            },
            body: JSON.stringify({ entries, historicalContext, entryId, userId }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`AI_SERVICE HTTP ${response.status}:`, errText);
            throw new Error(`Edge Function returned a non-2xx status code`); // Keep standard SDK wording to not surprise user
        }
        
        const data = await response.json();

        const parsed = data?.analysis;
        if (!parsed) {
            throw new Error('El análisis no devolvió datos. Intenta de nuevo.');
        }

        const userText = entries.map(e => {
            if (typeof e === 'string') return e;
            return `${e.title ? `Título: ${e.title}\n` : ''}Contenido: ${e.content}`;
        }).join('\n---\n');

        return {
            title: parsed.title || 'Registro Estratégico',
            original_text: userText,
            summary: parsed.summary,
            mood_label: parsed.mood_label,
            sentiment_score: typeof parsed.sentiment_score === 'number' ? parsed.sentiment_score : 0,
            wellness_recommendation: parsed.wellness_recommendation,
            strategic_insight: parsed.strategic_insight,
            action_items: parsed.action_items || [],
            suggested_goals: parsed.suggested_goals || [],
            category: parsed.category || 'PERSONAL',
        };
    },



    generateWeeklyReport: async (entries: any[]): Promise<string> => {
        if (entries.length === 0) return "Datos insuficientes.";
        try {
            const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/analyze-entry`;
            const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
            
            const token = getGlobalAccessToken();
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': anonKey,
                    'Authorization': `Bearer ${token || anonKey}`
                },
                body: JSON.stringify({ entries, mode: 'weekly' }),
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errText}`);
            }
            const data = await response.json();
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
