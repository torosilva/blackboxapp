import React, { useState, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, ScrollView,
    TouchableOpacity, ActivityIndicator, StatusBar, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Zap, RefreshCw, Sun, Clock, Check, ArrowRight } from 'lucide-react-native';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { SupabaseService } from '../services/SupabaseService';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { ThemeTokens } from '../theme/tokens';

type Lane = 'regresa' | 'hoy' | 'rondando';
type LoopFilter = 'open' | 'stalled' | 'closed';
const STALE_DAYS = 14;

const laneOf = (it: any): Lane => {
    const s = String(it?.status ?? 'hoy');
    return s === 'regresa' || s === 'rondando' ? (s as Lane) : 'hoy';
};

const isStale = (it: any): boolean => {
    if (!it?.created_at) return false;
    const days = (Date.now() - new Date(it.created_at).getTime()) / (24 * 60 * 60 * 1000);
    return days >= STALE_DAYS;
};

export default function LoopsScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const initialFilter: LoopFilter = (route.params?.initialFilter as LoopFilter) ?? 'open';
    const [currentFilter] = useState<LoopFilter>(initialFilter);
    const { user } = useAuth();
    const { tokens } = useTheme();
    const styles = useMemo(() => makeStyles(tokens), [tokens]);
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        if (!user) return;
        const data = await SupabaseService.getOpenActionItems(user.id);
        setItems(data || []);
        setLoading(false);
        setRefreshing(false);
    }, [user]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    // Close a loop — optimistic remove, rollback on failure.
    const closeItem = async (id: string) => {
        const prev = items;
        setItems(prev.filter(i => i.id !== id));
        const ok = await SupabaseService.updateActionItemStatus(id, true);
        if (!ok) setItems(prev);
    };

    // Manual move between HOY and RONDANDO (REGRESAN is engine-set).
    const moveItem = async (id: string, to: 'hoy' | 'rondando') => {
        const prev = items;
        setItems(prev.map(i => (i.id === id ? { ...i, status: to } : i)));
        const ok = await SupabaseService.setActionItemLane(id, to);
        if (!ok) setItems(prev);
    };

    const regresan = items.filter(i => laneOf(i) === 'regresa');
    const hoy = items.filter(i => laneOf(i) === 'hoy');
    const rondando = items.filter(i => laneOf(i) === 'rondando');
    const stale = items.filter(isStale);

    const CL = ChevronLeft as any;

    const headerTitle =
        currentFilter === 'stalled' ? 'SIN AVANCE' :
        currentFilter === 'closed' ? 'COMPLETADAS' :
        'PENDIENTES';
    const headerSub =
        currentFilter === 'stalled' ? `${stale.length} sin avance >14 días` :
        currentFilter === 'closed' ? 'Historial de pendientes cerrados' :
        loading ? 'Cargando…' : `${items.length} abiertos`;

    // 'closed' is informational only — we don't fetch closed items here.
    // The user is redirected to the Centro Estratégico view that already
    // shows "Active Loops Realizados".
    if (currentFilter === 'closed') {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle={tokens.statusBar} />
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <CL color={tokens.text.primary} size={28} />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle}>{headerTitle}</Text>
                        <Text style={styles.headerSub}>{headerSub}</Text>
                    </View>
                    <View style={{ width: 44 }} />
                </View>
                <View style={styles.center}>
                    <Check size={48} color={tokens.accent.green} />
                    <Text style={styles.emptyTitle}>Tus pendientes cerrados</Text>
                    <Text style={styles.emptyText}>
                        Lo que ya cerraste se mantiene en el Centro Estratégico,
                        bajo "Realizados".
                    </Text>
                    <TouchableOpacity
                        style={[styles.closeBtn, { marginTop: 24, paddingHorizontal: 18 }]}
                        onPress={() => navigation.navigate('Settings', { initialViewMode: 'completed' })}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.closeBtnText}>Ver cerrados</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle={tokens.statusBar} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <CL color={tokens.text.primary} size={28} />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>{headerTitle}</Text>
                    <Text style={styles.headerSub}>{headerSub}</Text>
                </View>
                <View style={{ width: 44 }} />
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={tokens.accent.indigo} />
                </View>
            ) : currentFilter === 'stalled' ? (
                stale.length === 0 ? (
                    <View style={styles.center}>
                        <Sun size={48} color={tokens.border.strong} />
                        <Text style={styles.emptyTitle}>Sin pendientes estancados</Text>
                        <Text style={styles.emptyText}>
                            Ningún pendiente lleva más de {STALE_DAYS} días sin avance. Buen ritmo de ejecución.
                        </Text>
                    </View>
                ) : (
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={() => { setRefreshing(true); load(); }}
                                tintColor={tokens.accent.indigo}
                            />
                        }
                    >
                        <LaneHeader
                            icon={<Clock size={15} color={tokens.accent.amber} />}
                            title="SIN AVANCE"
                            count={stale.length}
                            color={tokens.accent.amber}
                            hint={`Pendientes abiertos hace más de ${STALE_DAYS} días. Decide: cierra, repriorita o descarta.`}
                        />
                        {stale.map(it => (
                            <SimpleCard
                                key={it.id}
                                item={it}
                                onClose={() => closeItem(it.id)}
                                moveLabel="Hoy"
                                onMove={() => moveItem(it.id, 'hoy')}
                            />
                        ))}
                    </ScrollView>
                )
            ) : items.length === 0 ? (
                <View style={styles.center}>
                    <Zap size={48} color={tokens.border.strong} />
                    <Text style={styles.emptyTitle}>Sin pendientes abiertos</Text>
                    <Text style={styles.emptyText}>
                        Cuando registres una memoria o converses en el chat, los
                        accionables que detecte BlackBoxMind aparecerán aquí para que
                        los cierres.
                    </Text>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => { setRefreshing(true); load(); }}
                            tintColor={tokens.accent.indigo}
                        />
                    }
                >
                    {/* ── REGRESAN — the differentiator ───────────────── */}
                    <LaneHeader
                        icon={<RefreshCw size={15} color={tokens.accent.red} />}
                        title="REGRESAN"
                        count={regresan.length}
                        color={tokens.accent.red}
                        hint="Lo que sigues evitando. No es falta de tiempo — es lo que cuesta enfrentar."
                    />
                    {regresan.length === 0 ? (
                        <Text style={styles.laneEmpty}>
                            Nada diagnosticado como evasión todavía. Aparece cuando el
                            análisis de patrones detecta un pendiente que llevas evitando.
                        </Text>
                    ) : (
                        regresan.map(it => (
                            <ReturnCard key={it.id} item={it} onClose={() => closeItem(it.id)} />
                        ))
                    )}

                    {/* ── HOY ─────────────────────────────────────────── */}
                    <LaneHeader
                        icon={<Sun size={15} color={tokens.accent.amber} />}
                        title="HOY"
                        count={hoy.length}
                        color={tokens.accent.amber}
                        hint="Lo que cierras hoy. Pocos, no todos."
                    />
                    {hoy.length === 0 ? (
                        <Text style={styles.laneEmpty}>Sin pendientes marcados para hoy.</Text>
                    ) : (
                        hoy.map(it => (
                            <SimpleCard
                                key={it.id}
                                item={it}
                                onClose={() => closeItem(it.id)}
                                moveLabel="Rondando"
                                onMove={() => moveItem(it.id, 'rondando')}
                            />
                        ))
                    )}

                    {/* ── RONDANDO ────────────────────────────────────── */}
                    <LaneHeader
                        icon={<Clock size={15} color={tokens.text.link} />}
                        title="RONDANDO"
                        count={rondando.length}
                        color={tokens.text.link}
                        hint="Te da vueltas, pero no es de hoy."
                    />
                    {rondando.length === 0 ? (
                        <Text style={styles.laneEmpty}>Sin pendientes rondando.</Text>
                    ) : (
                        rondando.map(it => (
                            <SimpleCard
                                key={it.id}
                                item={it}
                                onClose={() => closeItem(it.id)}
                                moveLabel="Hoy"
                                onMove={() => moveItem(it.id, 'hoy')}
                            />
                        ))
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const LaneHeader = ({ icon, title, count, color, hint }: {
    icon: React.ReactNode; title: string; count: number; color: string; hint: string;
}) => {
    const { tokens } = useTheme();
    const styles = useMemo(() => makeStyles(tokens), [tokens]);
    return (
    <View style={styles.laneHeaderWrap}>
        <View style={styles.laneHeaderRow}>
            {icon}
            <Text style={[styles.laneTitle, { color }]}>{title}</Text>
            <View style={[styles.laneCount, { borderColor: color }]}>
                <Text style={[styles.laneCountText, { color }]}>{count}</Text>
            </View>
        </View>
        <Text style={styles.laneHint}>{hint}</Text>
    </View>
    );
};

const ReturnCard = ({ item, onClose }: { item: any; onClose: () => void | Promise<void> }) => {
    const { tokens } = useTheme();
    const styles = useMemo(() => makeStyles(tokens), [tokens]);
    return (
    <View style={styles.returnCard}>
        <View style={styles.returnTopRow}>
            {!!item.connected_theme && (
                <View style={styles.themeChip}>
                    <Text style={styles.themeChipText}>{item.connected_theme}</Text>
                </View>
            )}
            {item.recurrence_count > 1 && (
                <Text style={styles.recurrenceText}>×{item.recurrence_count} veces</Text>
            )}
        </View>

        {!!item.avoidance_reason && (
            <Text style={styles.avoidanceText}>{item.avoidance_reason}</Text>
        )}

        <View style={styles.returnDivider} />
        <Text style={styles.nextLabel}>TU SIGUIENTE MOVIMIENTO</Text>
        <Text style={styles.nextTask}>{item.task}</Text>

        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Check size={16} color={tokens.accent.green} />
            <Text style={styles.closeBtnText}>Cerrar este pendiente</Text>
        </TouchableOpacity>
    </View>
    );
};

const SimpleCard = ({ item, onClose, moveLabel, onMove }: {
    item: any; onClose: () => void | Promise<void>; moveLabel: string; onMove: () => void | Promise<void>;
}) => {
    const { tokens } = useTheme();
    const styles = useMemo(() => makeStyles(tokens), [tokens]);
    return (
    <View style={styles.simpleCard}>
        <TouchableOpacity style={styles.checkbox} onPress={onClose} activeOpacity={0.7}>
            <Check size={14} color={tokens.text.muted} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
            <Text style={styles.simpleTask}>{item.task}</Text>
            <View style={styles.simpleBadges}>
                {!!item.category && (
                    <View style={styles.categoryBadge}>
                        <Text style={styles.categoryText}>{item.category}</Text>
                    </View>
                )}
                {String(item.priority).toUpperCase() === 'HIGH' && (
                    <View style={styles.priorityBadge}>
                        <Text style={styles.priorityText}>PRIORIDAD ALTA</Text>
                    </View>
                )}
            </View>
        </View>
        <TouchableOpacity style={styles.moveBtn} onPress={onMove} activeOpacity={0.7}>
            <Text style={styles.moveBtnText}>{moveLabel}</Text>
            <ArrowRight size={12} color={tokens.text.muted} />
        </TouchableOpacity>
    </View>
    );
};

const makeStyles = (tokens: ThemeTokens) => StyleSheet.create({
    container: { flex: 1, backgroundColor: tokens.bg.page },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: tokens.border.subtle,
    },
    backBtn: { padding: 8 },
    headerTitleContainer: { flex: 1, alignItems: 'center' },
    headerTitle: { color: tokens.text.primary, fontSize: 16, fontWeight: '900', letterSpacing: 2 },
    headerSub: { color: tokens.accent.indigo, fontSize: 11, fontWeight: '800', marginTop: 2 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    emptyTitle: { color: tokens.text.primary, fontSize: 18, fontWeight: '800', marginTop: 16 },
    emptyText: { color: tokens.text.muted, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },

    laneHeaderWrap: { marginTop: 24, marginBottom: 10 },
    laneHeaderRow: { flexDirection: 'row', alignItems: 'center' },
    laneTitle: { fontSize: 13, fontWeight: '900', letterSpacing: 2, marginLeft: 8 },
    laneCount: { marginLeft: 10, minWidth: 22, height: 20, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
    laneCountText: { fontSize: 11, fontWeight: '800' },
    laneHint: { color: tokens.text.disabled, fontSize: 12, marginTop: 4, lineHeight: 16 },
    laneEmpty: { color: tokens.text.disabled, fontSize: 13, fontStyle: 'italic', paddingVertical: 8, lineHeight: 18 },

    returnCard: {
        backgroundColor: tokens.bg.card,
        borderRadius: 18,
        padding: 18,
        marginBottom: 12,
        borderWidth: 1,
        borderLeftWidth: 3,
        borderColor: tokens.accent.redSoft,
        borderLeftColor: tokens.accent.red,
    },
    returnTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    themeChip: { backgroundColor: tokens.accent.redSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    themeChipText: { color: tokens.accent.red, fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
    recurrenceText: { color: tokens.accent.red, fontSize: 11, fontWeight: '800' },
    avoidanceText: { color: tokens.text.primary, fontSize: 16, fontWeight: '600', lineHeight: 23 },
    returnDivider: { height: 1, backgroundColor: tokens.border.subtle, marginVertical: 14 },
    nextLabel: { color: tokens.text.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 4 },
    nextTask: { color: tokens.text.secondary, fontSize: 14, lineHeight: 20 },
    closeBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        marginTop: 16, paddingVertical: 11, borderRadius: 12,
        backgroundColor: tokens.accent.greenSoft, borderWidth: 1, borderColor: tokens.accent.green,
    },
    closeBtnText: { color: tokens.accent.green, fontSize: 14, fontWeight: '800', marginLeft: 8 },

    simpleCard: {
        backgroundColor: tokens.bg.card,
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: tokens.border.subtle,
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkbox: {
        width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: tokens.border.strong,
        alignItems: 'center', justifyContent: 'center', marginRight: 14,
    },
    simpleTask: { color: tokens.text.primary, fontSize: 15, fontWeight: '600', marginBottom: 6, lineHeight: 20 },
    simpleBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    categoryBadge: { backgroundColor: tokens.border.subtle, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    categoryText: { color: tokens.text.muted, fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
    priorityBadge: { backgroundColor: tokens.accent.redSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    priorityText: { color: tokens.accent.red, fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
    moveBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, marginLeft: 8 },
    moveBtnText: { color: tokens.text.muted, fontSize: 12, fontWeight: '700', marginRight: 4 },
});
