import { supabase } from './supabase';

export interface ChatMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
}

export const ChatService = {
    async sendMessage(
        userId: string,
        userMessage: string,
        chatHistory: ChatMessage[] = [],
        userName?: string,
        category?: string
    ) {
        const { data, error } = await supabase.functions.invoke('ai-chat', {
            body: {
                userMessage,
                chatHistory,
                userId,
                userName: userName ?? 'Explorador',
                category: category ?? 'General',
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
