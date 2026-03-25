import React, { useState, useEffect } from 'react';
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

const CATEGORIES = [
    { id: 'BUSINESS', label: 'Estrategia & Negocios', icon: Briefcase, color: '#818cf8', bg: 'rgba(129, 140, 248, 0.1)' },
    { id: 'PERSONAL', label: 'Desarrollo Personal', icon: User, color: '#facc15', bg: 'rgba(250, 204, 21, 0.1)' },
    { id: 'HEALTH', label: 'Bienestar & Salud', icon: Heart, color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
    { id: 'GENERAL', label: 'Consulta General', icon: MessageSquare, color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)' },
];

const ChatHubScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { user } = useAuth();
    const isFocused = useIsFocused();
    
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
                <ActivityIndicator size="large" color="#6366f1" />
            </View>
        );
    }

    return (
        <SAV style={styles.container}>
            <StatusBar barStyle="light-content" />
            
            {/* Header */}
            <View style={styles.header}>
                <TO onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ChevronLeft color="white" size={28} />
                </TO>
                <View style={styles.headerTitleContainer}>
                    <Sparkles size={20} color="#818cf8" />
                    <Text style={styles.headerTitle}>HUB ESTRATÉGICO</Text>
                </View>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {!showNewThread ? (
                    <>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Conversaciones Recientes</Text>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TO style={[styles.addBtn, { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' }]} onPress={handleQuickChat}>
                                    <Sparkles size={16} color="#818cf8" />
                                    <Text style={[styles.addBtnText, { color: '#818cf8' }]}>Flash</Text>
                                </TO>
                                <TO style={styles.addBtn} onPress={() => setShowNewThread(true)}>
                                    <Plus size={16} color="white" />
                                    <Text style={styles.addBtnText}>Nueva</Text>
                                </TO>
                            </View>
                        </View>

                        {threads.length === 0 ? (
                            <View style={styles.emptyState}>
                                <MessageSquare size={48} color="#1e293b" />
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
                                            <Trash2 size={16} color="#475569" />
                                        </TO>
                                        <ChevronRight size={20} color="#1e293b" />
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
                            placeholderTextColor="#475569"
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
                                        <Icon size={24} color={isSelected ? cat.color : '#475569'} />
                                        <Text style={[styles.categoryLabel, isSelected && { color: 'white' }]}>
                                            {cat.label}
                                        </Text>
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
                                <LG colors={['#6366f1', '#4f46e5']} start={{x:0, y:0}} end={{x:1, y:0}} style={styles.btnGradient}>
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
    headerTitleContainer: { flexDirection: 'row', alignItems: 'center' },
    headerTitle: { color: 'white', fontWeight: 'bold', letterSpacing: 2, marginLeft: 8 },
    backBtn: { padding: 8 },
    scrollContent: { padding: 20 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    sectionTitle: { color: '#94a3b8', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
    addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#6366f1', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    addBtnText: { color: 'white', fontWeight: 'bold', fontSize: 13, marginLeft: 4 },
    threadCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0f172a',
        padding: 16,
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)'
    },
    catIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    threadInfo: { flex: 1 },
    threadTitle: { color: 'white', fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
    threadDate: { color: '#475569', fontSize: 12 },
    deleteBtn: { padding: 8, marginRight: 8 },
    emptyState: { alignItems: 'center', marginTop: 80, gap: 16 },
    emptyText: { color: '#cbd5e1', fontSize: 16, fontWeight: 'bold' },
    emptySubtext: { color: '#475569', fontSize: 14, textAlign: 'center' },
    newThreadContainer: { gap: 20 },
    newThreadHeading: { color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
    label: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
    input: {
        backgroundColor: '#0f172a',
        borderRadius: 16,
        padding: 16,
        color: 'white',
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#1e293b'
    },
    categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    categoryItem: {
        width: '48%',
        aspectRatio: 1,
        backgroundColor: '#0f172a',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#1e293b',
        gap: 12,
        padding: 10
    },
    categoryLabel: { color: '#475569', fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
    formActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
    cancelBtn: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 18 },
    cancelBtnText: { color: '#475569', fontWeight: 'bold' },
    createBtn: { flex: 2, borderRadius: 18, overflow: 'hidden' },
    btnGradient: { padding: 18, alignItems: 'center' },
    createBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});

export default ChatHubScreen;
