import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList,
    ActivityIndicator, StatusBar, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, X } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { SupabaseService } from '../services/SupabaseService';

type SearchResult = {
    id: string;
    title: string | null;
    summary: string | null;
    content: string | null;
    mood_label: string | null;
    sentiment_score: number | null;
    category: string | null;
    created_at: string;
    similarity: number;
};

const SearchScreen = () => {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastQueryRef = useRef('');

    const SAV = SafeAreaView as any;
    const TO = TouchableOpacity as any;
    const CL = ChevronLeft as any;
    const XI = X as any;

    const runSearch = useCallback(async (q: string) => {
        if (!user?.id) return;
        const trimmed = q.trim();
        lastQueryRef.current = trimmed;
        if (!trimmed) {
            setResults([]);
            setLoading(false);
            setError(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const [semData, textData] = await Promise.all([
                SupabaseService.semanticSearch(user.id, trimmed, { threshold: 0.5, limit: 20 }),
                SupabaseService.textSearchEntries(user.id, trimmed, 20),
            ]);
            if (lastQueryRef.current !== trimmed) return;

            const byId = new Map<string, SearchResult>();
            for (const r of (semData || [])) byId.set(r.id, r);

            const qLower = trimmed.toLowerCase();
            for (const r of (textData || [])) {
                const titleHit = (r.title || '').toLowerCase().includes(qLower);
                const virtualSim = titleHit ? 0.99 : 0.85;
                const existing = byId.get(r.id);
                if (existing) {
                    existing.similarity = Math.max(existing.similarity ?? 0, virtualSim);
                } else {
                    byId.set(r.id, { ...r, similarity: virtualSim });
                }
            }

            const merged = Array.from(byId.values())
                .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
            setResults(merged);
            setLoading(false);
        } catch (e: any) {
            if (lastQueryRef.current !== trimmed) return;
            setError(e?.message || 'search failed');
            setLoading(false);
            setResults([]);
        }
    }, [user]);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { runSearch(query); }, 350);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [query, runSearch]);

    const fmtDate = (iso: string) => {
        const d = new Date(iso);
        const days = Math.floor((Date.now() - d.getTime()) / 86400000);
        if (days <= 0) return 'Hoy';
        if (days === 1) return 'Ayer';
        if (days < 7) return `Hace ${days} días`;
        return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    };

    const renderItem = ({ item }: { item: SearchResult }) => (
        <TO
            style={styles.card}
            onPress={() => navigation.navigate('EntryDetail', { entryId: item.id })}
            activeOpacity={0.85}
        >
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title || 'Sin título'}</Text>
            {!!item.summary && (
                <Text style={styles.cardSummary} numberOfLines={2}>{item.summary}</Text>
            )}
            <View style={styles.cardFooter}>
                <Text style={styles.cardMeta} numberOfLines={1}>
                    {fmtDate(item.created_at)}{item.category ? ` · ${item.category}` : ''}
                </Text>
                <View style={styles.simPill}>
                    <Text style={styles.simPillText}>{(item.similarity ?? 0).toFixed(2)}</Text>
                </View>
            </View>
        </TO>
    );

    const trimmed = query.trim();
    const showEmpty = !trimmed && !loading && !error;
    const showNoResults = !!trimmed && !loading && !error && results.length === 0;

    return (
        <SAV style={styles.container}>
            <StatusBar barStyle="light-content" />

            <View style={styles.header}>
                <TO onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
                    <CL size={24} color="#e2e8f0" />
                </TO>
                <Text style={styles.headerTitle}>Buscar memorias</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.searchBox}>
                <TextInput
                    style={styles.input}
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Busca por significado, no por palabras..."
                    placeholderTextColor="#475569"
                    autoFocus
                    returnKeyType="search"
                    onSubmitEditing={() => { Keyboard.dismiss(); runSearch(query); }}
                    selectionColor="#c084fc"
                />
                {!!query && (
                    <TO onPress={() => setQuery('')} style={styles.clearBtn} activeOpacity={0.7}>
                        <XI size={18} color="#64748b" />
                    </TO>
                )}
            </View>

            <View style={styles.body}>
                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator color="#c084fc" />
                    </View>
                ) : error ? (
                    <TO style={styles.center} onPress={() => runSearch(query)} activeOpacity={0.7}>
                        <Text style={styles.errorText}>Error de búsqueda. Toca para reintentar.</Text>
                    </TO>
                ) : showEmpty ? (
                    <View style={styles.center}>
                        <Text style={styles.emptyText}>
                            Pregúntale a tu segundo cerebro: ¿qué he pensado sobre [tema]?
                        </Text>
                    </View>
                ) : showNoResults ? (
                    <View style={styles.center}>
                        <Text style={styles.emptyText}>
                            Nada encontrado para "{trimmed}". Prueba otra forma de pedirlo.
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={results}
                        keyExtractor={(it) => it.id}
                        renderItem={renderItem}
                        contentContainerStyle={styles.list}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="on-drag"
                    />
                )}
            </View>
        </SAV>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0E1A' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { color: '#f1f5f9', fontSize: 17, fontWeight: '700' },

    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#151B2C',
        borderWidth: 1,
        borderColor: '#1E293B',
        borderRadius: 12,
        marginHorizontal: 20,
        marginTop: 4,
        marginBottom: 16,
        paddingHorizontal: 14,
    },
    input: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 15,
        paddingVertical: 12,
    },
    clearBtn: { padding: 6, marginLeft: 4 },

    body: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    emptyText: { color: '#64748b', fontSize: 14, textAlign: 'center', lineHeight: 21 },
    errorText: { color: '#f87171', fontSize: 14, textAlign: 'center', fontWeight: '600' },

    list: { paddingHorizontal: 20, paddingBottom: 40 },
    card: {
        backgroundColor: '#151B2C',
        borderWidth: 1,
        borderColor: '#1E293B',
        borderRadius: 14,
        padding: 16,
        marginBottom: 10,
    },
    cardTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    cardSummary: { color: '#94a3b8', fontSize: 13, lineHeight: 19, marginTop: 6 },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    cardMeta: { flex: 1, color: '#64748b', fontSize: 12, fontWeight: '600', textTransform: 'capitalize', marginRight: 8 },
    simPill: {
        backgroundColor: 'rgba(192,132,252,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(192,132,252,0.30)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    simPillText: { color: '#c084fc', fontSize: 11, fontWeight: '800' },
});

export default SearchScreen;
