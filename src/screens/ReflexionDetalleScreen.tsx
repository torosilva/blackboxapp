import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Sparkles, RefreshCw, ChevronRight } from 'lucide-react-native';
import { SupabaseService } from '../services/SupabaseService';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { ThemeTokens } from '../theme/tokens';

const ReflexionDetalleScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { reflejo, loops = [], memories = [] } = route.params || {};
    const { user } = useAuth();
    const { tokens } = useTheme();
    const styles = useMemo(() => makeStyles(tokens), [tokens]);
    const [historicalEvidence, setHistoricalEvidence] = useState<any[]>([]);
    const [historicalLoading, setHistoricalLoading] = useState(false);

    const SAV = SafeAreaView as any;
    const TO = TouchableOpacity as any;
    const CL = ChevronLeft as any;
    const Sp = Sparkles as any;
    const RC = RefreshCw as any;
    const CR = ChevronRight as any;

    const fmtDate = (iso?: string) => {
        if (!iso) return '';
        const d = new Date(iso);
        const days = Math.floor((Date.now() - d.getTime()) / 86400000);
        if (days <= 0) return 'Hoy';
        if (days === 1) return 'Ayer';
        if (days < 7) return `Hace ${days} días`;
        return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    };

    useEffect(() => {
        if (!reflejo || !user?.id) return;
        let cancelled = false;
        setHistoricalLoading(true);
        SupabaseService
            .semanticSearch(user.id, String(reflejo).slice(0, 1500), { limit: 10 })
            .then((res) => {
                if (cancelled) return;
                const recentIds = new Set((memories ?? []).map((m: any) => m.id));
                const filtered = (res ?? []).filter((e: any) => !recentIds.has(e.id));
                setHistoricalEvidence(filtered.slice(0, 5));
            })
            .finally(() => { if (!cancelled) setHistoricalLoading(false); });
        return () => { cancelled = true; };
    }, [reflejo, user?.id]);

    return (
        <SAV style={styles.container}>
            <StatusBar barStyle={tokens.statusBar} />

            <View style={styles.header}>
                <TO onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
                    <CL size={24} color={tokens.text.primary} />
                </TO>
                <Text style={styles.headerTitle}>Reflejo de hoy</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
                {/* Full reflejo */}
                <View style={styles.reflejoCard}>
                    <View style={styles.reflejoHead}>
                        <Sp size={15} color={tokens.accent.purple} strokeWidth={2.2} />
                        <Text style={styles.reflejoLabel}>REFLEJO DE HOY</Text>
                    </View>
                    <Text style={styles.reflejoText}>{reflejo || 'Sin reflejo disponible.'}</Text>
                </View>

                {/* Related patterns (loops) */}
                {Array.isArray(loops) && loops.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>PATRONES RELACIONADOS</Text>
                        {loops.map((l: any) => (
                            <TO
                                key={l.id}
                                style={styles.loopCard}
                                onPress={() => navigation.navigate('Loops')}
                                activeOpacity={0.85}
                            >
                                {String(l.status) === 'regresa' && (
                                    <RC size={16} color={tokens.accent.purple} strokeWidth={2.5} style={{ marginTop: 2 }} />
                                )}
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.loopText}>{l.avoidance_reason || l.task}</Text>
                                    {!!l.avoidance_reason && !!l.task && (
                                        <Text style={styles.loopTask}>{l.task}</Text>
                                    )}
                                </View>
                                <CR size={18} color={tokens.text.disabled} />
                            </TO>
                        ))}
                    </View>
                )}

                {/* Related memories */}
                {Array.isArray(memories) && memories.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>EVIDENCIA RECIENTE</Text>
                        {memories.map((e: any) => (
                            <TO
                                key={e.id}
                                style={styles.memCard}
                                onPress={() => navigation.navigate('EntryDetail', { entryId: e.id })}
                                activeOpacity={0.8}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.memTitle} numberOfLines={1}>{e.title || 'Registro'}</Text>
                                    <Text style={styles.memMeta}>
                                        {fmtDate(e.created_at)}{e.category ? ` · ${e.category}` : ''}
                                    </Text>
                                </View>
                                <CR size={16} color={tokens.text.disabled} />
                            </TO>
                        ))}
                    </View>
                )}

                {historicalEvidence.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>EVIDENCIA HISTÓRICA</Text>
                        <Text style={styles.sectionSub}>
                            Tu propio historial confirma el patrón.
                        </Text>
                        {historicalEvidence.map((e: any) => (
                            <TO
                                key={e.id}
                                style={styles.memCard}
                                onPress={() => navigation.navigate('EntryDetail', { entryId: e.id })}
                                activeOpacity={0.8}
                            >
                                <View style={{ flex: 1 }}>
                                    <View style={styles.histCardHead}>
                                        <Text style={styles.memTitle} numberOfLines={1}>
                                            {e.title || 'Registro'}
                                        </Text>
                                        <View style={styles.histScorePill}>
                                            <Text style={styles.histScoreText}>
                                                {(e.similarity ?? 0).toFixed(2)}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={styles.memMeta}>
                                        {fmtDate(e.created_at)}{e.category ? ` · ${e.category}` : ''}
                                    </Text>
                                </View>
                                <CR size={16} color={tokens.text.disabled} />
                            </TO>
                        ))}
                    </View>
                )}
            </ScrollView>
        </SAV>
    );
};

const makeStyles = (tokens: ThemeTokens) => StyleSheet.create({
    container: { flex: 1, backgroundColor: tokens.bg.page },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { color: tokens.text.primary, fontSize: 17, fontWeight: '700' },
    body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },

    reflejoCard: {
        backgroundColor: tokens.accent.purpleSoft,
        borderWidth: 1,
        borderColor: tokens.accent.purpleSoft,
        borderRadius: 16,
        padding: 18,
        marginBottom: 28,
    },
    reflejoHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
    reflejoLabel: { color: tokens.accent.purple, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
    reflejoText: { color: tokens.text.primary, fontSize: 16, lineHeight: 25, fontWeight: '500' },

    section: { marginBottom: 26 },
    sectionTitle: { color: tokens.text.muted, fontSize: 12, fontWeight: '900', letterSpacing: 1.8, marginBottom: 12 },

    loopCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: tokens.bg.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: tokens.border.subtle,
        padding: 15,
        marginBottom: 10,
    },
    loopText: { color: tokens.text.primary, fontSize: 15, fontWeight: '600', lineHeight: 21 },
    loopTask: { color: tokens.text.muted, fontSize: 13, marginTop: 5, lineHeight: 18 },

    memCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: tokens.bg.card,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: tokens.border.subtle,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 8,
    },
    memTitle: { color: tokens.text.secondary, fontSize: 14, fontWeight: '600' },
    memMeta: { color: tokens.text.muted, fontSize: 12, fontWeight: '600', marginTop: 3, textTransform: 'capitalize' },

    sectionSub: {
        color: tokens.text.muted,
        fontSize: 12,
        fontStyle: 'italic',
        marginTop: -4,
        marginBottom: 10,
        letterSpacing: 0.3,
    },
    histCardHead: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
        marginBottom: 2,
    },
    histScorePill: {
        backgroundColor: tokens.accent.purpleSoft,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    histScoreText: {
        color: tokens.accent.purple,
        fontSize: 11,
        fontWeight: '700',
    },
});

export default ReflexionDetalleScreen;
