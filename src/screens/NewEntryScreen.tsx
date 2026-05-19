import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
  StatusBar,
  Animated,
  Easing,
  KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Mic, X, Camera, Image as ImageIcon, Brain } from 'lucide-react-native';
import { aiService } from '../services/ai';
import { voiceService } from '../services/voice';
import { SupabaseService } from '../services/SupabaseService';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/types';
import VoiceVisualizer from '../components/VoiceVisualizer';
import AILoadingOverlay from '../components/AILoadingOverlay';
import { useSubscription, FREE_ENTRY_LIMIT } from '../hooks/useSubscription';
import { Crown, Lock } from 'lucide-react-native';
import { NotificationService } from '../services/notificationService';

const NewEntryScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, profile, refreshProfile } = useAuth();
  const { isPro, monthlyEntryCount, entryLimitReached } = useSubscription();

  const SAV = SafeAreaView as any;
  const TO = TouchableOpacity as any;
  const TI = TextInput as any;
  const Mi = Mic as any;
  const Xi = X as any;
  const Ca = Camera as any;
  const II = ImageIcon as any;
  const Cr = Crown as any;
  const Lk = Lock as any;

  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [lastRecordingUri, setLastRecordingUri] = useState<string | null>(null);
  const [metering, setMetering] = useState(-160);
  const [showText, setShowText] = useState(false);
  const pulseAnim = React.useRef(new Animated.Value(1)).current;


  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Buffer for Android status bar
  const androidPadding = (StatusBar.currentHeight || 0) + 40;

  const handleSave = async () => {
    if (!content.trim()) {
      Alert.alert('Faltan datos', 'Por favor, escribe o graba algo.');
      return;
    }
    if (!user) {
      Alert.alert("Error", "Debes estar conectado para guardar entradas.");
      return;
    }

    // Waste text detector: Prevent short/test entries from consuming AI tokens
    const wordCount = content.trim().split(/\s+/).length;
    if (content.length < 40 || wordCount < 8) {
      Alert.alert(
        'Contenido Insuficiente',
        'Detectamos un texto demasiado corto que no permitirá generar Metas ni Active Loops eficaces. \n\nEs importante enviar mensajes estructurados de al menos un párrafo para que el Coach Estratégico pueda darte un análisis profundo.',
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

      // AI generates the title, summary, and strategic insights
      const analysis = await aiService.generateDailySummary(
        [content],
        user.id
      );

      // Save the entry to the DB and get its ID
      const savedEntry = await SupabaseService.createEntry({
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

      // Note: action_items are inserted server-side by the Edge Function
      // using SERVICE_ROLE_KEY, so no client-side insert needed here.

      // Schedule follow-up notifications for HIGH priority loops
      if (Array.isArray(analysis.action_items)) {
        const highPriorities = analysis.action_items.filter((ai: any) => ai.priority === 'HIGH');
        for (const hp of highPriorities) {
          await NotificationService.scheduleStrategicFollowup(hp.task || hp.description);
        }
      }

      // Entry analyzed — take the user straight to the verdict (the clinical
      // report), not silently back to an empty compose box.
      if (savedEntry?.id) {
        navigation.replace('EntryDetail', { entryId: savedEntry.id });
      } else {
        navigation.goBack();
      }

    } catch (err: any) {
      console.error('Save Error:', err);
      Alert.alert(
        'No se pudo guardar',
        'Hubo un problema al analizar tu entrada. Verifica tu conexión e intenta de nuevo.',
        [{ text: 'Entendido' }]
      );
    } finally {
      setLoading(false);
    }
  };



  const toggleRecording = async () => {
    if (isRecording) {
      const uri = await voiceService.stopRecording();
      setLastRecordingUri(uri);
      setIsRecording(false);
      setMetering(-160);
      if (uri) {
        setIsTranscribing(true);
        try {
          const trans = await voiceService.transcribeAudio(uri);
          setContent(prev => prev + (prev ? " " : "") + trans);
        } catch (err: any) {
          console.error('Transcription error handling:', err);
          Alert.alert('Error de transcripción', 'No se pudo convertir el audio a texto. Intenta de nuevo.');
        } finally {
          setIsTranscribing(false);
        }
      }
    } else {
      const started = await voiceService.startRecording((status) => {
        if (status.metering !== undefined) {
          setMetering(status.metering);
        }
      });
      if (started) {
        setIsRecording(true);
      }
    }
  };

  // Gate: FREE users limited to 5 entries/month
  if (entryLimitReached) {
    return (
      <SAV style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 30 }]}>
        <View style={{ backgroundColor: '#1e293b', padding: 30, borderRadius: 30, width: '100%', borderWidth: 1, borderColor: '#6366f1' }}>
          <Cr size={60} color="#facc15" style={{ alignSelf: 'center', marginBottom: 20 }} />
          <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 15 }}>
            Límite Mensual Alcanzado
          </Text>
          <Text style={{ color: '#94a3b8', fontSize: 16, textAlign: 'center', marginBottom: 8, lineHeight: 24 }}>
            Has usado {monthlyEntryCount}/{FREE_ENTRY_LIMIT} registros este mes como usuario{' '}
            <Text style={{ color: '#6366f1', fontWeight: 'bold' }}>FREE</Text>.
          </Text>
          <Text style={{ color: '#94a3b8', fontSize: 16, textAlign: 'center', marginBottom: 30, lineHeight: 24 }}>
            Hazte <Text style={{ color: '#a855f7', fontWeight: 'bold' }}>PRO</Text> para registros ilimitados, chat estratégico y reportes semanales.
          </Text>
          <TO
            style={{ backgroundColor: '#6366f1', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}
            onPress={() => navigation.navigate('Paywall')}
          >
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>VER PLANES PRO</Text>
          </TO>
          <TO onPress={() => navigation.goBack()} style={{ alignSelf: 'center' }}>
            <Text style={{ color: '#475569', fontSize: 14, fontWeight: '500' }}>Volver al inicio</Text>
          </TO>
        </View>
      </SAV>
    );
  }

  return (
    <SAV style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TO onPress={() => navigation.goBack()}>
          <Xi color="white" size={24} />
        </TO>
        <Text style={styles.headerTitle}>NUEVO REGISTRO</Text>
        {content.trim() ? (
          <TO
            onPress={handleSave}
            disabled={loading}
            style={[styles.publishBtn, loading && { opacity: 0.5 }]}
          >
            {loading ? (
              <View />
            ) : (
              <Text style={styles.publishBtnText}>ANALIZAR</Text>
            )}
          </TO>
        ) : (
          <View style={{ width: 70 }} />
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {(!showText && !content.trim()) ? (
          // ─── VOZ PRIMERO (acción principal) ───────────────────────────────
          <View style={styles.voiceHero}>
            <Text style={styles.voiceTitle}>Suelta lo que cargas</Text>
            <Text style={styles.voiceSub}>
              Habla. BLACKBOX lo ordena, detecta el sesgo y te devuelve el movimiento.
            </Text>

            <Animated.View style={{ transform: [{ scale: isRecording ? 1 : pulseAnim }], marginTop: 20 }}>
              <TO
                onPress={() => { toggleRecording(); }}
                style={[styles.heroRecordBtn, isRecording && styles.recordBtnActive]}
              >
                <View style={[styles.heroInnerRecord, isRecording && styles.innerRecordActive]}>
                  {isRecording ? <View style={styles.stopIconLg} /> : <Mi size={46} color="white" />}
                </View>
              </TO>
            </Animated.View>

            <View style={styles.visualizerContainer}>
              <VoiceVisualizer isActive={isRecording} metering={metering} />
            </View>

            <Text style={styles.recordHint}>
              {isRecording ? 'Grabando… toca para terminar' : 'Toca el micrófono y habla'}
            </Text>

            <TO onPress={() => setShowText(true)} style={{ marginTop: 28, padding: 8 }}>
              <Text style={styles.writeLink}>Prefiero escribir</Text>
            </TO>
          </View>
        ) : (
          // ─── ESCRIBIR / REVISAR (secundario) ──────────────────────────────
          <>
            <View style={styles.modeRow}>
              <TO onPress={() => setShowText(false)} style={{ padding: 6 }}>
                <Text style={styles.writeLink}>← Volver a voz</Text>
              </TO>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
              <TI
                multiline
                style={styles.contentInput}
                placeholder="Escribe lo que cargas…"
                placeholderTextColor="#475569"
                autoFocus
                value={content}
                onChangeText={setContent}
              />
            </ScrollView>

            <View style={styles.visualizerContainer}>
              <VoiceVisualizer isActive={isRecording} metering={metering} />
            </View>

            <View style={styles.toolbar}>
              <TO style={styles.toolBtn}>
                <Ca size={24} color="#94a3b8" />
              </TO>

              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <TO
                  onPress={() => { toggleRecording(); }}
                  style={[styles.recordBtn, isRecording && styles.recordBtnActive]}
                >
                  <View style={[styles.innerRecord, isRecording && styles.innerRecordActive]}>
                    {isRecording ? <View style={styles.stopIcon} /> : <Mi size={28} color="white" />}
                  </View>
                </TO>
              </Animated.View>

              <TO style={styles.toolBtn}>
                <II size={24} color="#94a3b8" />
              </TO>
            </View>
          </>
        )}
      </KeyboardAvoidingView>

      <AILoadingOverlay visible={loading || isTranscribing} message={isTranscribing ? "Transcribiendo audio..." : "Ingresando a tu BlackboxMind..."} />
    </SAV>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderColor: '#1e293b'
  },
  headerTitle: { color: 'white', fontWeight: 'bold', fontSize: 16, letterSpacing: 1 },
  publishBtn: { backgroundColor: '#6366f1', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  publishBtnText: { color: 'white', fontWeight: 'bold', fontSize: 13 },
  content: { flex: 1 },
  scrollContent: { padding: 24 },
  titleInput: { color: 'white', fontSize: 28, fontWeight: 'bold', marginBottom: 20 },
  contentInput: { color: '#cbd5e1', fontSize: 18, lineHeight: 28, minHeight: 300, textAlignVertical: 'top' },
  visualizerContainer: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 40 : 25,
    paddingTop: 20,
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30
  },
  toolBtn: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  recordBtn: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center', alignItems: 'center',
    marginTop: -50
  },
  recordBtnActive: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  innerRecord: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
  innerRecordActive: { backgroundColor: '#ef4444' },
  stopIcon: { width: 22, height: 22, backgroundColor: 'white', borderRadius: 4 },
  stopIconLg: { width: 34, height: 34, backgroundColor: 'white', borderRadius: 6 },
  voiceHero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  voiceTitle: {
    color: 'white',
    fontSize: 30,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  voiceSub: {
    color: '#94a3b8',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 12,
    maxWidth: 320,
  },
  heroRecordBtn: {
    width: 132, height: 132, borderRadius: 66,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  heroInnerRecord: {
    width: 104, height: 104, borderRadius: 52,
    backgroundColor: '#6366f1',
    justifyContent: 'center', alignItems: 'center',
  },
  recordHint: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 8,
  },
  writeLink: {
    color: '#818cf8',
    fontSize: 14,
    fontWeight: '600',
  },
  modeRow: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 23, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100
  },
  overlayText: { color: 'white', marginTop: 16, fontWeight: 'bold', letterSpacing: 1 }
});

export default NewEntryScreen;
