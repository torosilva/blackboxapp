import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Share, Platform, StatusBar, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Share2, ClipboardList, Stethoscope, Activity, TrendingUp } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { aiService } from '../services/ai';
import { SupabaseService } from '../services/SupabaseService';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../hooks/useSubscription';
import AILoadingOverlay from '../components/AILoadingOverlay';
import { Crown } from 'lucide-react-native';

/**
 * A simple, zero-dependency Markdown renderer for the strategic report.
 * Handles headings, bold text, and lists to match the user's premium design.
 */
const SimpleMarkdown = ({ content }: { content: string }) => {
    const lines = content.split('\n');

    return (
        <View>
            {lines.map((line, index) => {
                const trimmed = line.trim();

                // Headings
                if (trimmed.startsWith('## ')) {
                    return <Text key={index} style={markdownStyles.heading2}>{trimmed.replace('## ', '')}</Text>;
                }
                if (trimmed.startsWith('# ')) {
                    return <Text key={index} style={markdownStyles.heading1}>{trimmed.replace('# ', '')}</Text>;
                }

                // Lists
                if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
                    return (
                        <View key={index} style={markdownStyles.listItemContainer}>
                            <Text style={markdownStyles.bullet}>•</Text>
                            <Text style={markdownStyles.listItemText}>{trimmed.substring(2)}</Text>
                        </View>
                    );
                }

                // Bold handling (simplified)
                if (trimmed.includes('**')) {
                    const parts = trimmed.split('**');
                    return (
                        <Text key={index} style={markdownStyles.body}>
                            {parts.map((part, i) => (
                                <Text key={i} style={i % 2 === 1 ? markdownStyles.strong : null}>
                                    {part}
                                </Text>
                            ))}
                        </Text>
                    );
                }

                if (trimmed === '') return <View key={index} style={{ height: 10 }} />;

                return <Text key={index} style={markdownStyles.body}>{trimmed}</Text>;
            })}
        </View>
    );
};

const WeeklyReportScreen = ({ route }: any) => {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const { isPro } = useSubscription();
    const Cr = Crown as any;

    const SAV = SafeAreaView as any;
    const TO = TouchableOpacity as any;
    const CL = ChevronLeft as any;
    const S2 = Share2 as any;
    const CPL = ClipboardList as any;
    const Ste = Stethoscope as any;
    const Act = Activity as any;
    const Tr = TrendingUp as any;

    const [loading, setLoading] = useState(true);
    const [report, setReport] = useState('');
    const [metrics, setMetrics] = useState({ avgSentiment: 0, totalEntries: 0 });
    const [strategicProfile, setStrategicProfile] = useState<any>(null);

    const reportEndDate = route.params?.reportEndDate ? new Date(route.params.reportEndDate) : new Date();

    useEffect(() => {
        if (user) {
            generateReport();
        } else {
            setReport("## Acceso Denegado\n\nDebes iniciar sesión para ver tus reportes.");
            setLoading(false);
        }
    }, [user, route.params?.reportEndDate]);

    const generateReport = async () => {
        try {
            setLoading(true);
            if (!user) return;
            const entries = await SupabaseService.getWeeklyEntries(user.id, reportEndDate, 7);

            if (entries && entries.length > 0) {
                // 1. Generate Content Fingerprint (Count + Latest ID)
                const fingerprint = `${entries.length}_${entries[0].id}`;

                // 2. Check Persistent Cache
                const cached = await SupabaseService.getCachedInsight(user.id, 'weekly', fingerprint);

                // VALIDATION: Only use cache if it doesn't look like an error message
                const isErrorMessage = cached?.report && (
                    cached.report.includes("Reseteando cuota") ||
                    cached.report.includes("Limite de cuota") ||
                    cached.report.includes("Error al generar") ||
                    cached.report.includes("No se pudo generar")
                );

                if (cached && !isErrorMessage) {
                    console.log('WEEKLY_DEBUG: Using valid cached report for fingerprint:', fingerprint);
                    setMetrics(cached.metrics);
                    setReport(cached.report);
                    setLoading(false);
                    return;
                }

                // 3. Cache Miss (or Poisoned Cache): Calculate Metrics & Generate with Gemini
                console.log('WEEKLY_DEBUG: Generating fresh strategic report...');
                const total = entries.length;

                // Debug scores to verify why it might be Zero
                const scores = entries.map(e => e.sentiment_score);
                console.log('WEEKLY_DEBUG: Sentiment scores in batch:', scores);

                const sum = entries.reduce((acc, curr) => acc + (Number(curr.sentiment_score) || 0), 0);
                const avg = sum / total;

                const currentMetrics = { avgSentiment: avg, totalEntries: total };
                setMetrics(currentMetrics);

                // 4. Fetch Deep Strategic Memory as Context
                const profile = await SupabaseService.getStrategicProfile(user.id);
                const historicalContext = await SupabaseService.getHistoricalContext(user.id);
                setStrategicProfile(profile);

                const markdown = await aiService.generateWeeklyReport(entries, {
                    ...historicalContext,
                    strategic_profile: profile
                });
                setReport(markdown);

                // 4. Save to persistent cache ONLY IF it's a real report
                const isNewError = markdown.includes("Reseteando cuota") ||
                    markdown.includes("Error al generar") ||
                    markdown.includes("No se pudo generar");
                if (!isNewError) {
                    await SupabaseService.saveCachedInsight(user.id, 'weekly', fingerprint, {
                        metrics: currentMetrics,
                        report: markdown
                    });
                }

            } else {
                setMetrics({ avgSentiment: 0, totalEntries: 0 });
                setReport(`## Sin registros suficientes\n\nNo hay entradas en los últimos 7 días para generar un reporte clínico.\n\n*Recuerda registrar al menos 5 sesiones para un análisis profundo.*`);
            }
        } catch (error) {
            console.error('WeeklyReport: Error', error);
            setReport("## Error de Conexión\n\nNo pudimos conectar con el analista estratégico en este momento.");
        } finally {
            setLoading(false);
        }
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: report,
                title: 'Reporte Estratégico BLACKBOX'
            });
        } catch (error) {
            console.log('Share error', error);
        }
    };

    const getScoreColor = (score: number) => {
        if (score > 0.3) return '#10b981'; // Emerald 500
        if (score < -0.3) return '#f87171'; // Red 400
        return '#facc15'; // Yellow 400
    };

    const showStabilityInfo = () => {
        Alert.alert(
            "🧠 ¿Qué es la Estabilidad?",
            "Es el balance emocional de tu semana calculado por BLACKBOX.\n\nRango: -1.0 a +1.0\n\n• Valores Positivos (+): Indican una tendencia hacia la calma, el enfoque y el 'flow'.\n• Valores Negativos (-): Sugieren periodos de estrés, ansiedad o agotamiento.\n\nTu puntaje actual es un promedio de todas tus entradas analizadas en este periodo.",
            [{ text: "Entendido", style: "default" }]
        );
    };

    // Gate: FREE users cannot access Weekly Reports
    if (!isPro) {
        return (
            <SAV style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 30 }]}>
                <View style={{ backgroundColor: '#151B33', padding: 30, borderRadius: 30, width: '100%', borderWidth: 1, borderColor: '#6366f1' }}>
                    <Cr size={60} color="#facc15" style={{ alignSelf: 'center', marginBottom: 20 }} />
                    <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 }}>
                        Reporte Semanal PRO
                    </Text>
                    <Text style={{ color: '#94a3b8', fontSize: 15, textAlign: 'center', marginBottom: 30, lineHeight: 24 }}>
                        El <Text style={{ color: '#818cf8', fontWeight: 'bold' }}>Análisis Estratégico Semanal</Text> es exclusivo de usuarios{' '}
                        <Text style={{ color: '#a855f7', fontWeight: 'bold' }}>PRO</Text>.{'\n\n'}
                        Recibe un diagnóstico profundo de tus metas, loops y estado mental cada semana.
                    </Text>
                    <TO
                        style={{ backgroundColor: '#4f46e5', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}
                        onPress={() => navigation.navigate('Paywall')}
                    >
                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>VER PLANES PRO</Text>
                    </TO>
                    <TO onPress={() => navigation.goBack()} style={{ alignSelf: 'center', paddingTop: 8 }}>
                        <Text style={{ color: '#475569', fontSize: 14 }}>Volver</Text>
                    </TO>
                </View>
            </SAV>
        );
    }

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <AILoadingOverlay
                    visible={true}
                    message="Compilando registros y análisis clínico..."
                />
            </View>
        );
    }

    return (
        <SAV style={styles.container}>
            <StatusBar barStyle="light-content" />

            <View style={styles.headerNav}>
                <TO onPress={() => navigation.goBack()} style={styles.iconButton}>
                    <CL color="white" size={24} />
                </TO>
                <Text style={styles.headerNavTitle}>Strategic Analytics</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* WELCOME HEADER */}
                <View style={styles.welcomeSection}>
                    <Text style={styles.welcomeTitle}>Weekly Insights</Text>
                    <Text style={styles.welcomeSubtitle}>Rendimiento y claridad mental</Text>
                </View>

                {/* VISUAL DASHBOARD */}
                <View style={styles.dashboardRow}>
                    <TO
                        style={styles.metricsCard}
                        onPress={showStabilityInfo}
                        activeOpacity={0.7}
                    >
                        <View style={styles.cardHeaderSmall}>
                            <Act size={14} color="#94a3b8" />
                            <Text style={styles.cardLabelSmall}>ESTABILIDAD</Text>
                        </View>
                        <Text style={[styles.metricsValue, { color: getScoreColor(metrics.avgSentiment) }]}>
                            {metrics.avgSentiment > 0 ? '+' : ''}{metrics.avgSentiment.toFixed(1)}
                        </Text>
                    </TO>

                    <View style={styles.metricsCard}>
                        <View style={styles.cardHeaderSmall}>
                            <CPL size={14} color="#94a3b8" />
                            <Text style={styles.cardLabelSmall}>ENTRADAS</Text>
                        </View>
                        <Text style={styles.metricsValue}>{metrics.totalEntries}</Text>
                    </View>
                </View>

                {/* DEEP STRATEGIC IDENTITY (MEMORIA LARGO PLAZO) */}
                {strategicProfile && (
                    <View style={styles.strategicCard}>
                        <View style={styles.strategicHeader}>
                            <View style={styles.brainIconBox}>
                                <Text style={{ fontSize: 18 }}>🧠</Text>
                            </View>
                            <Text style={styles.strategicTitle}>IDENTIDAD COGNITIVA GLOBAL</Text>
                        </View>
                        <Text style={styles.cognitiveSummary}>
                            "{strategicProfile.cognitive_summary || 'Consolidando tu trayectoria estratégica...'}"
                        </Text>
                        <View style={styles.tagsRow}>
                            {(strategicProfile.recurring_themes || []).map((t: string, i: number) => (
                                <View key={i} style={styles.tag}>
                                    <Text style={styles.tagText}>#{t.toUpperCase()}</Text>
                                </View>
                            ))}
                        </View>
                        <Text style={styles.memoryFooter}>
                            Basado en {strategicProfile.data_points_count || 0} análisis históricos.
                        </Text>
                    </View>
                )}

                {/* CLINICAL REPORT CONTENT */}
                <View style={styles.reportCard}>
                    <View style={styles.reportHeader}>
                        <View style={styles.medicalIconContainer}>
                            <Ste size={20} color="#818cf8" />
                        </View>
                        <Text style={styles.reportCategory}>REPORTE ESTRATÉGICO</Text>
                    </View>

                    <SimpleMarkdown content={report} />
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* FLOATING ACTION BUTTON */}
            <View style={styles.footer}>
                <TO style={styles.exportButton} onPress={handleShare}>
                    <S2 size={20} color="white" style={{ marginRight: 10 }} />
                    <Text style={styles.exportButtonText}>Exportar Reporte</Text>
                </TO>
            </View>
        </SAV>
    );
};

const markdownStyles = StyleSheet.create({
    heading1: { color: '#ffffff', fontSize: 24, fontWeight: 'bold', marginBottom: 15, marginTop: 10 },
    heading2: { color: '#818cf8', fontSize: 18, fontWeight: 'bold', marginBottom: 10, marginTop: 20 },
    body: { color: '#cbd5e1', fontSize: 15, lineHeight: 24, marginBottom: 10 },
    strong: { color: '#ffffff', fontWeight: 'bold' },
    listItemContainer: { flexDirection: 'row', marginBottom: 8, paddingLeft: 4 },
    bullet: { color: '#818cf8', fontSize: 18, marginRight: 8, position: 'relative', top: -2 },
    listItemText: { color: '#cbd5e1', fontSize: 15, lineHeight: 22, flex: 1 }
});

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0B1021' },
    loadingContainer: { flex: 1, backgroundColor: '#0B1021', justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: '#94a3b8', marginTop: 16, fontWeight: '500' },
    headerNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 10 : 15,
        paddingBottom: 10
    },
    headerNavTitle: { color: '#64748b', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2 },
    iconButton: { padding: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12 },
    scrollContent: { padding: 20 },
    welcomeSection: { marginBottom: 24, marginTop: 10 },
    welcomeTitle: { color: 'white', fontSize: 32, fontWeight: 'bold' },
    welcomeSubtitle: { color: '#94a3b8', fontSize: 16, marginTop: 4 },
    dashboardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
    metricsCard: {
        backgroundColor: '#151B33',
        width: '48%',
        padding: 20,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 5
    },
    cardHeaderSmall: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
    cardLabelSmall: { color: '#64748b', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    metricsValue: { color: 'white', fontSize: 36, fontWeight: 'bold' },
    reportCard: {
        backgroundColor: '#151B33',
        padding: 24,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)'
    },
    reportHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        paddingBottom: 16
    },
    medicalIconContainer: { backgroundColor: 'rgba(129, 140, 248, 0.1)', padding: 10, borderRadius: 12, marginRight: 12 },
    reportCategory: { color: '#818cf8', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
    strategicCard: {
        backgroundColor: 'rgba(99, 102, 241, 0.08)',
        padding: 24,
        borderRadius: 28,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.2)',
        borderStyle: 'dashed'
    },
    strategicHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    brainIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(99, 102, 241, 0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    strategicTitle: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
    cognitiveSummary: { color: '#c7d2fe', fontSize: 14, lineHeight: 22, fontStyle: 'italic', marginBottom: 16 },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    tag: { backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    tagText: { color: '#94a3b8', fontSize: 10, fontWeight: '700' },
    memoryFooter: { color: '#475569', fontSize: 10, fontWeight: '600', textAlign: 'right' },
    footer: { position: 'absolute', bottom: 30, left: 20, right: 20 },
    exportButton: {
        backgroundColor: '#4f46e5',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        borderRadius: 20,
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 15,
        elevation: 8
    },
    exportButtonText: { color: 'white', fontWeight: 'bold', fontSize: 17 }
});

export default WeeklyReportScreen;
