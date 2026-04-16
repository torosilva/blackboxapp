import { supabase } from './SupabaseService';
import { getGlobalAccessToken } from '../context/AuthContext';

export interface ChatMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
}

export interface EntryContext {
    originalText: string;
    summary: string;
    moodLabel: string;
    sentimentScore: number;
    strategicInsight: string;
    wellnessRecommendation: string;
    actionItems: any[];
}

export const ChatService = {
    async sendMessage(
        userId: string,
        userMessage: string,
        chatHistory: ChatMessage[] = [],
        userName?: string,
        category?: string,
        therapyMode?: boolean,
        entryContext?: EntryContext
    ) {
        const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-chat`;
        const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
        const token = getGlobalAccessToken();

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': anonKey,
                'Authorization': `Bearer ${token || anonKey}`
            },
            body: JSON.stringify({
                userMessage,
                chatHistory,
                userId,
                userName: userName ?? 'Explorador',
                category: category ?? 'General',
                therapyMode: therapyMode ?? false,
                entryContext: entryContext ?? null,
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('CHAT_SERVICE HTTP Error:', response.status, errText);
            throw new Error(`Chat Edge Function falló: HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data?.content) {
            throw new Error('No response from AI');
        }

        return data.content;
    }
};
