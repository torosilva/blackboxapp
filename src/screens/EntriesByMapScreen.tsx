/**
 * EntriesByMapScreen — drill-down from MapasScreen.
 *
 * Receives a list of entry_ids (from a pattern or project) and renders them
 * as cards in the same visual language as "Memorias recientes" on the home.
 * Tapping any card opens EntryDetail.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    StatusBar, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SupabaseService } from '../services/SupabaseService';
import { useAuth } from '../context/AuthContext';

const fmtDate = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days <= 0) return 'Hoy';
    if (days === 1) return 'Ayer';
    if (days < 7) return `Hace ${days} días`;
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
};

export default function EntriesByMapScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { user } = useAuth();

    const params = route.params || {};
    const mapName: string = params.mapName || 'Mapa';
    const entryIds: string[] = Array.isArray(params.entryIds) ? params.entryIds : [];

    const [entries, setEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const CL = ChevronLeft as any;
    const CR = ChevronRight as any;

    const load = useCallback(async () => {
        if (!user) return;
        const data = await SupabaseService.getEntriesByIds(user.id, entryIds);
        setEntries(data || []);
        setLoading(false);
        setRefreshing(false);
    }, [user, entryIds]);

    useEffect(() => { load(); }, [load]);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <CL color="white" size={28} />
                </TouchableOpacity>
                <View style={styles.headerTitleWrap}>
                    <Text style={styles.headerKind}>MAPA</Text>
                    <Text style={styles.headerTitle} numberOfLines={1}>{mapName}</Text>
                    <Text style={styles.headerSub}>{entries.length} entrada{entries.length === 1 ? '' : 's'}</Text>
                </View>
                <View style={{ width: 44 }} />
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#6366f1" />
                </View>
            ) : entries.length === 0 ? (
                <View style={styles.center}>
                    <Text style={styles.emptyTitle}>Sin entradas en este mapa</Text>
                    <Text style={styles.emptyText}>
                        Las entradas pueden haberse eliminado, o el mapa quedó desactualizado.
                        Vuelve a abrir Tus Mapas para refrescar.
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
                    {entries.map((e: any) => (
                        <TouchableOpacity
                            key={e.id}
                            style={styles.entryCard}
                            onPress={() => navigation.navigate('EntryDetail', { entryId: e.id })}
                            activeOpacity={0.85}
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={styles.entryTitle} numberOfLines={2}>
                                    {e.title || 'Registro'}
                                </Text>
                                <Text style={styles.entryMeta}>
                                    {fmtDate(e.created_at)}{e.category ? ` · ${e.category}` : ''}
                                </Text>
                                {!!e.summary && (
                                    <Text style={styles.entrySummary} numberOfLines={2}>{e.summary}</Text>
                                )}
                            </View>
                            <CR size={18} color="#475569" />
                        </TouchableOpacity>
                    ))}
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
    headerTitleWrap: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
    headerKind: { color: '#818cf8', fontSize: 10, fontWeight: '800', letterSpacing: 1.8 },
    headerTitle: { color: 'white', fontSize: 16, fontWeight: '800', marginTop: 2 },
    headerSub: { color: '#64748b', fontSize: 11, fontWeight: '600', marginTop: 2 },

    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    emptyTitle: { color: '#e2e8f0', fontSize: 16, fontWeight: '800', textAlign: 'center' },
    emptyText: { color: '#64748b', fontSize: 13, lineHeight: 19, marginTop: 8, textAlign: 'center' },

    scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
    entryCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#151B2C',
        borderColor: '#1E293B',
        borderWidth: 1.5,
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 14,
        marginBottom: 10,
        shadowColor: '#000000',
        shadowOpacity: 0.3,
        shadowRadius: 7,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
    },
    entryTitle: { color: '#f1f5f9', fontSize: 15, fontWeight: '700', lineHeight: 20 },
    entryMeta: { color: '#64748b', fontSize: 11, fontWeight: '600', marginTop: 4 },
    entrySummary: { color: '#94a3b8', fontSize: 13, lineHeight: 18, marginTop: 6 },
});
