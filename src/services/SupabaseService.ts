import { createClient } from '@supabase/supabase-js';
import * as FileSystem from 'expo-file-system/legacy';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DiaryEntry, WellnessRecommendation } from '../core-types';

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
                action_items: entry.ai_analysis.action_items || entry.action_items,
                category: entry.category || entry.ai_analysis.category || 'PERSONAL'
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
                encoding: 'base64',
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
        category?: string;
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
                        // Consolidate into JSONB if column exists, AND keep flat columns for legacy support
                        ai_analysis: {
                            summary: entry.summary,
                            mood_label: entry.mood_label,
                            sentiment_score: entry.sentiment_score,
                            wellness_recommendation: entry.wellness_recommendation,
                            strategic_insight: entry.strategic_insight,
                            action_items: entry.action_items
                        },
                        // Direct flat columns (Legacy/Standard)
                        summary: entry.summary,
                        mood_label: entry.mood_label,
                        sentiment_score: entry.sentiment_score,
                        wellness_recommendation: entry.wellness_recommendation,
                        strategic_insight: entry.strategic_insight,
                        action_items: entry.action_items,
                        mood: entry.mood_label, // Alias for 'mood' column in old schema
                        category: entry.category || 'PERSONAL'
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
     * Fetch recent AI summaries for historical context (legacy string format).
     * Kept for internal backwards compatibility — prefer getHistoricalContext().
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
     * Build a structured historical context object for the AI analysis prompt.
     * Includes mood trends, category patterns, bias recurrence, open loops,
     * and a dataMaturity signal so the prompt can adapt its tone.
     */
    async getHistoricalContext(userId: string): Promise<{
        recentMoods: { date: string; score: number; label: string }[];
        dominantCategories: { category: string; count: number }[];
        recurringBiases: { bias: string; count: number }[];
        openLoopsCount: number;
        avgSentimentLast7Days: number | null;
        totalEntries: number;
        dataMaturity: 'none' | 'building' | 'ready';
    }> {
        const empty = {
            recentMoods: [],
            dominantCategories: [],
            recurringBiases: [],
            openLoopsCount: 0,
            avgSentimentLast7Days: null,
            totalEntries: 0,
            dataMaturity: 'none' as const,
        };

        try {
            // ── 1. Fetch the last 15 entries ──────────────────────────────────
            const { data: entries, error: entriesErr } = await supabase
                .from('entries')
                .select('id, sentiment_score, mood_label, category, strategic_insight, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(15);

            if (entriesErr || !entries || entries.length === 0) return empty;

            const totalEntries = entries.length;
            const dataMaturity: 'none' | 'building' | 'ready' =
                totalEntries === 0 ? 'none' : totalEntries < 5 ? 'building' : 'ready';

            // ── 2. Recent moods ───────────────────────────────────────────────
            const recentMoods = entries
                .filter(e => e.sentiment_score !== null)
                .map(e => ({
                    date: e.created_at?.slice(0, 10) ?? '',
                    score: e.sentiment_score,
                    label: e.mood_label ?? 'Desconocido',
                }));

            // ── 3. Dominant categories ────────────────────────────────────────
            const catCount: Record<string, number> = {};
            for (const e of entries) {
                const cat = e.category || 'PERSONAL';
                catCount[cat] = (catCount[cat] || 0) + 1;
            }
            const dominantCategories = Object.entries(catCount)
                .map(([category, count]) => ({ category, count }))
                .sort((a, b) => b.count - a.count);

            // ── 4. Recurring biases ───────────────────────────────────────────
            const biasCount: Record<string, number> = {};
            for (const e of entries) {
                let bias: string | null = null;
                try {
                    if (typeof e.strategic_insight === 'string') {
                        const parsed = JSON.parse(e.strategic_insight);
                        bias = parsed?.detected_bias ?? null;
                    } else if (e.strategic_insight?.detected_bias) {
                        bias = e.strategic_insight.detected_bias;
                    }
                } catch { /* ignore parse errors */ }
                if (bias) biasCount[bias] = (biasCount[bias] || 0) + 1;
            }
            const recurringBiases = Object.entries(biasCount)
                .map(([bias, count]) => ({ bias, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 3);

            // ── 5. Open loops count ───────────────────────────────────────────
            let openLoopsCount = 0;
            try {
                const { count } = await supabase
                    .from('action_items')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', userId)
                    .eq('is_completed', false);
                openLoopsCount = count || 0;
            } catch { /* table may not exist yet, ignore */ }

            // ── 6. Avg sentiment last 7 days ──────────────────────────────────
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const recent7 = entries.filter(
                e => e.created_at && new Date(e.created_at) >= sevenDaysAgo && e.sentiment_score !== null
            );
            const avgSentimentLast7Days = recent7.length > 0
                ? recent7.reduce((sum, e) => sum + (e.sentiment_score ?? 0), 0) / recent7.length
                : null;

            return {
                recentMoods,
                dominantCategories,
                recurringBiases,
                openLoopsCount,
                avgSentimentLast7Days,
                totalEntries,
                dataMaturity,
            };
        } catch (err: any) {
            console.error('SUPABASE_SERVICE: getHistoricalContext failed:', err.message);
            return empty;
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
    async acceptTerms(userId: string, email: string) {
        try {
            console.log('SUPABASE_SERVICE: Accepting terms for:', userId);
            const { error } = await supabase
                .from('profiles')
                .upsert({
                    id: userId,
                    email: email, // Required if creating profile for the first time
                    accepted_terms_at: new Date().toISOString()
                }, { onConflict: 'id' });

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
    async acceptPrivacy(userId: string, email: string) {
        try {
            console.log('SUPABASE_SERVICE: Accepting privacy for:', userId);
            const { error } = await supabase
                .from('profiles')
                .upsert({
                    id: userId,
                    email: email, // Required in case profile is missing
                    accepted_privacy_at: new Date().toISOString()
                }, { onConflict: 'id' });

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
    async upsertProfile(userId: string, email: string, fullName?: string, avatarUrl?: string) {
        try {
            console.log('SUPABASE_SERVICE: Syncing profile for:', userId);

            // Payload: Use fullName if provided, otherwise fallback to email prefix
            const payload = {
                id: userId,
                email: email,
                full_name: fullName || email.split('@')[0],
                avatar_url: avatarUrl,
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
     * 6. Password Reset
     */
    async resetPassword(email: string) {
        // Use the most compatible redirect URI for the current environment
        const redirectUrl = AuthSession.makeRedirectUri({
            path: 'reset-password'
        });
        
        console.log('SUPABASE_SERVICE: Reset Password Redirect URI:', redirectUrl);

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: redirectUrl,
        });
        if (error) throw error;
        return true;
    },

    /**
     * 7. Social Authentication (Google)
     */
    async signInWithGoogle() {
        try {
            // Simplified redirect for better compatibility in Expo Go
            const redirectUrl = AuthSession.makeRedirectUri({
                path: 'auth/callback'
            });
            
            console.log('SUPABASE_SERVICE: Generated Google Redirect URI:', redirectUrl);
            console.log('SUPABASE_SERVICE: Starting Google OAuth...');
            
            // Helpful note for the developer
            if (redirectUrl.startsWith('exp://')) {
                console.log('SUPABASE_SERVICE: NOTE: Using Expo Go scheme. Ensure this exact URI is whitelisted in Supabase Dashboard.');
            }

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    skipBrowserRedirect: true,
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
                scheme: 'blackbox',
                path: 'auth/callback'
            });
            console.log('SUPABASE_SERVICE: Generated Apple Redirect URI:', redirectUrl);
            console.log('SUPABASE_SERVICE: Starting Apple OAuth...');

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'apple',
                options: {
                    redirectTo: redirectUrl,
                    skipBrowserRedirect: true,
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
    },

    /**
     * 10. Strategic Goals
     */
    async getGoals(userId: string) {
        try {
            const { data, error } = await supabase
                .from('goals')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } catch (error: any) {
            console.error('SUPABASE_SERVICE: Error fetching goals', error);
            return [];
        }
    },

    async createGoal(userId: string, title: string, description: string, category: 'BUSINESS' | 'PERSONAL' | 'DEVELOPMENT' | 'WELLNESS') {
        try {
            const { data, error } = await supabase
                .from('goals')
                .insert([{ user_id: userId, title, description, category }])
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error: any) {
            console.error('SUPABASE_SERVICE: Error creating goal', JSON.stringify(error));
            throw error;
        }
    },

    async updateGoalStatus(goalId: string, isCompleted: boolean) {
        try {
            const { error } = await supabase
                .from('goals')
                .update({ is_completed: isCompleted, updated_at: new Date().toISOString() })
                .eq('id', goalId);

            if (error) throw error;
            return true;
        } catch (error: any) {
            console.error('SUPABASE_SERVICE: Error updating goal', error);
            return false;
        }
    },

    async deleteGoal(goalId: string) {
        try {
            const { error } = await supabase
                .from('goals')
                .delete()
                .eq('id', goalId);

            if (error) throw error;
            return true;
        } catch (error: any) {
            console.error('SUPABASE_SERVICE: Error deleting goal', error);
            return false;
        }
    },

    /**
     * 11. Chat Strategy & History
     */
    async getChatThreads(userId: string) {
        const { data, error } = await supabase
            .from('chat_threads')
            .select('*')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    async createChatThread(userId: string, title: string, category: 'BUSINESS' | 'PERSONAL' | 'HEALTH' | 'GENERAL') {
        const { data, error } = await supabase
            .from('chat_threads')
            .insert([{ user_id: userId, title, category }])
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async deleteChatThread(threadId: string) {
        const { error } = await supabase
            .from('chat_threads')
            .delete()
            .eq('id', threadId);
        if (error) throw error;
        return true;
    },

    async getChatMessages(threadId: string) {
        const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('thread_id', threadId)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return data;
    },

    async saveChatMessage(threadId: string, role: 'user' | 'model', content: string) {
        const { error } = await supabase
            .from('chat_messages')
            .insert([{ thread_id: threadId, role, content }]);

        // Also update the thread's updated_at timestamp
        await supabase
            .from('chat_threads')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', threadId);

        if (error) throw error;
        return true;
    },

    /**
     * seedWelcomeEntry: Creates a sample entry for new users to demonstrate the app's value.
     */
    async seedWelcomeEntry(userId: string) {
        try {
            const welcomeTitle = "Bienvenida a BLACKBOX: Tu Primera Sesión";
            const welcomeContent = "Esta es una entrada de ejemplo para que veas cómo BLACKBOX funciona. Aquí puedes registrar tus pensamientos, grabaciones de voz o planes estratégicos. Una vez que guardas, mi motor de IA analiza tu contenido para detectar sesgos, resumir puntos clave y sugerir pasos accionables.";
            
            const analysis = {
                summary: "Bienvenido a tu nueva herramienta de claridad mental. Esta sesión demuestra cómo BLACKBOX transforma texto en estrategia. Se ha detectado un tono positivo y enfocado en el crecimiento.",
                sentiment_score: 0.9,
                mood_label: "Inspirado",
                strategic_insight: "Tu mayor activo es la capacidad de reflexionar sobre tus propios procesos cognitivos. No dejes que el sesgo de confirmación limite tus decisiones hoy.",
                wellness_recommendation: "Tómate 5 minutos para revisar tus Active Loops de hoy y prioriza el que tenga mayor impacto en tu meta de NEGOCIOS.",
                action_items: [
                    { id: '1', task: "Explorar la sección de Metas en Configuración", is_completed: false, category: "BUSINESS" },
                    { id: '2', task: "Registrar mi primera reflexión de voz usando el micro", is_completed: false, category: "PERSONAL" },
                    { id: '3', task: "Probar el Chat Estratégico desde el Hub", is_completed: false, category: "BUSINESS" }
                ]
            };

            const { error } = await supabase
                .from('entries')
                .insert([{
                    user_id: userId,
                    title: welcomeTitle,
                    content: welcomeContent,
                    summary: analysis.summary,
                    sentiment_score: analysis.sentiment_score,
                    mood_label: analysis.mood_label,
                    strategic_insight: analysis.strategic_insight,
                    wellness_recommendation: analysis.wellness_recommendation,
                    action_items: analysis.action_items,
                    created_at: new Date().toISOString()
                }]);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('SEED_WELCOME_ERROR:', error);
            return false;
        }
    },

    async applyInvitationCode(userId: string, code: string) {
        const { data, error } = await supabase.rpc('apply_invitation_code', {
            input_code: code,
            user_id: userId
        });
        if (error) throw error;
        return data as boolean;
    },

    /**
     * Count entries created in the current calendar month (for FREE tier gate).
     */
    async getMonthlyEntryCount(userId: string): Promise<number> {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const { count, error } = await supabase
            .from('entries')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('created_at', startOfMonth);

        if (error) {
            console.error('SUPABASE_SERVICE: getMonthlyEntryCount error:', error.message);
            return 0;
        }
        return count || 0;
    },

    async getTodayUsage(userId: string) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isoToday = today.toISOString();

        // Count entries
        const { count: entriesCount, error: entriesError } = await supabase
            .from('entries')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('created_at', isoToday);

        // Count chat threads (started today)
        const { count: chatsCount, error: chatsError } = await supabase
            .from('chat_threads')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('created_at', isoToday);

        if (entriesError || chatsError) throw (entriesError || chatsError);
        
        return {
            entriesCount: entriesCount || 0,
            chatsCount: chatsCount || 0
        };
    },

    async createInvitation(email: string, invitedBy: string) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No O, I, 0, 1 for clarity
        let randomPart = '';
        for (let i = 0; i < 6; i++) {
            randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const fullCode = `BB-${randomPart}`;

        const { data, error } = await supabase
            .from('invitations')
            .insert([{
                code: fullCode,
                email: email.toLowerCase(),
                invited_by: invitedBy,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // ─── Normalized Action Items ─────────────────────────────────────────────

    /**
     * Mark a single action item as completed (or toggle it back to open).
     */
    async completeActionItem(id: string, completed: boolean = true): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('action_items')
                .update({
                    is_completed: completed,
                    completed_at: completed ? new Date().toISOString() : null,
                })
                .eq('id', id);

            if (error) throw error;
            console.log(`SUPABASE_SERVICE: action_item ${id} marked completed=${completed}`);
            return true;
        } catch (err: any) {
            console.error('SUPABASE_SERVICE: completeActionItem failed:', err.message);
            return false;
        }
    },

    /**
     * Fetch all open (not completed) action items for a user,
     * ordered by priority (HIGH first) then creation date.
     */
    async getOpenActionItems(userId: string) {
        try {
            const { data, error } = await supabase
                .from('action_items')
                .select('*')
                .eq('user_id', userId)
                .eq('is_completed', false)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Sort in-memory: HIGH > MEDIUM > LOW
            const priorityOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
            return (data || []).sort(
                (a, b) => (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1)
            );
        } catch (err: any) {
            console.error('SUPABASE_SERVICE: getOpenActionItems failed:', err.message);
            return [];
        }
    },

    /**
     * Fetch all action items (open and completed) for a specific entry.
     */
    async getActionItemsByEntry(entryId: string) {
        try {
            const { data, error } = await supabase
                .from('action_items')
                .select('*')
                .eq('entry_id', entryId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (err: any) {
            console.error('SUPABASE_SERVICE: getActionItemsByEntry failed:', err.message);
            return [];
        }
    },

    // ─── User Patterns ───────────────────────────────────────────────────────

    /**
     * Fetch all active AI-detected patterns for a user,
     * ordered by most recently updated (most relevant first).
     */
    async getUserPatterns(userId: string) {
        try {
            const { data, error } = await supabase
                .from('user_patterns')
                .select('*')
                .eq('user_id', userId)
                .eq('is_active', true)
                .order('last_seen_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (err: any) {
            console.error('SUPABASE_SERVICE: getUserPatterns failed:', err.message);
            return [];
        }
    },

    /**
     * Fire-and-forget invocation of the analyze-patterns Edge Function.
     * Does not block — errors are logged but not thrown.
     */
    async triggerPatternAnalysis(userId: string): Promise<void> {
        try {
            console.log('SUPABASE_SERVICE: Triggering pattern analysis for:', userId);
            const { error } = await supabase.functions.invoke('analyze-patterns', {
                body: { userId },
            });
            if (error) {
                console.warn('SUPABASE_SERVICE: Pattern analysis invoke error:', error.message);
            } else {
                console.log('SUPABASE_SERVICE: Pattern analysis triggered successfully');
            }
        } catch (err: any) {
            console.warn('SUPABASE_SERVICE: triggerPatternAnalysis failed (non-blocking):', err.message);
        }
    },
};


