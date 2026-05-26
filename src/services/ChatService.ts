import { supabase } from './SupabaseService';
import { getGlobalAccessToken } from '../context/AuthContext';

export interface ChatMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
    // Local preview URI for an attached image, set only on the in-memory
    // copy of the message so the user bubble can render the thumbnail.
    // Not persisted to DB; absent on history loaded from Supabase.
    imageUri?: string;
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

const CHAT_TIMEOUT_MS = 60_000;

export const ChatService = {
    async sendMessage(
        userId: string,
        userMessage: string,
        chatHistory: ChatMessage[] = [],
        userName?: string,
        category?: string,
        therapyMode?: boolean,
        entryContext?: EntryContext,
        image?: { mediaType: string; data: string } | null
    ) {
        const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-chat`;
        const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
        const token = getGlobalAccessToken();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);

        try {
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
                    image: image ?? null,
                }),
                signal: controller.signal,
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
        } catch (err: any) {
            if (err?.name === 'AbortError') {
                console.error('CHAT_SERVICE timeout after', CHAT_TIMEOUT_MS, 'ms');
                throw new Error('La IA tardó demasiado en responder. Verifica tu conexión e intenta de nuevo.');
            }
            throw err;
        } finally {
            clearTimeout(timeoutId);
        }
    }
};
