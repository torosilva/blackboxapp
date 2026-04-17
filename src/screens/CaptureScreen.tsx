import React, { useState, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    StatusBar, Alert, KeyboardAvoidingView, Platform, Animated, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Mic, MicOff, ArrowUp, Box, Brain, Plus,
    LayoutDashboard, BarChart2, MessageCircle, ShieldAlert
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { aiService } from '../services/ai';
import { voiceService } from '../services/voice';
import { SupabaseService } from '../services/SupabaseService';
import { NotificationService } from '../services/notificationService';
import AILoadingOverlay from '../components/AILoadingOverlay';

const CaptureScreen = () => {
    const navigation = useNavigation<any>();
    const { user, profile } = useAuth();

    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [lastRecordingUri, setLastRecordingUri] = useState<string | null>(null);

    const inputRef = useRef<any>(null);
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const brainAnim = useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.08, duration: 1800, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
            ])
        ).start();
        Animated.loop(
            Animated.sequence([
                Animated.timing(brainAnim, { toValue: -5, duration: 2200, useNativeDriver: true }),
                Animated.timing(brainAnim, { toValue: 0, duration: 2200, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
    const canSubmit = content.trim().length >= 40 && wordCount >= 8;

    const displayName = (profile?.full_name || user?.email?.split('@')[0] || '').split(' ')[0];
    const greeting = (() => {
        const h = new Date().getHours();
        if (h < 12) return 'Buenos días';
        if (h < 19) return 'Buenas tardes';
        return 'Buenas noches';
    })();

    const handleSave = async () => {
        if (!content.trim()) return;
        if (!user) { Alert.alert('Error', 'Debes estar conectado.'); return; }

        if (!canSubmit) {
            Alert.alert(
                'Contenido Insuficiente',
                'Escribe al menos un párrafo para que BLACKBOX pueda darte un análisis profundo.',
                [{ text: 'Entendido' }]
            );
            return;
        }

        setLoading(true);
        try {
            let audioUrl = null;
            if (lastRecordingUri) {
                audioUrl = await SupabaseService.uploadAudio(lastRecordingUri, user.id);
            }

            const analysis = await aiService.generateDailySummary([content], user.id);

            await SupabaseService.createEntry({
                user_id: user.id,
                title: analysis.title,
                content: analysis.original_text || content,
                sentiment_score: analysis.sentiment_score,
                mood_label: analysis.mood_label,
                summary: analysis.summary,
                wellness_recommendation: analysis.wellness_recommendation,
                strategic_insight: analysis.strategic_insight,
                action_items: analysis.action_items,
                audio_url: audioUrl,
                original_text: analysis.original_text || content,
                category: analysis.category || 'PERSONAL'
            });

            if (Array.isArray(analysis.action_items)) {
                const highs = analysis.action_items.filter((a: any) => a.priority === 'HIGH');
                for (const h of highs) {
                    await NotificationService.scheduleStrategicFollowup(h.task);
                }
            }

            setContent('');
            setLastRecordingUri(null);
            Alert.alert('✓ Memoria registrada', analysis.title || 'Entrada guardada en BLACKBOX.');
        } catch (err: any) {
            console.error('CAPTURE_ERROR:', err);
            Alert.alert('No se pudo guardar', 'Hubo un problema al analizar tu entrada. Verifica tu conexión e intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    const toggleRecording = async () => {
        if (isRecording) {
            const uri = await voiceService.stopRecording();
            setLastRecordingUri(uri);
            setIsRecording(false);
            if (uri) {
                setIsTranscribing(true);
                try {
                    const trans = await voiceService.transcribeAudio(uri);
                    setContent(prev => prev + (prev ? ' ' : '') + trans);
                } catch {
                    Alert.alert('Error de transcripción', 'No se pudo convertir el audio a texto.');
                } finally {
                    setIsTranscribing(false);
                }
            }
        } else {
            const started = await voiceService.startRecording(() => { });
            if (started) setIsRecording(true);
        }
    };

    const SAV = SafeAreaView as any;
    const TO = TouchableOpacity as any;
    const Mi = Mic as any;
    const MO = MicOff as any;
    const Au = ArrowUp as any;
    const Bx = Box as any;
    const Br = Brain as any;
    const Pl = Plus as any;
    const LD = LayoutDashboard as any;
    const BC = BarChart2 as any;
    const MC = MessageCircle as any;
    const SA = ShieldAlert as any;

    const shortcuts = [
        { label: 'Dashboard', icon: LD, onPress: () => navigation.navigate('Dashboard') },
        { label: 'Reporte Estratégico', icon: BC, onPress: () => navigation.navigate('WeeklyReport', {}) },
        { label: 'Últimos Chats', icon: MC, onPress: () => navigation.navigate('ChatHub') },
        { label: 'Intervención Estratégica', icon: SA, onPress: () => navigation.navigate('Settings', { initialViewMode: 'biases' }) },
    ];

    return (
        <SAV style={styles.container}>
            <StatusBar barStyle="light-content" />

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={20}
            >
                <View style={styles.body}>
                    {/* Hero — big animated logo */}
                    <View style={styles.hero}>
                        <View style={styles.logoBox}>
                            <Animated.View style={{ transform: [{ translateY: brainAnim }], position: 'absolute' }}>
                                <Bx size={44} color="#818cf8" strokeWidth={1.8} />
                            </Animated.View>
                            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                                <Br size={88} color="#a855f7" strokeWidth={1.3} />
                            </Animated.View>
                        </View>
                        <Text style={styles.greeting}>
                            {greeting}{displayName ? `, ${displayName}` : ''}
                        </Text>
                    </View>

                    {/* Input card — Claude style */}
                    <View style={styles.inputCard}>
                        <TextInput
                            ref={inputRef}
                            style={styles.input}
                            placeholder="¿Qué está en tu mente ahora mismo?"
                            placeholderTextColor="#475569"
                            multiline
                            value={content}
                            onChangeText={setContent}
                            textAlignVertical="top"
                            editable={!loading}
                        />

                        <View style={styles.inputFooter}>
                            <View style={styles.leftActions}>
                                <TO style={styles.iconBtn} activeOpacity={0.7}>
                                    <Pl size={16} color="#64748b" />
                                </TO>
                                {wordCount > 0 && (
                                    <Text style={styles.wordCount}>{wordCount} palabras</Text>
                                )}
                            </View>

                            <View style={styles.rightActions}>
                                <TO
                                    onPress={toggleRecording}
                                    disabled={loading || isTranscribing}
                                    style={[styles.iconBtn, isRecording && styles.iconBtnRecording]}
                                    activeOpacity={0.7}
                                >
                                    {isTranscribing ? (
                                        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                                            <Mi size={16} color="#6366f1" />
                                        </Animated.View>
                                    ) : isRecording ? (
                                        <MO size={16} color="white" />
                                    ) : (
                                        <Mi size={16} color="#64748b" />
                                    )}
                                </TO>

                                <TO
                                    onPress={handleSave}
                                    disabled={!canSubmit || loading}
                                    style={[styles.sendBtn, canSubmit ? styles.sendBtnActive : styles.sendBtnDisabled]}
                                    activeOpacity={0.8}
                                >
                                    <Au size={16} color={canSubmit ? 'white' : '#475569'} strokeWidth={2.5} />
                                </TO>
                            </View>
                        </View>
                    </View>

                    {/* Shortcut chips — small, delicate, centered */}
                    <View style={styles.chipsWrap}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.chipsRow}
                        >
                            {shortcuts.map((s) => {
                                const Icon = s.icon;
                                return (
                                    <TO
                                        key={s.label}
                                        onPress={s.onPress}
                                        style={styles.chip}
                                        activeOpacity={0.7}
                                    >
                                        <Icon size={12} color="#94a3b8" strokeWidth={2} />
                                        <Text style={styles.chipText}>{s.label}</Text>
                                    </TO>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </KeyboardAvoidingView>

            <AILoadingOverlay
                visible={loading || isTranscribing}
                message={isTranscribing ? 'Transcribiendo audio...' : 'Ingresando a tu BlackboxMind...'}
            />
        </SAV>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0a0f1e' },
    body: {
        flex: 1,
        paddingHorizontal: 20,
        justifyContent: 'center',
        alignItems: 'stretch',
    },
    hero: {
        alignItems: 'center',
        marginBottom: 36,
    },
    logoBox: {
        width: 120, height: 120,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    greeting: {
        color: '#e2e8f0',
        fontSize: 24,
        fontWeight: '400',
        letterSpacing: 0.2,
        textAlign: 'center',
    },
    inputCard: {
        backgroundColor: '#141b2e',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        padding: 16,
        minHeight: 140,
    },
    input: {
        color: '#e2e8f0',
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '300',
        minHeight: 60,
        paddingTop: 4,
        paddingBottom: 12,
    },
    inputFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    leftActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    rightActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    iconBtn: {
        width: 30, height: 30, borderRadius: 15,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconBtnRecording: {
        backgroundColor: 'rgba(239,68,68,0.2)',
        borderColor: '#ef4444',
    },
    wordCount: { color: '#475569', fontSize: 12 },
    sendBtn: {
        width: 30, height: 30, borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendBtnActive: { backgroundColor: '#6366f1' },
    sendBtnDisabled: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    chipsWrap: {
        marginTop: 14,
        flexGrow: 0,
        flexShrink: 0,
    },
    chipsRow: {
        gap: 6,
        paddingHorizontal: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 14,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    chipText: {
        color: '#94a3b8',
        fontSize: 11,
        fontWeight: '500',
    },
});

export default CaptureScreen;
