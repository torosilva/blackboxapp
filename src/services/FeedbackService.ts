import { supabase } from './SupabaseService';

export interface Feedback {
    id?: string;
    user_id: string;
    content: string;
    type: 'bug' | 'improvement' | 'other';
    created_at?: string;
}

export const FeedbackService = {
    /**
     * Submit user feedback to Supabase
     */
    async submitFeedback(userId: string, content: string, type: 'bug' | 'improvement' | 'other' = 'other') {
        try {
            const { data, error } = await supabase
                .from('feedback')
                .insert([
                    {
                        user_id: userId,
                        content,
                        type,
                    }
                ])
                .select();

            if (error) throw error;
            return { data, error: null };
        } catch (error: any) {
            console.error('FeedbackService: Error submitting feedback', error);
            return { data: null, error };
        }
    }
};
