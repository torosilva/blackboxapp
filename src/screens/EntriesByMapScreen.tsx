/**
 * EntriesByMapScreen — drill-down from MapasScreen.
 *
 * Receives a list of entry_ids (from a pattern or project) and renders them
 * as cards in the same visual language as "Memorias recientes" on the home.
 * Tapping any card opens EntryDetail.
 */
import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    StatusBar, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SupabaseService } from '../services/SupabaseService';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { ThemeTokens } from '../theme/tokens';

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
    const { tokens } = useTheme();
    const styles = useMemo(() => makeStyles(tokens), [tokens]);
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
            <StatusBar barStyle={tokens.statusBar} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <CL color={tokens.text.primary} size={28} />
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
                    <ActivityIndicator size="large" color={tokens.accent.indigo} />
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
                            tintColor={tokens.accent.indigo}
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
                            <CR size={18} color={tokens.text.disabled} />
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const makeStyles = (tokens: ThemeTokens) => StyleSheet.create({
    container: { flex: 1, backgroundColor: tokens.bg.page },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: tokens.border.subtle,
    },
    backBtn: { padding: 8 },
    headerTitleWrap: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
    headerKind: { color: tokens.text.link, fontSize: 10, fontWeight: '800', letterSpacing: 1.8 },
    headerTitle: { color: tokens.text.primary, fontSize: 16, fontWeight: '800', marginTop: 2 },
    headerSub: { color: tokens.text.muted, fontSize: 11, fontWeight: '600', marginTop: 2 },

    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    emptyTitle: { color: tokens.text.primary, fontSize: 16, fontWeight: '800', textAlign: 'center' },
    emptyText: { color: tokens.text.muted, fontSize: 13, lineHeight: 19, marginTop: 8, textAlign: 'center' },

    scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
    entryCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: tokens.bg.card,
        borderColor: tokens.border.default,
        borderWidth: 1.5,
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 14,
        marginBottom: 10,
        shadowColor: tokens.shadow.color,
        shadowOpacity: 0.3,
        shadowRadius: 7,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
    },
    entryTitle: { color: tokens.text.primary, fontSize: 15, fontWeight: '700', lineHeight: 20 },
    entryMeta: { color: tokens.text.muted, fontSize: 11, fontWeight: '600', marginTop: 4 },
    entrySummary: { color: tokens.text.muted, fontSize: 13, lineHeight: 18, marginTop: 6 },
});
