import React, { useState, useEffect, useMemo } from 'react';
import {
    View, Text, StyleSheet, FlatList,
    TouchableOpacity, ActivityIndicator, StatusBar,
    RefreshControl, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, MessageSquare, AlertCircle, Sparkles, User, ExternalLink } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { FeedbackService } from '../services/FeedbackService';
import { useTheme } from '../theme/ThemeContext';
import { ThemeTokens } from '../theme/tokens';

export default function FeedbackHistoryScreen() {
    const navigation = useNavigation<any>();
    const { tokens } = useTheme();
    const styles = useMemo(() => makeStyles(tokens), [tokens]);
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
            case 'bug': return tokens.accent.red;
            case 'improvement': return tokens.text.link;
            default: return tokens.text.muted;
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
                <ActivityIndicator size="large" color={tokens.accent.indigo} />
            </View>
        );
    }

    return (
        <SAV style={styles.container}>
            <StatusBar barStyle={tokens.statusBar} />
            <View style={styles.header}>
                <TO onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ChevronLeft color={tokens.text.primary} size={28} />
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
                    }} tintColor={tokens.accent.indigo} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <MessageSquare size={48} color={tokens.border.default} />
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
                        
                        {item.attachment_url && (
                            <View style={styles.attachmentContainer}>
                                <Image 
                                    source={{ uri: item.attachment_url }} 
                                    style={styles.attachmentImage}
                                    resizeMode="cover"
                                />
                                <View style={styles.attachmentOverlay}>
                                    <ExternalLink size={12} color={tokens.text.onAccent} />
                                    <Text style={styles.attachmentText}>Adjunto</Text>
                                </View>
                            </View>
                        )}
                        
                        <View style={styles.cardBottom}>
                            <User size={14} color={tokens.text.disabled} />
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

const makeStyles = (tokens: ThemeTokens) => StyleSheet.create({
    container: { flex: 1, backgroundColor: tokens.bg.page },
    loadingContainer: { flex: 1, backgroundColor: tokens.bg.page, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderColor: tokens.border.default
    },
    headerTitle: { color: tokens.text.primary, fontWeight: 'bold', letterSpacing: 2 },
    backBtn: { padding: 8 },
    listContent: { padding: 20 },
    card: {
        backgroundColor: tokens.bg.card,
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: tokens.border.subtle
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    typeBadge: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    typeText: { fontSize: 10, fontWeight: '900' },
    date: { color: tokens.text.disabled, fontSize: 12 },
    content: { color: tokens.text.secondary, fontSize: 15, lineHeight: 22, marginBottom: 16 },
    cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    userEmail: { color: tokens.text.disabled, fontSize: 12 },
    emptyState: { alignItems: 'center', marginTop: 100, gap: 16 },
    emptyText: { color: tokens.text.disabled, fontSize: 16 },
    attachmentContainer: {
        width: '100%',
        height: 150,
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 16,
        backgroundColor: tokens.bg.page,
        borderWidth: 1,
        borderColor: tokens.border.subtle
    },
    attachmentImage: {
        width: '100%',
        height: '100%'
    },
    attachmentOverlay: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        backgroundColor: tokens.bg.overlay,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        gap: 4
    },
    attachmentText: {
        color: tokens.text.onAccent,
        fontSize: 10,
        fontWeight: 'bold'
    }
});
