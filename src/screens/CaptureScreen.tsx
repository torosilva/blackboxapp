import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    StatusBar, Alert, KeyboardAvoidingView, Platform, Animated, ScrollView, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
    Mic, MicOff, ArrowUp, Box, Brain, Plus, X,
    LayoutDashboard, BarChart2, MessageCircle, ShieldAlert,
    ChevronRight, RefreshCw,
} from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { voiceService } from '../services/voice';
import { aiService } from '../services/ai';
import { NotificationService } from '../services/notificationService';
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
    const [pendingRetryUri, setPendingRetryUri] = useState<string | null>(null);
    const [recordSecs, setRecordSecs] = useState(0);
    const [pickedImage, setPickedImage] = useState<{ uri: string; mediaType: string; data: string } | null>(null);
    const [showText, setShowText] = useState(false);

    // ── Command-center data (memory made visible) ─────────────────────────────
    const [recentEntries, setRecentEntries] = useState<any[]>([]);
    const [topLoops, setTopLoops] = useState<any[]>([]);
    const [hasRegresa, setHasRegresa] = useState(false);
    const [pulse, setPulse] = useState<{ openLoopsCount: number; moodLabel: string | null; totalEntries: number } | null>(null);

    const loadHome = useCallback(async () => {
        if (!user) return;
        try {
            const [entries, loops, ctx] = await Promise.all([
                SupabaseService.getEntries(user.id),
                SupabaseService.getOpenActionItems(user.id),
                SupabaseService.getHistoricalContext(user.id),
            ]);
            setRecentEntries((entries || []).slice(0, 3));

            const regresa = (loops || []).filter((l: any) => String(l.status) === 'regresa');
            const high = (loops || []).filter((l: any) => String(l.priority).toUpperCase() === 'HIGH');
            const pick = regresa.length ? regresa : high.length ? high : (loops || []);
            setTopLoops(pick.slice(0, 3));
            setHasRegresa(regresa.length > 0);

            setPulse({
                openLoopsCount: ctx.openLoopsCount ?? 0,
                moodLabel: ctx.recentMoods?.[0]?.label ?? null,
                totalEntries: ctx.totalEntries ?? 0,
            });
        } catch (e: any) {
            console.warn('CAPTURE: loadHome failed:', e?.message);
        }
    }, [user]);

    useFocusEffect(useCallback(() => { loadHome(); }, [loadHome]));

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

    // Pulse the recording dot while listening.
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
    const MAX_RECORD_SECS = 300;

    const fmtDate = (iso: string) => {
        if (!iso) return '';
        const d = new Date(iso);
        const days = Math.floor((Date.now() - d.getTime()) / 86400000);
        if (days <= 0) return 'Hoy';
        if (days === 1) return 'Ayer';
        if (days < 7) return `Hace ${days} días`;
        return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    };

    const inputRef = useRef<any>(null);
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.08, duration: 1800, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
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

    // Core: text/voice → analyze → clinical verdict (ficha). Returns false
    // if it didn't proceed (too short / error) so callers can recover.
    const analyzeAndOpenVerdict = async (rawMessage: string, audioUri: string | null): Promise<boolean> => {
        const message = (rawMessage || '').trim();
        if (!message) return false;
        if (!user) { Alert.alert('Error', 'Debes estar conectado.'); return false; }

        const wc = message.split(/\s+/).length;
        if (message.length < 40 || wc < 8) {
            Alert.alert(
                'Cuéntame un poco más',
                'Suéltalo con un poco más de detalle (un par de frases) para que BLACKBOX pueda darte un veredicto útil.',
                [{ text: 'Entendido' }]
            );
            return false;
        }

        setLoading(true);
        try {
            let audioUrl = null;
            if (audioUri) {
                audioUrl = await SupabaseService.uploadAudio(audioUri, user.id);
            }

            const analysis = await aiService.generateDailySummary([message], user.id);

            const savedEntry = await SupabaseService.createEntry({
                user_id: user.id,
                title: analysis.title,
                content: analysis.original_text || message,
                sentiment_score: analysis.sentiment_score,
                mood_label: analysis.mood_label,
                summary: analysis.summary,
                wellness_recommendation: analysis.wellness_recommendation,
                strategic_insight: analysis.strategic_insight,
                action_items: analysis.action_items,
                audio_url: audioUrl,
                original_text: analysis.original_text || message,
                category: analysis.category || 'PERSONAL',
            });

            if (Array.isArray(analysis.action_items)) {
                const highPriorities = analysis.action_items.filter((ai: any) => ai.priority === 'HIGH');
                for (const hp of highPriorities) {
                    await NotificationService.scheduleStrategicFollowup(hp.task || hp.description);
                }
            }

            setContent('');
            setLastRecordingUri(null);

            if (savedEntry?.id) {
                navigation.navigate('EntryDetail', { entryId: savedEntry.id });
                return true;
            }
            Alert.alert('No se pudo guardar', 'Intenta de nuevo.');
            return false;
        } catch (err: any) {
            console.error('CAPTURE_ANALYZE_ERROR:', err);
            Alert.alert('No se pudo analizar', 'Hubo un problema al generar tu veredicto. Verifica tu conexión e intenta de nuevo.');
            return false;
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async () => {
        if (!user) { Alert.alert('Error', 'Debes estar conectado.'); return; }

        // Image attachments stay in the conversational (vision) flow.
        if (pickedImage) {
            const message = content.trim() || '¿Qué ves en esta imagen? Interprétala en mi contexto.';
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
            return;
        }

        // Typed brain-dump → straight to the verdict.
        await analyzeAndOpenVerdict(content, lastRecordingUri);
    };

    // Transcribe a saved recording, then route to the verdict. On a
    // connectivity failure keep the audio and surface a retry instead of
    // losing the user's words; on no-speech say so plainly.
    const transcribeAndAnalyze = async (uri: string) => {
        setIsTranscribing(true);
        let trans = '';
        try {
            trans = await voiceService.transcribeAudio(uri);
        } catch {
            setIsTranscribing(false);
            setPendingRetryUri(uri);
            Alert.alert(
                'Sin conexión',
                'No pude transcribir tu audio. Lo guardé — toca "Reintentar transcripción" cuando tengas señal.'
            );
            return;
        }
        setIsTranscribing(false);
        setPendingRetryUri(null);
        if (!trans.trim()) {
            Alert.alert('No se escuchó nada', 'No detecté voz clara. Intenta grabar de nuevo.');
            return;
        }
        const ok = await analyzeAndOpenVerdict(trans, uri);
        if (!ok) {
            setContent(prev => prev ? `${prev} ${trans}` : trans);
            setShowText(true);
        }
    };

    const toggleRecording = async () => {
        if (isRecording) {
            const uri = await voiceService.stopRecording();
            setLastRecordingUri(uri);
            setIsRecording(false);
            if (uri) await transcribeAndAnalyze(uri);
        } else {
            setPendingRetryUri(null);
            const started = await voiceService.startRecording(() => { });
            if (started) setIsRecording(true);
        }
    };

    // Hard cap at 5 min so a forgotten/runaway recording can't rack up
    // transcription cost. Auto-stop runs the normal transcribe flow.
    useEffect(() => {
        if (isRecording && recordSecs >= MAX_RECORD_SECS) {
            toggleRecording();
        }
    }, [isRecording, recordSecs]);

    const SAV = SafeAreaView as any;
    const TO = TouchableOpacity as any;
    const Mi = Mic as any;
    const MO = MicOff as any;
    const Au = ArrowUp as any;
    const Br = Brain as any;
    const Pl = Plus as any;
    const Xx = X as any;
    const LD = LayoutDashboard as any;
    const BC = BarChart2 as any;
    const MC = MessageCircle as any;
    const SA = ShieldAlert as any;
    const CR = ChevronRight as any;
    const RC = RefreshCw as any;

    const shortcuts = [
        { label: 'Mis memorias', icon: Br, onPress: () => navigation.navigate('Home') },
        { label: 'Dashboard', icon: LD, onPress: () => navigation.navigate('Dashboard') },
        { label: 'Reporte', icon: BC, onPress: () => navigation.navigate('WeeklyReport', {}) },
        { label: 'Chats', icon: MC, onPress: () => navigation.navigate('ChatHub') },
        { label: 'Mis sesgos', icon: SA, onPress: () => navigation.navigate('Settings', { initialViewMode: 'biases' }) },
    ];

    const captureMode = !showText && !content.trim() && !pickedImage;

    return (
        <SAV style={styles.container}>
            <StatusBar barStyle="light-content" />

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={20}
            >
                <ScrollView
                    contentContainerStyle={styles.body}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Greeting + brand mark */}
                    <View style={styles.topRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.greetingSmall}>{greeting}</Text>
                            {!!displayName && <Text style={styles.greetingName}>{displayName}</Text>}
                        </View>
                        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                            <Br size={36} color="#a855f7" strokeWidth={1.5} />
                        </Animated.View>
                    </View>

                    {/* ── CAPTURE HERO (shared, not full-screen) ───────────────── */}
                    {captureMode ? (
                        <View style={styles.captureHero}>
                            <Text style={styles.voiceTitle}>Suelta lo que cargas</Text>
                            <Text style={styles.voiceSub}>
                                Habla. Te devuelvo el veredicto — y recuerdo lo que importa.
                            </Text>

                            <TO
                                onPress={toggleRecording}
                                disabled={loading || isTranscribing}
                                style={[styles.bigMicBtn, isRecording && styles.bigMicBtnActive]}
                                activeOpacity={0.85}
                            >
                                <Animated.View style={{ transform: [{ scale: isRecording ? dotAnim : pulseAnim }] }}>
                                    {isRecording ? <MO size={40} color="white" /> : <Mi size={40} color="white" />}
                                </Animated.View>
                            </TO>

                            <Text style={styles.recordHintBig}>
                                {isTranscribing
                                    ? 'Transcribiendo tu audio…'
                                    : isRecording
                                        ? `Escuchando ${fmtSecs(recordSecs)} / 5:00 · toca para terminar`
                                        : 'Toca el micrófono y habla'}
                            </Text>

                            {pendingRetryUri && !isRecording && !isTranscribing && (
                                <TO
                                    onPress={() => transcribeAndAnalyze(pendingRetryUri)}
                                    style={styles.retryBtn}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.retryText}>↻ Reintentar transcripción</Text>
                                </TO>
                            )}

                            <TO onPress={() => setShowText(true)} style={styles.writeLinkBtn} activeOpacity={0.7}>
                                <Text style={styles.writeLinkBig}>Prefiero escribir</Text>
                            </TO>
                        </View>
                    ) : (
                        <View style={styles.captureHero}>
                            {(showText && !content.trim() && !pickedImage) && (
                                <TO onPress={() => setShowText(false)} style={styles.backToVoiceRow} activeOpacity={0.7}>
                                    <Text style={styles.writeLink}>← Volver a voz</Text>
                                </TO>
                            )}
                            <View style={styles.inputCard}>
                                <TextInput
                                    ref={inputRef}
                                    style={styles.input}
                                    placeholder={"Suéltalo sin filtro. Ej: \"Cerré el trato grande pero arrastro 3 pendientes, choqué con mi socio y otra vez no avancé en lo de mi hija.\""}
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
                                            <Pl size={20} color="#94a3b8" />
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
                                                    <Mi size={20} color="#6366f1" />
                                                </Animated.View>
                                            ) : isRecording ? (
                                                <MO size={20} color="white" />
                                            ) : (
                                                <Mi size={20} color="#94a3b8" />
                                            )}
                                        </TO>

                                        <TO
                                            onPress={handleSend}
                                            disabled={!canSubmit || loading}
                                            style={[styles.sendBtn, canSubmit ? styles.sendBtnActive : styles.sendBtnDisabled]}
                                            activeOpacity={0.8}
                                        >
                                            <Au size={20} color={canSubmit ? 'white' : '#475569'} strokeWidth={2.5} />
                                        </TO>
                                    </View>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* ── LO QUE REGRESA / LOOPS ABIERTOS ──────────────────────── */}
                    {topLoops.length > 0 && (
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <View style={styles.sectionTitleRow}>
                                    {hasRegresa && <RC size={14} color="#f87171" strokeWidth={2.5} />}
                                    <Text style={[styles.sectionTitle, hasRegresa && { color: '#f87171' }]}>
                                        {hasRegresa ? 'LO QUE REGRESA' : 'LOOPS ABIERTOS'}
                                    </Text>
                                </View>
                                <TO onPress={() => navigation.navigate('Loops')} activeOpacity={0.7}>
                                    <Text style={styles.sectionLink}>Ver todos</Text>
                                </TO>
                            </View>
                            {hasRegresa && (
                                <Text style={styles.sectionSub}>Lo que sigues evitando. No es falta de tiempo.</Text>
                            )}
                            {topLoops.map((l) => (
                                <TO
                                    key={l.id}
                                    style={[styles.loopCard, hasRegresa && styles.loopCardRegresa]}
                                    onPress={() => navigation.navigate('Loops')}
                                    activeOpacity={0.8}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.loopText} numberOfLines={2}>
                                            {l.avoidance_reason || l.task}
                                        </Text>
                                        {!!l.avoidance_reason && (
                                            <Text style={styles.loopTask} numberOfLines={1}>{l.task}</Text>
                                        )}
                                    </View>
                                    <CR size={18} color="#475569" />
                                </TO>
                            ))}
                        </View>
                    )}

                    {/* ── MEMORIAS RECIENTES ───────────────────────────────────── */}
                    {recentEntries.length > 0 && (
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>MEMORIAS RECIENTES</Text>
                                <TO onPress={() => navigation.navigate('Home')} activeOpacity={0.7}>
                                    <Text style={styles.sectionLink}>Ver todas</Text>
                                </TO>
                            </View>
                            {recentEntries.map((e) => (
                                <TO
                                    key={e.id}
                                    style={styles.memCard}
                                    onPress={() => navigation.navigate('EntryDetail', { entryId: e.id })}
                                    activeOpacity={0.8}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.memTitle} numberOfLines={1}>{e.title || 'Registro'}</Text>
                                        <Text style={styles.memMeta}>
                                            {fmtDate(e.created_at)}{e.category ? ` · ${e.category}` : ''}
                                        </Text>
                                    </View>
                                    <CR size={18} color="#475569" />
                                </TO>
                            ))}
                        </View>
                    )}

                    {/* ── TU PULSO ─────────────────────────────────────────────── */}
                    {pulse && pulse.totalEntries > 0 && (
                        <TO style={styles.pulseCard} onPress={() => navigation.navigate('Dashboard')} activeOpacity={0.85}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.pulseLabel}>TU PULSO</Text>
                                <Text style={styles.pulseMain}>
                                    {pulse.openLoopsCount} loop{pulse.openLoopsCount === 1 ? '' : 's'} abierto{pulse.openLoopsCount === 1 ? '' : 's'}
                                    {pulse.moodLabel ? ` · ${pulse.moodLabel}` : ''}
                                </Text>
                            </View>
                            <CR size={18} color="#475569" />
                        </TO>
                    )}

                    {/* Shortcut chips */}
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
                                        <Icon size={15} color="#a5b4fc" strokeWidth={2} />
                                        <Text style={styles.chipText}>{s.label}</Text>
                                    </TO>
                                );
                            })}
                        </ScrollView>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            <AILoadingOverlay
                visible={loading || isTranscribing}
                message={isTranscribing ? 'Transcribiendo…' : 'Analizando…'}
            />

            <WelcomeModal />
        </SAV>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0a0f1e' },
    body: {
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 32,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    greetingSmall: { color: '#94a3b8', fontSize: 15, fontWeight: '400' },
    greetingName: { color: '#f1f5f9', fontSize: 26, fontWeight: '700', letterSpacing: 0.2, marginTop: 2 },

    captureHero: {
        alignItems: 'center',
        paddingTop: 18,
        paddingBottom: 8,
    },
    voiceTitle: {
        color: '#e2e8f0',
        fontSize: 22,
        fontWeight: '700',
        textAlign: 'center',
        letterSpacing: 0.3,
    },
    voiceSub: {
        color: '#94a3b8',
        fontSize: 14,
        lineHeight: 21,
        textAlign: 'center',
        marginTop: 8,
        maxWidth: 320,
    },
    bigMicBtn: {
        width: 96, height: 96, borderRadius: 48,
        backgroundColor: '#6366f1',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 22,
        shadowColor: '#6366f1',
        shadowOpacity: 0.45,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 0 },
    },
    bigMicBtnActive: { backgroundColor: '#ef4444', shadowColor: '#ef4444' },
    recordHintBig: {
        color: '#64748b',
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: 0.4,
        marginTop: 14,
    },
    writeLink: {
        color: '#818cf8',
        fontSize: 14,
        fontWeight: '600',
    },
    writeLinkBtn: {
        marginTop: 18,
        paddingVertical: 10,
        paddingHorizontal: 22,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(129,140,248,0.45)',
        backgroundColor: 'rgba(129,140,248,0.08)',
    },
    writeLinkBig: {
        color: '#a5b4fc',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    retryBtn: {
        marginTop: 16,
        paddingVertical: 12,
        paddingHorizontal: 22,
        borderRadius: 16,
        backgroundColor: 'rgba(251,191,36,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(251,191,36,0.5)',
    },
    retryText: { color: '#fbbf24', fontSize: 15, fontWeight: '700' },
    backToVoiceRow: { paddingVertical: 6, marginBottom: 8, alignSelf: 'flex-start' },

    inputCard: {
        width: '100%',
        backgroundColor: '#141b2e',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        padding: 16,
        minHeight: 150,
    },
    input: {
        color: '#e2e8f0',
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '300',
        minHeight: 70,
        paddingTop: 4,
        paddingBottom: 12,
    },
    inputFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    leftActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    rightActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    iconBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconBtnRecording: { backgroundColor: 'rgba(239,68,68,0.2)', borderColor: '#ef4444' },
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
    recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444', marginRight: 10 },
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
    sendBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    sendBtnActive: { backgroundColor: '#6366f1' },
    sendBtnDisabled: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },

    // ── Sections ──────────────────────────────────────────────────────────
    section: { marginTop: 28 },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    sectionTitle: { color: '#94a3b8', fontSize: 12, fontWeight: '900', letterSpacing: 1.8 },
    sectionSub: { color: '#475569', fontSize: 12, marginTop: -4, marginBottom: 10, lineHeight: 16 },
    sectionLink: { color: '#6366f1', fontSize: 12, fontWeight: '800' },

    loopCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#141b2e',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
        padding: 15,
        marginBottom: 10,
    },
    loopCardRegresa: {
        backgroundColor: '#1a1020',
        borderColor: 'rgba(248,113,113,0.18)',
        borderLeftWidth: 3,
        borderLeftColor: '#f87171',
    },
    loopText: { color: '#f1f5f9', fontSize: 15, fontWeight: '600', lineHeight: 21 },
    loopTask: { color: '#94a3b8', fontSize: 13, marginTop: 4, lineHeight: 18 },

    memCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#141b2e',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
        paddingHorizontal: 15,
        paddingVertical: 14,
        marginBottom: 10,
    },
    memTitle: { color: '#f1f5f9', fontSize: 15, fontWeight: '600' },
    memMeta: { color: '#64748b', fontSize: 12, fontWeight: '600', marginTop: 3, textTransform: 'capitalize' },

    pulseCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(99,102,241,0.08)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(99,102,241,0.25)',
        paddingHorizontal: 16,
        paddingVertical: 15,
        marginTop: 28,
    },
    pulseLabel: { color: '#818cf8', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 4 },
    pulseMain: { color: '#e2e8f0', fontSize: 16, fontWeight: '700' },

    chipsWrap: { marginTop: 28, flexGrow: 0, flexShrink: 0 },
    chipsRow: { gap: 8, paddingHorizontal: 2, alignItems: 'center' },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
    },
    chipText: { color: '#cbd5e1', fontSize: 13, fontWeight: '600' },
});

export default CaptureScreen;
