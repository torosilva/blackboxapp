import { useState, useEffect } from 'react';
import { supabase } from '../services/SupabaseService';
import { useAuth } from '../context/AuthContext';

export const useSubscription = () => {
    const { user } = useAuth();
    const [isPro, setIsPro] = useState(false);
    const [auditCount, setAuditCount] = useState(0);
    const [loading, setLoading] = useState(true);

    const checkSubscription = async () => {
        if (!user) return;
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('is_pro, audit_count')
                .eq('id', user.id)
                .maybeSingle();

            if (data) {
                setIsPro(data.is_pro);
                setAuditCount(data.audit_count);
            }
        } catch (error) {
            console.error('HOOK_SUBSCRIPTION_ERROR:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkSubscription();
    }, [user]);

    const canCreateAudit = () => {
        if (isPro) return true;
        return auditCount < 3;
    };

    return {
        isPro,
        auditCount,
        canCreateAudit,
        loading,
        refresh: checkSubscription
    };
};
