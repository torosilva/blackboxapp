import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { voiceService } from '../services/voice';
import { aiService } from '../services/ai';
import { SupabaseService } from '../services/SupabaseService';
import { useAuth } from '../context/AuthContext';
import AILoadingOverlay from '../components/AILoadingOverlay';
import { NotificationService } from '../services/notificationService';
import { useSubscription } from '../hooks/useSubscription';

export const QuickCaptureScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { user } = useAuth();
    const { canCreateAudit, refresh } = useSubscription();
    const [isRecording, setIsRecording] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [duration, setDuration] = useState(0);

    // Pulse animation
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isRecording) {
            interval = setInterval(() => setDuration((d) => d + 1), 1000);
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.2,
                        duration: 800,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 800,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        } else {
            setDuration(0);
            pulseAnim.setValue(1);
            pulseAnim.stopAnimation();
            clearInterval(interval!);
        }
        return () => clearInterval(interval!);
    }, [isRecording]);

    const handleStartRecording = async () => {
        if (!canCreateAudit()) {
            Alert.alert(
                "Límite de Auditoría",
                "Has alcanzado el límite de 3 auditorías gratuitas. Desbloquea el acceso ilimitado para continuar.",
                [
                    { text: "Ahora no", style: "cancel" },
                    { text: "Ver Planes", onPress: () => navigation.navigate('Paywall') }
                ]
            );
            return;
        }

        try {
            await voiceService.startRecording();
            setIsRecording(true);
        } catch (err: any) {
            console.error('QuickCapture: Recording error:', err);
            setIsRecording(false);
            Alert.alert('Error de Grabación', err.message);
        }
    };

    const handleStopRecording = async () => {
        if (!isRecording) return;
        setIsRecording(false);
        setIsAnalyzing(true);

        try {
            const uri = await voiceService.stopRecording();
            if (!uri || !user) throw new Error('Recording failed or user not authenticated');

            // 1. Transcribe
            const transcription = await voiceService.transcribeAudio(uri);
            if (!transcription.trim()) throw new Error('Empty transcription');

            // 2. Upload Audio
            const audioUrl = await SupabaseService.uploadAudio(uri, user.id);

            // 3. AI Analysis (Zero-Click Titling included)
            const historicalContext = await SupabaseService.getRecentInsights(user.id);
            const analysis = await aiService.generateDailySummary([transcription], historicalContext);

            // 4. Create Entry
            await SupabaseService.createEntry({
                user_id: user.id,
                title: analysis.title,
                content: transcription,
                summary: analysis.summary,
                category: analysis.category,
                mood_label: analysis.mood_label,
                sentiment_score: analysis.sentiment_score,
                wellness_recommendation: analysis.wellness_recommendation,
                strategic_insight: analysis.strategic_insight,
                action_items: analysis.action_items,
                audio_url: audioUrl,
                original_text: transcription
            });

            // 5. Navigate to Home
            await refresh(); // Sync audit count
            navigation.navigate('Home');

            // NEW: Aggressive Follow-up Trigger (Local)
            if (Array.isArray(analysis.action_items)) {
                const highPriorities = analysis.action_items.filter((ai: any) => ai.priority === 'HIGH');
                for (const hp of highPriorities) {
                    await NotificationService.scheduleStrategicFollowup(hp.description);
                }
            }

            // 6. Proactive Goal Assessment (v5.8)
            if (analysis.suggested_goals && analysis.suggested_goals.length > 0) {
                const goalsText = analysis.suggested_goals.join('\n• ');
                Alert.alert(
                    "🎯 Metas Detectadas",
                    `He identificado objetivos estratégicos en tu sesión:\n\n• ${goalsText}\n\n¿Deseas registrarlos como Metas Oficiales?`,
                    [
                        { text: "Ahora no", style: "cancel" },
                        { 
                            text: "Registrar Metas", 
                            onPress: async () => {
                                try {
                                    for (const goalTitle of analysis.suggested_goals) {
                                        await SupabaseService.createGoal(user.id, goalTitle, `Identificado proactivamente en: ${analysis.title}`, 'BUSINESS');
                                    }
                                    Alert.alert("Éxito", "Metas registradas en tu Centro Estratégico.");
                                } catch (e: any) {
                                    console.error("Failed to register suggested goals", e);
                                    Alert.alert("Error de Registro", `No se pudieron guardar las metas: ${e.message || 'Error desconocido'}`);
                                }
                            }
                        }
                    ]
                );
            } else {
                Alert.alert('Protocolo Completado', `Bautizado como: ${analysis.title}`);
            }
        } catch (err: any) {
            console.error('Process Error:', err);
            Alert.alert('Error', err.message || 'No se pudo procesar el volcado mental.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    return (
        <View className="flex-1 bg-[#020617] items-center justify-center px-6">
            {/* HEADER DE ESTADO */}
            <View className="absolute top-20 items-center">
                <Text className="text-gray-500 text-xs tracking-[4px] font-bold uppercase mb-2">
                    Protocolo de Ingesta
                </Text>
                <Text className="text-white text-lg font-medium">
                    {isAnalyzing ? "AUDITANDO DATOS..." : isRecording ? "CAPTURANDO SEÑAL" : "SISTEMA LISTO"}
                </Text>
            </View>

            {/* BOTÓN CENTRAL GIGANTE */}
            <View className="items-center justify-center h-64 w-64">
                {isRecording && (
                    <Animated.View 
                        style={{ transform: [{ scale: pulseAnim }] }}
                        className="absolute w-48 h-48 rounded-full bg-red-500/20"
                    />
                )}

                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={isRecording ? handleStopRecording : handleStartRecording}
                    disabled={isAnalyzing}
                    className={`w-36 h-36 rounded-full items-center justify-center border-4 shadow-2xl ${
                        isRecording 
                            ? 'bg-red-600 border-red-400 shadow-red-500/50' 
                            : isAnalyzing
                            ? 'bg-[#1e293b] border-indigo-500 opacity-50'
                            : 'bg-[#1e293b] border-white/20'
                    }`}
                >
                    {isAnalyzing ? (
                        <View /> // Handled by overlay
                    ) : (
                        <Ionicons 
                            name={isRecording ? "stop" : "mic"} 
                            size={48} 
                            color="white" 
                        />
                    )}
                </TouchableOpacity>
            </View>

            {/* TIMER / FEEDBACK INFERIOR */}
            <View className="absolute bottom-32 items-center">
                {isRecording ? (
                    <Text className="text-red-400 text-3xl font-light font-mono tracking-widest">
                        {formatTime(duration)}
                    </Text>
                ) : isAnalyzing ? (
                    <Text className="text-indigo-400 text-sm tracking-widest font-mono">
                        {">_"} AUDITANDO ESTRATEGIA...
                    </Text>
                ) : (
                    <TouchableOpacity onPress={() => navigation.navigate('Home')}>
                      <Text className="text-gray-500 text-sm">
                          Toca el micro para iniciar el volcado mental
                      </Text>
                    </TouchableOpacity>
                )}
            </View>
            
            {/* BOTÓN DE CANCELAR */}
            {!isRecording && !isAnalyzing && (
              <TouchableOpacity 
                onPress={() => navigation.navigate('Home')}
                className="absolute bottom-16"
              >
                  <Ionicons name="close-circle-outline" size={32} color="#475569" />
              </TouchableOpacity>
            )}

            <AILoadingOverlay visible={isAnalyzing} message="Consultando a tu Coach Estratégico..." />
        </View>
    );
};

export default QuickCaptureScreen;
