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
import { aiService } from '../services/ai';
import { useSubscription } from '../hooks/useSubscription';
import { Crown } from 'lucide-react-native';

const ChatScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { threadId, category, title, isTherapyMode, entryContext, initialMessage } = route.params || {};
    const { user, profile, refreshProfile } = useAuth();
    const { isPro } = useSubscription();
    const Cr = Crown as any;

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
    const initialSentRef = useRef(false);
    // Hybrid memoria: a home-originated chat (has initialMessage) becomes a
    // journal entry. The first message creates it (fail-safe); leaving the
    // chat enriches it with a summary of the whole conversation.
    const memoryEntryIdRef = useRef<string | null>(null);
    const memoryCreatingRef = useRef(false);
    const memorySyncingRef = useRef(false);
    const messagesRef = useRef<ChatMessage[]>([]);
    useEffect(() => { messagesRef.current = messages; }, [messages]);
    // 'none' before any save; 'saving' first write; 'saved' persisted;
    // 'updating' while re-syncing the full conversation.
    const [memoryState, setMemoryState] = useState<'none' | 'saving' | 'saved' | 'updating'>('none');
    // Message count included in the last memoria write — used to know when
    // there are new turns the user could push with "Actualizar".
    const [memorySyncedLen, setMemorySyncedLen] = useState(0);

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

    useEffect(() => {
        if (threadId) {
            setMessages([]);
            setFetchingHistory(true);
            loadHistory();
        } else {
            setFetchingHistory(false);
            navigation.goBack();
        }
        // Therapy mode (post-entry) is always accessible.
        // The PRO gate only applies to manually opened chats from ChatHub.
        if (!isPro && !isTherapyMode) {
            setIsLimitReached(true);
        }
    }, [threadId, isPro, isTherapyMode]);

    const loadHistory = async () => {
        try {
            console.log('CHAT_SCREEN: Loading history for thread:', threadId);
            const history = await SupabaseService.getChatMessages(threadId);
            // Load the memoria already linked to this thread (if any) so
            // reopening it updates that entry instead of duplicating.
            if (!isTherapyMode) {
                try {
                    const thread = await SupabaseService.getChatThread(threadId);
                    if (thread?.entry_id) {
                        memoryEntryIdRef.current = thread.entry_id;
                        setMemorySyncedLen(history?.length ?? 0);
                        setMemoryState('saved');
                    }
                } catch (e: any) {
                    console.warn('CHAT_SCREEN: getChatThread failed:', e?.message);
                }
            }
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

            // 2. Get AI Response — pass therapy context if in therapy mode
            const response = await ChatService.sendMessage(
                user.id,
                text,
                messages,
                fullName,
                category,
                isTherapyMode,
                entryContext
            );
            
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

    // Fail-safe: turn the conversation's first user message into a memoria
    // and link it to this thread, so it's never lost and reopening the
    // thread updates the same entry instead of duplicating. Therapy chats
    // are excluded — they already own a journal entry.
    const ensureMemory = async () => {
        if (memoryEntryIdRef.current || memoryCreatingRef.current) return;
        if (!user || !threadId || isTherapyMode || !isPro) return;
        const seedText = messagesRef.current.find((m) => m.role === 'user')?.parts[0]?.text ?? '';
        if (!seedText.trim()) return;
        memoryCreatingRef.current = true;
        setMemoryState('saving');
        try {
            const a = await aiService.generateDailySummary([seedText], user.id);
            const entry = await SupabaseService.createEntry({
                user_id: user.id,
                title: a.title,
                content: a.original_text || seedText,
                summary: a.summary,
                mood_label: a.mood_label,
                sentiment_score: a.sentiment_score,
                wellness_recommendation: a.wellness_recommendation,
                strategic_insight: a.strategic_insight,
                action_items: a.action_items,
                audio_url: null,
                original_text: a.original_text || seedText,
                category: a.category || 'PERSONAL',
            });
            if (entry?.id) {
                memoryEntryIdRef.current = entry.id;
                await SupabaseService.linkThreadEntry(threadId, entry.id);
                setMemorySyncedLen(messagesRef.current.length);
                setMemoryState('saved');
            } else {
                setMemoryState('none');
            }
        } catch (e: any) {
            console.warn('CHAT_MEMORY: ensureMemory failed:', e?.message);
            setMemoryState('none');
        } finally {
            memoryCreatingRef.current = false;
        }
    };

    // Re-sync the memoria with a summary of the whole conversation.
    // Called manually from the in-chat banner and once on leaving the chat.
    const syncMemory = () => {
        const id = memoryEntryIdRef.current;
        if (!id || !user || memorySyncingRef.current) return;
        const msgs = messagesRef.current;
        if (msgs.filter((m) => m.role === 'user').length < 2) return;
        if (msgs.length <= memorySyncedLen) return; // nothing new to push
        memorySyncingRef.current = true;
        setMemoryState('updating');
        const len = msgs.length;
        const transcript = msgs
            .map((m) => `${m.role === 'user' ? 'Usuario' : 'BLACKBOX'}: ${m.parts[0]?.text ?? ''}`)
            .join('\n\n');
        aiService.generateDailySummary([transcript], user.id)
            .then((a) => SupabaseService.updateEntryAnalysis(id, {
                title: a.title,
                content: a.original_text || transcript,
                summary: a.summary,
                mood_label: a.mood_label,
                sentiment_score: a.sentiment_score,
                wellness_recommendation: a.wellness_recommendation,
                strategic_insight: a.strategic_insight,
                action_items: a.action_items,
                original_text: a.original_text || transcript,
                category: a.category,
            }))
            .then(() => {
                setMemorySyncedLen(len);
                setMemoryState('saved');
            })
            .catch((e: any) => {
                console.warn('CHAT_MEMORY: syncMemory failed:', e?.message);
                setMemoryState('saved');
            })
            .finally(() => { memorySyncingRef.current = false; });
    };

    // Auto-send the message the user typed on the home screen, once,
    // after history loads. Gated users never trigger this (paywall stays).
    useEffect(() => {
        if (fetchingHistory || initialSentRef.current) return;
        if (!initialMessage || !initialMessage.trim()) return;
        if (!isPro && !isTherapyMode) return;
        initialSentRef.current = true;
        handleSend(initialMessage);
    }, [fetchingHistory, initialMessage, isPro, isTherapyMode]);

    // Once the conversation has a user message, ensure a linked memoria
    // exists (covers both home chats and reopened Hub threads).
    useEffect(() => {
        if (fetchingHistory) return;
        if (memoryEntryIdRef.current || memoryCreatingRef.current) return;
        if (messages.some((m) => m.role === 'user')) {
            ensureMemory(); // background, not awaited
        }
    }, [fetchingHistory, messages]);

    useEffect(() => {
        const unsub = navigation.addListener('beforeRemove', () => {
            syncMemory();
        });
        return unsub;
    }, [navigation]);

    if (isLimitReached) {
        return (
            <SAV style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 30 }]}>
                <View style={{ backgroundColor: '#1e293b', padding: 30, borderRadius: 30, width: '100%', borderWidth: 1, borderColor: '#6366f1' }}>
                    <Cr size={60} color="#facc15" style={{ alignSelf: 'center', marginBottom: 20 }} />
                    <Text style={{ color: 'white', fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 15 }}>
                        Función PRO
                    </Text>
                    <Text style={{ color: '#94a3b8', fontSize: 16, textAlign: 'center', marginBottom: 30, lineHeight: 24 }}>
                        El <Text style={{ color: '#6366f1', fontWeight: 'bold' }}>Chat Estratégico BLACKBOX</Text> es exclusivo de usuarios PRO.{"\n\n"}
                        Accede a consultas ilimitadas con tu asesor de IA.
                    </Text>
                    <TouchableOpacity
                        style={{ backgroundColor: '#6366f1', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}
                        onPress={() => navigation.navigate('Paywall')}
                    >
                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>VER PLANES PRO</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ alignSelf: 'center', paddingTop: 10 }}>
                        <Text style={{ color: '#475569', fontSize: 14 }}>Volver</Text>
                    </TouchableOpacity>
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

    const memoryHasNew =
        memoryState === 'saved' &&
        messages.length > memorySyncedLen &&
        messages.filter((m) => m.role === 'user').length >= 2;

    return (
        <SAV style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <View style={styles.header}>
                <TO onPress={() => isTherapyMode ? navigation.navigate('Home') : navigation.goBack()} style={styles.backBtn}>
                    <CL color="white" size={28} />
                </TO>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{title?.toUpperCase() || 'SESIÓN'}</Text>
                    {isTherapyMode ? (
                        <Text style={[styles.categoryLabel, { color: '#a855f7' }]}>🧠 SESIÓN ESTRATÉGICA</Text>
                    ) : (
                        <Text style={styles.categoryLabel}>{category}</Text>
                    )}
                </View>
                <View style={{ width: 44 }} />
            </View>

            {memoryState !== 'none' && (
                <View style={styles.memoryBanner}>
                    {(memoryState === 'saving' || memoryState === 'updating') && (
                        <ActivityIndicator size="small" color="#a855f7" style={{ marginRight: 8 }} />
                    )}
                    <Text style={styles.memoryBannerText}>
                        {memoryState === 'saving' && 'Guardando como memoria…'}
                        {memoryState === 'updating' && 'Actualizando memoria…'}
                        {memoryState === 'saved' && (memoryHasNew
                            ? 'Guardado como memoria · hay mensajes nuevos'
                            : 'Guardado como memoria ✓')}
                    </Text>
                    {memoryState === 'saved' && memoryHasNew && (
                        <TO onPress={syncMemory} style={styles.memoryBannerBtn}>
                            <Text style={styles.memoryBannerBtnText}>Actualizar</Text>
                        </TO>
                    )}
                </View>
            )}

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
                        placeholder={isTherapyMode ? "¿Cómo te hace sentir eso?" : "Escribe un mensaje..."}
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
    memoryBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(168, 85, 247, 0.12)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(168, 85, 247, 0.25)',
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    memoryBannerText: { color: '#c4b5fd', fontSize: 12, fontWeight: '700', flex: 1 },
    memoryBannerBtn: {
        backgroundColor: '#a855f7',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        marginLeft: 8,
    },
    memoryBannerBtnText: { color: 'white', fontSize: 12, fontWeight: '900' },
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
