import React, { createContext, useState, useEffect, useContext } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, SupabaseService } from '../services/SupabaseService';

interface AuthContextProps {
    user: User | null;
    profile: any | null;
    session: Session | null;
    isLoading: boolean;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

let _globalAccessToken: string | null = null;
export const getGlobalAccessToken = () => _globalAccessToken;

export const AuthContext = createContext<AuthContextProps>({} as AuthContextProps);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);

    // Sync active session with global variable
    useEffect(() => {
        _globalAccessToken = session?.access_token || null;
    }, [session]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        console.log('AUTH: Initializing session check...');
        supabase.auth.getSession().then(({ data: { session }, error }) => {
            if (error) {
                console.error('AUTH_CONTEXT: getSession error:', error.message);
                if (error.message.includes('refresh_token_not_found') || error.message.includes('invalid_grant')) {
                    supabase.auth.signOut();
                }
                setIsLoading(false);
                return;
            }
            console.log('AUTH: Session check complete. Session exists:', !!session);
            _globalAccessToken = session?.access_token || null;
            setSession(session);
            setUser(session?.user ?? null);
            setIsLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            console.log('AUTH_CONTEXT: Auth event type:', _event);
            _globalAccessToken = session?.access_token || null;
            if (_event === 'SIGNED_OUT') {
                console.log('AUTH_CONTEXT: User signed out, clearing state.');
                setSession(null);
                setUser(null);
                setProfile(null);
                setIsLoading(false);
                return;
            }
            
            console.log('AUTH_CONTEXT: New session detected for user:', session?.user?.id);
            setSession(session);
            setUser(session?.user ?? null);
            
            if (session?.user) {
                console.log('AUTH_CONTEXT: Loading profile for user:', session.user.id);
                fetchProfile(session.user.id);
            } else {
                setProfile(null);
                setIsLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const [profile, setProfile] = useState<any | null>(null);

    const fetchProfile = async (userId: string) => {
        // Safety timeout for profile fetch (10s)
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Profile fetch timeout')), 10000)
        );

        try {
            console.log('AUTH_CONTEXT: Fetching profile for:', userId);
            const fetchPromise = supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

            if (error) {
                if (error.code === 'PGRST116') {
                    console.log('AUTH_CONTEXT: Profile not found, creating it...');
                    const email = session?.user?.email || '';
                    await SupabaseService.upsertProfile(userId, email);
                    await SupabaseService.seedWelcomeEntry(userId);
                    // Fetch again after creation
                    const { data: newData, error: newError } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', userId)
                        .single();
                    if (newError) throw newError;
                    setProfile(newData);
                } else {
                    throw error;
                }
            } else {
                setProfile(data);
            }
        } catch (error) {
            console.error('AUTH_CONTEXT: Error or timeout fetching profile', error);
        } finally {
            console.log('AUTH_CONTEXT: Profile fetch operation finished.');
            setIsLoading(false);
        }
    };

    const refreshProfile = async () => {
        if (user) await fetchProfile(user.id);
    };

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    const Provider = AuthContext.Provider as any;

    return (
        <Provider value={{ user, profile, session, isLoading, signOut, refreshProfile }}>
            {children}
        </Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
