/**
 * MapasScreen — "Tus Mapas"
 *
 * Two sub-sections:
 *  • Patrones: rows from user_patterns (already populated by analyze-patterns).
 *  • Proyectos: rows from user_projects (populated by detect-projects EF).
 *
 * Tapping any card navigates to EntriesByMapScreen with the supporting
 * entry_ids so the user can drill into the captures that built the map.
 *
 * The detect-projects EF is triggered on-demand with a 24h client-side
 * cache (AsyncStorage), so opening this screen costs at most one Anthropic
 * call per day per user.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    StatusBar, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, MapPin, Sparkles, Activity } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SupabaseService } from '../services/SupabaseService';
import { useAuth } from '../context/AuthContext';

type Tab = 'patrones' | 'proyectos';
const PROJECT_REFRESH_KEY = 'PROJECT_DETECTION_LAST_RUN';
const PROJECT_REFRESH_MS = 24 * 60 * 60 * 1000; // 24h

export default function MapasScreen() {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const [tab, setTab] = useState<Tab>('patrones');
    const [patterns, setPatterns] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [detecting, setDetecting] = useState(false);

    const CL = ChevronLeft as any;

    const loadAll = useCallback(async () => {
        if (!user) return;
        const [pats, projs] = await Promise.all([
            SupabaseService.getUserPatterns(user.id),
            SupabaseService.getProjects(user.id),
        ]);
        setPatterns(pats || []);
        setProjects(projs || []);
        setLoading(false);
        setRefreshing(false);
    }, [user]);

    // First-load detection: if we never ran detect-projects, or last run was
    // >24h ago, trigger it. The list reloads automatically when it finishes.
    const maybeTriggerDetection = useCallback(async () => {
        if (!user) return;
        try {
            const last = await AsyncStorage.getItem(`${PROJECT_REFRESH_KEY}_${user.id}`);
            const now = Date.now();
            const fresh = last && (now - parseInt(last, 10)) < PROJECT_REFRESH_MS;
            if (fresh) return;
            setDetecting(true);
            const res = await SupabaseService.triggerProjectDetection(user.id);
            if (res.success) {
                await AsyncStorage.setItem(`${PROJECT_REFRESH_KEY}_${user.id}`, String(now));
                await loadAll();
            }
        } catch (e: any) {
            console.warn('MAPAS: detection trigger failed:', e?.message);
        } finally {
            setDetecting(false);
        }
    }, [user, loadAll]);

    useEffect(() => {
        loadAll().then(() => maybeTriggerDetection());
    }, [loadAll, maybeTriggerDetection]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadAll();
    }, [loadAll]);

    const openPattern = (pat: any) => {
        const ids: string[] = Array.isArray(pat.supporting_entry_ids) ? pat.supporting_entry_ids : [];
        navigation.navigate('EntriesByMap', {
            mapId: pat.id,
            mapName: pat.title || 'Patrón',
            entryIds: ids,
        });
    };

    const openProject = (proj: any) => {
        const ids: string[] = Array.isArray(proj.entry_ids) ? proj.entry_ids : [];
        navigation.navigate('EntriesByMap', {
            mapId: proj.id,
            mapName: proj.name || 'Proyecto',
            entryIds: ids,
        });
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <CL color="white" size={28} />
                </TouchableOpacity>
                <View style={styles.headerTitleWrap}>
                    <Text style={styles.headerTitle}>TUS MAPAS</Text>
                    <Text style={styles.headerSub}>Lo que se repite en tu historia</Text>
                </View>
                <View style={{ width: 44 }} />
            </View>

            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tabBtn, tab === 'patrones' && styles.tabBtnActive]}
                    onPress={() => setTab('patrones')}
                    activeOpacity={0.7}
                >
                    <Activity size={14} color={tab === 'patrones' ? '#c084fc' : '#64748b'} />
                    <Text style={[styles.tabText, tab === 'patrones' && styles.tabTextActive]}>
                        Patrones ({patterns.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabBtn, tab === 'proyectos' && styles.tabBtnActive]}
                    onPress={() => setTab('proyectos')}
                    activeOpacity={0.7}
                >
                    <MapPin size={14} color={tab === 'proyectos' ? '#c084fc' : '#64748b'} />
                    <Text style={[styles.tabText, tab === 'proyectos' && styles.tabTextActive]}>
                        Proyectos ({projects.length})
                    </Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#6366f1" />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
                    }
                >
                    {tab === 'patrones' ? (
                        patterns.length === 0 ? (
                            <View style={styles.empty}>
                                <Activity size={36} color="#334155" />
                                <Text style={styles.emptyTitle}>Sin patrones detectados aún</Text>
                                <Text style={styles.emptyText}>
                                    Cuando captures más memorias, BlackBoxMind detectará los patrones
                                    cognitivos y conductuales que se repiten en tu historia.
                                </Text>
                            </View>
                        ) : (
                            patterns.map((p: any) => {
                                const supportCount = Array.isArray(p.supporting_entry_ids) ? p.supporting_entry_ids.length : 0;
                                return (
                                    <TouchableOpacity
                                        key={p.id}
                                        style={styles.card}
                                        onPress={() => openPattern(p)}
                                        activeOpacity={0.85}
                                    >
                                        <View style={styles.cardHead}>
                                            <Text style={styles.cardKind}>
                                                {(p.pattern_type || 'patrón').toUpperCase()}
                                            </Text>
                                            <View style={styles.freqPill}>
                                                <Text style={styles.freqPillText}>×{p.frequency ?? supportCount}</Text>
                                            </View>
                                        </View>
                                        <Text style={styles.cardTitle} numberOfLines={2}>{p.title}</Text>
                                        {!!p.description && (
                                            <Text style={styles.cardDesc} numberOfLines={2}>{p.description}</Text>
                                        )}
                                        {supportCount > 0 && (
                                            <Text style={styles.cardLink}>
                                                Ver {supportCount} entrada{supportCount === 1 ? '' : 's'} →
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                );
                            })
                        )
                    ) : (
                        // Proyectos tab
                        detecting && projects.length === 0 ? (
                            <View style={styles.empty}>
                                <ActivityIndicator size="small" color="#6366f1" style={{ marginBottom: 12 }} />
                                <Text style={styles.emptyTitle}>Detectando proyectos…</Text>
                                <Text style={styles.emptyText}>
                                    Analizando tu historia para extraer los proyectos y áreas de vida recurrentes.
                                    Esto se actualiza una vez al día.
                                </Text>
                            </View>
                        ) : projects.length === 0 ? (
                            <View style={styles.empty}>
                                <MapPin size={36} color="#334155" />
                                <Text style={styles.emptyTitle}>Sin proyectos detectados aún</Text>
                                <Text style={styles.emptyText}>
                                    Necesitamos más entradas (al menos 5) y mencionar proyectos o áreas
                                    concretas para que BlackBoxMind las mapee.
                                </Text>
                            </View>
                        ) : (
                            projects.map((proj: any) => {
                                const cnt = Array.isArray(proj.entry_ids) ? proj.entry_ids.length : 0;
                                return (
                                    <TouchableOpacity
                                        key={proj.id}
                                        style={styles.card}
                                        onPress={() => openProject(proj)}
                                        activeOpacity={0.85}
                                    >
                                        <View style={styles.cardHead}>
                                            <Text style={styles.cardKind}>PROYECTO</Text>
                                            <View style={styles.freqPill}>
                                                <Text style={styles.freqPillText}>×{proj.frequency ?? cnt}</Text>
                                            </View>
                                        </View>
                                        <Text style={styles.cardTitle} numberOfLines={2}>{proj.name}</Text>
                                        {!!proj.description && (
                                            <Text style={styles.cardDesc} numberOfLines={2}>{proj.description}</Text>
                                        )}
                                        {cnt > 0 && (
                                            <Text style={styles.cardLink}>
                                                Ver {cnt} entrada{cnt === 1 ? '' : 's'} →
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                );
                            })
                        )
                    )}

                    {tab === 'proyectos' && detecting && projects.length > 0 && (
                        <View style={styles.detectingNote}>
                            <ActivityIndicator size="small" color="#818cf8" style={{ marginRight: 8 }} />
                            <Text style={styles.detectingNoteText}>Buscando nuevos proyectos…</Text>
                        </View>
                    )}
                    <View style={{ height: 24 }} />
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

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
    headerTitleWrap: { flex: 1, alignItems: 'center' },
    headerTitle: { color: 'white', fontSize: 16, fontWeight: '900', letterSpacing: 2 },
    headerSub: { color: '#818cf8', fontSize: 11, fontWeight: '700', marginTop: 2 },

    tabs: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 4,
    },
    tabBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        backgroundColor: '#151B2C',
        borderColor: '#1E293B',
        borderWidth: 1.5,
        borderRadius: 12,
    },
    tabBtnActive: {
        backgroundColor: 'rgba(192,132,252,0.08)',
        borderColor: 'rgba(192,132,252,0.35)',
    },
    tabText: { color: '#64748b', fontSize: 13, fontWeight: '700' },
    tabTextActive: { color: '#c084fc' },

    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },

    empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
    emptyTitle: { color: '#e2e8f0', fontSize: 16, fontWeight: '800', marginTop: 12, textAlign: 'center' },
    emptyText: { color: '#64748b', fontSize: 13, lineHeight: 19, marginTop: 8, textAlign: 'center' },

    card: {
        backgroundColor: '#151B2C',
        borderColor: '#1E293B',
        borderWidth: 1.5,
        borderRadius: 14,
        paddingVertical: 16,
        paddingHorizontal: 16,
        marginBottom: 12,
        shadowColor: '#000000',
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
    },
    cardHead: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    cardKind: { color: '#94a3b8', fontSize: 10, fontWeight: '700', letterSpacing: 1.6 },
    freqPill: {
        backgroundColor: 'rgba(192,132,252,0.12)',
        borderColor: 'rgba(192,132,252,0.3)',
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    freqPillText: { color: '#c084fc', fontSize: 11, fontWeight: '800' },
    cardTitle: { color: '#f1f5f9', fontSize: 16, fontWeight: '700', marginBottom: 6, lineHeight: 22 },
    cardDesc: { color: '#94a3b8', fontSize: 13, lineHeight: 19, marginBottom: 8 },
    cardLink: { color: '#818cf8', fontSize: 12, fontWeight: '700' },

    detectingNote: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(99,102,241,0.08)',
        borderColor: 'rgba(99,102,241,0.2)',
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginTop: 12,
    },
    detectingNoteText: { color: '#a5b4fc', fontSize: 12, fontWeight: '600', flex: 1 },
});
