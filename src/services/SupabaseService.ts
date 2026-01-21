import { createClient } from '@supabase/supabase-js';
import * as FileSystem from 'expo-file-system/legacy';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DiaryEntry, WellnessRecommendation } from '../types';

WebBrowser.maybeCompleteAuthSession(); // Required for web-based auth flows

// Native base64 decoder compatible with React Native
const decode = (base64: string): ArrayBuffer => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const lookup = new Uint8Array(256);
    for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

    const len = base64.length;
    let bufferLength = len * 0.75;
    if (base64[len - 1] === '=') bufferLength--;
    if (base64[len - 2] === '=') bufferLength--;

    const bytes = new Uint8Array(bufferLength);
    for (let i = 0, j = 0; i < len; i += 4) {
        const encoded1 = lookup[base64.charCodeAt(i)];
        const encoded2 = lookup[base64.charCodeAt(i + 1)];
        const encoded3 = lookup[base64.charCodeAt(i + 2)];
        const encoded4 = lookup[base64.charCodeAt(i + 3)];

        bytes[j++] = (encoded1 << 2) | (encoded2 >> 4);
        bytes[j++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
        bytes[j++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }
    return bytes.buffer;
};

// Initialize Supabase using the existing pattern or env
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // Required for mobile OAuth flows to prevent conflicts
    },
});

export const SupabaseService = {
    /**
     * Internal helper to unpack ai_analysis JSONB into flat object
     * for UI backward compatibility.
     */
    _unpackEntry(entry: any) {
        if (!entry) return null;
        if (entry.ai_analysis) {
            return {
                ...entry,
                summary: entry.ai_analysis.summary || entry.summary,
                mood_label: entry.ai_analysis.mood_label || entry.mood_label,
                sentiment_score: entry.ai_analysis.sentiment_score ?? entry.sentiment_score,
                wellness_recommendation: entry.ai_analysis.wellness_recommendation || entry.wellness_recommendation,
                strategic_insight: entry.ai_analysis.strategic_insight || entry.strategic_insight,
                action_items: entry.ai_analysis.action_items || entry.action_items
            };
        }
        return entry;
    },

    /**
     * 1. Upload Audio to Supabase Storage
     */
    async uploadAudio(uri: string, userId: string): Promise<string | null> {
        try {
            console.log('SUPABASE_SERVICE: Attempting audio upload...');
            const fileExt = uri.split('.').pop() || 'm4a';
            const fileName = `${userId}/${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            // Read file as Base64
            const base64 = await FileSystem.readAsStringAsync(uri, {
                encoding: 'base64' as any,
            });

            const { data, error } = await supabase.storage
                .from('diaries')
                .upload(filePath, decode(base64), {
                    contentType: 'audio/m4a',
                    upsert: false,
                });

            if (error) {
                console.error('SUPABASE_SERVICE: Upload error', error);
                throw error;
            }

            const { data: publicUrlData } = supabase.storage.from('diaries').getPublicUrl(filePath);
            console.log('SUPABASE_SERVICE: Upload success:', publicUrlData.publicUrl);
            return publicUrlData.publicUrl;

        } catch (error: any) {
            console.error('SUPABASE_SERVICE: Upload failed:', error.message || error);
            return null;
        }
    },

    /**
     * 2. Save the Entry & AI Analysis to Database
     */
    async createEntry(entry: {
        user_id: string;
        title: string;
        content: string;
        summary: string;
        mood_label: string;
        sentiment_score: number;
        wellness_recommendation: any;
        strategic_insight: any;
        action_items: any[];
        audio_url: string | null;
        original_text: string;
    }) {
        try {
            console.log('SUPABASE_SERVICE: Inserting entry to DB with Active Loops...');
            const { data, error } = await supabase
                .from('entries')
                .insert([
                    {
                        user_id: entry.user_id,
                        title: entry.title,
                        content: entry.content,
                        audio_url: entry.audio_url,
                        original_text: entry.original_text,
                        // NEW CONSOLIDATED SCHEMA
                        ai_analysis: {
                            summary: entry.summary,
                            mood_label: entry.mood_label,
                            sentiment_score: entry.sentiment_score,
                            wellness_recommendation: entry.wellness_recommendation,
                            strategic_insight: entry.strategic_insight,
                            action_items: entry.action_items
                        },
                        // Keep legacy columns during transition if they still exist in DB
                        summary: entry.summary,
                        mood_label: entry.mood_label,
                        sentiment_score: entry.sentiment_score,
                        wellness_recommendation: entry.wellness_recommendation,
                        strategic_insight: entry.strategic_insight,
                        action_items: entry.action_items
                    },
                ])
                .select()
                .single();

            if (error) {
                console.error('SUPABASE_SERVICE: DB Insert Error:', JSON.stringify(error));
                throw error;
            }
            console.log('SUPABASE_SERVICE: Entry created successfully');
            return data;
        } catch (error: any) {
            console.error('SUPABASE_SERVICE: Database Insert Failed:', error.message || error);
            throw error;
        }
    },

    /**
     * Fetch recent AI summaries for historical context
     */
    async getRecentInsights(userId: string, limit: number = 10): Promise<string> {
        try {
            const { data, error } = await supabase
                .from('entries')
                .select('summary, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            if (!data || data.length === 0) return "";

            return data
                .filter(item => item.summary)
                .map(item => `[${new Date(item.created_at).toLocaleDateString()}]: ${item.summary}`)
                .join('\n');
        } catch (error) {
            console.error('SUPABASE_SERVICE: Error fetching recent insights', error);
            return "";
        }
    },

    /**
     * 3. Fetch Entries for a specific date range (default last 7 days)
     */
    async getWeeklyEntries(userId: string, endDate: Date = new Date(), daysCount: number = 7) {
        try {
            console.log(`SUPABASE_SERVICE: Fetching entries for ${daysCount} days ending at ${endDate.toISOString()}`);

            const startRange = new Date(endDate);
            startRange.setDate(startRange.getDate() - daysCount);

            const { data, error } = await supabase
                .from('entries')
                .select('*')
                .eq('user_id', userId)
                .gte('created_at', startRange.toISOString())
                .lte('created_at', endDate.toISOString())
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (data || []).map(e => this._unpackEntry(e));
        } catch (error: any) {
            console.error('SUPABASE_SERVICE: Weekly Fetch Failed:', error.message);
            return [];
        }
    },

    /**
     * 4. Fetch All Entries for a user
     */
    async getEntries(userId: string) {
        try {
            console.log('SUPABASE_SERVICE: Fetching all entries for user:', userId);
            const { data, error } = await supabase
                .from('entries')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (data || []).map(e => this._unpackEntry(e));
        } catch (error: any) {
            console.error('SUPABASE_SERVICE: Fetch Entries Failed:', error.message);
            return [];
        }
    },

    /**
     * 5. Delete Entry from Database
     */
    async deleteEntry(entryId: string) {
        try {
            console.log('SUPABASE_SERVICE: Deleting entry:', entryId);
            const { error } = await supabase
                .from('entries')
                .delete()
                .eq('id', entryId);

            if (error) throw error;
            console.log('SUPABASE_SERVICE: Entry deleted successfully');
            return true;
        } catch (error: any) {
            console.error('SUPABASE_SERVICE: Delete Entry Failed:', error.message);
            throw error;
        }
    },

    /**
     * 4. Fetch Single Entry by ID
     */
    async getEntryById(entryId: string) {
        try {
            console.log('SUPABASE_SERVICE: Fetching entry:', entryId);
            const { data, error } = await supabase
                .from('entries')
                .select('*')
                .eq('id', entryId)
                .single();

            if (error) throw error;
            return this._unpackEntry(data);
        } catch (error: any) {
            console.error('SUPABASE_SERVICE: Fetch Entry Failed:', error.message);
            return null;
        }
    },

    /**
     * 5. Update Action Items only (Persistent Task Toggling)
     */
    async updateEntryActions(entryId: string, actions: any[]) {
        try {
            console.log('SUPABASE_SERVICE: Updating actions for entry:', entryId);

            // First get the latest state to preserve other ai_analysis fields if needed 
            // but we can also just update the column part if we use some jsonb operators
            // However, current schema has the whole object in ai_analysis.
            const { data: currentEntry, error: fetchError } = await supabase
                .from('entries')
                .select('ai_analysis')
                .eq('id', entryId)
                .single();

            if (fetchError) throw fetchError;

            const newAnalysis = {
                ...(currentEntry.ai_analysis || {}),
                action_items: actions
            };

            const { error: updateError } = await supabase
                .from('entries')
                .update({
                    ai_analysis: newAnalysis,
                    // Also update legacy column for compatibility
                    action_items: actions
                })
                .eq('id', entryId);

            if (updateError) throw updateError;
            console.log('SUPABASE_SERVICE: Actions updated successfully');
            return true;
        } catch (error: any) {
            console.error('SUPABASE_SERVICE: Update Actions Failed:', error.message);
            return false;
        }
    },

    /**
     * Mark terms as accepted for the user
     */
    async acceptTerms(userId: string) {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ accepted_terms_at: new Date().toISOString() })
                .eq('id', userId);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('SUPABASE_SERVICE: Error accepting terms', error);
            throw error;
        }
    },

    /**
     * Mark privacy policy as accepted for the user
     */
    async acceptPrivacy(userId: string) {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ accepted_privacy_at: new Date().toISOString() })
                .eq('id', userId);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('SUPABASE_SERVICE: Error accepting privacy', error);
            throw error;
        }
    },

    /**
     * 5. Ensure Profile Exists (Automatic Registration)
     */
    async upsertProfile(userId: string, email: string, fullName?: string) {
        try {
            console.log('SUPABASE_SERVICE: Syncing profile for:', userId);

            // Payload: Use fullName if provided, otherwise fallback to email prefix
            const payload = {
                id: userId,
                email: email,
                full_name: fullName || email.split('@')[0],
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('profiles')
                .upsert(payload, { onConflict: 'id' });

            if (error) {
                console.error('SUPABASE_SERVICE: Profile sync failed:', error.message);

                // Secondary fallback: Try just id and email if full_name also fails
                if (error.message?.includes('full_name')) {
                    console.log('SUPABASE_SERVICE: Attempting ultra-minimal sync...');
                    await supabase.from('profiles').upsert({ id: userId, email: email }, { onConflict: 'id' });
                }
                throw error;
            }
            console.log('SUPABASE_SERVICE: Profile synced successfully');
        } catch (error: any) {
            console.error('SUPABASE_SERVICE: Profile sync fatal error:', error.message || JSON.stringify(error));
        }
    },

    /**
     * 6. Cache & Cost Optimization: Get/Set AI Insights
     */
    async getCachedInsight(userId: string, type: 'daily' | 'weekly', fingerprint: string) {
        try {
            const { data, error } = await supabase
                .from('cached_insights')
                .select('content')
                .eq('user_id', userId)
                .eq('insight_type', type)
                .eq('fingerprint', fingerprint)
                .maybeSingle();

            if (error) return null;
            return data?.content;
        } catch (e) {
            return null;
        }
    },

    async saveCachedInsight(userId: string, type: 'daily' | 'weekly', fingerprint: string, content: any) {
        try {
            // Upsert based on natural key (user, type, fingerprint)
            const { error } = await supabase
                .from('cached_insights')
                .upsert({
                    user_id: userId,
                    insight_type: type,
                    fingerprint: fingerprint,
                    content: content,
                    created_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id,insight_type,fingerprint'
                });

            if (error) console.error('SUPABASE_SERVICE: Cache save error:', error.message);
        } catch (e) {
            console.error('SUPABASE_SERVICE: Cache save fatal error:', e);
        }
    },

    /**
     * 7. Social Authentication (Google)
     */
    async signInWithGoogle() {
        try {
            const redirectUrl = AuthSession.makeRedirectUri({
                scheme: 'blackbox'
            });
            console.log('SUPABASE_SERVICE: Generated Redirect URI:', redirectUrl);
            console.log('SUPABASE_SERVICE: Starting Google OAuth...');

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    skipBrowserRedirect: false,
                },
            });

            if (data?.url) {
                const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
                if (result.type === 'success' && result.url) {
                    // Check for both hash (implicit) and query (PKCE) params
                    const urlObj = new URL(result.url.replace('#', '?'));
                    const params = urlObj.searchParams;

                    const code = params.get('code');
                    const accessToken = params.get('access_token');
                    const refreshToken = params.get('refresh_token');

                    if (code) {
                        console.log('SUPABASE_SERVICE: Exchanging code for session...');
                        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
                        if (exchangeError) throw exchangeError;
                    } else if (accessToken && refreshToken) {
                        console.log('SUPABASE_SERVICE: Setting session from tokens...');
                        await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });
                    }
                }
            }

            if (error) throw error;
        } catch (error: any) {
            console.error('SUPABASE_SERVICE: Google Sign-In Failed:', error.message);
            throw error;
        }
    },

    /**
     * 8. Social Authentication (Apple)
     */
    async signInWithApple() {
        try {
            const redirectUrl = AuthSession.makeRedirectUri({
                scheme: 'blackbox'
            });
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'apple',
                options: {
                    redirectTo: redirectUrl,
                },
            });

            if (data?.url) {
                const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
                if (result.type === 'success' && result.url) {
                    const urlObj = new URL(result.url.replace('#', '?'));
                    const params = urlObj.searchParams;

                    const code = params.get('code');
                    const accessToken = params.get('access_token');
                    const refreshToken = params.get('refresh_token');

                    if (code) {
                        console.log('SUPABASE_SERVICE: Exchanging code for session (Apple)...');
                        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
                        if (exchangeError) throw exchangeError;
                    } else if (accessToken && refreshToken) {
                        console.log('SUPABASE_SERVICE: Setting session from tokens (Apple)...');
                        await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });
                    }
                }
            }

            if (error) throw error;
        } catch (error: any) {
            console.error('SUPABASE_SERVICE: Apple Sign-In Failed:', error.message);
            throw error;
        }
    },

    /**
     * 9. Delete User Account
     * Note: This deletes data from public tables. Auth deletion usually requires a Service Role key 
     * or a database trigger on 'auth.users' deletion.
     */
    async deleteAccount(userId: string) {
        try {
            console.log('SUPABASE_SERVICE: Initiating account deletion for:', userId);

            // Delete entries first (cascading might be on, but let's be safe)
            const { error: entriesError } = await supabase
                .from('entries')
                .delete()
                .eq('user_id', userId);

            if (entriesError) throw entriesError;

            // Delete profile
            const { error: profileError } = await supabase
                .from('profiles')
                .delete()
                .eq('id', userId);

            if (profileError) throw profileError;

            // Optional: Call a custom RPC if you have one to handle Auth.users deletion
            // await supabase.rpc('delete_user');

            console.log('SUPABASE_SERVICE: Account data deleted successfully');
            return true;
        } catch (error: any) {
            console.error('SUPABASE_SERVICE: Delete Account Failed:', error.message);
            throw error;
        }
    }
};
