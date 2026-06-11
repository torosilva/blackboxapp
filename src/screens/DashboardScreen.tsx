import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    ActivityIndicator,
    RefreshControl,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { ChevronLeft, User, Heart, MessageSquare } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { SupabaseService } from '../services/SupabaseService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WhatsNewModal from '../components/WhatsNewModal';
import { useTheme } from '../theme/ThemeContext';
import { ThemeTokens } from '../theme/tokens';
import { useLoopStats } from '../hooks/useLoopStats';

const DashboardScreen = () => {
    const { tokens } = useTheme();
    const styles = useMemo(() => makeStyles(tokens), [tokens]);
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { user, profile } = useAuth();
    const { stats: loopStats, refresh: refreshLoopStats } = useLoopStats(user?.id);
    const isFocused = useIsFocused();
    
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({
        totalMemories: 0,
        activeLoops: 0,
        completedGoals: 0,
        totalGoals: 0,
        goalPercentage: 0,
        latestEntry: null as any
    });
    const [recentThreads, setRecentThreads] = useState<any[]>([]);
    const [stalledLoopsPct, setStalledLoopsPct] = useState(0);
    const [patterns, setPatterns] = useState<any[]>([]);
    const [onboardingChecked, setOnboardingChecked] = useState(false);
    const [goalsList, setGoalsList] = useState<any[]>([]);
    const [captureRhythm, setCaptureRhythm] = useState<{ thisWeek: number; weeklyAverage: number; streak: number }>({
        thisWeek: 0, weeklyAverage: 0, streak: 0
    });
    const [monthlyUsage, setMonthlyUsage] = useState<{ chats: number; searches: number; reflexes: number }>({
        chats: 0, searches: 0, reflexes: 0
    });
    useEffect(() => {
        if (isFocused && user && !onboardingChecked) {
            fetchStats();
            checkOnboarding();
            setOnboardingChecked(true);
        } else if (isFocused && user) {
            fetchStats();
        }
    }, [isFocused, user, onboardingChecked]);

    // Sincroniza activeLoops y stalledLoopsPct con el hook compartido cada
    // vez que sus stats cambian (mount inicial, refresh manual, focus).
    // Aísla la ventana en la que `loopStats` aún es null para que la UI
    // no quede pegada con el valor de fetchStats() inicial.
    useEffect(() => {
        if (!loopStats) return;
        setStats(prev => ({ ...prev, activeLoops: loopStats.open }));
        setStalledLoopsPct(loopStats.open > 0 ? Math.round((loopStats.stalled / loopStats.open) * 100) : 0);
    }, [loopStats]);

    const checkOnboarding = async () => {
        try {
            const hasHidden = await AsyncStorage.getItem('HIDE_GUIDE');
            if (hasHidden !== 'true') {
                navigation.navigate('Onboarding');
            }
        } catch (e) {
            console.error('Error checking onboarding state', e);
        }
    };

    const fetchStats = async () => {
        if (!user) return;
        setRefreshing(true);
        try {
            console.log('DASHBOARD: Fetching strategic stats for user:', user.id);
            
            // ── 1. Fetch Consolidated Historical Context (New Standard) ──────
            const history = await SupabaseService.getHistoricalContext(user.id);
            
            // ── 2. Fetch real goals from separate table ────────────────────────
            const goals = await SupabaseService.getGoals(user.id);
            const totalGoals = goals ? goals.length : 0;
            const completedGoals = goals ? goals.filter((g: any) => g.is_completed).length : 0;
            const goalPercent = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;
            setGoalsList(goals || []);

            // ── 3. Fetch entries for Interventions list ────────────────────────
            const entries = await SupabaseService.getEntries(user.id);
            
            // activeLoops y stalledLoopsPct los maneja el useEffect[loopStats]
            // — misma fuente que home y LoopsScreen (hook compartido). Aquí
            // solo disparamos el refresh para pull-to-refresh; el set lo hace
            // el efecto en cuanto loopStats actualiza.
            refreshLoopStats();
            setStats(prev => ({
                ...prev,
                totalMemories: history.totalEntries,
                completedGoals: completedGoals,
                totalGoals: totalGoals,
                goalPercentage: goalPercent,
                latestEntry: entries && entries.length > 0 ? entries[0] : null
            }));

            // ── 5. Fetch recent threads ────────────────────────────────────────
            const threads = await SupabaseService.getChatThreads(user.id);
            if (threads) {
                setRecentThreads(threads.slice(0, 3));
            }

            // ── 6. Fetch detected patterns ──────────────────────────────────────
            const pats = await SupabaseService.getUserPatterns(user.id);
            setPatterns(pats || []);

            // ── 7. Capture rhythm (this week / weekly avg / streak) ─────────────
            const rhythm = await SupabaseService.getCaptureRhythm(user.id);
            setCaptureRhythm(rhythm);

            // ── 8. Monthly AI usage counters ────────────────────────────────────
            const usage = await SupabaseService.getMonthlyUsage(user.id);
            setMonthlyUsage(usage);

        } catch (error) {
            console.error('DASHBOARD_FETCH_ERROR:', error);
            setLoading(false);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const SAV = SafeAreaView as any;

    if (loading && !refreshing) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={tokens.accent.indigo} />
            </View>
        );
    }

    // Goal categorisation: a goal is "en riesgo" when due within the next
    // 7 days (overdue counts as at risk too). Everything else active
    // (future-due or no due date) is "en curso".
    const todayRef = new Date();
    const sevenDaysAhead = new Date(todayRef.getTime() + 7 * 24 * 60 * 60 * 1000);
    const activeGoalsList = goalsList.filter((g: any) => !g.is_completed);
    const goalsEnRiesgo = activeGoalsList.filter((g: any) => {
        if (!g.due_date) return false;
        return new Date(g.due_date) <= sevenDaysAhead;
    }).length;
    const goalsEnCurso = activeGoalsList.length - goalsEnRiesgo;

    return (
        <>
        <SAV style={styles.container}>
            <StatusBar barStyle={tokens.statusBar} />
            <ScrollView
                style={styles.scroll}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={fetchStats} tintColor={tokens.accent.indigo} />
                }
            >
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <ChevronLeft size={28} color={tokens.text.primary} />
                    </TouchableOpacity>
                    <Text style={[styles.vistaHeader, {flex: 1, textAlign: 'center', marginRight: 32, marginBottom: 0}]}>Dashboard Estratégico</Text>
                </View>

                {/* ESTADO ACTUAL — compact one-liner */}
                <View style={styles.vistaCard}>
                    <Text style={styles.vistaCardTitle}>ESTADO ACTUAL</Text>
                    <Text style={styles.vistaLine}>
                        {stats.activeLoops} pendientes abiertos · {stalledLoopsPct}% sin avance &gt;14 días
                    </Text>
                </View>

                {/* PROGRESO A METAS */}
                <View style={styles.vistaCard}>
                    <Text style={styles.vistaCardTitle}>PROGRESO A METAS</Text>
                    <View style={styles.vistaGoalsRow}>
                        <Text style={styles.vistaBigNumber}>{stats.completedGoals} / {stats.totalGoals}</Text>
                        <Text style={styles.vistaSubPercent}>{stats.goalPercentage}%</Text>
                    </View>
                    <Text style={styles.vistaLine}>
                        En curso: {goalsEnCurso} · En riesgo: {goalsEnRiesgo}
                    </Text>
                </View>

                {/* PATRONES DETECTADOS */}
                <View style={styles.vistaCard}>
                    <Text style={styles.vistaCardTitle}>PATRONES DETECTADOS</Text>
                    {patterns.length === 0 ? (
                        <Text style={styles.vistaEmpty}>Sin patrones detectados aún.</Text>
                    ) : (
                        patterns.slice(0, 5).map((p: any) => (
                            <Text key={p.id} style={styles.vistaPatternItem}>
                                → {p.title} ({p.frequency} entradas)
                            </Text>
                        ))
                    )}
                    {patterns.length > 5 && (
                        <TouchableOpacity onPress={() => Alert.alert('Patrones detectados', patterns.map((p:any) => '→ ' + p.title + ' (' + p.frequency + ' entradas)').join('\n\n'))} style={styles.verMasBtn}>
                            <Text style={styles.verMasText}>Ver más ({patterns.length - 5})</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* RITMO DE CAPTURA */}
                <View style={styles.vistaCard}>
                    <Text style={styles.vistaCardTitle}>RITMO DE CAPTURA</Text>
                    <Text style={styles.vistaLine}>
                        Esta semana: {captureRhythm.thisWeek} · Promedio: {captureRhythm.weeklyAverage}/sem · Streak: {captureRhythm.streak} días
                    </Text>
                </View>

                {/* USO ESTE MES */}
                <View style={styles.vistaCard}>
                    <Text style={styles.vistaCardTitle}>USO ESTE MES</Text>
                    <Text style={styles.vistaLine}>
                        Chats: {monthlyUsage.chats} · Búsquedas: {monthlyUsage.searches} · Reflejos: {monthlyUsage.reflexes}
                    </Text>
                </View>

                {/* HISTORIAL DE CHATS */}
                {recentThreads.length > 0 && (
                    <View style={styles.vistaCard}>
                        <View style={styles.vistaHistorialHeader}>
                            <Text style={styles.vistaCardTitle}>HISTORIAL DE CHATS</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('ChatHub' as any)}>
                                <Text style={styles.vistaSeeAll}>Ver todos</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingTop: 12 }}>
                            {recentThreads.map((thread) => {
                                let iconColor = tokens.text.link;
                                let Icon: any = MessageSquare;
                                if (thread.category === 'BUSINESS') iconColor = tokens.text.link;
                                else if (thread.category === 'PERSONAL') { iconColor = tokens.accent.yellow; Icon = User; }
                                else if (thread.category === 'HEALTH') { iconColor = tokens.accent.green; Icon = Heart; }
                                return (
                                    <TouchableOpacity
                                        key={thread.id}
                                        style={styles.chatCard}
                                        onPress={() => navigation.navigate('Chat' as any, {
                                            threadId: thread.id, category: thread.category, title: thread.title
                                        })}
                                    >
                                        <View style={[styles.chatIconContainer, { backgroundColor: `${iconColor}20` }]}>
                                            <Icon size={18} color={iconColor} />
                                        </View>
                                        <Text style={styles.chatCardTitle} numberOfLines={1}>{thread.title}</Text>
                                        <Text style={styles.chatCardDate}>{new Date(thread.updated_at).toLocaleDateString()}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                )}
            </ScrollView>
        </SAV>
        <WhatsNewModal />
        </>
    );
};

const makeStyles = (tokens: ThemeTokens) => StyleSheet.create({
    headerRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 4, marginBottom: 16 },
    backBtn: { padding: 6 },
    verMasBtn: { marginTop: 12, alignSelf: 'flex-start' },
    verMasText: { color: tokens.accent.indigo, fontSize: 13, fontWeight: '700' },
    container: { flex: 1, backgroundColor: tokens.bg.page },
    loadingContainer: { flex: 1, backgroundColor: tokens.bg.page, justifyContent: 'center', alignItems: 'center' },
    scroll: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: 20,
        paddingTop: 0,
        marginBottom: 20
    },
    greeting: { color: tokens.text.muted, fontSize: 16, fontWeight: '500' },
    userName: { color: tokens.text.primary, fontSize: 24, fontWeight: 'bold' },
    profileBtn: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: tokens.bg.input,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: tokens.border.subtle
    },
    headerBrainCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: tokens.accent.indigo,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 10
    },
    headerLogoContainer: {
        flex: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerLogo: {
        width: 120,
        height: 40,
    },
    statsGrid: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        gap: 12,
        marginBottom: 30
    },
    statCard: { flex: 1, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: tokens.border.subtle },
    cardGradient: { padding: 16, alignItems: 'center' },
    statValue: { color: tokens.text.primary, fontSize: 22, fontWeight: 'bold', marginVertical: 4 },
    statLabel: { color: tokens.text.muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    insightSection: {
        marginHorizontal: 24,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: tokens.accent.indigoSoft,
        marginBottom: 30
    },
    insightGradient: { padding: 24 },
    insightHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
    insightTitle: { color: tokens.text.link, fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
    latestMood: { color: tokens.text.muted, fontSize: 14, marginBottom: 8 },
    latestInsight: { color: tokens.text.secondary, fontSize: 15, lineHeight: 22, fontStyle: 'italic' },
    actionArea: { paddingHorizontal: 24, gap: 16 },
    mainBtn: { borderRadius: 18, overflow: 'hidden', elevation: 8, shadowColor: tokens.accent.indigo, shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3, shadowRadius: 10 },
    btnGradient: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 20 },
    mainBtnText: { color: tokens.text.primary, fontSize: 17, fontWeight: 'bold' },
    dateSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: tokens.border.subtle,
        padding: 15,
        borderRadius: 16,
        marginTop: 15,
        borderWidth: 1,
        borderColor: tokens.border.subtle
    },
    dateText: {
        color: tokens.text.primary,
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 10
    },
    secondaryBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tokens.bg.input,
        paddingVertical: 14,
        borderRadius: 16,
        gap: 10,
        borderWidth: 1,
        borderColor: tokens.border.subtle
    },
    secondaryBtnText: { color: tokens.text.secondary, fontSize: 14, fontWeight: '600' },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 40,
        marginBottom: 40,
        gap: 6
    },
    lastUpdate: { color: tokens.text.disabled, fontSize: 12, fontWeight: '500' },
    recentChatsSection: { marginBottom: 30 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 15 },
    sectionTitle: { color: tokens.accent.indigo, fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
    viewMoreText: { color: tokens.text.muted, fontSize: 12, fontWeight: '600' },
    recentChatsScroll: { paddingHorizontal: 24, gap: 12 },
    chatCard: {
        width: 150,
        backgroundColor: tokens.bg.input,
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: tokens.border.subtle
    },
    chatIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10
    },
    chatCardTitle: { color: tokens.text.primary, fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
    chatCardDate: { color: tokens.text.disabled, fontSize: 11, fontWeight: '500' },
    seedBtn: {
        marginTop: 15,
        backgroundColor: tokens.accent.indigo,
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 12,
        alignSelf: 'flex-start'
    },
    seedBtnText: {
        color: tokens.text.onAccent,
        fontSize: 13,
        fontWeight: 'bold'
    },
    guideActionBtn: {
        backgroundColor: tokens.accent.yellow,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
    },
    guideActionBtnText: {
        color: tokens.bg.page,
        fontSize: 13,
        fontWeight: '900',
    },
    quickCaptureBanner: {
        borderRadius: 24,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: tokens.accent.indigo,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
    },
    quickCaptureGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
    },
    quickCaptureIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    quickCaptureTitle: {
        color: tokens.text.primary,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    quickCaptureSubtitle: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        fontWeight: '500',
    },
    interventionSection: {
        marginHorizontal: 20,
        marginBottom: 20,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#7f1d1d'
    },
    interventionGradient: {
        padding: 24,
    },
    interventionText: {
        color: tokens.text.secondary,
        fontSize: 15,
        lineHeight: 22,
        marginTop: 10,
    },
    interventionPunchline: {
        color: tokens.accent.red,
        fontSize: 13,
        fontWeight: '600',
        fontStyle: 'italic',
        marginTop: 8,
    },
    interventionBtn: {
        backgroundColor: tokens.accent.red,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
        marginTop: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'flex-start'
    },
    interventionBtnText: {
        color: '#000',
        fontWeight: '900',
        fontSize: 13,
        marginRight: 6
    },
    reportGrid: {
        flexDirection: 'row',
        marginTop: 15,
        marginBottom: 15
    },
    reportItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10
    },
    reportValue: {
        color: tokens.text.primary,
        fontSize: 20,
        fontWeight: 'bold'
    },
    reportLabel: {
        color: tokens.text.muted,
        fontSize: 10,
        fontWeight: '600',
        marginTop: 4,
        textTransform: 'uppercase'
    },
    reportVerdict: {
        color: tokens.text.secondary,
        fontSize: 13,
        lineHeight: 18,
        fontStyle: 'italic',
        textAlign: 'center',
        backgroundColor: tokens.bg.scrim,
        padding: 10,
        borderRadius: 12
    },
    membershipBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        borderWidth: 1.5,
        marginLeft: 15,
        marginTop: 12,
        alignSelf: 'center'
    },
    freeBadge: {
        backgroundColor: tokens.border.subtle,
        borderColor: tokens.text.disabled,
    },
    proBadge: {
        backgroundColor: tokens.accent.indigoSoft,
        borderColor: tokens.text.link,
    },
    membershipBadgeText: {
        fontSize: 11,
        fontWeight: 'bold',
        letterSpacing: 1,
        color: tokens.text.primary
    },

    // ─── Vista Estratégica refactor (2026-05) ─────────────────────────────
    vistaHeader: {
        color: tokens.text.primary,
        fontSize: 22,
        fontWeight: '700',
        letterSpacing: 0.3,
        marginBottom: 16,
    },
    vistaCard: {
        backgroundColor: tokens.bg.card,
        borderColor: tokens.border.default,
        borderWidth: 1.5,
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
        shadowColor: tokens.shadow.color,
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
    },
    vistaCardTitle: {
        color: tokens.text.muted,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1.8,
        marginBottom: 10,
    },
    vistaLine: {
        color: tokens.text.primary,
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '500',
    },
    vistaGoalsRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 10,
        marginBottom: 6,
    },
    vistaBigNumber: {
        color: tokens.text.primary,
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    vistaSubPercent: {
        color: tokens.accent.green,
        fontSize: 16,
        fontWeight: '700',
    },
    vistaEmpty: {
        color: tokens.text.muted,
        fontSize: 13,
        fontStyle: 'italic',
    },
    vistaPatternItem: {
        color: tokens.text.primary,
        fontSize: 14,
        lineHeight: 22,
        fontWeight: '500',
        marginBottom: 2,
    },
    vistaHistorialHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    vistaSeeAll: {
        color: tokens.text.link,
        fontSize: 12,
        fontWeight: '700',
    },
});

export default DashboardScreen;
