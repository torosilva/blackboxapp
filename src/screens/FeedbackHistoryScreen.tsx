import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList,
    TouchableOpacity, ActivityIndicator, StatusBar,
    RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, MessageSquare, AlertCircle, Sparkles, User } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { FeedbackService } from '../services/FeedbackService';

export default function FeedbackHistoryScreen() {
    const navigation = useNavigation<any>();
    const [feedback, setFeedback] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchFeedback = async () => {
        const { data, error } = await FeedbackService.getAllFeedback();
        if (data) setFeedback(data);
        setLoading(false);
        setRefreshing(false);
    };

    useEffect(() => {
        fetchFeedback();
    }, []);

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'bug': return '#ef4444';
            case 'improvement': return '#818cf8';
            default: return '#94a3b8';
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'bug': return 'FALLA';
            case 'improvement': return 'MEJORA';
            default: return 'OTRO';
        }
    };

    const TO = TouchableOpacity as any;
    const SAV = SafeAreaView as any;

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#6366f1" />
            </View>
        );
    }

    return (
        <SAV style={styles.container}>
            <StatusBar barStyle="light-content" />
            <View style={styles.header}>
                <TO onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ChevronLeft color="white" size={28} />
                </TO>
                <Text style={styles.headerTitle}>FEEDBACK RECIBIDO</Text>
                <View style={{ width: 44 }} />
            </View>

            <FlatList
                data={feedback}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => {
                        setRefreshing(true);
                        fetchFeedback();
                    }} tintColor="#6366f1" />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <MessageSquare size={48} color="#1e293b" />
                        <Text style={styles.emptyText}>No hay feedback aún.</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <View style={styles.cardTop}>
                            <View style={[styles.typeBadge, { borderColor: getTypeColor(item.type) }]}>
                                <Text style={[styles.typeText, { color: getTypeColor(item.type) }]}>
                                    {getTypeLabel(item.type)}
                                </Text>
                            </View>
                            <Text style={styles.date}>
                                {new Date(item.created_at).toLocaleDateString()}
                            </Text>
                        </View>
                        
                        <Text style={styles.content}>{item.content}</Text>
                        
                        <View style={styles.cardBottom}>
                            <User size={14} color="#475569" />
                            <Text style={styles.userEmail}>
                                {item.profiles?.full_name || 'Usuario Anónimo'}
                            </Text>
                        </View>
                    </View>
                )}
            />
        </SAV>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#020617' },
    loadingContainer: { flex: 1, backgroundColor: '#020617', justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderColor: '#1e293b'
    },
    headerTitle: { color: 'white', fontWeight: 'bold', letterSpacing: 2 },
    backBtn: { padding: 8 },
    listContent: { padding: 20 },
    card: {
        backgroundColor: '#0f172a',
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)'
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    typeBadge: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    typeText: { fontSize: 10, fontWeight: '900' },
    date: { color: '#475569', fontSize: 12 },
    content: { color: '#cbd5e1', fontSize: 15, lineHeight: 22, marginBottom: 16 },
    cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    userEmail: { color: '#475569', fontSize: 12 },
    emptyState: { alignItems: 'center', marginTop: 100, gap: 16 },
    emptyText: { color: '#475569', fontSize: 16 }
});
