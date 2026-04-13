import { supabase } from './SupabaseService';

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
        const { data, error } = await supabase.functions.invoke('ai-chat', {
            body: {
                userMessage,
                chatHistory,
                userId,
                userName: userName ?? 'Explorador',
                category: category ?? 'General',
                therapyMode: therapyMode ?? false,
                entryContext: entryContext ?? null,
            },
        });

        if (error) {
            console.error('CHAT_SERVICE: Edge function error', error);
            throw error;
        }

        if (!data?.content) {
            throw new Error('No response from AI');
        }

        return data.content;
    }
};
