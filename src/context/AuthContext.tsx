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

const AuthContext = createContext<AuthContextProps>({} as AuthContextProps);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        console.log('AUTH: Initializing session check...');
        // 1. Verificar sesión actual al abrir la app
        supabase.auth.getSession().then(({ data: { session } }) => {
            console.log('AUTH: Session check complete. Session exists:', !!session);
            setSession(session);
            setUser(session?.user ?? null);
            setIsLoading(false);
        });

        // 2. Escuchar cambios (Login, Logout, Auto-refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
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
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    console.log('AUTH_CONTEXT: Profile not found, creating it...');
                    const email = session?.user?.email || '';
                    await SupabaseService.upsertProfile(userId, email);
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
            console.error('AUTH_CONTEXT: Error fetching profile', error);
        } finally {
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
