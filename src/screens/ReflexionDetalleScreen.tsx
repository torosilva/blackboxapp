import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Sparkles, RefreshCw, ChevronRight } from 'lucide-react-native';

const ReflexionDetalleScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { reflejo, loops = [], memories = [] } = route.params || {};

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

    return (
        <SAV style={styles.container}>
            <StatusBar barStyle="light-content" />

            <View style={styles.header}>
                <TO onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
                    <CL size={24} color="#e2e8f0" />
                </TO>
                <Text style={styles.headerTitle}>Reflejo de hoy</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
                {/* Full reflejo */}
                <View style={styles.reflejoCard}>
                    <View style={styles.reflejoHead}>
                        <Sp size={15} color="#c084fc" strokeWidth={2.2} />
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
                                    <RC size={16} color="#c084fc" strokeWidth={2.5} style={{ marginTop: 2 }} />
                                )}
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.loopText}>{l.avoidance_reason || l.task}</Text>
                                    {!!l.avoidance_reason && !!l.task && (
                                        <Text style={styles.loopTask}>{l.task}</Text>
                                    )}
                                </View>
                                <CR size={18} color="#475569" />
                            </TO>
                        ))}
                    </View>
                )}

                {/* Related memories */}
                {Array.isArray(memories) && memories.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>MEMORIAS RELACIONADAS</Text>
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
                                <CR size={16} color="#475569" />
                            </TO>
                        ))}
                    </View>
                )}
            </ScrollView>
        </SAV>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0a0f1e' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { color: '#f1f5f9', fontSize: 17, fontWeight: '700' },
    body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },

    reflejoCard: {
        backgroundColor: 'rgba(168,85,247,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(168,85,247,0.28)',
        borderRadius: 16,
        padding: 18,
        marginBottom: 28,
    },
    reflejoHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
    reflejoLabel: { color: '#c084fc', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
    reflejoText: { color: '#e2e8f0', fontSize: 16, lineHeight: 25, fontWeight: '500' },

    section: { marginBottom: 26 },
    sectionTitle: { color: '#94a3b8', fontSize: 12, fontWeight: '900', letterSpacing: 1.8, marginBottom: 12 },

    loopCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#141b2e',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
        padding: 15,
        marginBottom: 10,
    },
    loopText: { color: '#f1f5f9', fontSize: 15, fontWeight: '600', lineHeight: 21 },
    loopTask: { color: '#94a3b8', fontSize: 13, marginTop: 5, lineHeight: 18 },

    memCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(20,27,46,0.6)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 8,
    },
    memTitle: { color: '#cbd5e1', fontSize: 14, fontWeight: '600' },
    memMeta: { color: '#64748b', fontSize: 12, fontWeight: '600', marginTop: 3, textTransform: 'capitalize' },
});

export default ReflexionDetalleScreen;
