import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    StatusBar, Alert, KeyboardAvoidingView, Platform, Animated, ScrollView, Image, Modal, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
    Mic, MicOff, ArrowUp, Plus, X, RefreshCw, ChevronRight, ChevronDown,
    LayoutDashboard, BarChart2, MessageCircle, ShieldAlert, Brain, Sparkles, MoreHorizontal,
    Search as SearchIcon,
} from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { voiceService } from '../services/voice';
import { aiService } from '../services/ai';
import { NotificationService } from '../services/notificationService';
import { SupabaseService } from '../services/SupabaseService';
import AILoadingOverlay from '../components/AILoadingOverlay';
import WelcomeModal from '../components/WelcomeModal';

type Stats = {
    closed: number;
    open: number;
    regresa: number;
    stalled: number;
    stalledDays: number;
    moodLabel: string | null;
    totalEntries: number;
};

const NB = String.fromCharCode(160); // non-breaking space — keeps "354 abiertos" as one unit
const STALE_DAYS = 14;

// SINGLE SOURCE OF TRUTH for loop counts. Every number on the home derives
// from here. Note: `stalled` is a SUBSET of `open` (open loops untouched
// ≥ STALE_DAYS), not an independent total — so open ≥ stalled always holds.
const deriveLoopStats = (loops: any[], closedThisWeek: number) => {
    const all = loops || [];
    const daysOpen = (l: any) =>
        l?.created_at ? Math.floor((Date.now() - new Date(l.created_at).getTime()) / 86400000) : 0;

    const regresa = all.filter((l: any) => String(l.status) === 'regresa');
    const stalled = all.filter((l: any) => daysOpen(l) >= STALE_DAYS); // ⊆ open
    const stalledDays = stalled.length ? Math.max(...stalled.map(daysOpen)) : 0;
    const high = all.filter((l: any) => String(l.priority).toUpperCase() === 'HIGH' && !regresa.includes(l));
    const rest = all.filter((l: any) => !regresa.includes(l) && !high.includes(l));

    return {
        open: all.length,
        closed: closedThisWeek,
        regresa: regresa.length,
        stalled: stalled.length,
        stalledDays,
        ordered: [...regresa, ...high, ...rest],
    };
};

// Truncate at a sentence boundary (never mid-word). Falls back to the last
// whole word + ellipsis. Returns whether it was cut so callers can offer a
// "ver completo" link.
const truncateSentence = (raw: string, max = 240): { text: string; truncated: boolean } => {
    const s = raw.replace(/\s+/g, ' ').trim();
    if (s.length <= max) return { text: s, truncated: false };
    const slice = s.slice(0, max);
    const lastEnd = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('? '), slice.lastIndexOf('! '));
    if (lastEnd >= max * 0.55) return { text: slice.slice(0, lastEnd + 1).trim(), truncated: true };
    const lastSpace = slice.lastIndexOf(' ');
    return { text: (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).trim() + '…', truncated: true };
};

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
    const [showTextModal, setShowTextModal] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // ── Command-center data ───────────────────────────────────────────────────
    const [recentEntries, setRecentEntries] = useState<any[]>([]);
    const [topLoops, setTopLoops] = useState<any[]>([]);
    const [hasRegresa, setHasRegresa] = useState(false);
    const [stats, setStats] = useState<Stats | null>(null);
    const [memoriesOpen, setMemoriesOpen] = useState(true);
    const [liveReflejo, setLiveReflejo] = useState<string | null>(null);
    const [reflejoLoading, setReflejoLoading] = useState(false);

    const loadHome = useCallback(async () => {
        if (!user) return;
        try {
            const [entries, loops, ctx, closed] = await Promise.all([
                SupabaseService.getEntries(user.id),
                SupabaseService.getOpenActionItems(user.id),
                SupabaseService.getHistoricalContext(user.id),
                SupabaseService.getClosedLoopsCount(user.id, 7),
            ]);
            setRecentEntries((entries || []).slice(0, 3));

            const s = deriveLoopStats(loops, closed);
            setTopLoops(s.ordered.slice(0, 3));
            setHasRegresa(s.regresa > 0);
            setStats({
                closed: s.closed,
                open: s.open,
                regresa: s.regresa,
                stalled: s.stalled,
                stalledDays: s.stalledDays,
                moodLabel: ctx.recentMoods?.[0]?.label ?? null,
                totalEntries: ctx.totalEntries ?? 0,
            });

            // ── Live "Reflejo de hoy" — generated against current stats, cached
            // by a stats fingerprint so it only regenerates when the backlog
            // actually changes (controls cost/latency). ──────────────────────
            if (s.open === 0 && s.closed === 0) {
                setLiveReflejo(null);
            } else {
                const fp = `reflejo_${s.open}_${s.closed}_${s.stalled}_${s.stalledDays}_${s.ordered[0]?.id ?? 'none'}`;
                const cached = await SupabaseService.getCachedInsight(user.id, 'daily', fp);
                const cachedText = typeof cached === 'string' ? cached : cached?.text ?? null;
                if (cachedText) {
                    setLiveReflejo(cachedText);
                } else {
                    setReflejoLoading(true);
                    const text = await aiService.generateLoopReflection({
                        userId: user.id,
                        open: s.open,
                        closed: s.closed,
                        stalled: s.stalled,
                        stalledDays: s.stalledDays,
                        topLoops: s.ordered.slice(0, 5),
                    });
                    setReflejoLoading(false);
                    setLiveReflejo(text);
                    if (text) await SupabaseService.saveCachedInsight(user.id, 'daily', fp, { text });
                }
            }
        } catch (e: any) {
            setReflejoLoading(false);
            console.warn('CAPTURE: loadHome failed:', e?.message);
        }
    }, [user]);

    useFocusEffect(useCallback(() => { loadHome(); }, [loadHome]));

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadHome();
        setRefreshing(false);
    }, [loadHome]);

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

    useEffect(() => {
        if (!isRecording) { setRecordSecs(0); return; }
        setRecordSecs(0);
        const id = setInterval(() => setRecordSecs(s => s + 1), 1000);
        return () => clearInterval(id);
    }, [isRecording]);

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
                'Suéltalo con un poco más de detalle (un par de frases) para que BlackBoxMind pueda darte un veredicto útil.',
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
            setShowTextModal(false);

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
                setShowTextModal(false);

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
            // Couldn't proceed (too short / error) — drop the words into the
            // text sheet so they aren't lost.
            setContent(prev => prev ? `${prev} ${trans}` : trans);
            setShowTextModal(true);
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
    const Pl = Plus as any;
    const Xx = X as any;
    const RC = RefreshCw as any;
    const CR = ChevronRight as any;
    const CD = ChevronDown as any;
    const Sp = Sparkles as any;
    const Br = Brain as any;
    const MH = MoreHorizontal as any;
    const SI = SearchIcon as any;
    const LD = LayoutDashboard as any;
    const BC = BarChart2 as any;
    const MC = MessageCircle as any;
    const SA = ShieldAlert as any;

    const shortcuts = [
        { label: 'Mis memorias', icon: Br, onPress: () => navigation.navigate('Home') },
        { label: 'Dashboard', icon: LD, onPress: () => navigation.navigate('Dashboard') },
        { label: 'Reporte', icon: BC, onPress: () => navigation.navigate('WeeklyReport', {}) },
        { label: 'Chats', icon: MC, onPress: () => navigation.navigate('ChatHub') },
        { label: 'Mis sesgos', icon: SA, onPress: () => navigation.navigate('Settings', { initialViewMode: 'biases' }) },
    ];

    // ── Reflejo de hoy — the AI with an opinion (reuses the latest verdict) ───
    // strategic_insight is an object ({ detected_bias, counter_thought,
    // warning_message }); pull the most opinionated line out of it.
    const reflection = recentEntries[0];
    const reflectionText: string | null = (() => {
        const si = reflection?.strategic_insight;
        if (typeof si === 'string' && si.trim()) return si;
        if (si && typeof si === 'object') {
            const pick = si.warning_message || si.counter_thought || si.detected_bias;
            if (typeof pick === 'string' && pick.trim()) return pick;
        }
        const sum = reflection?.summary;
        return typeof sum === 'string' && sum.trim() ? sum : null;
    })();
    const reflectionToday = reflection?.created_at
        ? new Date(reflection.created_at).toDateString() === new Date().toDateString()
        : false;
    const reflejo = reflectionText ? truncateSentence(reflectionText) : null;

    const cleanHead = stats != null && stats.open === 0 && stats.closed === 0;

    return (
        <SAV style={styles.container}>
            <StatusBar barStyle="light-content" />

            <ScrollView
                contentContainerStyle={styles.body}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" colors={['#6366f1']} />
                }
            >
                {/* Brand mark — minimal, no wellness greeting. Overflow lives here. */}
                <View style={styles.brandRow}>
                    <Text style={styles.brand}>BlackBoxMind.ai</Text>
                    <View style={styles.brandActions}>
                        <TO onPress={() => navigation.navigate('Search')} style={styles.headerBtn} activeOpacity={0.7}>
                            <SI size={20} color="rgba(255,255,255,0.8)" strokeWidth={2} />
                        </TO>
                        <TO onPress={() => navigation.navigate('Settings')} style={styles.headerBtn} activeOpacity={0.7}>
                            <MH size={20} color="#64748b" />
                        </TO>
                    </View>
                </View>

                {/* SYSTEM STATE — momentum first, backlog after. Units never break
                    mid-stat (nbsp) and the bullet is bound to its stat, so no
                    orphan "·" at the start of a wrapped line. */}
                <View style={styles.statusBlock}>
                    {cleanHead ? (
                        <>
                            <Text style={styles.statusMain}>Tu cabeza está limpia</Text>
                            <Text style={styles.statusSub}>Sin loops abiertos. Suelta lo que llegue.</Text>
                        </>
                    ) : (
                        <View style={styles.statsGrid}>
                            {!!stats && stats.closed > 0 && (
                                <View style={styles.statCard}>
                                    <Text style={[styles.statValue, styles.statValuePos]}>
                                        {stats.closed}
                                    </Text>
                                    <Text style={styles.statLabel}>CERRADOS</Text>
                                    <Text style={styles.statSub}>esta semana</Text>
                                </View>
                            )}
                            <View style={styles.statCard}>
                                <Text style={[styles.statValue, styles.statValueNeutral]}>
                                    {stats?.open ?? 0}
                                </Text>
                                <Text style={styles.statLabel}>ABIERTOS</Text>
                                <Text style={styles.statSub}> </Text>
                            </View>
                            {!!stats && stats.stalled > 0 && (
                                <View style={styles.statCard}>
                                    <Text style={[styles.statValue, styles.statValueWarn]}>
                                        {stats.stalled}
                                    </Text>
                                    <Text style={styles.statLabel}>ESTANCADOS</Text>
                                    <Text style={styles.statSub}>{`>${STALE_DAYS} días`}</Text>
                                </View>
                            )}
                        </View>
                    )}
                </View>

                {pendingRetryUri && !isRecording && !isTranscribing && (
                    <TO style={styles.retryBanner} onPress={() => transcribeAndAnalyze(pendingRetryUri)} activeOpacity={0.8}>
                        <Text style={styles.retryBannerText}>↻ Tienes un audio sin transcribir · toca para reintentar</Text>
                    </TO>
                )}

                {/* REFLEJO DE HOY — third pillar: live read of the current backlog */}
                {(reflejoLoading || liveReflejo) ? (
                    <TO
                        style={styles.reflejoCard}
                        onPress={() => liveReflejo && navigation.navigate('ReflexionDetalle', { reflejo: liveReflejo, loops: topLoops, memories: recentEntries })}
                        activeOpacity={0.85}
                        disabled={reflejoLoading}
                    >
                        <View style={styles.reflejoHead}>
                            <Sp size={14} color="#c084fc" strokeWidth={2.2} />
                            <Text style={styles.reflejoLabel}>REFLEJO DE HOY</Text>
                        </View>
                        {reflejoLoading ? (
                            <Text style={[styles.reflejoText, { color: '#94a3b8' }]}>Leyendo tu backlog…</Text>
                        ) : (
                            <>
                                <Text style={styles.reflejoText} numberOfLines={3}>{liveReflejo}</Text>
                                <Text style={styles.reflejoMore}>Ver reflejo completo →</Text>
                            </>
                        )}
                    </TO>
                ) : reflectionText ? (
                    <TO
                        style={styles.reflejoCard}
                        onPress={() => navigation.navigate('EntryDetail', { entryId: reflection.id })}
                        activeOpacity={0.85}
                    >
                        <View style={styles.reflejoHead}>
                            <Sp size={14} color="#c084fc" strokeWidth={2.2} />
                            <Text style={styles.reflejoLabel}>{reflectionToday ? 'REFLEJO DE HOY' : 'ÚLTIMO REFLEJO'}</Text>
                            {!reflectionToday && !!reflection?.created_at && (
                                <Text style={styles.reflejoDate}>· {fmtDate(reflection.created_at)}</Text>
                            )}
                        </View>
                        <Text style={styles.reflejoText}>{reflejo?.text}</Text>
                        {!!reflejo?.truncated && (
                            <Text style={styles.reflejoMore}>Ver reflejo completo →</Text>
                        )}
                    </TO>
                ) : null}

                {/* ── LOOPS — PRIMARY MODULE ───────────────────────────────────── */}
                {topLoops.length > 0 ? (
                    <View style={styles.loopsModule}>
                        <View style={styles.loopsHeaderRow}>
                            <Text style={[styles.loopsTitle, hasRegresa && { color: '#f87171' }]}>
                                {hasRegresa ? 'LO QUE REGRESA' : 'PRIORIDAD HOY'}
                            </Text>
                            <TO onPress={() => navigation.navigate('Loops')} activeOpacity={0.7}>
                                <Text style={styles.sectionLink}>Ver todos</Text>
                            </TO>
                        </View>
                        {!!stats && stats.closed > 0 && (
                            <Text style={styles.loopsCounter}>{stats.closed} cerrados esta semana</Text>
                        )}

                        {topLoops.map((l) => {
                            const isReg = String(l.status) === 'regresa';
                            return (
                                <TO
                                    key={l.id}
                                    style={[styles.loopCard, isReg && styles.loopCardRegresa]}
                                    onPress={() => navigation.navigate('Loops')}
                                    activeOpacity={0.85}
                                >
                                    {isReg && <RC size={16} color="#c084fc" strokeWidth={2.5} style={{ marginTop: 2 }} />}
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.loopText} numberOfLines={2}>
                                            {l.avoidance_reason || l.task}
                                        </Text>
                                    </View>
                                    <CR size={18} color="#475569" />
                                </TO>
                            );
                        })}
                    </View>
                ) : (
                    <View style={styles.emptyLoops}>
                        <Text style={styles.emptyLoopsText}>
                            Nada abierto en tu cabeza ahora mismo. Cuando algo te dé vueltas, suéltalo abajo.
                        </Text>
                    </View>
                )}

                {/* ── MEMORIAS — SECONDARY, collapsible ────────────────────────── */}
                {recentEntries.length > 0 && (
                    <View style={styles.memModule}>
                        <TO
                            style={styles.memHeaderRow}
                            onPress={() => setMemoriesOpen(o => !o)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.memHeader}>Memorias recientes</Text>
                            <Animated.View style={{ transform: [{ rotate: memoriesOpen ? '0deg' : '-90deg' }] }}>
                                <CD size={16} color="#64748b" />
                            </Animated.View>
                        </TO>

                        {memoriesOpen && recentEntries.map((e) => (
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
                                <CR size={16} color="#475569" />
                            </TO>
                        ))}
                        {memoriesOpen && (
                            <TO onPress={() => navigation.navigate('Home')} activeOpacity={0.7} style={styles.memAll}>
                                <Text style={styles.sectionLink}>Ver todas</Text>
                            </TO>
                        )}
                    </View>
                )}

                {/* Secondary nav */}
                <View style={styles.chipsWrap}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                        {shortcuts.map((s) => {
                            const Icon = s.icon;
                            return (
                                <TO key={s.label} onPress={s.onPress} style={styles.chip} activeOpacity={0.7}>
                                    <Icon size={15} color="#a5b4fc" strokeWidth={2} />
                                    <Text style={styles.chipText}>{s.label}</Text>
                                </TO>
                            );
                        })}
                    </ScrollView>
                </View>
            </ScrollView>

            {/* ── CAPTURE: demoted to a corner action ──────────────────────────── */}
            {(isRecording || isTranscribing) && (
                <View style={styles.recPill} pointerEvents="none">
                    <Animated.View
                        style={[styles.recDot, isTranscribing && { backgroundColor: '#6366f1' }, { transform: [{ scale: dotAnim }] }]}
                    />
                    <Text style={styles.recPillText}>
                        {isTranscribing ? 'Transcribiendo…' : `Escuchando ${fmtSecs(recordSecs)} · toca para terminar`}
                    </Text>
                </View>
            )}

            {/* Single voice-capture FAB. Long-press to type instead. */}
            <TO
                style={[styles.micFab, isRecording && styles.micFabRec]}
                onPress={toggleRecording}
                onLongPress={() => setShowTextModal(true)}
                disabled={loading || isTranscribing}
                activeOpacity={0.85}
            >
                <Animated.View style={{ transform: [{ scale: isRecording ? dotAnim : pulseAnim }] }}>
                    {isRecording ? <MO size={26} color="white" /> : <Mi size={26} color="white" />}
                </Animated.View>
            </TO>

            {/* Text capture sheet */}
            <Modal visible={showTextModal} transparent animationType="slide" onRequestClose={() => setShowTextModal(false)}>
                <KeyboardAvoidingView
                    style={styles.modalRoot}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={20}
                >
                    <TO style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowTextModal(false)} />
                    <View style={styles.modalSheet}>
                        <View style={styles.sheetHandle} />
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
                                autoFocus
                            />

                            {(isRecording || isTranscribing) && (
                                <View style={styles.recordingBar}>
                                    <Animated.View
                                        style={[styles.recordingDot, isTranscribing && { backgroundColor: '#6366f1' }, { transform: [{ scale: dotAnim }] }]}
                                    />
                                    <Text style={styles.recordingText}>
                                        {isTranscribing ? 'Transcribiendo tu audio…' : `Escuchando ${fmtSecs(recordSecs)} · toca el micrófono para detener`}
                                    </Text>
                                </View>
                            )}

                            {pickedImage && (
                                <View style={styles.imagePreview}>
                                    <Image source={{ uri: pickedImage.uri }} style={styles.imageThumb} />
                                    <Text style={styles.imageHint}>Imagen adjunta · BlackBoxMind la interpretará</Text>
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
                                    {wordCount > 0 && <Text style={styles.wordCount}>{wordCount} palabras</Text>}
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
                </KeyboardAvoidingView>
            </Modal>

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
        paddingTop: 12,
        paddingBottom: 110,
    },

    brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    brandActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    brand: { color: '#475569', fontSize: 12, fontWeight: '900', letterSpacing: 0 },
    headerBtn: {
        width: 34, height: 34, borderRadius: 17,
        alignItems: 'center', justifyContent: 'center',
        marginRight: -6,
    },

    // System state
    statusBlock: { marginBottom: 22 },
    statusMain: { color: '#f8fafc', fontSize: 28, fontWeight: '800', letterSpacing: 0.2 },
    statusSub: { color: '#94a3b8', fontSize: 15, fontWeight: '600', marginTop: 6, lineHeight: 21 },
    statsGrid: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 22,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#151B2C',
        borderColor: '#1E293B',
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 12,
    },
    statValue: {
        fontSize: 28,
        fontWeight: '800',
        lineHeight: 32,
        letterSpacing: 0.2,
    },
    statValuePos: { color: '#34d399' },
    statValueNeutral: { color: '#f1f5f9' },
    statValueWarn: { color: '#f59e0b' },
    statLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#94a3b8',
        letterSpacing: 1.5,
        marginTop: 6,
        textTransform: 'uppercase',
    },
    statSub: {
        fontSize: 10,
        color: '#64748b',
        marginTop: 2,
    },

    // Reflejo de hoy — third pillar
    reflejoCard: {
        backgroundColor: 'rgba(168,85,247,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(168,85,247,0.28)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 28,
    },
    reflejoHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
    reflejoLabel: { color: '#c084fc', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
    reflejoDate: { color: '#7c6a9c', fontSize: 11, fontWeight: '700' },
    reflejoText: { color: '#e2e8f0', fontSize: 15, lineHeight: 22, fontWeight: '500' },
    reflejoMore: { color: '#c084fc', fontSize: 13, fontWeight: '800', marginTop: 10 },

    retryBanner: {
        backgroundColor: 'rgba(251,191,36,0.10)',
        borderWidth: 1,
        borderColor: 'rgba(251,191,36,0.4)',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 14,
        marginBottom: 22,
    },
    retryBannerText: { color: '#fbbf24', fontSize: 13, fontWeight: '700' },

    // Loops — primary module
    loopsModule: { marginBottom: 30 },
    loopsHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    loopsTitle: { color: '#e2e8f0', fontSize: 16, fontWeight: '900', letterSpacing: 1.5 },
    loopsCounter: { color: '#34d399', fontSize: 12, fontWeight: '400', marginTop: -6, marginBottom: 12 },
    sectionLink: { color: '#6366f1', fontSize: 13, fontWeight: '800' },

    loopCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#141b2e',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
        paddingVertical: 16,
        paddingHorizontal: 16,
        marginBottom: 11,
    },
    loopCardRegresa: {
        backgroundColor: 'rgba(168,85,247,0.07)',
        borderColor: 'rgba(168,85,247,0.22)',
        borderLeftWidth: 3,
        borderLeftColor: '#a855f7',
    },
    loopText: { color: '#f1f5f9', fontSize: 16, fontWeight: '600', lineHeight: 22 },

    emptyLoops: {
        backgroundColor: '#141b2e',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        padding: 20,
        marginBottom: 30,
    },
    emptyLoopsText: { color: '#94a3b8', fontSize: 15, lineHeight: 22 },

    // Memorias — secondary
    memModule: { marginBottom: 24 },
    memHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 4,
        marginBottom: 8,
    },
    memHeader: { color: '#64748b', fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
    memCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(20,27,46,0.6)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 8,
    },
    memTitle: { color: '#cbd5e1', fontSize: 14, fontWeight: '600' },
    memMeta: { color: '#64748b', fontSize: 12, fontWeight: '600', marginTop: 3, textTransform: 'capitalize' },
    memAll: { paddingVertical: 6, alignSelf: 'flex-start', marginTop: 2 },

    // Secondary nav chips (in scroll content)
    chipsWrap: { marginTop: 6 },
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

    // Single floating voice-capture FAB
    micFab: {
        position: 'absolute',
        right: 20,
        bottom: 28,
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: '#6366f1',
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#6366f1', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },
    micFabRec: { backgroundColor: '#ef4444', shadowColor: '#ef4444' },

    recPill: {
        position: 'absolute',
        bottom: 96,
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1e293b',
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    recDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#ef4444', marginRight: 9 },
    recPillText: { color: '#e2e8f0', fontSize: 13, fontWeight: '700' },

    // Text sheet (modal)
    modalRoot: { flex: 1, justifyContent: 'flex-end' },
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
    modalSheet: {
        backgroundColor: '#0d1424',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 28,
        borderTopWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    sheetHandle: {
        width: 40, height: 4, borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.18)',
        alignSelf: 'center', marginBottom: 14,
    },
    inputCard: {
        backgroundColor: '#141b2e',
        borderRadius: 20,
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
        maxHeight: 240,
        paddingTop: 4,
        paddingBottom: 12,
    },
    inputFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
    leftActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    rightActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    iconBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center', alignItems: 'center',
    },
    iconBtnRecording: { backgroundColor: 'rgba(239,68,68,0.2)', borderColor: '#ef4444' },
    wordCount: { color: '#475569', fontSize: 12 },
    recordingBar: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(239,68,68,0.10)',
        borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
        marginTop: 4, marginBottom: 8,
    },
    recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444', marginRight: 10 },
    recordingText: { color: '#fca5a5', fontSize: 13, fontWeight: '700', flex: 1 },
    imagePreview: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(99,102,241,0.10)',
        borderRadius: 12, padding: 8, marginTop: 4, marginBottom: 8,
    },
    imageThumb: { width: 44, height: 44, borderRadius: 8, marginRight: 10 },
    imageHint: { color: '#a5b4fc', fontSize: 12, fontWeight: '600', flex: 1 },
    imageRemove: { padding: 6 },
    sendBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    sendBtnActive: { backgroundColor: '#6366f1' },
    sendBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
});

export default CaptureScreen;
