import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    ActivityIndicator,
    Image,
    Platform,
    RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { 
    Target, 
    Zap, 
    Brain, 
    ChevronRight, 
    LayoutDashboard, 
    Sparkles,
    CheckCircle2,
    Clock,
    User,
    Briefcase,
    Heart,
    MessageSquare,
    MessageCircle,
    Mic,
    AlertTriangle,
    ShieldAlert,
    Stethoscope,
    Box,
    Calendar
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { SupabaseService } from '../services/SupabaseService';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { 
    useSharedValue, 
    useAnimatedStyle, 
    withRepeat, 
    withSequence, 
    withTiming, 
    withDelay 
} from 'react-native-reanimated';

const DashboardScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { user, profile } = useAuth();
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
    const [interventions, setInterventions] = useState<any[]>([]);
    const [onboardingChecked, setOnboardingChecked] = useState(false);
    const [appointmentDate, setAppointmentDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    
    // Animation shared values
    const floatValue = useSharedValue(0);
    const pulseValue = useSharedValue(1);

    useEffect(() => {
        if (isFocused && user && !onboardingChecked) {
            fetchStats();
            checkOnboarding();
            setOnboardingChecked(true);
        } else if (isFocused && user) {
            fetchStats();
        }
    }, [isFocused, user, onboardingChecked]);

    useEffect(() => {
        // Subtle floating / breathing animation
        floatValue.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 2500 }),
                withTiming(0, { duration: 2500 })
            ),
            -1,
            true
        );
        pulseValue.value = withRepeat(
            withTiming(1.05, { duration: 1500 }),
            -1,
            true
        );
    }, []);

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
            console.log('DASHBOARD: Fetching stats for user:', user.id);
            const data = await SupabaseService.getEntries(user.id);
            let pending = 0;
            if (data) {
                console.log('DASHBOARD: Data received, count:', data.length);
                pending = data.reduce((acc: number, entry: any) => {
                    const tasks = entry.action_items || [];
                    return acc + tasks.filter((t: any) => !t.is_completed).length;
                }, 0);
            }

            // Fetch real goals from separate table
            const goals = await SupabaseService.getGoals(user.id);
            const totalGoals = goals ? goals.length : 0;
            const completedGoals = goals ? goals.filter((g: any) => g.is_completed).length : 0;
            const goalPercent = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;

            const latestEntry = data && data.length > 0 ? data[0] : null;
            setStats({
                totalMemories: data ? data.length : 0,
                activeLoops: pending,
                completedGoals: completedGoals,
                totalGoals: totalGoals,
                goalPercentage: goalPercent,
                latestEntry: latestEntry
            });

            // Calculate Interventions (HIGH priority > 72h)
            if (data) {
                const now = new Date().getTime();
                const overdues: any[] = [];
                data.forEach((entry: any) => {
                    const entryDate = new Date(entry.created_at).getTime();
                    const diffDays = (now - entryDate) / (1000 * 60 * 60 * 24);
                    
                    if (diffDays >= 3 && Array.isArray(entry.action_items)) {
                        entry.action_items.forEach((item: any) => {
                            if (item.priority === 'HIGH' && !item.is_completed) {
                                overdues.push({ 
                                    ...item, 
                                    entryId: entry.id,
                                    entryTitle: entry.title,
                                    days: Math.floor(diffDays)
                                });
                            }
                        });
                    }
                });
                setInterventions(overdues.slice(0, 2)); // Show top 2 interventions
            }

            // Fetch recent threads
            const threads = await SupabaseService.getChatThreads(user.id);
            if (threads) {
                setRecentThreads(threads.slice(0, 3));
            }
        } catch (error) {
            console.error('DASHBOARD_FETCH_ERROR:', error);
            // Ensure we stop loading even on error
            setLoading(false);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleSeedSample = async () => {
        if (!user) return;
        setLoading(true);
        try {
            await SupabaseService.seedWelcomeEntry(user.id);
            await fetchStats();
        } catch (error) {
            console.error('DASHBOARD: Error seeding sample:', error);
        } finally {
            setLoading(false);
        }
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Buenos días';
        if (hour < 18) return 'Buenas tardes';
        return 'Buenas noches';
    };
    
    const onDateChange = (event: any, selectedDate?: Date) => {
        setShowDatePicker(false);
        if (selectedDate) {
            setAppointmentDate(selectedDate);
        }
    };

    const TO = TouchableOpacity as any;
    const SAV = SafeAreaView as any;
    const LG = LinearGradient as any;

    const animatedLogoStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateY: floatValue.value * -8 },
                { scale: pulseValue.value }
            ],
            opacity: 0.9
        };
    });

    if (loading && !refreshing) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#6366f1" />
            </View>
        );
    }

    return (
        <SAV style={styles.container}>
            <StatusBar barStyle="light-content" />
            <ScrollView 
                style={styles.scroll} 
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={fetchStats} tintColor="#6366f1" />
                }
            >
                {/* Header Section (v5.9.6 Logo & Name Restoration) */}
                <View style={[styles.header, { paddingHorizontal: 20, paddingTop: 10 }]}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ marginRight: 12 }}>
                            <Text style={styles.greeting}>{getGreeting()},</Text>
                            <Text style={[styles.userName, { fontSize: 26, letterSpacing: -0.5 }]}>
                                {profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Explorador'}
                            </Text>
                        </View>
                        
                        <TouchableOpacity 
                            onPress={() => !profile?.is_pro && navigation.navigate('InvitationCode')}
                            activeOpacity={0.7}
                            style={[
                                styles.membershipBadge, 
                                profile?.is_pro ? styles.proBadge : styles.freeBadge
                            ]}
                        >
                            <Text style={styles.membershipBadgeText}>{profile?.is_pro ? 'PRO' : 'FREE'}</Text>
                        </TouchableOpacity>
                    </View>
                    
                    <TO 
                        onPress={() => navigation.navigate('Settings', { initialViewMode: 'hub' })}
                        style={{ alignItems: 'flex-end', justifyContent: 'flex-start' }}
                    >
                        <Animated.View style={animatedLogoStyle}>
                            <View style={{ width: 50, height: 50, justifyContent: 'center', alignItems: 'center' }}>
                                {/* Core Cube */}
                                <Box size={24} color="#818cf8" strokeWidth={2} style={{ position: 'absolute' }} />
                                {/* Brain Overlay */}
                                <Brain size={44} color="#a855f7" strokeWidth={1.5} />
                            </View>
                        </Animated.View>
                    </TO>
                </View>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    <TO style={styles.statCard} onPress={() => navigation.navigate('Home')}>
                        <LG colors={['#1e293b', '#0f172a']} style={styles.cardGradient}>
                            <Brain size={20} color="#6366f1" />
                            <Text style={styles.statValue}>{stats.totalMemories}</Text>
                            <Text style={styles.statLabel}>Memorias</Text>
                        </LG>
                    </TO>
                    <TO style={styles.statCard} onPress={() => navigation.navigate('Settings', { initialViewMode: 'pending' })}>
                        <LG colors={['#1e293b', '#0f172a']} style={styles.cardGradient}>
                            <Zap size={20} color="#facc15" />
                            <Text style={styles.statValue}>{stats.activeLoops}</Text>
                            <Text style={styles.statLabel}>Active Loops</Text>
                        </LG>
                    </TO>
                    <TO style={styles.statCard} onPress={() => navigation.navigate('Settings', { initialViewMode: 'hub' })}>
                        <LG colors={['#1e293b', '#0f172a']} style={styles.cardGradient}>
                            <CheckCircle2 size={20} color="#10b981" />
                            <Text style={stats.goalPercentage === 100 && stats.totalGoals > 0 ? [styles.statValue, { color: '#10b981' }] : styles.statValue}>
                                {stats.completedGoals}/{stats.totalGoals}
                            </Text>
                            <Text style={styles.statLabel}>Metas ({stats.goalPercentage}%)</Text>
                        </LG>
                    </TO>
                </View>

                {/* QuickCapture Banner (v5.9.7 - NEW PROMINENT LOCATION) */}
                <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
                    <TO 
                        onPress={() => navigation.navigate('QuickCapture')}
                        activeOpacity={0.8}
                        style={styles.quickCaptureBanner}
                    >
                        <LG colors={['#6366f1', '#4f46e5']} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.quickCaptureGradient}>
                            <View style={styles.quickCaptureIconContainer}>
                                <Mic size={24} color="white" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.quickCaptureTitle}>Capturar Pensamiento</Text>
                                <Text style={styles.quickCaptureSubtitle}>Libera tu sobrecarga mental ahora</Text>
                            </View>
                            <ChevronRight size={20} color="white" />
                        </LG>
                    </TO>
                </View>

                {/* Strategic Analysis Report Box (v5.9.6 - MOVED UP) */}
                <View style={[styles.insightSection, { marginTop: 0, marginBottom: 20, borderColor: 'rgba(168, 85, 247, 0.4)' }]}>
                    <LG colors={['rgba(168, 85, 247, 0.15)', 'rgba(0, 0, 0, 0)']} style={styles.insightGradient}>
                        <View style={styles.insightHeader}>
                           <Stethoscope size={16} color="#a855f7" />
                           <Text style={[styles.insightTitle, { color: '#a855f7' }]}>REPORTE MÉTRICO ESTRATÉGICO</Text>
                        </View>
                        <View style={styles.reportGrid}>
                            <View style={styles.reportItem}>
                                <Text style={styles.reportValue}>{stats.totalMemories > 0 ? Math.round((stats.completedGoals / stats.totalMemories) * 100) : 0}%</Text>
                                <Text style={styles.reportLabel}>Ratio de Ejecución</Text>
                            </View>
                            <View style={[styles.reportItem, { borderLeftWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }]}>
                                <Text style={styles.reportValue}>{stats.activeLoops}</Text>
                                <Text style={styles.reportLabel}>Sobrecarga Mental</Text>
                            </View>
                        </View>
                        <Text style={styles.reportVerdict}>
                            {stats.activeLoops > 5 ? "⚠️ ALTA: Requiere purga de loops para recuperar claridad." : "✅ ÓPTIMA: Capacidad cognitiva disponible para retos nuevos."}
                        </Text>
                    </LG>
                </View>
 
                {/* Strategic Interventions (Follow-up Agresivo) */}
                {interventions.length > 0 && (
                    <View style={styles.interventionSection}>
                        <LG colors={['#7f1d1d', '#0f172a']} start={{x:0, y:0}} end={{x:1, y:1}} style={styles.interventionGradient}>
                            <View style={styles.insightHeader}>
                                <ShieldAlert size={16} color="#ef4444" />
                                <Text style={[styles.insightTitle, { color: '#ef4444' }]}>INTERVENCIÓN ESTRATÉGICA</Text>
                            </View>
                            <Text style={styles.interventionText}>
                                Llevas <Text style={{fontWeight: 'bold', color: '#f87171'}}>{interventions[0].days} días</Text> procrastinando: 
                                <Text style={{color: '#fff'}}> "{interventions[0].task}"</Text>.
                            </Text>
                            <Text style={styles.interventionPunchline}>
                                Estás comprometiendo tu ventaja competitiva. ¿Qué te detiene?
                            </Text>
                            <TO 
                                style={styles.interventionBtn}
                                onPress={() => navigation.navigate('EntryDetail', { entryId: interventions[0].entryId })}
                            >
                                <Text style={styles.interventionBtnText}>Resolver Ahora</Text>
                                <ChevronRight size={14} color="#000" />
                            </TO>
                        </LG>
                    </View>
                )}


                {/* Recent Conversations */}
                {recentThreads.length > 0 && (
                    <View style={styles.recentChatsSection}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>ÚLTIMOS CHATS</Text>
                            <TO onPress={() => navigation.navigate('ChatHub' as any)}>
                                <Text style={styles.viewMoreText}>Ver todos</Text>
                            </TO>
                        </View>
                        <ScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={false} 
                            contentContainerStyle={styles.recentChatsScroll}
                        >
                            {recentThreads.map((thread) => {
                                let iconColor = '#818cf8';
                                let Icon = MessageSquare;
                                if (thread.category === 'BUSINESS') iconColor = '#818cf8';
                                else if (thread.category === 'PERSONAL') { iconColor = '#facc15'; Icon = User; }
                                else if (thread.category === 'HEALTH') { iconColor = '#10b981'; Icon = Heart; }
                                
                                return (
                                    <TO 
                                        key={thread.id} 
                                        style={styles.chatCard}
                                        onPress={() => navigation.navigate('Chat' as any, {
                                            threadId: thread.id,
                                            category: thread.category,
                                            title: thread.title
                                        })}
                                    >
                                        <View style={[styles.chatIconContainer, { backgroundColor: `${iconColor}20` }]}>
                                            <Icon size={18} color={iconColor} />
                                        </View>
                                        <Text style={styles.chatCardTitle} numberOfLines={1}>{thread.title}</Text>
                                        <Text style={styles.chatCardDate}>{new Date(thread.updated_at).toLocaleDateString()}</Text>
                                    </TO>
                                );
                            })}
                        </ScrollView>
                    </View>
                )}
                {/* Strategic Analysis Section (v5.9.8 - REPLACED ACTION AREA) */}
                <View style={[styles.insightSection, { marginTop: 10 }]}>
                    <LG colors={['rgba(99, 102, 241, 0.1)', 'rgba(0, 0, 0, 0)']} style={styles.insightGradient}>
                        <View style={styles.insightHeader}>
                            <Stethoscope size={20} color="#a855f7" />
                            <Text style={[styles.insightTitle, { color: '#a855f7' }]}>ANÁLISIS ESTRATÉGICO</Text>
                        </View>
                        <Text style={styles.latestInsight}>
                            Genera un reporte detallado de los 7 días previos a tu sesión de rendimiento para maximizar tu ejecución.
                        </Text>
                        
                        <TO style={styles.dateSelector} onPress={() => setShowDatePicker(true)}>
                            <Calendar size={18} color="#94a3b8" />
                            <Text style={styles.dateText}>Fin del reporte: {appointmentDate.toLocaleDateString()}</Text>
                        </TO>

                        {!!showDatePicker && (
                            <DateTimePicker
                                value={appointmentDate}
                                mode="date"
                                display="default"
                                onChange={onDateChange}
                                maximumDate={new Date()}
                            />
                        )}

                        <TO
                            style={[styles.mainBtn, { marginTop: 15 }]}
                            onPress={() => navigation.navigate('WeeklyReport', { reportEndDate: appointmentDate.toISOString() })}
                        >
                            <LG colors={['#6366f1', '#4f46e5']} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.btnGradient}>
                                <Sparkles size={20} color="white" style={{marginRight: 10}} />
                                <Text style={styles.mainBtnText}>Generar Reporte Estratégico</Text>
                                <ChevronRight size={20} color="white" style={{marginLeft: 'auto'}} />
                            </LG>
                        </TO>
                    </LG>
                </View>

                {/* Strategic Guide moved to bottom */}
                <View style={[styles.insightSection, { marginTop: 20 }]}>
                    <LG colors={['rgba(250, 204, 21, 0.1)', 'rgba(0, 0, 0, 0)']} style={styles.insightGradient}>
                        <View style={styles.insightHeader}>
                            <Target size={16} color="#facc15" />
                            <Text style={[styles.insightTitle, { color: '#facc15' }]}>GUÍA ESTRATÉGICA: BLACKBOX</Text>
                        </View>
                        <Text style={styles.latestInsight}>
                            Domina el equilibrio entre Metas y Loops Activos para maximizar tu ejecución clínica.
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 15 }}>
                            <TO style={styles.guideActionBtn} onPress={() => navigation.navigate('Onboarding')}>
                                <Text style={styles.guideActionBtnText}>Ver Guía de Inicio</Text>
                            </TO>
                            {!stats.latestEntry && (
                                <TO style={[styles.guideActionBtn, { backgroundColor: '#1e293b' }]} onPress={handleSeedSample}>
                                    <Text style={[styles.guideActionBtnText, { color: '#94a3b8' }]}>Cargar Ejemplo</Text>
                                </TO>
                            )}
                        </View>
                    </LG>
                </View>
                <View style={styles.footer}>
                    <Clock size={14} color="#475569" />
                    <Text style={styles.lastUpdate}>Actualizado hace un momento</Text>
                </View>
            </ScrollView>
        </SAV>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#020617' },
    loadingContainer: { flex: 1, backgroundColor: '#020617', justifyContent: 'center', alignItems: 'center' },
    scroll: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: 20,
        paddingTop: 0,
        marginBottom: 20
    },
    greeting: { color: '#94a3b8', fontSize: 16, fontWeight: '500' },
    userName: { color: '#ffffff', fontSize: 24, fontWeight: 'bold' },
    profileBtn: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#1e293b',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)'
    },
    headerBrainCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#6366f1',
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
    statCard: { flex: 1, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    cardGradient: { padding: 16, alignItems: 'center' },
    statValue: { color: '#ffffff', fontSize: 22, fontWeight: 'bold', marginVertical: 4 },
    statLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    insightSection: {
        marginHorizontal: 24,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.2)',
        marginBottom: 30
    },
    insightGradient: { padding: 24 },
    insightHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
    insightTitle: { color: '#818cf8', fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
    latestMood: { color: '#94a3b8', fontSize: 14, marginBottom: 8 },
    latestInsight: { color: '#cbd5e1', fontSize: 15, lineHeight: 22, fontStyle: 'italic' },
    actionArea: { paddingHorizontal: 24, gap: 16 },
    mainBtn: { borderRadius: 18, overflow: 'hidden', elevation: 8, shadowColor: '#6366f1', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3, shadowRadius: 10 },
    btnGradient: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 20 },
    mainBtnText: { color: '#ffffff', fontSize: 17, fontWeight: 'bold' },
    dateSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 15,
        borderRadius: 16,
        marginTop: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)'
    },
    dateText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 10
    },
    secondaryBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1e293b',
        paddingVertical: 14,
        borderRadius: 16,
        gap: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)'
    },
    secondaryBtnText: { color: '#cbd5e1', fontSize: 14, fontWeight: '600' },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 40,
        marginBottom: 40,
        gap: 6
    },
    lastUpdate: { color: '#475569', fontSize: 12, fontWeight: '500' },
    recentChatsSection: { marginBottom: 30 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 15 },
    sectionTitle: { color: '#6366f1', fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
    viewMoreText: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
    recentChatsScroll: { paddingHorizontal: 24, gap: 12 },
    chatCard: {
        width: 150,
        backgroundColor: '#1e293b',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)'
    },
    chatIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10
    },
    chatCardTitle: { color: 'white', fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
    chatCardDate: { color: '#475569', fontSize: 11, fontWeight: '500' },
    seedBtn: {
        marginTop: 15,
        backgroundColor: '#6366f1',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 12,
        alignSelf: 'flex-start'
    },
    seedBtnText: {
        color: 'white',
        fontSize: 13,
        fontWeight: 'bold'
    },
    guideActionBtn: {
        backgroundColor: '#facc15',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
    },
    guideActionBtnText: {
        color: '#020617',
        fontSize: 13,
        fontWeight: '900',
    },
    quickCaptureBanner: {
        borderRadius: 24,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#6366f1',
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
        color: 'white',
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
        color: '#cbd5e1',
        fontSize: 15,
        lineHeight: 22,
        marginTop: 10,
    },
    interventionPunchline: {
        color: '#f87171',
        fontSize: 13,
        fontWeight: '600',
        fontStyle: 'italic',
        marginTop: 8,
    },
    interventionBtn: {
        backgroundColor: '#ef4444',
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
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold'
    },
    reportLabel: {
        color: '#94a3b8',
        fontSize: 10,
        fontWeight: '600',
        marginTop: 4,
        textTransform: 'uppercase'
    },
    reportVerdict: {
        color: '#cbd5e1',
        fontSize: 13,
        lineHeight: 18,
        fontStyle: 'italic',
        textAlign: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
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
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderColor: '#475569',
    },
    proBadge: {
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        borderColor: '#818cf8',
    },
    membershipBadgeText: {
        fontSize: 11,
        fontWeight: 'bold',
        letterSpacing: 1,
        color: '#ffffff'
    }
});

export default DashboardScreen;
