import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    ActivityIndicator,
    TextInput,
    Alert,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { 
    Briefcase, 
    User, 
    Heart, 
    MessageSquare, 
    Plus, 
    ChevronRight, 
    Trash2,
    Sparkles,
    ChevronLeft
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { SupabaseService } from '../services/SupabaseService';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { ThemeTokens } from '../theme/tokens';

const ChatHubScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { user } = useAuth();
    const isFocused = useIsFocused();
    const { tokens } = useTheme();
    const styles = useMemo(() => makeStyles(tokens), [tokens]);

    const CATEGORIES = useMemo(() => ([
        { id: 'BUSINESS', label: 'Estrategia', icon: Briefcase, color: tokens.text.link, bg: tokens.accent.indigoSoft },
        { id: 'PERSONAL', label: 'Personales', icon: User, color: tokens.accent.yellow, bg: tokens.accent.yellowSoft },
        { id: 'DEVELOPMENT', label: 'Desarrollo Personal', icon: Sparkles, color: tokens.accent.purple, bg: tokens.accent.purpleSoft },
        { id: 'WELLNESS', label: 'Bienestar', icon: Heart, color: tokens.accent.green, bg: tokens.accent.greenSoft },
        { id: 'GENERAL', label: 'Consulta General', icon: MessageSquare, color: tokens.text.muted, bg: tokens.bg.chip },
    ]), [tokens]);
    
    const [threads, setThreads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showNewThread, setShowNewThread] = useState(false);
    const [newThreadTitle, setNewThreadTitle] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('GENERAL');

    const TO = TouchableOpacity as any;
    const SAV = SafeAreaView as any;
    const LG = LinearGradient as any;
    const TI = TextInput as any;

    useEffect(() => {
        if (isFocused && user) {
            fetchThreads();
        }
    }, [isFocused, user]);

    const fetchThreads = async () => {
        if (!user) return;
        try {
            const data = await SupabaseService.getChatThreads(user.id);
            if (data) setThreads(data);
        } catch (error) {
            console.error('FETCH_THREADS_ERROR:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateThread = async () => {
        if (!newThreadTitle.trim() || !user) return;
        setLoading(true);
        try {
            const newThread = await SupabaseService.createChatThread(
                user.id, 
                newThreadTitle, 
                selectedCategory as any
            );
            if (newThread) {
                setShowNewThread(false);
                setNewThreadTitle('');
                navigation.navigate('Chat', { 
                    threadId: newThread.id, 
                    category: newThread.category,
                    title: newThread.title
                });
            }
        } catch (error) {
            console.error('CREATE_THREAD_ERROR:', error);
            Alert.alert('Error', 'No se pudo crear la conversación');
        } finally {
            setLoading(false);
        }
    };
    
    const handleQuickChat = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const dateStr = new Date().toLocaleDateString();
            const threadTitle = `Consulta Rápida ${dateStr}`;
            const newThread = await SupabaseService.createChatThread(
                user.id, 
                threadTitle, 
                'GENERAL'
            );
            if (newThread) {
                navigation.navigate('Chat', { 
                    threadId: newThread.id, 
                    category: newThread.category,
                    title: newThread.title
                });
            }
        } catch (error) {
            console.error('QUICK_CHAT_ERROR:', error);
            Alert.alert('Error', 'No se pudo iniciar la consulta rápida');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteThread = (id: string) => {
        Alert.alert(
            'Eliminar Conversación',
            '¿Estás seguro de que quieres borrar este hilo? Se perderá todo el historial.',
            [
                { text: 'Cancelar', style: 'cancel' },
                { 
                    text: 'Eliminar', 
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await SupabaseService.deleteChatThread(id);
                            fetchThreads();
                        } catch (error) {
                            Alert.alert('Error', 'No se pudo eliminar');
                        }
                    }
                }
            ]
        );
    };

    if (loading && threads.length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={tokens.accent.indigo} />
            </View>
        );
    }

    return (
        <SAV style={styles.container}>
            <StatusBar barStyle={tokens.statusBar} />

            {/* Header */}
            <View style={styles.header}>
                <TO onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ChevronLeft color={tokens.text.primary} size={28} />
                </TO>
                <View style={styles.headerTitleContainer}>
                    <Sparkles size={20} color={tokens.text.link} />
                    <Text style={styles.headerTitle}>HISTORIAL DE CHATS</Text>
                </View>
                <View style={{ width: 44 }} />
            </View>

            <Text style={styles.hubSubtitle}>
                Tus conversaciones de consulta. Lo que reflexionas y se queda vive en Memorias.
            </Text>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {!showNewThread ? (
                    <>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Conversaciones Recientes</Text>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TO style={[styles.addBtn, { backgroundColor: tokens.bg.input, borderWidth: 1, borderColor: tokens.border.strong }]} onPress={handleQuickChat}>
                                    <Sparkles size={16} color={tokens.text.link} />
                                    <Text style={[styles.addBtnText, { color: tokens.text.link }]}>Flash</Text>
                                </TO>
                                <TO style={styles.addBtn} onPress={() => setShowNewThread(true)}>
                                    <Plus size={16} color={tokens.text.onAccent} />
                                    <Text style={styles.addBtnText}>Nueva</Text>
                                </TO>
                            </View>
                        </View>

                        {threads.length === 0 ? (
                            <View style={styles.emptyState}>
                                <MessageSquare size={48} color={tokens.border.default} />
                                <Text style={styles.emptyText}>No hay conversaciones activas.</Text>
                                <Text style={styles.emptySubtext}>Inicia un nuevo hilo estratégico para comenzar.</Text>
                            </View>
                        ) : (
                            threads.map((thread) => {
                                const cat = CATEGORIES.find(c => c.id === thread.category) || CATEGORIES[3];
                                const Icon = cat.icon;
                                return (
                                    <TO 
                                        key={thread.id} 
                                        style={styles.threadCard}
                                        onPress={() => navigation.navigate('Chat', { 
                                            threadId: thread.id, 
                                            category: thread.category,
                                            title: thread.title
                                        })}
                                    >
                                        <View style={[styles.catIcon, { backgroundColor: cat.bg }]}>
                                            <Icon size={20} color={cat.color} />
                                        </View>
                                        <View style={styles.threadInfo}>
                                            <Text style={styles.threadTitle} numberOfLines={1}>{thread.title}</Text>
                                            <Text style={styles.threadDate}>
                                                {new Date(thread.updated_at).toLocaleDateString()} • {cat.label}
                                            </Text>
                                        </View>
                                        <TO style={styles.deleteBtn} onPress={() => handleDeleteThread(thread.id)}>
                                            <Trash2 size={16} color={tokens.text.disabled} />
                                        </TO>
                                        <ChevronRight size={20} color={tokens.border.default} />
                                    </TO>
                                );
                            })
                        )}
                    </>
                ) : (
                    <View style={styles.newThreadContainer}>
                        <Text style={styles.newThreadHeading}>Nueva Conversación</Text>
                        
                        <Text style={styles.label}>Título del Hilo</Text>
                        <TI
                            style={styles.input}
                            placeholder="Ej: Estrategia Q3, Plan de Salud..."
                            placeholderTextColor={tokens.text.disabled}
                            value={newThreadTitle}
                            onChangeText={setNewThreadTitle}
                            autoFocus
                        />

                        <Text style={styles.label}>Selecciona Categoría</Text>
                        <View style={styles.categoryGrid}>
                            {CATEGORIES.map((cat) => {
                                const Icon = cat.icon;
                                const isSelected = selectedCategory === cat.id;
                                return (
                                    <TO 
                                        key={cat.id} 
                                        style={[
                                            styles.categoryItem, 
                                            isSelected && { borderColor: cat.color, backgroundColor: cat.bg }
                                        ]}
                                        onPress={() => setSelectedCategory(cat.id)}
                                    >
                                        <View style={[styles.catIconCircle, { backgroundColor: isSelected ? cat.color : tokens.bg.input }]}>
                                            <Icon size={24} color={isSelected ? tokens.text.onAccent : tokens.text.muted} />
                                        </View>
                                        <Text style={[styles.categoryLabel, isSelected && { color: tokens.text.primary }]}>
                                            {cat.label}
                                        </Text>
                                        <ChevronRight size={20} color={isSelected ? cat.color : tokens.border.default} style={{ marginLeft: 'auto' }} />
                                    </TO>
                                );
                            })}
                        </View>

                        <View style={styles.formActions}>
                            <TO style={styles.cancelBtn} onPress={() => setShowNewThread(false)}>
                                <Text style={styles.cancelBtnText}>Cancelar</Text>
                            </TO>
                            <TO 
                                style={[styles.createBtn, !newThreadTitle.trim() && { opacity: 0.5 }]} 
                                onPress={handleCreateThread}
                                disabled={!newThreadTitle.trim() || loading}
                            >
                                <LG colors={[tokens.accent.indigo, tokens.accent.indigoStrong]} start={{x:0, y:0}} end={{x:1, y:0}} style={styles.btnGradient}>
                                    <Text style={styles.createBtnText}>Crear y Empezar</Text>
                                </LG>
                            </TO>
                        </View>
                    </View>
                )}
            </ScrollView>
        </SAV>
    );
};

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
    headerTitleContainer: { flexDirection: 'row', alignItems: 'center' },
    headerTitle: { color: tokens.text.primary, fontWeight: 'bold', letterSpacing: 2, marginLeft: 8 },
    backBtn: { padding: 8 },
    hubSubtitle: { color: tokens.text.muted, fontSize: 12, fontWeight: '600', paddingHorizontal: 20, paddingBottom: 8, lineHeight: 17 },
    scrollContent: { padding: 20 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    sectionTitle: { color: tokens.text.muted, fontSize: 13, fontWeight: '900', letterSpacing: 1 },
    addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: tokens.accent.indigo, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    addBtnText: { color: tokens.text.onAccent, fontWeight: 'bold', fontSize: 13, marginLeft: 4 },
    threadCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: tokens.bg.card,
        padding: 16,
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: tokens.border.subtle
    },
    catIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    threadInfo: { flex: 1 },
    threadTitle: { color: tokens.text.primary, fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
    threadDate: { color: tokens.text.disabled, fontSize: 12 },
    deleteBtn: { padding: 8, marginRight: 8 },
    emptyState: { alignItems: 'center', marginTop: 80, gap: 16 },
    emptyText: { color: tokens.text.secondary, fontSize: 16, fontWeight: 'bold' },
    emptySubtext: { color: tokens.text.disabled, fontSize: 14, textAlign: 'center' },
    newThreadContainer: { gap: 20 },
    newThreadHeading: { color: tokens.text.primary, fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
    label: { color: tokens.text.muted, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
    input: {
        backgroundColor: tokens.bg.card,
        borderRadius: 16,
        padding: 16,
        color: tokens.text.primary,
        fontSize: 16,
        borderWidth: 1,
        borderColor: tokens.border.default
    },
    categoryGrid: { flexDirection: 'column', gap: 12 },
    categoryItem: {
        width: '100%',
        flexDirection: 'row',
        backgroundColor: tokens.bg.card,
        borderRadius: 20,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: tokens.border.default,
        padding: 16,
        gap: 16
    },
    catIconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center'
    },
    categoryLabel: { color: tokens.text.muted, fontSize: 16, fontWeight: '700' },
    formActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
    cancelBtn: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 18 },
    cancelBtnText: { color: tokens.text.disabled, fontWeight: 'bold' },
    createBtn: { flex: 2, borderRadius: 18, overflow: 'hidden' },
    btnGradient: { padding: 18, alignItems: 'center' },
    createBtnText: { color: tokens.text.onAccent, fontWeight: 'bold', fontSize: 16 }
});

export default ChatHubScreen;
