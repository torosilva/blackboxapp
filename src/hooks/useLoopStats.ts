import { useCallback, useEffect, useState } from 'react';
import { SupabaseService } from '../services/SupabaseService';

// Una sola fuente de verdad para todos los conteos de loops/pendientes.
// `stalled` es SUBCONJUNTO de `open` (loops sin tocar ≥ STALE_DAYS), no
// un total independiente — invariante: open ≥ stalled siempre.
export const STALE_DAYS = 14;

export type LoopStats = {
    open: number;
    closed: number;
    regresa: number;
    stalled: number;
    stalledDays: number;
    ordered: any[];
};

const daysOpen = (l: any) =>
    l?.created_at ? Math.floor((Date.now() - new Date(l.created_at).getTime()) / 86400000) : 0;

// Derivación pura — misma entrada, misma salida. Cualquier pantalla que
// quiera derivar stats sin re-hacer fetch (ej. CaptureScreen.loadHome
// que ya pide loops en paralelo con otras consultas) usa esta función
// directamente.
export const deriveLoopStats = (loops: any[], closedThisWeek: number): LoopStats => {
    const all = loops || [];
    const regresa = all.filter((l: any) => String(l.status) === 'regresa');
    const stalled = all.filter((l: any) => daysOpen(l) >= STALE_DAYS);
    const stalledDays = stalled.length ? Math.max(...stalled.map(daysOpen)) : 0;
    const high = all.filter((l: any) => String(l.priority).toUpperCase() === 'HIGH' && !regresa.includes(l));
    const rest = all.filter((l: any) => !regresa.includes(l) && !high.includes(l));

    return {
        open: all.length,
        closed: closedThisWeek,
        regresa: regresa.length,
        stalled: stalled.length,
        stalledDays,
        ordered: [...regresa, ...high, ...rest],
    };
};

// Hook reactivo. Hace el fetch (getOpenActionItems + getClosedLoopsCount)
// y devuelve stats derivados + helper refresh para revalidar.
export const useLoopStats = (userId: string | undefined) => {
    const [stats, setStats] = useState<LoopStats | null>(null);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const [loops, closed] = await Promise.all([
                SupabaseService.getOpenActionItems(userId),
                SupabaseService.getClosedLoopsCount(userId, 7),
            ]);
            setStats(deriveLoopStats(loops, closed));
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => { refresh(); }, [refresh]);

    return { stats, loading, refresh };
};
