import { supabase } from './SupabaseService';

export interface Feedback {
    id?: string;
    user_id: string;
    content: string;
    type: 'bug' | 'improvement' | 'other';
    attachment_url?: string | null;
    created_at?: string;
}

export const FeedbackService = {
    /**
     * Submit user feedback to Supabase
     */
    async submitFeedback(userId: string, content: string, type: 'bug' | 'improvement' | 'other' = 'other', attachmentUrl?: string | null) {
        try {
            const { data, error } = await supabase
                .from('feedback')
                .insert([
                    {
                        user_id: userId,
                        content,
                        type,
                        attachment_url: attachmentUrl
                    }
                ])
                .select();

            if (error) throw error;
            return { data, error: null };
        } catch (error: any) {
            console.error('FeedbackService: Error submitting feedback', error);
            return { data: null, error };
        }
    },

    /**
     * Fetch all feedback (Admin only)
     */
    async getAllFeedback() {
        try {
            const { data, error } = await supabase
                .from('feedback')
                .select('*, profiles(full_name)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { data, error: null };
        } catch (error: any) {
            console.error('FeedbackService: Error fetching feedback', error);
            return { data: null, error };
        }
    }
};
