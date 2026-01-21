import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

let mockEntries: any[] = [
    {
        id: '1',
        title: 'Welcome to your AI Diary',
        content: 'This is a sample entry. Once you connect Supabase, your real entries will appear here.',
        created_at: new Date().toISOString(),
        mood: '👋'
    }
];

// Helper to add timeout to any promise-like object
const withTimeout = async <T>(promise: Promise<T> | any, ms: number = 10000): Promise<T> => {
    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out after 10 seconds')), ms)
    );
    return Promise.race([promise, timeout]);
};

export class EntryService {
    async pickImage() {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
        });

        if (!result.canceled) {
            return result.assets[0].uri;
        }
        return null;
    }

    async saveEntry(userId: string, entry: {
        title: string,
        content: string,
        mood?: string,
        image_url?: string,
        mood_label?: string,
        sentiment_score?: number,
        wellness_action?: any
    }) {
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

        if (!supabaseUrl || supabaseUrl.includes('YOUR_SUPABASE')) {
            const newEntry = {
                id: Math.random().toString(36).substr(2, 9),
                user_id: userId,
                ...entry,
                created_at: new Date().toISOString()
            };
            mockEntries = [newEntry, ...mockEntries];
            return { data: newEntry, error: null };
        }

        try {
            console.log('Attemping to save to Supabase. Table: entries...');
            const result = (await withTimeout(
                supabase
                    .from('entries')
                    .insert([
                        {
                            user_id: userId,
                            title: entry.title,
                            content: entry.content,
                            mood: entry.mood,
                            image_url: entry.image_url,
                            mood_label: entry.mood_label,
                            sentiment_score: entry.sentiment_score,
                            wellness_action: entry.wellness_action
                        }
                    ])
                    .select()
            )) as { data: any, error: any };

            if (result.error) {
                console.error('Supabase Error Result:', JSON.stringify(result.error, null, 2));
                return { data: null, error: result.error };
            }

            console.log('Save successful to Supabase');
            return { data: result.data, error: null };
        } catch (err: any) {
            console.error('Supabase Exception caught:', err.message || err);
            return { data: null, error: err };
        }
    }

    async getEntries(userId: string) {
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

        if (!supabaseUrl || supabaseUrl.includes('YOUR_SUPABASE')) {
            return mockEntries;
        }

        try {
            const result = (await withTimeout(
                supabase
                    .from('entries')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
            )) as { data: any[], error: any };

            if (result.error) throw result.error;
            return result.data || [];
        } catch (err) {
            console.error('Fetch error:', err);
            return mockEntries;
        }
    }
}

export const entryService = new EntryService();
