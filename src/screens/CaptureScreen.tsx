import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    StatusBar, Alert, KeyboardAvoidingView, Platform, Animated, ScrollView, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
    Mic, MicOff, ArrowUp, Box, Brain, Plus, X,
    LayoutDashboard, BarChart2, MessageCircle, ShieldAlert
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { voiceService } from '../services/voice';
import { SupabaseService } from '../services/SupabaseService';
import AILoadingOverlay from '../components/AILoadingOverlay';
import WelcomeModal from '../components/WelcomeModal';

const CaptureScreen = () => {
    const navigation = useNavigation<any>();
    const { user, profile } = useAuth();

    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [lastRecordingUri, setLastRecordingUri] = useState<string | null>(null);
    const [recordSecs, setRecordSecs] = useState(0);
    const [pickedImage, setPickedImage] = useState<{ uri: string; mediaType: string; data: string } | null>(null);

    const pickImage = async () => {
        try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
                Alert.alert('Permiso requerido', 'Necesito acceso a tus fotos para adjuntar una imagen.');
                return;
            }
            const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.7,
                base64: true,
            });
            if (res.canceled || !res.assets?.[0]?.base64) return;
            const a = res.assets[0];
            const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            const mediaType = allowed.includes(a.mimeType || '') ? a.mimeType! : 'image/jpeg';
            setPickedImage({ uri: a.uri, mediaType, data: a.base64! });
        } catch (e: any) {
            console.warn('CAPTURE: pickImage failed:', e?.message);
            Alert.alert('Error', 'No se pudo cargar la imagen.');
        }
    };

    // Recording timer for the "Escuchando…" indicator.
    useEffect(() => {
        if (!isRecording) { setRecordSecs(0); return; }
        setRecordSecs(0);
        const id = setInterval(() => setRecordSecs(s => s + 1), 1000);
        return () => clearInterval(id);
    }, [isRecording]);

    // Pulse the recording dot while listening (dedicated value so it
    // doesn't fight the ambient brain-breathing animation).
    const dotAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        if (!isRecording && !isTranscribing) return;
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(dotAnim, { toValue: 1.4, duration: 600, useNativeDriver: true }),
                Animated.timing(dotAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => { loop.stop(); dotAnim.setValue(1); };
    }, [isRecording, isTranscribing]);

    const fmtSecs = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

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
    const canSubmit = content.trim().length > 0 || !!pickedImage;

    const displayName = (profile?.full_name || user?.email?.split('@')[0] || '').split(' ')[0];
    const greeting = (() => {
        const h = new Date().getHours();
        if (h < 12) return 'Buenos días';
        if (h < 19) return 'Buenas tardes';
        return 'Buenas noches';
    })();

    const handleSend = async () => {
        const message = content.trim() || (pickedImage ? '¿Qué ves en esta imagen? Interprétala en mi contexto.' : '');
        if (!message) return;
        if (!user) { Alert.alert('Error', 'Debes estar conectado.'); return; }

        setLoading(true);
        try {
            const threadTitle = message.split('\n')[0].slice(0, 50) || 'Nueva conversación';
            const thread = await SupabaseService.createChatThread(user.id, threadTitle, 'GENERAL');
            if (!thread) throw new Error('No se pudo crear la conversación');

            const imgParam = pickedImage;
            setContent('');
            setLastRecordingUri(null);
            setPickedImage(null);

            navigation.navigate('Chat', {
                threadId: thread.id,
                category: thread.category,
                title: thread.title,
                initialMessage: message,
                initialImage: imgParam,
            });
        } catch (err: any) {
            console.error('CAPTURE_ERROR:', err);
            Alert.alert('No se pudo iniciar', 'Hubo un problema al abrir la conversación. Verifica tu conexión e intenta de nuevo.');
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
    const Xx = X as any;
    const LD = LayoutDashboard as any;
    const BC = BarChart2 as any;
    const MC = MessageCircle as any;
    const SA = ShieldAlert as any;

    const shortcuts = [
        { label: 'Mi BlackBoxMind', icon: Br, onPress: () => navigation.navigate('Home') },
        { label: 'Dashboard', icon: LD, onPress: () => navigation.navigate('Dashboard') },
        { label: 'Reporte Estratégico', icon: BC, onPress: () => navigation.navigate('WeeklyReport', {}) },
        { label: 'Historial de Chats', icon: MC, onPress: () => navigation.navigate('ChatHub') },
        { label: 'Mis Sesgos', icon: SA, onPress: () => navigation.navigate('Settings', { initialViewMode: 'biases' }) },
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

                        {(isRecording || isTranscribing) && (
                            <View style={styles.recordingBar}>
                                <Animated.View
                                    style={[
                                        styles.recordingDot,
                                        isTranscribing && { backgroundColor: '#6366f1' },
                                        { transform: [{ scale: dotAnim }] },
                                    ]}
                                />
                                <Text style={styles.recordingText}>
                                    {isTranscribing
                                        ? 'Transcribiendo tu audio…'
                                        : `Escuchando ${fmtSecs(recordSecs)} · toca el micrófono para detener`}
                                </Text>
                            </View>
                        )}

                        {pickedImage && (
                            <View style={styles.imagePreview}>
                                <Image source={{ uri: pickedImage.uri }} style={styles.imageThumb} />
                                <Text style={styles.imageHint}>Imagen adjunta · BLACKBOX la interpretará</Text>
                                <TO onPress={() => setPickedImage(null)} style={styles.imageRemove} activeOpacity={0.7}>
                                    <Xx size={16} color="#fca5a5" />
                                </TO>
                            </View>
                        )}

                        <View style={styles.inputFooter}>
                            <View style={styles.leftActions}>
                                <TO style={styles.iconBtn} activeOpacity={0.7} onPress={pickImage} disabled={loading}>
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
                                    onPress={handleSend}
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

            <WelcomeModal />
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
    recordingBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(239,68,68,0.10)',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginTop: 4,
        marginBottom: 8,
    },
    recordingDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#ef4444',
        marginRight: 10,
    },
    recordingText: { color: '#fca5a5', fontSize: 13, fontWeight: '700', flex: 1 },
    imagePreview: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(99,102,241,0.10)',
        borderRadius: 12,
        padding: 8,
        marginTop: 4,
        marginBottom: 8,
    },
    imageThumb: { width: 44, height: 44, borderRadius: 8, marginRight: 10 },
    imageHint: { color: '#a5b4fc', fontSize: 12, fontWeight: '600', flex: 1 },
    imageRemove: { padding: 6 },
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
