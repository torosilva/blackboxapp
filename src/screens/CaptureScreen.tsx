import React, { useState, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    StatusBar, Alert, KeyboardAvoidingView, Platform, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mic, MicOff, Send, Box, Brain } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { aiService } from '../services/ai';
import { voiceService } from '../services/voice';
import { SupabaseService } from '../services/SupabaseService';
import { NotificationService } from '../services/notificationService';
import AILoadingOverlay from '../components/AILoadingOverlay';

const CaptureScreen = () => {
    const { user } = useAuth();

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
                Animated.timing(brainAnim, { toValue: -6, duration: 2200, useNativeDriver: true }),
                Animated.timing(brainAnim, { toValue: 0, duration: 2200, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
    const canSubmit = content.trim().length >= 40 && wordCount >= 8;

    const handleSave = async () => {
        if (!content.trim()) return;
        if (!user) { Alert.alert("Error", "Debes estar conectado."); return; }

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
                    await NotificationService.scheduleStrategicFollowup(h.task || h.description);
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
            const started = await voiceService.startRecording(() => {});
            if (started) setIsRecording(true);
        }
    };

    const SAV = SafeAreaView as any;
    const Mi = Mic as any;
    const MO = MicOff as any;
    const Se = Send as any;
    const Bx = Box as any;
    const Br = Brain as any;

    return (
        <SAV style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Header — animated logo */}
            <View style={styles.header}>
                <View style={styles.logoContainer}>
                    <Animated.View style={{ transform: [{ translateY: brainAnim }], position: 'absolute' }}>
                        <Bx size={20} color="#818cf8" strokeWidth={2} />
                    </Animated.View>
                    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                        <Br size={36} color="#a855f7" strokeWidth={1.5} />
                    </Animated.View>
                </View>
                <Text style={styles.brandText}>BLACKBOXMIND</Text>
                <Text style={styles.dateText}>
                    {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
                </Text>
            </View>

            {/* Editor */}
            <KeyboardAvoidingView
                style={styles.editorWrapper}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={90}
            >
                <View style={styles.editorRow}>
                    <TextInput
                        ref={inputRef}
                        style={styles.editor}
                        placeholder="¿Qué está en tu mente ahora mismo?"
                        placeholderTextColor="#334155"
                        multiline
                        value={content}
                        onChangeText={setContent}
                        textAlignVertical="top"
                        autoFocus={false}
                        editable={!loading}
                    />

                    {/* Mic button — right side */}
                    <View style={styles.micColumn}>
                        <TouchableOpacity
                            onPress={toggleRecording}
                            disabled={loading || isTranscribing}
                            style={[styles.micBtn, isRecording && styles.micBtnActive]}
                            activeOpacity={0.7}
                        >
                            {isTranscribing ? (
                                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                                    <Mi size={22} color="#6366f1" />
                                </Animated.View>
                            ) : isRecording ? (
                                <MO size={22} color="white" />
                            ) : (
                                <Mi size={22} color="#64748b" />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Footer — word count + submit */}
                <View style={styles.footer}>
                    <Text style={styles.wordCount}>
                        {wordCount > 0 ? `${wordCount} palabras` : 'Escribe o graba tu pensamiento'}
                    </Text>
                    {isRecording && (
                        <Text style={styles.recordingLabel}>● Grabando...</Text>
                    )}
                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={!canSubmit || loading}
                        style={[styles.sendBtn, canSubmit ? styles.sendBtnActive : styles.sendBtnDisabled]}
                        activeOpacity={0.8}
                    >
                        <Se size={18} color={canSubmit ? 'white' : '#334155'} />
                    </TouchableOpacity>
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
    header: { alignItems: 'center', paddingTop: 12, paddingBottom: 20 },
    logoContainer: {
        width: 48, height: 48,
        justifyContent: 'center', alignItems: 'center', marginBottom: 8
    },
    brandText: {
        color: '#c7d2fe', fontSize: 11, fontWeight: '800',
        letterSpacing: 4, marginBottom: 4
    },
    dateText: {
        color: '#334155', fontSize: 10, fontWeight: '600', letterSpacing: 1.5
    },
    editorWrapper: { flex: 1, paddingHorizontal: 20 },
    editorRow: { flex: 1, flexDirection: 'row' },
    editor: {
        flex: 1,
        color: '#e2e8f0',
        fontSize: 18,
        lineHeight: 30,
        fontWeight: '300',
        letterSpacing: 0.2,
        paddingTop: 8,
        paddingRight: 12,
    },
    micColumn: {
        width: 48, justifyContent: 'flex-start', paddingTop: 8, alignItems: 'center'
    },
    micBtn: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
        justifyContent: 'center', alignItems: 'center'
    },
    micBtnActive: {
        backgroundColor: 'rgba(239,68,68,0.15)',
        borderColor: '#ef4444'
    },
    footer: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 16, borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.04)'
    },
    wordCount: { flex: 1, color: '#334155', fontSize: 12 },
    recordingLabel: { color: '#ef4444', fontSize: 12, fontWeight: '600', marginRight: 12 },
    sendBtn: {
        width: 44, height: 44, borderRadius: 22,
        justifyContent: 'center', alignItems: 'center'
    },
    sendBtnActive: { backgroundColor: '#6366f1' },
    sendBtnDisabled: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)'
    },
});

export default CaptureScreen;
