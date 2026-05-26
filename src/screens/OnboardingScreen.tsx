import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Animated,
    Easing,
    StatusBar,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Brain, Mic, ArrowRight, Sparkles, Zap } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { SupabaseService } from '../services/SupabaseService';
import { aiService } from '../services/ai';
import { voiceService } from '../services/voice';

// ─── Config ────────────────────────────────────────────────────────────────

interface Question {
    id: string;
    text: string;
    hint: string;
}

const ONBOARDING_QUESTIONS: Question[] = [
    {
        id: '1',
        title: 'BIENVENIDO A BlackBoxMind.ai',
        subtitle: 'Tu Coach de Alto Rendimiento',
        description: 'BlackBoxMind no es un diario; es un motor de ejecución clínica para mentes que no se detienen.',
        icon: <Brain size={120} color="#6366f1" />,
        color: '#6366f1'
    },
    {
        id: '2',
        title: 'PASO 1: CAPTURA',
        subtitle: 'Vacía tu mente al instante',
        description: 'Usa el botón "QuickCapture" o el icono del Micrófono. Habla sin filtros. BlackBoxMind extraerá lo esencial.',
        icon: <Zap size={120} color="#c084fc" />,
        color: '#c084fc'
    },
    {
        id: 'q3',
        text: '¿Qué te detiene de resolverlo HOY?',
        hint: 'Sé específico. La respuesta importa.',
    },
    {
        id: '4',
        title: 'PASO 3: LOOPS',
        subtitle: 'Cierra el Ciclo Ejecutivo',
        description: 'Gestiona tus tareas en el Centro Estratégico. Lo que no marcas como verde, BlackBoxMind lo perseguirá con alertas de 72h.',
        icon: <TrendingUp size={120} color="#22c55e" />,
        color: '#22c55e'
    },
    {
        id: 'q5',
        text: 'Última: ¿qué patrón tuyo te frustra más?',
        hint: 'Eso que dices "siempre me pasa".',
    },
];

const ONBOARDING_STATE_KEY = 'ONBOARDING_STATE';
const MIN_CHARS = 15;
const PROCESSING_PHRASES = [
    'Cruzando referencias entre tus 5 capturas...',
    'Detectando patrones cognitivos...',
    'Sintetizando tu primer reflejo...',
];

interface PersistedState {
    step: number;
    responses: { questionId: string; text: string }[];
    entryIds: string[];
}

interface Pattern {
    title: string;
    description: string;
}

// ─── Subcomponents ─────────────────────────────────────────────────────────

const ProgressDots: React.FC<{ active: number; total: number }> = ({ active, total }) => {
    return (
        <View style={styles.progressDots}>
            {Array.from({ length: total }).map((_, i) => (
                <View
                    key={i}
                    style={[
                        styles.progressDot,
                        { backgroundColor: i < active ? '#c084fc' : '#334155' },
                    ]}
                />
            ))}
        </View>
    );
};

const PulseLogo: React.FC<{ size?: number; intensity?: 'subtle' | 'strong' }> = ({
    size = 96,
    intensity = 'subtle',
}) => {
    const scale = useRef(new Animated.Value(1)).current;
    const BrainIcon = Brain as any;

    useEffect(() => {
        const max = intensity === 'subtle' ? 1.02 : 1.15;
        const duration = intensity === 'subtle' ? 2000 : 1200;
        Animated.loop(
            Animated.sequence([
                Animated.timing(scale, {
                    toValue: max,
                    duration,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(scale, {
                    toValue: 1.0,
                    duration,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ]),
        ).start();
    }, [intensity]);

    return (
        <Animated.View style={{ transform: [{ scale }] }}>
            <View style={[styles.logoCircle, { width: size, height: size, borderRadius: size / 2 }]}>
                <BrainIcon size={size * 0.45} color="#c084fc" strokeWidth={1.4} />
            </View>
        </Animated.View>
    );
};

const TypewriterText: React.FC<{ text: string; durationMs?: number; style?: any }> = ({
    text,
    durationMs = 600,
    style,
}) => {
    const [shown, setShown] = useState('');

    useEffect(() => {
        if (!text) {
            setShown('');
            return;
        }
        const total = text.length;
        const step = Math.max(1, Math.floor(total / Math.max(1, durationMs / 30)));
        let i = 0;
        const interval = setInterval(() => {
            i = Math.min(total, i + step);
            setShown(text.slice(0, i));
            if (i >= total) clearInterval(interval);
        }, 30);
        return () => clearInterval(interval);
    }, [text, durationMs]);

    return <Text style={style}>{shown}</Text>;
};

const PatternCard: React.FC<{ pattern: Pattern; delay: number }> = ({ pattern, delay }) => {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(16)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration: 320,
                delay,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: 0,
                duration: 320,
                delay,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    return (
        <Animated.View style={[styles.patternCard, { opacity, transform: [{ translateY }] }]}>
            <Text style={styles.patternTitle}>{pattern.title}</Text>
            <Text style={styles.patternDesc}>{pattern.description}</Text>
        </Animated.View>
    );
};

// ─── Main Screen ───────────────────────────────────────────────────────────

const OnboardingScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { user, refreshProfile } = useAuth();

    const SAV = SafeAreaView as any;
    const TO = TouchableOpacity as any;
    const TI = TextInput as any;
    const AR = ArrowRight as any;
    const M = Mic as any;
    const Sp = Sparkles as any;

    const isPreviewMode = !!route.params?.isPreviewMode;

    const [currentStep, setCurrentStep] = useState(0); // 0=welcome, 1-5=questions, 6=processing, 7=reflejo
    const [responses, setResponses] = useState<{ questionId: string; text: string }[]>([]);
    const [entryIds, setEntryIds] = useState<string[]>([]);
    const [currentInput, setCurrentInput] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [reflejo, setReflejo] = useState('');
    const [patterns, setPatterns] = useState<Pattern[]>([]);
    const [processingPhraseIdx, setProcessingPhraseIdx] = useState(0);
    const [processingTimedOut, setProcessingTimedOut] = useState(false);

    const contentOpacity = useRef(new Animated.Value(1)).current;
    const contentTranslateX = useRef(new Animated.Value(0)).current;
    const buttonOpacity = useRef(new Animated.Value(0.4)).current;

    // Persistencia: restaurar estado al montar (solo si no preview mode)
    useEffect(() => {
        if (isPreviewMode) return;
        AsyncStorage.getItem(ONBOARDING_STATE_KEY).then((raw) => {
            if (!raw) return;
            try {
                const parsed: PersistedState = JSON.parse(raw);
                if (parsed.step >= 1 && parsed.step <= 5) {
                    setCurrentStep(parsed.step);
                    setResponses(parsed.responses || []);
                    setEntryIds(parsed.entryIds || []);
                }
            } catch {
                /* ignore */
            }
        });
    }, [isPreviewMode]);

    // Persistir progreso en cada paso (no en preview mode)
    useEffect(() => {
        if (isPreviewMode) return;
        if (currentStep >= 1 && currentStep <= 5) {
            const state: PersistedState = { step: currentStep, responses, entryIds };
            AsyncStorage.setItem(ONBOARDING_STATE_KEY, JSON.stringify(state)).catch(() => {});
        }
    }, [currentStep, responses, entryIds, isPreviewMode]);

    // Habilitar botón "Continuar" cuando hay >15 chars
    useEffect(() => {
        Animated.timing(buttonOpacity, {
            toValue: currentInput.trim().length >= MIN_CHARS ? 1 : 0.4,
            duration: 250,
            useNativeDriver: true,
        }).start();
    }, [currentInput]);

    // Rotación de frases durante procesamiento (paso 6)
    useEffect(() => {
        if (currentStep !== 6) return;
        const id = setInterval(() => {
            setProcessingPhraseIdx((idx) => (idx + 1) % PROCESSING_PHRASES.length);
        }, 4500);
        return () => clearInterval(id);
    }, [currentStep]);

    // Timeout de seguridad si la EF tarda >30s
    useEffect(() => {
        if (currentStep !== 6) return;
        const id = setTimeout(() => setProcessingTimedOut(true), 30000);
        return () => clearTimeout(id);
    }, [currentStep]);

    // Animación de transición entre preguntas
    const animateTransition = (next: () => void) => {
        Animated.parallel([
            Animated.timing(contentOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
            Animated.timing(contentTranslateX, { toValue: -8, duration: 200, useNativeDriver: true }),
        ]).start(() => {
            next();
            contentTranslateX.setValue(8);
            Animated.parallel([
                Animated.timing(contentOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
                Animated.spring(contentTranslateX, {
                    toValue: 0,
                    friction: 7,
                    tension: 50,
                    useNativeDriver: true,
                }),
            ]).start();
        });
    };

    // ── Acciones principales ───────────────────────────────────────────────

    const handleStart = () => {
        Vibration.vibrate(10);
        animateTransition(() => setCurrentStep(1));
    };

    const handleSubmitAnswer = async () => {
        if (!user || isSaving) return;
        const text = currentInput.trim();
        if (text.length < MIN_CHARS) return;

        setIsSaving(true);
        Vibration.vibrate(10);
        const questionId = ONBOARDING_QUESTIONS[currentStep - 1].id;

        try {
            const entryId = await SupabaseService.createOnboardingEntry({
                userId: user.id,
                content: text,
                isPreviewOnboarding: isPreviewMode,
            });

            const newResponses = [...responses, { questionId, text }];
            const newEntryIds = entryId ? [...entryIds, entryId] : entryIds;
            setResponses(newResponses);
            setEntryIds(newEntryIds);
            setCurrentInput('');

            if (currentStep < 5) {
                animateTransition(() => setCurrentStep(currentStep + 1));
            } else {
                // Última pregunta → procesamiento
                animateTransition(() => setCurrentStep(6));
                // Disparar generación del reflejo en background
                generateReflejo(newEntryIds);
            }
        } catch (e: any) {
            console.warn('OnboardingScreen: submitAnswer error:', e?.message);
        } finally {
            setIsSaving(false);
        }
    };

    const generateReflejo = async (ids: string[]) => {
        if (!user) return;
        try {
            const result = await aiService.generateInitialReflejo(ids, user.id);
            setReflejo(result.reflejo || 'No pude sintetizar un patrón claro todavía. Sigue capturando.');
            setPatterns(result.patterns || []);
            animateTransition(() => setCurrentStep(7));
        } catch (e: any) {
            console.warn('OnboardingScreen: generateReflejo error:', e?.message);
            setReflejo('No pude sintetizar tu reflejo ahora mismo. Estará en tu home en unos minutos.');
            setPatterns([]);
            animateTransition(() => setCurrentStep(7));
        }
    };

    const handleMicPress = async () => {
        if (isTranscribing) return;
        try {
            if (!isRecording) {
                const ok = await voiceService.startRecording();
                if (ok) setIsRecording(true);
            } else {
                setIsRecording(false);
                setIsTranscribing(true);
                const uri = await voiceService.stopRecording();
                if (uri) {
                    const text = await voiceService.transcribeAudio(uri);
                    setCurrentInput((prev) => (prev ? `${prev} ${text}` : text));
                }
            }
        } catch (e: any) {
            console.warn('OnboardingScreen: mic error:', e?.message);
        } finally {
            setIsTranscribing(false);
        }
    };

    const handleFinishToHome = async () => {
        if (!user) return;
        if (isPreviewMode) return; // En preview el botón es "Guardar/Descartar"

        await SupabaseService.markOnboardingComplete(user.id);
        await AsyncStorage.removeItem(ONBOARDING_STATE_KEY);
        await refreshProfile();
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    };

    const handlePreviewSave = async () => {
        if (!user) return;
        await SupabaseService.confirmPreviewOnboardingEntries(user.id);
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    };

    const handlePreviewDiscard = async () => {
        if (!user) return;
        await SupabaseService.discardPreviewOnboardingEntries(user.id);
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    };

    const handleProcessingSkip = async () => {
        if (!user) return;
        if (!isPreviewMode) {
            await SupabaseService.markOnboardingComplete(user.id);
            await AsyncStorage.removeItem(ONBOARDING_STATE_KEY);
            await refreshProfile();
        }
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    };

    // ── Render helpers ─────────────────────────────────────────────────────

    const currentQuestion = useMemo(() => {
        if (currentStep >= 1 && currentStep <= 5) {
            return ONBOARDING_QUESTIONS[currentStep - 1];
        }
        return null;
    }, [currentStep]);

    // ── Render: Step 0 Welcome ─────────────────────────────────────────────

    const renderWelcome = () => (
        <Animated.View
            style={[
                styles.fillCenter,
                { opacity: contentOpacity, transform: [{ translateX: contentTranslateX }] },
            ]}
        >
            {isPreviewMode && (
                <View style={styles.previewPill}>
                    <Text style={styles.previewPillText}>MODO DEMO · no se borrará tu data actual</Text>
                </View>
            )}

            <View style={{ marginBottom: 32 }}>
                <PulseLogo size={96} intensity="subtle" />
            </View>

            <Text style={styles.welcomeHeadline}>Soy BlackBoxMind.</Text>

            <Text style={styles.welcomeSubhead}>
                No soy un journal. No te voy a felicitar.{'\n'}
                Voy a confrontarte con tus propios patrones.{'\n\n'}
                Antes de empezar, necesito 5 minutos de tu cabeza.{'\n'}
                5 preguntas. Suelta lo que llegue.
            </Text>

            <TO style={styles.primaryButton} onPress={handleStart} activeOpacity={0.85}>
                <Text style={styles.primaryButtonText}>Empezar</Text>
                <AR size={18} color="#fff" style={{ marginLeft: 8 }} />
            </TO>
        </Animated.View>
    );

    // ── Render: Step 1-5 Question ──────────────────────────────────────────

    const renderQuestion = () => {
        if (!currentQuestion) return null;
        const canSubmit = currentInput.trim().length >= MIN_CHARS && !isSaving;

        return (
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <View style={styles.questionContainer}>
                    <ProgressDots active={currentStep} total={5} />

                    <Animated.View
                        style={[
                            styles.questionContent,
                            { opacity: contentOpacity, transform: [{ translateX: contentTranslateX }] },
                        ]}
                    >
                        <Text style={styles.questionText}>{currentQuestion.text}</Text>
                        <Text style={styles.questionHint}>{currentQuestion.hint}</Text>

                        <View style={styles.inputRow}>
                            <TI
                                style={styles.input}
                                value={currentInput}
                                onChangeText={setCurrentInput}
                                placeholder="Empieza a escribir..."
                                placeholderTextColor="#64748b"
                                multiline
                                autoFocus
                                editable={!isSaving}
                            />
                            <TO
                                style={[styles.micBtn, isRecording && styles.micBtnActive]}
                                onPress={handleMicPress}
                                disabled={isTranscribing}
                            >
                                {isTranscribing ? (
                                    <ActivityIndicator size="small" color="#c084fc" />
                                ) : (
                                    <M size={20} color={isRecording ? '#fff' : '#c084fc'} />
                                )}
                            </TO>
                        </View>
                    </Animated.View>

                    <Animated.View style={{ opacity: buttonOpacity }}>
                        <TO
                            style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
                            onPress={handleSubmitAnswer}
                            disabled={!canSubmit}
                            activeOpacity={0.85}
                        >
                            {isSaving ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Text style={styles.primaryButtonText}>Continuar</Text>
                                    <AR size={18} color="#fff" style={{ marginLeft: 8 }} />
                                </>
                            )}
                        </TO>
                    </Animated.View>
                </View>
            </KeyboardAvoidingView>
        );
    };

    // ── Render: Step 6 Processing ──────────────────────────────────────────

    const renderProcessing = () => (
        <View style={styles.fillCenter}>
            <View style={{ marginBottom: 36 }}>
                <PulseLogo size={120} intensity="strong" />
            </View>

            <Text style={styles.processingText}>{PROCESSING_PHRASES[processingPhraseIdx]}</Text>

            <View style={styles.processingDotsRow}>
                {[0, 1, 2, 3, 4].map((i) => (
                    <View key={i} style={styles.processingDot} />
                ))}
            </View>

            {processingTimedOut && (
                <View style={styles.timeoutBox}>
                    <Text style={styles.timeoutText}>
                        Esto está tardando más de lo normal. ¿Quieres ver el home con tus capturas
                        mientras tanto?
                    </Text>
                    <TO style={[styles.secondaryButton, { marginTop: 16 }]} onPress={handleProcessingSkip}>
                        <Text style={styles.secondaryButtonText}>Entrar al home</Text>
                    </TO>
                </View>
            )}
        </View>
    );

    // ── Render: Step 7 Reflejo ─────────────────────────────────────────────

    const renderReflejo = () => (
        <ScrollView contentContainerStyle={styles.reflejoScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.reflejoHeadline}>Esto es lo que vi en tu cabeza esta semana:</Text>

            <View style={styles.reflejoCard}>
                <TypewriterText text={reflejo} durationMs={600} style={styles.reflejoText} />
            </View>

            {patterns.length > 0 && (
                <>
                    <View style={styles.patternsLabelRow}>
                        <Sp size={14} color="#c084fc" />
                        <Text style={styles.patternsLabel}>Patrones detectados</Text>
                    </View>

                    {patterns.map((p, idx) => (
                        <PatternCard key={`${p.title}-${idx}`} pattern={p} delay={700 + idx * 200} />
                    ))}
                </>
            )}

            {isPreviewMode ? (
                <View style={styles.previewActionsRow}>
                    <TO
                        style={[styles.secondaryButton, { flex: 1, marginRight: 8 }]}
                        onPress={handlePreviewDiscard}
                    >
                        <Text style={styles.secondaryButtonText}>Descartar y volver</Text>
                    </TO>
                    <TO
                        style={[styles.primaryButton, { flex: 1, marginLeft: 8, marginTop: 0 }]}
                        onPress={handlePreviewSave}
                    >
                        <Text style={styles.primaryButtonText}>Guardar capturas</Text>
                    </TO>
                </View>
            ) : (
                <TO style={[styles.primaryButton, { marginTop: 36 }]} onPress={handleFinishToHome}>
                    <Text style={styles.primaryButtonText}>Entrar al home</Text>
                    <AR size={18} color="#fff" style={{ marginLeft: 8 }} />
                </TO>
            )}
        </ScrollView>
    );

    // ── Main render ────────────────────────────────────────────────────────

    return (
        <View style={styles.root}>
            <StatusBar barStyle="light-content" backgroundColor="#0A0E1A" />
            <LinearGradient
                colors={['rgba(124, 58, 237, 0.08)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.6, y: 0.5 }}
                style={StyleSheet.absoluteFillObject}
            />
            <SAV style={styles.safeArea}>
                {currentStep === 0 && renderWelcome()}
                {currentStep >= 1 && currentStep <= 5 && renderQuestion()}
                {currentStep === 6 && renderProcessing()}
                {currentStep === 7 && renderReflejo()}
            </SAV>
        </View>
    );
};

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#0A0E1A' },
    safeArea: { flex: 1 },
    fillCenter: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 28,
    },

    // Welcome
    previewPill: {
        position: 'absolute',
        top: 24,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: 'rgba(192, 132, 252, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(192, 132, 252, 0.3)',
    },
    previewPillText: {
        color: '#c084fc',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1,
    },
    logoCircle: {
        backgroundColor: 'rgba(124, 58, 237, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(192, 132, 252, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    welcomeHeadline: {
        color: '#FFFFFF',
        fontSize: 28,
        fontWeight: '700',
        lineHeight: 34,
        textAlign: 'center',
        marginBottom: 14,
    },
    welcomeSubhead: {
        color: '#cbd5e1',
        fontSize: 15,
        lineHeight: 23,
        textAlign: 'center',
        marginBottom: 40,
        maxWidth: 320,
    },

    // Buttons
    primaryButton: {
        flexDirection: 'row',
        backgroundColor: '#7C3AED',
        height: 56,
        paddingHorizontal: 32,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    primaryButtonDisabled: {
        backgroundColor: '#3b2f5e',
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    secondaryButton: {
        height: 52,
        paddingHorizontal: 22,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    secondaryButtonText: {
        color: '#cbd5e1',
        fontSize: 15,
        fontWeight: '600',
    },

    // Progress
    progressDots: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginTop: 24,
    },
    progressDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },

    // Question
    questionContainer: {
        flex: 1,
        paddingHorizontal: 28,
        paddingBottom: 28,
        justifyContent: 'space-between',
    },
    questionContent: {
        flex: 1,
        justifyContent: 'center',
    },
    questionText: {
        color: '#FFFFFF',
        fontSize: 27,
        fontWeight: '700',
        lineHeight: 34,
        textAlign: 'left',
        marginBottom: 12,
    },
    questionHint: {
        color: '#94a3b8',
        fontSize: 13,
        fontStyle: 'italic',
        lineHeight: 19,
        marginBottom: 28,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 10,
    },
    input: {
        flex: 1,
        backgroundColor: '#1A2236',
        borderWidth: 1.5,
        borderColor: 'rgba(192, 132, 252, 0.3)',
        borderRadius: 14,
        paddingVertical: 18,
        paddingHorizontal: 16,
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '500',
        minHeight: 110,
        maxHeight: 220,
        textAlignVertical: 'top',
    },
    micBtn: {
        width: 56,
        height: 56,
        borderRadius: 14,
        backgroundColor: 'rgba(124, 58, 237, 0.08)',
        borderWidth: 1.5,
        borderColor: 'rgba(192, 132, 252, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    micBtnActive: {
        backgroundColor: '#c084fc',
        borderColor: '#c084fc',
    },

    // Processing
    processingText: {
        color: '#cbd5e1',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 22,
        paddingHorizontal: 20,
    },
    processingDotsRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 6,
    },
    processingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#c084fc',
        opacity: 0.7,
    },
    timeoutBox: {
        marginTop: 40,
        paddingHorizontal: 24,
        alignItems: 'center',
    },
    timeoutText: {
        color: '#94a3b8',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 21,
    },

    // Reflejo
    reflejoScroll: {
        paddingHorizontal: 24,
        paddingTop: 32,
        paddingBottom: 60,
    },
    reflejoHeadline: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '700',
        lineHeight: 26,
        marginBottom: 20,
    },
    reflejoCard: {
        backgroundColor: '#1A1730',
        borderWidth: 1.5,
        borderColor: '#7C3AED',
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 6,
    },
    reflejoText: {
        color: '#FFFFFF',
        fontSize: 15.5,
        lineHeight: 24,
        fontWeight: '500',
    },
    patternsLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 28,
        marginBottom: 12,
    },
    patternsLabel: {
        color: '#c084fc',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    },
    patternCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 14,
        padding: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    patternTitle: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 4,
    },
    patternDesc: {
        color: '#94a3b8',
        fontSize: 13,
        lineHeight: 19,
    },
    previewActionsRow: {
        flexDirection: 'row',
        marginTop: 32,
    },
});

export default OnboardingScreen;
