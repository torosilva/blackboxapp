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
    MessageCircle
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { SupabaseService } from '../services/SupabaseService';
import { LinearGradient } from 'expo-linear-gradient';

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
        latestEntry: null as any
    });
    const [recentThreads, setRecentThreads] = useState<any[]>([]);

    useEffect(() => {
        if (isFocused && user) {
            fetchStats();
        }
    }, [isFocused, user]);

    const fetchStats = async () => {
        if (!user) return;
        setRefreshing(true);
        try {
            console.log('DASHBOARD: Fetching stats for user:', user.id);
            const data = await SupabaseService.getEntries(user.id);
            if (data) {
                console.log('DASHBOARD: Data received, count:', data.length);
                const pending = data.reduce((acc: number, entry: any) => {
                    const tasks = entry.action_items || [];
                    return acc + tasks.filter((t: any) => !t.is_completed).length;
                }, 0);

                const completed = data.reduce((acc: number, entry: any) => {
                    const tasks = entry.action_items || [];
                    return acc + tasks.filter((t: any) => t.is_completed).length;
                }, 0);

                setStats({
                    totalMemories: data.length,
                    activeLoops: pending,
                    completedGoals: completed,
                    latestEntry: data.length > 0 ? data[0] : null
                });
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

    const TO = TouchableOpacity as any;
    const SAV = SafeAreaView as any;
    const LG = LinearGradient as any;

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
                {/* Header Section */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.greeting}>{getGreeting()},</Text>
                        <Text style={styles.userName}>{profile?.full_name || user?.email?.split('@')[0] || 'Explorador'}</Text>
                    </View>
                    <TO style={styles.profileBtn} onPress={() => navigation.navigate('Settings', {})}>
                        <User size={20} color="#94a3b8" />
                    </TO>
                </View>

                {/* Main Branding / Logo */}
                <View style={styles.logoContainer}>
                    <Image 
                        source={require('../../assets/logo.png')} 
                        style={styles.logo} 
                        resizeMode="contain"
                    />
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
                            <Text style={styles.statValue}>{stats.completedGoals}</Text>
                            <Text style={styles.statLabel}>Metas</Text>
                        </LG>
                    </TO>
                </View>

                {/* Strategic Context section */}
                <View style={styles.insightSection}>
                    <LG colors={['rgba(99, 102, 241, 0.1)', 'rgba(0, 0, 0, 0)']} style={styles.insightGradient}>
                        <View style={styles.insightHeader}>
                            <Sparkles size={16} color="#818cf8" />
                            <Text style={styles.insightTitle}>ESTADO ESTRATÉGICO</Text>
                        </View>
                        
                        {stats.latestEntry ? (
                            <View>
                                <Text style={styles.latestMood}>Último estado: <Text style={{color: '#fff'}}>{stats.latestEntry.mood_label || 'Estable'}</Text></Text>
                                <Text style={styles.latestInsight} numberOfLines={2}>
                                    {stats.latestEntry.summary || 'Tu última entrada está siendo procesada...'}
                                </Text>
                                <TO style={[styles.seedBtn, { marginTop: 10, alignSelf: 'flex-start' }]} onPress={handleSeedSample}>
                                    <Sparkles size={12} color="#818cf8" style={{marginRight: 4}} />
                                    <Text style={[styles.seedBtnText, { fontSize: 11 }]}>Reiniciar Sesión de Ejemplo</Text>
                                </TO>
                            </View>
                        ) : (
                            <View>
                                <Text style={styles.latestInsight}>Aún no hay registros. Comienza hoy tu viaje de claridad mental.</Text>
                                <TO style={styles.seedBtn} onPress={handleSeedSample}>
                                    <Sparkles size={14} color="#818cf8" style={{marginRight: 6}} />
                                    <Text style={styles.seedBtnText}>Ver Sesión de Ejemplo (IA)</Text>
                                </TO>
                            </View>
                        )}
                    </LG>
                </View>

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

                {/* Main Action Area */}
                <View style={styles.actionArea}>
                    <TO 
                        style={styles.mainBtn}
                        onPress={() => navigation.navigate('Home')}
                    >
                        <LG colors={['#6366f1', '#4f46e5']} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.btnGradient}>
                            <LayoutDashboard size={20} color="white" style={{marginRight: 10}} />
                            <Text style={styles.mainBtnText}>Entrar a mis Memorias</Text>
                            <ChevronRight size={20} color="white" style={{marginLeft: 'auto'}} />
                        </LG>
                    </TO>

                    <View style={styles.secondaryActions}>
                        <TO 
                            style={styles.secondaryBtn}
                            onPress={() => navigation.navigate('NewEntry', {})}
                        >
                            <Brain size={18} color="#94a3b8" />
                            <Text style={styles.secondaryBtnText}>Nuevo Registro</Text>
                        </TO>
                        <TO 
                            style={styles.secondaryBtn}
                            onPress={() => navigation.navigate('ChatHub' as any)}
                        >
                            <Sparkles size={18} color="#94a3b8" />
                            <Text style={styles.secondaryBtnText}>Consultar IA</Text>
                        </TO>
                    </View>
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
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 20,
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
    logoContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        height: 120,
        marginBottom: 20
    },
    logo: { width: '80%', height: '100%' },
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
    secondaryActions: { flexDirection: 'row', gap: 12 },
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
    }
});

export default DashboardScreen;
