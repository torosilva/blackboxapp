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
    const { user, profile } = useAuth();

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

    const predefinedQuestions = [
        "¿Qué sesgos detectas aquí?",
        "¿Cuáles son los siguientes pasos?",
        "Resume nuestra discusión estratégica",
    ];

    useEffect(() => {
        if (threadId) {
            loadHistory();
        } else {
            setFetchingHistory(false);
            // Fallback: If no threadId, go back
            navigation.goBack();
        }
    }, [threadId]);

    const loadHistory = async () => {
        try {
            const history = await SupabaseService.getChatMessages(threadId);
            if (history && history.length > 0) {
                const formatted = history.map((m: any) => ({
                    role: m.role as 'user' | 'model',
                    parts: [{ text: m.content }]
                }));
                setMessages(formatted);
            } else {
                // Initial greeting if no messages
                setMessages([
                    {
                        role: 'model',
                        parts: [{ text: `Hola ${fullName}, estoy listo para profundizar en "${title || 'esta consulta'}". ¿En qué puedo ayudarte hoy dentro de esta categoría?` }]
                    }
                ]);
            }
        } catch (error) {
            console.error('LOAD_HISTORY_ERROR:', error);
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
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
            >
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.chatContainer}
                    contentContainerStyle={styles.chatContent}
                    keyboardShouldPersistTaps="handled"
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
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
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
    messageBubble: { padding: 16, borderRadius: 24, maxWidth: '85%' },
    userBubble: { backgroundColor: '#6366f1', borderBottomRightRadius: 4 },
    aiBubble: { backgroundColor: '#0f172a', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#1e293b' },
    messageText: { fontSize: 15, lineHeight: 22 },
    userText: { color: 'white' },
    aiText: { color: '#cbd5e1' },
    suggestions: { paddingVertical: 15 },
    suggestionBtn: {
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.3)',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 8,
        marginRight: 10
    },
    suggestionText: { color: '#a5b4fc', fontSize: 13 },
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
