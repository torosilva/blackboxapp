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
    RefreshControl,
    Alert
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
    Calendar,
    TrendingUp,
    Activity
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { SupabaseService } from '../services/SupabaseService';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WhatsNewModal from '../components/WhatsNewModal';
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
    const [patterns, setPatterns] = useState<any[]>([]);
    const [onboardingChecked, setOnboardingChecked] = useState(false);
    const [appointmentDate, setAppointmentDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [isAnalyzingPatterns, setIsAnalyzingPatterns] = useState(false);
    const [analysisPhase, setAnalysisPhase] = useState("");
    const [analysisProgress, setAnalysisProgress] = useState(0);
    const [strategicProfile, setStrategicProfile] = useState<any>(null);
    
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
            console.log('DASHBOARD: Fetching strategic stats for user:', user.id);
            
            // ── 1. Fetch Consolidated Historical Context (New Standard) ──────
            const history = await SupabaseService.getHistoricalContext(user.id);
            
            // ── 2. Fetch real goals from separate table ────────────────────────
            const goals = await SupabaseService.getGoals(user.id);
            const totalGoals = goals ? goals.length : 0;
            const completedGoals = goals ? goals.filter((g: any) => g.is_completed).length : 0;
            const goalPercent = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;

            // ── 3. Fetch entries for Interventions list ────────────────────────
            const entries = await SupabaseService.getEntries(user.id);
            
            setStats({
                totalMemories: history.totalEntries,
                activeLoops: history.openLoopsCount,
                completedGoals: completedGoals,
                totalGoals: totalGoals,
                goalPercentage: goalPercent,
                latestEntry: entries && entries.length > 0 ? entries[0] : null
            });

            // ── 4. Calculate Interventions (HIGH priority > 72h) ───────────────
            // We fetch from original normalized table for interventions
            const openItems = await SupabaseService.getOpenActionItems(user.id);
            const now = new Date().getTime();
            const overdues = openItems
                .filter(item => {
                    if (item.priority !== 'HIGH') return false;
                    const itemDate = new Date(item.created_at).getTime();
                    const diffDays = (now - itemDate) / (1000 * 60 * 60 * 24);
                    return diffDays >= 3;
                })
                .map(item => ({
                    ...item,
                    days: Math.floor((now - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24))
                }));
            
            setInterventions(overdues.slice(0, 2));

            // ── 5. Fetch recent threads ────────────────────────────────────────
            const threads = await SupabaseService.getChatThreads(user.id);
            if (threads) {
                setRecentThreads(threads.slice(0, 3));
            }

            // ── 6. Fetch detected patterns ──────────────────────────────────────
            const pats = await SupabaseService.getUserPatterns(user.id);
            setPatterns(pats || []);

            // ── 7. Fetch Strategic Profile (Long-term Memory) ───────────────────
            const profile = await SupabaseService.getStrategicProfile(user.id);
            setStrategicProfile(profile);

        } catch (error) {
            console.error('DASHBOARD_FETCH_ERROR:', error);
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

    const handleManualPatternAnalysis = async () => {
        if (!user || isAnalyzingPatterns) return;
        
        Alert.alert(
            "Auditoría Estratégica",
            `Analizaremos tus ${stats.totalMemories} memorias para consolidar tu perfil cognitivo de largo plazo.`,
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Iniciar Auditoría",
                    onPress: () => runPatternAnalysis()
                }
            ]
        );
    };

    const runPatternAnalysis = async () => {
        if (!user || isAnalyzingPatterns) return;
        setIsAnalyzingPatterns(true);
        setAnalysisProgress(0);
        setAnalysisPhase("Iniciando conexión con núcleo estratégico...");

        try {
            console.log('DASHBOARD: Strategic audit loop started...');
            
            // Real-feel progress animation (0-90% while EF works)
            let currentProgress = 0;
            const progressInterval = setInterval(() => {
                currentProgress += Math.random() * 5;
                if (currentProgress > 92) {
                    clearInterval(progressInterval);
                } else {
                    setAnalysisProgress(currentProgress);
                    if (currentProgress < 30) setAnalysisPhase("Fase 1/3: Recuperando histórico militar...");
                    else if (currentProgress < 70) setAnalysisPhase("Fase 2/3: Detectando sesgos y loops abiertos...");
                    else setAnalysisPhase("Fase 3/3: Sincronizando Perfil Longitudinal...");
                }
            }, 800);

            const success = await SupabaseService.triggerPatternAnalysis(user.id);
            clearInterval(progressInterval);

            if (success) {
                setAnalysisProgress(100);
                // Refresh data
                await fetchStats();
                Alert.alert(
                    "¡Perfil Sincronizado!",
                    "Tu memoria estratégica ha sido consolidada. Los patrones y sesgos detectados ya están disponibles.",
                    [{ text: "Ver Resultados", onPress: fetchStats }]
                );
            } else {
                setAnalysisProgress(0);
                Alert.alert("Error Técnico", "No pudimos completar la auditoría. Verifica tu conexión.");
            }
        } catch (err) {
            console.error('DASHBOARD: Deep audit failed:', err);
        } finally {
            setIsAnalyzingPatterns(false);
            setAnalysisPhase("");
            setAnalysisProgress(0);
        }
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
        <>
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
                            onPress={() => !profile?.is_pro && navigation.navigate('Paywall')}
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
                                onPress={() => navigation.navigate('EntryDetail', { entryId: interventions[0].entry_id })}
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

                    {/* ─── PERFIL ESTRATÉGICO (COGNITIVE IDENTITY) ────────────────── */}
                    {strategicProfile && (
                        <View style={{
                            marginHorizontal: 16,
                            marginBottom: 20,
                            padding: 20,
                            borderRadius: 24,
                            backgroundColor: 'rgba(99, 102, 241, 0.08)',
                            borderWidth: 1,
                            borderColor: 'rgba(99, 102, 241, 0.2)',
                            borderStyle: 'dashed'
                        }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(99, 102, 241, 0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                    <Text style={{ fontSize: 16 }}>🧠</Text>
                                </View>
                                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 }}>
                                    PERFIL ESTRATÉGICO
                                </Text>
                            </View>
                            <Text style={{ color: '#c7d2fe', fontSize: 13, lineHeight: 20, fontStyle: 'italic' }}>
                                "{strategicProfile.cognitive_summary || 'Analizando tu trayectoria...'}"
                            </Text>
                            <View style={{ flexDirection: 'row', marginTop: 12, flexWrap: 'wrap' }}>
                                {(strategicProfile.recurring_themes || []).slice(0, 3).map((theme: string, idx: number) => (
                                    <View key={idx} style={{ backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8, marginBottom: 6 }}>
                                        <Text style={{ color: '#94a3b8', fontSize: 10, fontWeight: '600' }}>#{theme.toUpperCase()}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                {/* ── Patrones Detectados ────────────────────────────────── */}
                <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>PATRONES DETECTADOS</Text>
                        <Activity size={14} color="#6366f1" />
                    </View>

                    {patterns.length === 0 ? (
                        stats.totalMemories >= 5 ? (
                            // Stuck state: enough memories but NO analysis run yet
                            <TouchableOpacity 
                                onPress={handleManualPatternAnalysis}
                                disabled={isAnalyzingPatterns}
                                activeOpacity={0.8}
                                style={{
                                    backgroundColor: 'rgba(99,102,241,0.05)',
                                    borderRadius: 20,
                                    padding: 24,
                                    borderWidth: 1,
                                    borderColor: isAnalyzingPatterns ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.3)',
                                    borderStyle: 'dashed',
                                    alignItems: 'center'
                                }}
                            >
                                {isAnalyzingPatterns ? (
                                    <View style={{ width: '100%', alignItems: 'center' }}>
                                        <ActivityIndicator size="small" color="#6366f1" style={{ marginBottom: 12 }} />
                                        <Text style={{ color: '#c7d2fe', fontWeight: '700', fontSize: 13, marginBottom: 8 }}>
                                            Auditoría en Progreso... {Math.round(analysisProgress)}%
                                        </Text>
                                        <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, height: 6, width: '100%', overflow: 'hidden', marginBottom: 12 }}>
                                            <View style={{
                                                backgroundColor: '#818cf8',
                                                height: '100%',
                                                width: `${analysisProgress}%`,
                                                borderRadius: 10
                                            }} />
                                        </View>
                                        <Text style={{ color: '#64748b', fontSize: 11, textAlign: 'center', opacity: 0.8 }}>
                                            {analysisPhase}
                                        </Text>
                                    </View>
                                ) : (
                                    <>
                                        <View style={{ 
                                            backgroundColor: 'rgba(99,102,241,0.2)', 
                                            width: 50, height: 50, borderRadius: 25, 
                                            justifyContent: 'center', alignItems: 'center', marginBottom: 12 
                                        }}>
                                            <Brain size={28} color="#818cf8" />
                                        </View>
                                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
                                            Auditar Perfil Estratégico
                                        </Text>
                                        <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
                                            Tienes 5+ memorias listas. Pulsa para detectar patrones cognitivos y conductuales.
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        ) : (
                            // Progress state — building profile (Initial phase)
                            <View style={{
                                backgroundColor: '#0f172a',
                                borderRadius: 20,
                                padding: 20,
                                borderWidth: 1,
                                borderColor: 'rgba(99,102,241,0.2)'
                            }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                    <Brain size={18} color="#6366f1" />
                                    <Text style={{ color: '#c7d2fe', fontWeight: '700', fontSize: 13, letterSpacing: 0.5, marginLeft: 8 }}>
                                        Analizando tu perfil cognitivo...
                                    </Text>
                                </View>
                                <Text style={{ color: '#64748b', fontSize: 13, lineHeight: 20, marginBottom: 16 }}>
                                    Necesitamos{' '}
                                    <Text style={{ color: '#818cf8', fontWeight: '700' }}>
                                        {Math.max(0, 5 - stats.totalMemories)} entrada(s) más
                                    </Text>
                                    {' '}para detectar patrones en tu comportamiento y cognición.
                                </Text>
                                <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, height: 6, overflow: 'hidden' }}>
                                    <View style={{
                                        backgroundColor: '#6366f1',
                                        height: '100%',
                                        width: `${Math.min(100, (stats.totalMemories / 5) * 100)}%`,
                                        borderRadius: 8
                                    }} />
                                </View>
                                <Text style={{ color: '#475569', fontSize: 11, marginTop: 6, textAlign: 'right' }}>
                                    {Math.min(stats.totalMemories, 5)}/5 entradas
                                </Text>
                            </View>
                        )
                    ) : (
                        // Pattern cards
                        patterns.map((pat) => {
                            const typeConfig: Record<string, { color: string; label: string; icon: any }> = {
                                emotional:      { color: '#f59e0b', label: 'Emocional',     icon: Heart },
                                procrastination:{ color: '#ef4444', label: 'Procrastinación', icon: Zap },
                                cognitive_bias: { color: '#6366f1', label: 'Sesgo Cognitivo', icon: Brain },
                                productivity:   { color: '#10b981', label: 'Productividad',  icon: TrendingUp },
                            };
                            const cfg = typeConfig[pat.pattern_type] ?? { color: '#94a3b8', label: pat.pattern_type, icon: Activity };
                            const IconComp = cfg.icon as any;

                            return (
                                <View key={pat.id} style={{
                                    backgroundColor: '#0f172a',
                                    borderRadius: 16,
                                    padding: 16,
                                    marginBottom: 12,
                                    borderWidth: 1,
                                    borderLeftWidth: 3,
                                    borderColor: 'rgba(255,255,255,0.05)',
                                    borderLeftColor: cfg.color,
                                }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                        <View style={{
                                            backgroundColor: `${cfg.color}20`,
                                            borderRadius: 8,
                                            padding: 6,
                                            marginRight: 10
                                        }}>
                                            <IconComp size={14} color={cfg.color} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: cfg.color, fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' }}>
                                                {cfg.label}
                                            </Text>
                                            <Text style={{ color: 'white', fontSize: 14, fontWeight: '700', marginTop: 1 }} numberOfLines={1}>
                                                {pat.title}
                                            </Text>
                                        </View>
                                        <View style={{
                                            backgroundColor: `${cfg.color}15`,
                                            borderRadius: 10,
                                            paddingHorizontal: 8,
                                            paddingVertical: 3
                                        }}>
                                            <Text style={{ color: cfg.color, fontSize: 11, fontWeight: '700' }}>×{pat.frequency}</Text>
                                        </View>
                                    </View>
                                    <Text style={{ color: '#94a3b8', fontSize: 13, lineHeight: 20 }} numberOfLines={3}>
                                        {pat.description}
                                    </Text>
                                    <Text style={{ color: '#475569', fontSize: 11, marginTop: 8 }}>
                                        Última vez: {new Date(pat.last_seen_at).toLocaleDateString()}
                                    </Text>
                                </View>
                            );
                        })
                    )}
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
        <WhatsNewModal />
        </>
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
