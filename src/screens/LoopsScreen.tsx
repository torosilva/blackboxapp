import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView,
    TouchableOpacity, ActivityIndicator, StatusBar, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Zap } from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SupabaseService } from '../services/SupabaseService';
import { useAuth } from '../context/AuthContext';
import { ActionList } from '../components/ActionList';

export default function LoopsScreen() {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    // Bump to remount ActionList with fresh data after a reload.
    const [refreshKey, setRefreshKey] = useState(0);
    const [showAll, setShowAll] = useState(false);

    // Executive triage: a CEO closes 3-5, not 239. Focus = non-stale,
    // HIGH-first, oldest-first; stale = open >21d and not HIGH (relegated,
    // still reachable under "ver todos" — never auto-completed).
    const RANK: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    const now = Date.now();
    const ageDays = (it: any) => (now - new Date(it.created_at).getTime()) / 86400000;
    const isStale = (it: any) => ageDays(it) > 21 && String(it.priority).toUpperCase() !== 'HIGH';
    const sortFn = (a: any, b: any) =>
        (RANK[String(b.priority).toUpperCase()] ?? 2) - (RANK[String(a.priority).toUpperCase()] ?? 2)
        || ageDays(b) - ageDays(a);
    const fresh = items.filter(i => !isStale(i)).sort(sortFn);
    const focusItems = fresh.slice(0, 5);
    const allSorted = [...fresh, ...items.filter(isStale).sort(sortFn)];
    const shown = showAll ? allSorted : focusItems;

    const load = useCallback(async () => {
        if (!user) return;
        const data = await SupabaseService.getOpenActionItems(user.id);
        setItems(data || []);
        setRefreshKey((k) => k + 1);
        setLoading(false);
        setRefreshing(false);
    }, [user]);

    // Reload every time the screen gains focus so freshly created loops
    // (and ones closed elsewhere) stay in sync.
    useFocusEffect(useCallback(() => { load(); }, [load]));

    const CL = ChevronLeft as any;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <CL color="white" size={28} />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>ACTIVE LOOPS</Text>
                    <Text style={styles.headerSub}>
                        {loading ? 'Cargando…' : showAll ? `${items.length} abiertos` : `Foco · ${focusItems.length} de ${items.length}`}
                    </Text>
                </View>
                <View style={{ width: 44 }} />
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#6366f1" />
                </View>
            ) : items.length === 0 ? (
                <View style={styles.center}>
                    <Zap size={48} color="#334155" />
                    <Text style={styles.emptyTitle}>Sin loops abiertos</Text>
                    <Text style={styles.emptyText}>
                        Cuando registres una memoria o converses en el chat, los
                        accionables que detecte BLACKBOX aparecerán aquí para que
                        los cierres.
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
                    {!showAll && (
                        <Text style={styles.focusHint}>
                            {focusItems.length > 0
                                ? 'Cierra estos hoy. El resto no existe hasta que estos estén.'
                                : 'Sin loops de alta prioridad. Revisa todos para depurar.'}
                        </Text>
                    )}
                    <ActionList key={refreshKey + (showAll ? '-all' : '-focus')} actions={shown} />
                    {items.length > focusItems.length && (
                        <TouchableOpacity
                            onPress={() => setShowAll(v => !v)}
                            style={styles.toggleAllBtn}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.toggleAllText}>
                                {showAll ? 'Ver solo el foco' : `Ver todos (${items.length})`}
                            </Text>
                        </TouchableOpacity>
                    )}
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
    headerTitleContainer: { flex: 1, alignItems: 'center' },
    headerTitle: {
        color: 'white', fontSize: 16, fontWeight: '900', letterSpacing: 2,
    },
    headerSub: { color: '#6366f1', fontSize: 11, fontWeight: '800', marginTop: 2 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    emptyTitle: {
        color: 'white', fontSize: 18, fontWeight: '800', marginTop: 16,
    },
    emptyText: {
        color: '#64748b', fontSize: 14, textAlign: 'center', marginTop: 8,
        lineHeight: 20,
    },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
    focusHint: { color: '#fbbf24', fontSize: 13, fontWeight: '700', marginTop: 16, marginBottom: 4, lineHeight: 18 },
    toggleAllBtn: { marginTop: 16, alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
    toggleAllText: { color: '#94a3b8', fontSize: 13, fontWeight: '800' },
});
