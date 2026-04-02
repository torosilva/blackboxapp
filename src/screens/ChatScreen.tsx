import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TextInput,
    TouchableOpacity, ScrollView, KeyboardAvoidingView,
    Platform, ActivityIndicator, StatusBar, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Send, ChevronLeft, Bot, Sparkles, Brain } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChatService, ChatMessage } from '../services/ChatService';
import { useAuth } from '../context/AuthContext';
import { SupabaseService } from '../services/SupabaseService';

const ChatScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { threadId, category, title } = route.params || {};
    const { user, profile, refreshProfile } = useAuth();

    const SAV = SafeAreaView as any;
    const TO = TouchableOpacity as any;
    const TI = TextInput as any;
    const Sn = Send as any;
    const CL = ChevronLeft as any;
    const Bo = Bot as any;

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetchingHistory, setFetchingHistory] = useState(true);
    const scrollViewRef = useRef<ScrollView>(null);

    const fullName = profile?.full_name || user?.email?.split('@')[0] || 'Explorador';

    const getPredefinedQuestions = () => {
        switch (category) {
            case 'BUSINESS':
                return [
                    "¿Cómo optimizo mi flujo de trabajo?",
                    "¿Qué riesgos estratégicos ves?",
                    "¿Cómo puedo delegar esto?"
                ];
            case 'PERSONAL':
                return [
                    "¿Cómo mejoro mi claridad mental?",
                    "¿Qué sesgos personales detectas?",
                    "¿Cómo equilibro esto?"
                ];
            case 'DEVELOPMENT':
                return [
                    "¿Qué nuevas habilidades debería priorizar?",
                    "¿Cómo acelero mi crecimiento profesional?",
                    "¿Qué bloqueos detectas en mi avance?"
                ];
            case 'WELLNESS':
            case 'HEALTH':
                return [
                    "¿Cómo afecta esto mi rendimiento?",
                    "¿Qué pausas recomiendas?",
                    "¿Cómo gestiono el estrés?"
                ];
            default:
                return [
                    "¿Qué sesgos detectas aquí?",
                    "¿Cuáles son los siguientes pasos?",
                    "Resume nuestra discusión"
                ];
        }
    };

    const predefinedQuestions = getPredefinedQuestions();

    const [isLimitReached, setIsLimitReached] = useState(false);
    const [inviteCode, setInviteCode] = useState('');

    const handleApplyCode = async () => {
        if (!inviteCode.trim() || !user) return;
        setLoading(true);
        try {
            const success = await SupabaseService.applyInvitationCode(user.id, `BB-${inviteCode.trim().toUpperCase()}`);
            if (success) {
                await refreshProfile();
                setIsLimitReached(false);
                Alert.alert("¡Éxito!", "Ahora eres PRO. Chat ilimitado activado.");
            } else {
                Alert.alert("Error", "Código inválido o ya utilizado.");
            }
        } catch (e) {
            Alert.alert("Error", "Hubo un problema al aplicar el código.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (threadId) {
            setMessages([]); // Clear previous state to avoid cross-thread leaks
            setFetchingHistory(true);
            loadHistory();
        } else {
            setFetchingHistory(false);
            navigation.goBack();
        }
        checkLimits();
    }, [threadId]);

    const checkLimits = async () => {
        if (user && profile && !profile.is_pro) {
            const usage = await SupabaseService.getTodayUsage(user.id);
            // If they already started a chat today and this is a new thread (no messages)
            if (usage.chatsCount >= 1 && messages.length === 0) {
                setIsLimitReached(true);
            }
        }
    };

    const loadHistory = async () => {
        try {
            console.log('CHAT_SCREEN: Loading history for thread:', threadId);
            const history = await SupabaseService.getChatMessages(threadId);
            if (history && history.length > 0) {
                console.log('CHAT_SCREEN: History loaded, messages:', history.length);
                const formatted = history.map((m: any) => ({
                    role: m.role as 'user' | 'model',
                    parts: [{ text: m.content }]
                }));
                setMessages(formatted);
            } else {
                console.log('CHAT_SCREEN: No history found, showing greeting');
                setMessages([
                    {
                        role: 'model',
                        parts: [{ text: `Hola ${fullName}, estoy listo para profundizar en "${title || 'esta consulta'}". ¿En qué puedo ayudarte hoy?` }]
                    }
                ]);
            }
        } catch (error) {
            console.error('LOAD_HISTORY_ERROR:', error);
            Alert.alert('Error', 'No se pudo cargar el historial del chat');
        } finally {
            setFetchingHistory(false);
        }
    };

    const handleSend = async (text: string = inputText) => {
        if (!text.trim() || loading || !user || !threadId) return;

        const userMsg: ChatMessage = { role: 'user', parts: [{ text }] };
        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setLoading(true);

        try {
            // 1. Save User Message to DB
            await SupabaseService.saveChatMessage(threadId, 'user', text);

            // 2. Get AI Response
            // Pass the category to the ChatService for more efficient/specialized prompting
            const response = await ChatService.sendMessage(user.id, text, messages, fullName, category);
            
            const aiText = response.parts[0].text;
            const aiMsg: ChatMessage = {
                role: 'model',
                parts: [{ text: aiText }]
            };
            
            // 3. Save AI Response to DB
            await SupabaseService.saveChatMessage(threadId, 'model', aiText);
            
            setMessages(prev => [...prev, aiMsg]);
        } catch (error) {
            console.error('SEND_MESSAGE_ERROR:', error);
            const errorMsg: ChatMessage = {
                role: 'model',
                parts: [{ text: "Lo siento, tuve un problema al procesar tu solicitud. Intenta de nuevo." }]
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    };

    if (isLimitReached) {
        return (
            <SAV style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 30 }]}>
                <View style={{ backgroundColor: '#1e293b', padding: 30, borderRadius: 30, width: '100%', borderWidth: 1, borderColor: '#6366f1' }}>
                    <Brain size={60} color="#6366f1" style={{ alignSelf: 'center', marginBottom: 20 }} />
                    <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 15 }}>
                        Límite de Consultas
                    </Text>
                    <Text style={{ color: '#94a3b8', fontSize: 16, textAlign: 'center', marginBottom: 30, lineHeight: 24 }}>
                        Como usuario <Text style={{ color: '#6366f1', fontWeight: 'bold' }}>FREE</Text> solo puedes iniciar un chat estratégico por día.
                        {"\n\n"}Para consultas ilimitadas con la IA, activa tu suscripción a <Text style={{ color: '#a855f7', fontWeight: 'bold' }}>PRO</Text>.
                    </Text>

                    <View style={{ flexDirection: 'row', backgroundColor: '#0f172a', borderRadius: 15, paddingHorizontal: 15, paddingVertical: 5, marginBottom: 20, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                        <Text style={{ color: '#6366f1', fontWeight: 'bold', fontSize: 18 }}>BB-</Text>
                        <TI
                            style={{ flex: 1, height: 50, color: 'white', fontSize: 18, fontWeight: '600', letterSpacing: 2 }}
                            placeholder="CÓDIGO"
                            placeholderTextColor="#475569"
                            autoCapitalize="characters"
                            value={inviteCode}
                            onChangeText={setInviteCode}
                            maxLength={6}
                        />
                    </View>

                    <TO 
                        style={{ backgroundColor: '#6366f1', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' }}
                        onPress={handleApplyCode}
                        disabled={loading}
                    >
                        {loading ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>ACTIVAR PRO</Text>}
                    </TO>

                    <TO onPress={() => navigation.goBack()} style={{ marginTop: 25, alignSelf: 'center' }}>
                        <Text style={{ color: '#475569', fontSize: 14, fontWeight: '500' }}>Volver</Text>
                    </TO>
                </View>
            </SAV>
        );
    }

    if (fetchingHistory) {
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
                    <CL color="white" size={28} />
                </TO>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{title?.toUpperCase() || 'CHAT'}</Text>
                    <Text style={styles.categoryLabel}>{category}</Text>
                </View>
                <View style={{ width: 44 }} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.chatContainer}
                    contentContainerStyle={styles.chatContent}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                >
                    {messages.map((msg, idx) => (
                        <View
                            key={idx}
                            style={[
                                styles.messageWrapper,
                                msg.role === 'user' ? styles.userWrapper : styles.aiWrapper
                            ]}
                        >
                            <View style={[
                                styles.messageBubble,
                                msg.role === 'user' ? styles.userBubble : styles.aiBubble
                            ]}>
                                <Text style={[
                                    styles.messageText,
                                    msg.role === 'user' ? styles.userText : styles.aiText
                                ]}>
                                    {msg.parts[0].text}
                                </Text>
                            </View>
                        </View>
                    ))}
                    {loading && (
                        <View style={styles.aiWrapper}>
                            <View style={[styles.messageBubble, styles.aiBubble, { paddingVertical: 12 }]}>
                                <ActivityIndicator size="small" color="#818cf8" />
                            </View>
                        </View>
                    )}
                </ScrollView>

                {/* Suggestions */}
                {messages.length <= 1 && !loading && (
                    <View style={styles.suggestions}>
                        <ScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={false} 
                            contentContainerStyle={{ paddingHorizontal: 20, paddingRight: 40 }}
                        >
                            {predefinedQuestions.map((q, i) => (
                                <TO
                                    key={i}
                                    style={styles.suggestionBtn}
                                    onPress={() => handleSend(q)}
                                >
                                    <Text style={styles.suggestionText}>{q}</Text>
                                </TO>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Input */}
                <View style={styles.inputArea}>
                    <TI
                        style={styles.input}
                        placeholder="Escribe un mensaje..."
                        placeholderTextColor="#64748b"
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                    />
                    <TO
                        style={[styles.sendBtn, !inputText.trim() && { opacity: 0.5 }]}
                        onPress={() => handleSend()}
                        disabled={!inputText.trim() || loading}
                    >
                        <Sn size={20} color="white" />
                    </TO>
                </View>
            </KeyboardAvoidingView>
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
    headerTitleContainer: { flex: 1, alignItems: 'center' },
    headerTitle: { color: 'white', fontWeight: 'bold', letterSpacing: 2, fontSize: 13 },
    categoryLabel: { color: '#6366f1', fontSize: 10, fontWeight: '900', marginTop: 2 },
    backBtn: { padding: 8 },
    chatContainer: { flex: 1 },
    chatContent: { padding: 20, paddingBottom: 100 },
    messageWrapper: { marginBottom: 20, width: '100%', flexDirection: 'row' },
    userWrapper: { justifyContent: 'flex-end' },
    aiWrapper: { justifyContent: 'flex-start' },
    messageBubble: { padding: 18, borderRadius: 20, maxWidth: '88%' },
    userBubble: { backgroundColor: '#4f46e5', borderBottomRightRadius: 4 },
    aiBubble: { backgroundColor: '#1e293b', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    messageText: { fontSize: 16, lineHeight: 24 },
    userText: { color: 'white' },
    aiText: { color: '#f8fafc' },
    suggestions: { paddingVertical: 10, backgroundColor: 'rgba(0,0,0,0.2)' },
    suggestionBtn: {
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.4)',
        borderRadius: 20,
        paddingHorizontal: 18,
        paddingVertical: 10,
        marginRight: 12,
        height: 40,
        justifyContent: 'center'
    },
    suggestionText: { color: '#c7d2fe', fontSize: 14, fontWeight: '500' },
    inputArea: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: 15,
        paddingBottom: Platform.OS === 'ios' ? 20 : 15,
        backgroundColor: '#020617',
        borderTopWidth: 1,
        borderColor: '#1e293b'
    },
    input: {
        flex: 1,
        backgroundColor: '#0f172a',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingTop: 10,
        paddingBottom: 10,
        color: 'white',
        maxHeight: 200,
        borderWidth: 1,
        borderColor: '#1e293b'
    },
    sendBtn: {
        width: 44,
        height: 44,
        backgroundColor: '#6366f1',
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10
    }
});

export default ChatScreen;
