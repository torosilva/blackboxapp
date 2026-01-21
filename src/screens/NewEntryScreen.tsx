import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
  StatusBar
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Mic, X, Camera, Image as ImageIcon } from 'lucide-react-native';
import { aiService } from '../services/ai';
import { voiceService } from '../services/voice';
import { SupabaseService } from '../services/SupabaseService';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/types';

const NewEntryScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [lastRecordingUri, setLastRecordingUri] = useState<string | null>(null);

  // Buffer for Android status bar
  const androidPadding = (StatusBar.currentHeight || 0) + 40;

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert('Faltan datos', 'Por favor, añade un título y contenido.');
      return;
    }
    if (!user) {
      Alert.alert("Error", "Debes estar conectado para guardar entradas.");
      return;
    }

    setLoading(true);
    try {
      let audioUrl = null;
      if (lastRecordingUri) {
        audioUrl = await SupabaseService.uploadAudio(lastRecordingUri, user.id);
      }

      // Fetch historical context for "Long-Term Memory"
      const historicalContext = await SupabaseService.getRecentInsights(user.id);

      const analysis = await aiService.generateDailySummary([{ title, content }], historicalContext);

      await SupabaseService.createEntry({
        user_id: user.id,
        title,
        content: analysis.original_text || content,
        sentiment_score: analysis.sentiment_score,
        mood_label: analysis.mood_label,
        summary: analysis.summary,
        wellness_recommendation: analysis.wellness_recommendation,
        strategic_insight: analysis.strategic_insight,
        action_items: analysis.action_items,
        audio_url: audioUrl,
        original_text: analysis.original_text || content
      });

      Alert.alert('Análisis de BLACKBOX', `${analysis.summary}`, [
        {
          text: 'Finalizar', onPress: () => {
            navigation.navigate('Home');
          }
        }
      ]);
    } catch (err) {
      console.error('Save Error:', err);
      Alert.alert('Error', 'No se pudo guardar la entrada.');
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
        setLoading(true);
        const trans = await voiceService.transcribeAudio(uri);
        setContent(prev => prev + (prev ? " " : "") + trans);
        setLoading(false);
      }
    } else {
      await voiceService.startRecording();
      setIsRecording(true);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <X color="white" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>NUEVO REGISTRO</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={loading}
          style={[styles.publishBtn, loading && { opacity: 0.5 }]}
        >
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.publishBtnText}>PUBLICAR</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <TextInput
          style={styles.titleInput}
          placeholder="Título de la sesión..."
          placeholderTextColor="#475569"
          value={title}
          onChangeText={setTitle}
        />

        <TextInput
          multiline
          style={styles.contentInput}
          placeholder="¿Qué tienes en mente?"
          placeholderTextColor="#475569"
          value={content}
          onChangeText={setContent}
        />
      </ScrollView>

      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolBtn}>
          <Camera size={24} color="#94a3b8" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={toggleRecording}
          style={[styles.recordBtn, isRecording && styles.recordBtnActive]}
        >
          <View style={[styles.innerRecord, isRecording && styles.innerRecordActive]}>
            {isRecording ? <View style={styles.stopIcon} /> : <Mic size={28} color="white" />}
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolBtn}>
          <ImageIcon size={24} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.overlayText}>Procesando Insights...</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 60 : 10,
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
