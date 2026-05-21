import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView,
    TouchableOpacity, ActivityIndicator, StatusBar, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Zap, RefreshCw, Sun, Clock, Check, ArrowRight } from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SupabaseService } from '../services/SupabaseService';
import { useAuth } from '../context/AuthContext';

type Lane = 'regresa' | 'hoy' | 'rondando';

const laneOf = (it: any): Lane => {
    const s = String(it?.status ?? 'hoy');
    return s === 'regresa' || s === 'rondando' ? (s as Lane) : 'hoy';
};

export default function LoopsScreen() {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
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

    const CL = ChevronLeft as any;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <CL color="white" size={28} />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>ACTIVE LOOPS</Text>
                    <Text style={styles.headerSub}>
                        {loading ? 'Cargando…' : `${items.length} abiertos`}
                    </Text>
                </View>
                <View style={{ width: 44 }} />
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#6366f1" />
                </View>
            ) : items.length === 0 ? (
                <View style={styles.center}>
                    <Zap size={48} color="#334155" />
                    <Text style={styles.emptyTitle}>Sin loops abiertos</Text>
                    <Text style={styles.emptyText}>
                        Cuando registres una memoria o converses en el chat, los
                        accionables que detecte BLACKBOX aparecerán aquí para que
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
                            tintColor="#6366f1"
                        />
                    }
                >
                    {/* ── REGRESAN — the differentiator ───────────────── */}
                    <LaneHeader
                        icon={<RefreshCw size={15} color="#f87171" />}
                        title="REGRESAN"
                        count={regresan.length}
                        color="#f87171"
                        hint="Lo que sigues evitando. No es falta de tiempo — es lo que cuesta enfrentar."
                    />
                    {regresan.length === 0 ? (
                        <Text style={styles.laneEmpty}>
                            Nada diagnosticado como evasión todavía. Aparece cuando el
                            análisis de patrones detecta un loop que llevas evitando.
                        </Text>
                    ) : (
                        regresan.map(it => (
                            <ReturnCard key={it.id} item={it} onClose={() => closeItem(it.id)} />
                        ))
                    )}

                    {/* ── HOY ─────────────────────────────────────────── */}
                    <LaneHeader
                        icon={<Sun size={15} color="#fbbf24" />}
                        title="HOY"
                        count={hoy.length}
                        color="#fbbf24"
                        hint="Lo que cierras hoy. Pocos, no todos."
                    />
                    {hoy.length === 0 ? (
                        <Text style={styles.laneEmpty}>Sin loops marcados para hoy.</Text>
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
                        icon={<Clock size={15} color="#818cf8" />}
                        title="RONDANDO"
                        count={rondando.length}
                        color="#818cf8"
                        hint="Te da vueltas, pero no es de hoy."
                    />
                    {rondando.length === 0 ? (
                        <Text style={styles.laneEmpty}>Sin loops rondando.</Text>
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
}) => (
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

const ReturnCard = ({ item, onClose }: { item: any; onClose: () => void | Promise<void> }) => (
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
            <Check size={16} color="#10b981" />
            <Text style={styles.closeBtnText}>Cerrar este loop</Text>
        </TouchableOpacity>
    </View>
);

const SimpleCard = ({ item, onClose, moveLabel, onMove }: {
    item: any; onClose: () => void | Promise<void>; moveLabel: string; onMove: () => void | Promise<void>;
}) => (
    <View style={styles.simpleCard}>
        <TouchableOpacity style={styles.checkbox} onPress={onClose} activeOpacity={0.7}>
            <Check size={14} color="#64748b" />
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
            <ArrowRight size={12} color="#94a3b8" />
        </TouchableOpacity>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#020617' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    backBtn: { padding: 8 },
    headerTitleContainer: { flex: 1, alignItems: 'center' },
    headerTitle: { color: 'white', fontSize: 16, fontWeight: '900', letterSpacing: 2 },
    headerSub: { color: '#6366f1', fontSize: 11, fontWeight: '800', marginTop: 2 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    emptyTitle: { color: 'white', fontSize: 18, fontWeight: '800', marginTop: 16 },
    emptyText: { color: '#64748b', fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },

    laneHeaderWrap: { marginTop: 24, marginBottom: 10 },
    laneHeaderRow: { flexDirection: 'row', alignItems: 'center' },
    laneTitle: { fontSize: 13, fontWeight: '900', letterSpacing: 2, marginLeft: 8 },
    laneCount: { marginLeft: 10, minWidth: 22, height: 20, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
    laneCountText: { fontSize: 11, fontWeight: '800' },
    laneHint: { color: '#475569', fontSize: 12, marginTop: 4, lineHeight: 16 },
    laneEmpty: { color: '#475569', fontSize: 13, fontStyle: 'italic', paddingVertical: 8, lineHeight: 18 },

    returnCard: {
        backgroundColor: '#1a1020',
        borderRadius: 18,
        padding: 18,
        marginBottom: 12,
        borderWidth: 1,
        borderLeftWidth: 3,
        borderColor: 'rgba(248,113,113,0.18)',
        borderLeftColor: '#f87171',
    },
    returnTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    themeChip: { backgroundColor: 'rgba(248,113,113,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    themeChipText: { color: '#fca5a5', fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
    recurrenceText: { color: '#f87171', fontSize: 11, fontWeight: '800' },
    avoidanceText: { color: '#f8fafc', fontSize: 16, fontWeight: '600', lineHeight: 23 },
    returnDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 14 },
    nextLabel: { color: '#64748b', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 4 },
    nextTask: { color: '#cbd5e1', fontSize: 14, lineHeight: 20 },
    closeBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        marginTop: 16, paddingVertical: 11, borderRadius: 12,
        backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)',
    },
    closeBtnText: { color: '#10b981', fontSize: 14, fontWeight: '800', marginLeft: 8 },

    simpleCard: {
        backgroundColor: '#151B33',
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkbox: {
        width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#334155',
        alignItems: 'center', justifyContent: 'center', marginRight: 14,
    },
    simpleTask: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 6, lineHeight: 20 },
    simpleBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    categoryBadge: { backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    categoryText: { color: '#94a3b8', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
    priorityBadge: { backgroundColor: 'rgba(239,68,68,0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    priorityText: { color: '#ef4444', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
    moveBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, marginLeft: 8 },
    moveBtnText: { color: '#94a3b8', fontSize: 12, fontWeight: '700', marginRight: 4 },
});
