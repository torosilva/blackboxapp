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
                        {loading ? 'Cargando…' : `${items.length} abiertos`}
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
                    <ActionList key={refreshKey} actions={items} />
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
});
