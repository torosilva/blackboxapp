export type WellnessActivityType = 'EXERCISE' | 'MEDITATION' | 'RELAXATION' | 'JOURNALING' | 'FOCUS_TOOL';

export interface WellnessRecommendation {
    type: WellnessActivityType;
    title: string;
    description: string;
    duration_minutes?: number;
    resource_link?: string;
}

export interface ActionItem {
    description: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    category: 'BUSINESS' | 'PERSONAL' | 'HEALTH';
    is_completed?: boolean; // Lo manejaremos en la UI (checkbox)
}

export interface StrategicInsight {
    detected_bias: string | null;
    warning_message: string;
    counter_thought: string;
}

export interface DiaryEntry {
    id: string;
    user_id: string;
    created_at: string;
    original_text: string;
    summary?: string; // Legacy
    mood_label?: string; // Legacy
    sentiment_score?: number | null; // Legacy
    audio_url: string | null;

    // Nuevo esquema consolidado
    ai_analysis?: {
        summary: string;
        mood_label: string;
        sentiment_score: number;
        wellness_recommendation: any;
        strategic_insight: StrategicInsight;
        action_items: ActionItem[];
    };

    // Mantenemos estos para compatibilidad con la UI mientras se desempaqueta
    strategic_insight?: StrategicInsight | null;
    wellness_recommendation?: any;
    action_items?: ActionItem[];
}
