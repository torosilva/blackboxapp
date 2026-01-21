import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, TextInput,
    TouchableOpacity, ScrollView, KeyboardAvoidingView,
    Platform, ActivityIndicator, StatusBar
} from 'react-native';
import { Send, ChevronLeft, Bot, User, Sparkles, Brain } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { ChatService, ChatMessage } from '../services/ChatService';
import { useAuth } from '../context/AuthContext';

const ChatScreen = () => {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);

    const predefinedQuestions = [
        "¿Qué sesgos he tenido esta semana?",
        "¿Cómo puedo mejorar mi enfoque?",
        "Hazme un resumen de mi progreso",
    ];

    const handleSend = async (text: string = inputText) => {
        if (!text.trim() || loading || !user) return;

        const userMsg: ChatMessage = { role: 'user', parts: [{ text }] };
        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setLoading(true);

        try {
            const response = await ChatService.sendMessage(user.id, text, messages);
            const aiMsg: ChatMessage = {
                role: 'model',
                parts: [{ text: response.parts[0].text }]
            };
            setMessages(prev => [...prev, aiMsg]);
        } catch (error) {
            const errorMsg: ChatMessage = {
                role: 'model',
                parts: [{ text: "Lo siento, tuve un problema al procesar tu solicitud. Intenta de nuevo." }]
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Initial greeting if no messages
        if (messages.length === 0) {
            setMessages([
                {
                    role: 'model',
                    parts: [{ text: "Hola soy tu Blackbox AI Consultant. Recuerda que soy un agente de IA y que puedo cometer errores. Siempre es importante que mi información se tome como referencia para ser discutida con tu coach de confianza. ¿En qué podemos profundizar hoy basándonos en tus registros?" }]
                }
            ]);
        }
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ChevronLeft color="white" size={28} />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Bot size={20} color="#818cf8" />
                    <Text style={styles.headerTitle}>BLACKBOX AI CONSULTANT</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.chatContainer}
                    contentContainerStyle={[styles.chatContent, { flexGrow: 1 }]}
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
                {messages.length === 1 && !loading && (
                    <View style={styles.suggestions}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
                            {predefinedQuestions.map((q, i) => (
                                <TouchableOpacity
                                    key={i}
                                    style={styles.suggestionBtn}
                                    onPress={() => handleSend(q)}
                                >
                                    <Text style={styles.suggestionText}>{q}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Input */}
                <View style={styles.inputArea}>
                    <TextInput
                        style={styles.input}
                        placeholder="Pregunta sobre tus registros..."
                        placeholderTextColor="#64748b"
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                    />
                    <TouchableOpacity
                        style={[styles.sendBtn, !inputText.trim() && { opacity: 0.5 }]}
                        onPress={() => handleSend()}
                        disabled={!inputText.trim() || loading}
                    >
                        <Send size={20} color="white" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#020617' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 20 : 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderColor: '#1e293b'
    },
    headerTitleContainer: { flexDirection: 'row', alignItems: 'center' },
    headerTitle: { color: 'white', fontWeight: 'bold', letterSpacing: 2, marginLeft: 8 },
    backBtn: { padding: 10, minWidth: 44, minHeight: 44, justifyContent: 'center' },
    chatContainer: { flex: 1 },
    chatContent: { padding: 20, paddingBottom: 120 }, // Extra space to scroll past the input
    messageWrapper: { marginBottom: 24, width: '100%' },
    userWrapper: { alignItems: 'flex-end' },
    aiWrapper: { alignItems: 'flex-start' },
    messageBubble: { padding: 16, borderRadius: 20, maxWidth: '85%' },
    userBubble: { backgroundColor: '#6366f1', borderBottomRightRadius: 4 },
    aiBubble: { backgroundColor: '#1e293b', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#334155' },
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
        paddingBottom: Platform.OS === 'ios' ? 30 : 15,
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
        maxHeight: 100,
        borderWidth: 1,
        borderColor: '#334155'
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
