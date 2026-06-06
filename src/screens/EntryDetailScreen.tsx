import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Platform, StatusBar, Share, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Share2, Edit3, Trash2, Calendar, Clock, Sparkles, Zap, Check, X, Laugh, SmilePlus, Meh, Angry, UserRoundCheck, Frown, Smile, CloudRain, Play, Pause } from 'lucide-react-native';
import { SupabaseService, supabase } from '../services/SupabaseService';
import { aiService } from '../services/ai';
import { ActionList } from '../components/ActionList';
import { BiasWarningCard } from '../components/BiasWarningCard';
import { WellnessActionCard } from '../components/WellnessActionCard';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import AILoadingOverlay from '../components/AILoadingOverlay';
import { Audio } from 'expo-av';

const formatRelativeDate = (iso: string) => {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days} días`;
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
};

const EntryDetailScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { entryId } = route.params as { entryId: string };
  const { user } = useAuth();

  const SAV = SafeAreaView as any;
  const TO = TouchableOpacity as any;
  const TI = TextInput as any;
  const CL = ChevronLeft as any;
  const S2 = Share2 as any;
  const E3 = Edit3 as any;
  const T2 = Trash2 as any;
  const Cal = Calendar as any;
  const Clo = Clock as any;
  const Sp = Sparkles as any;
  const Zp = Zap as any;
  const Ch = Check as any;
  const Xi = X as any;
  const L = Laugh as any;
  const SP = SmilePlus as any;
  const M = Meh as any;
  const A = Angry as any;
  const URC = UserRoundCheck as any;
  const FR = Frown as any;
  const S = Smile as any;
  const CR = CloudRain as any;

  const [entry, setEntry] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [actionItems, setActionItems] = useState<any[]>([]);
  const [related, setRelated] = useState<any[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);

  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [audioPositionMs, setAudioPositionMs] = useState(0);
  const [audioDurationMs, setAudioDurationMs] = useState(0);

  useEffect(() => {
    return sound ? () => { sound.unloadAsync(); } : undefined;
  }, [sound]);

  const fmtMs = (ms: number) => {
    const total = Math.floor(ms / 1000);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  };

  const toggleAudioPlayback = async () => {
    if (!entry?.audio_url) return;

    if (sound) {
      try {
        if (isAudioPlaying) {
          await sound.pauseAsync();
          setIsAudioPlaying(false);
        } else {
          await sound.playAsync();
          setIsAudioPlaying(true);
        }
      } catch {
        Alert.alert('Error', 'No se pudo controlar la reproducción.');
      }
      return;
    }

    setIsAudioLoading(true);
    try {
      const signedUrl = await SupabaseService.getSignedAudioUrl(entry.audio_url, 3600);
      if (!signedUrl) {
        Alert.alert('Audio no disponible', 'No se pudo cargar la grabación. Puede que ya haya expirado o se haya eliminado.');
        return;
      }
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: signedUrl },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;
          setIsAudioPlaying(status.isPlaying);
          setAudioPositionMs(status.positionMillis || 0);
          if (status.durationMillis) setAudioDurationMs(status.durationMillis);
          if (status.didJustFinish) {
            setIsAudioPlaying(false);
            setAudioPositionMs(0);
            newSound.setPositionAsync(0).catch(() => {});
          }
        }
      );
      setSound(newSound);
      setIsAudioPlaying(true);
    } catch (e) {
      Alert.alert('Error', 'No se pudo reproducir el audio.');
    } finally {
      setIsAudioLoading(false);
    }
  };

  useEffect(() => {
    const loadEntry = async () => {
      if (!entryId || entryId === 'undefined') {
        console.error('EntryDetailScreen: received invalid entryId:', entryId);
        setLoading(false);
        return;
      }
      try {
        const [data, items] = await Promise.all([
          SupabaseService.getEntryById(entryId),
          SupabaseService.getActionItemsByEntry(entryId)
        ]);
        
        setEntry(data);
        setActionItems(items || []);
        
        if (data) {
          setEditedTitle(data.title || '');
          setEditedContent(data.content || '');
        }
      } catch (error) {
        console.error('DETAIL_ERROR:', error);
      } finally {
        setLoading(false);
      }
    };
    loadEntry();
  }, [entryId]);

  useEffect(() => {
    if (!entryId || !user?.id) return;
    let cancelled = false;
    setRelatedLoading(true);
    SupabaseService.relatedEntries(user.id, entryId, { limit: 5 })
      .then(res => { if (!cancelled) setRelated(res); })
      .finally(() => { if (!cancelled) setRelatedLoading(false); });
    return () => { cancelled = true; };
  }, [entryId, user?.id]);

  const handleShare = async () => {
    if (!entry) return;
    try {
      const rec = entry.wellness_recommendation || entry.wellness_action;
      let recommendationText = '';
      if (rec) {
        recommendationText = typeof rec === 'string'
          ? `\n\n🎯 Take Action:\n${rec}`
          : `\n\n🎯 Take Action: ${rec.title || 'Insight'}\n${rec.description || ''}`;
      }

      const shareMessage = `BlackBoxMind SESSION: ${entry.title || 'Untitled'}\n\n` +
        `📝 Content:\n${entry.content}\n\n` +
        `🧠 AI Insight:\n${entry.summary || 'No analytics yet.'}` +
        recommendationText;

      await Share.share({
        message: shareMessage,
        title: 'Share BlackBoxMind Entry'
      });
    } catch (error) {
      console.error('SHARE_ERROR:', error);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      "Borrar Memoria",
      "¿Estás seguro de que quieres eliminar esta entrada para siempre?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('entries')
                .delete()
                .eq('id', entryId);

              if (error) throw error;
              navigation.goBack();
            } catch (error) {
              Alert.alert("Error", "No se pudo eliminar la entrada.");
            }
          }
        }
      ]
    );
  };

  const handleSave = async () => {
    if (!entry) return;
    setIsSaving(true);
    try {
      console.log('RE-PROCESSING AI INSIGHTS...');
      // Re-process AI Insights based on new content
      const analysis = await aiService.generateDailySummary([editedContent], user.id, entryId);

      const updatedPayload = {
        title: editedTitle,
        content: editedContent,
        summary: analysis.summary,
        sentiment_score: analysis.sentiment_score,
        mood_label: analysis.mood_label,
        category: analysis.category,
        wellness_recommendation: analysis.wellness_recommendation,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('entries')
        .update(updatedPayload)
        .eq('id', entryId)
        .select()
        .single();

      if (error) throw error;

      setEntry(data);
      setIsEditing(false);
      Alert.alert("Éxito", "Tu memoria y el análisis de BlackBoxMind han sido actualizados.");
    } catch (error) {
      console.error('SAVE_ERROR:', error);
      Alert.alert("Error", "No se pudieron guardar los cambios.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleConsultWithAI = async () => {
    if (!user || !entry) return;
    setIsSaving(true);
    try {
      // Create a thread automatically for this entry
      const threadTitle = `Consulta: ${entry.title || 'Sesión sin título'}`;
      let category = entry.category || 'GENERAL';
      
      // Map to ChatThread categories if needed
      if (category === 'WELLNESS') category = 'HEALTH';
      if (category === 'DEVELOPMENT') category = 'PERSONAL';

      // Continue the conversation already tied to this memoria; only
      // create (and link) a thread the first time. This keeps "Profundizar
      // en chat" on the SAME ficha instead of spawning new memorias.
      let thread = await SupabaseService.getThreadByEntry(entry.id);
      if (!thread) {
        thread = await SupabaseService.createChatThread(user.id, threadTitle, category);
        if (thread) await SupabaseService.linkThreadEntry(thread.id, entry.id);
      }

      if (thread) {
        navigation.navigate('Chat' as any, {
          threadId: thread.id,
          category: thread.category,
          title: thread.title,
        });
      }
    } catch (error) {
      console.error('CONSULT_AI_ERROR:', error);
      Alert.alert("Error", "No se pudo iniciar la consulta con IA.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <AILoadingOverlay visible={true} message="Recuperando memoria..." />
      </View>
    );
  }

  if (!entry) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#94a3b8' }}>Entry not found.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
          <Text style={{ color: '#6366f1' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getMoodIcon = (label: string, score: number = 0) => {
    const size = 28;
    const color = '#6366f1'; // Premium Blue for detail view

    switch (label) {
      case 'En Flow': return <L size={size} color={color} />;
      case 'Inspirado': return <SP size={size} color={color} />;
      case 'Agotado': return <FR size={size} color={color} />;
      case 'Disperso': return <M size={size} color={color} />;
      case 'Frustrado': return <A size={size} color={color} />;
      case 'Determinado': return <URC size={size} color={color} />;
      case 'Ansioso': return <CR size={size} color={color} />;
      case 'Satisfecho': return <SP size={size} color={color} />;
      default: return <S size={size} color={color} />;
    }
  };

  const dateObject = new Date(entry.created_at);

  return (
    <SAV style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TO onPress={() => isEditing ? setIsEditing(false) : navigation.goBack()} style={styles.backButton}>
          {isEditing ? <Xi size={28} color="#0F172A" /> : <CL size={28} color="#0F172A" />}
        </TO>

        <View style={styles.headerActions}>
          {!isEditing ? (
            <>
              <TO style={styles.actionCircle} onPress={handleShare}>
                <S2 size={20} color="#0F172A" />
              </TO>
              <TO
                style={[styles.actionCircle, { backgroundColor: '#6366f1' }]}
                onPress={() => setIsEditing(true)}
              >
                <E3 size={20} color="#0F172A" />
              </TO>
            </>
          ) : (
            <TO
              style={[styles.actionCircle, { backgroundColor: '#22c55e' }]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? <View /> : <Ch size={20} color="#0F172A" />}
            </TO>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Metadata */}
        <View style={styles.metaRow}>
          <View style={styles.metaBadge}>
            <Cal size={14} color="#6366f1" style={{ marginRight: 6 }} />
            <Text style={styles.metaText}>{dateObject.toLocaleDateString()}</Text>
          </View>
          <View style={styles.metaBadge}>
            <Clo size={14} color="#6366f1" style={{ marginRight: 6 }} />
            <Text style={styles.metaText}>{dateObject.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
          </View>
          <View style={styles.moodBadgeDetail}>
            {getMoodIcon(entry.mood_label, entry.sentiment_score)}
          </View>
          {entry.category && (
            <View style={[styles.metaBadge, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
              <Text style={[styles.metaText, { color: '#10b981' }]}>{entry.category}</Text>
            </View>
          )}
        </View>

        {/* Title */}
        {isEditing ? (
          <TI
            style={[styles.title, styles.titleInput]}
            value={editedTitle}
            onChangeText={setEditedTitle}
            placeholder="Título de la sesión..."
            placeholderTextColor="#475569"
          />
        ) : (
          <Text style={styles.title}>{entry.title || 'Untitled Session'}</Text>
        )}

        {/* Decorative Divider */}
        <View style={styles.divider} />

        {/* Content */}
        {isEditing ? (
          <TI
            style={[styles.bodyText, styles.contentInput]}
            value={editedContent}
            onChangeText={setEditedContent}
            multiline
            placeholder="¿Qué tienes en mente?"
            placeholderTextColor="#475569"
          />
        ) : (
          <Text style={styles.bodyText}>
            {entry.content}
          </Text>
        )}

        {/* 1. STRATEGIC INSIGHT (AUDIT) */}
        <BiasWarningCard insight={entry.strategic_insight} />

        {/* 2. PLAN DE ATAQUE (ACTIVE LOOPS) */}
        {actionItems && actionItems.length > 0 && (
          <ActionList actions={actionItems} entryId={entry.id} />
        )}

        {/* 3. BLACKBOX STRATEGIC INSIGHT & WELLNESS */}
        <WellnessActionCard
          recommendation={entry.wellness_recommendation}
          summary={entry.summary}
        />

        {/* 4. CHAT WITH AI ABOUT THIS */}
        <TO 
          style={styles.chatBtn} 
          onPress={handleConsultWithAI}
          disabled={isSaving}
        >
          <LG colors={['#6366f1', '#4f46e5']} start={{x:0, y:0}} end={{x:1, y:0}} style={styles.chatBtnGradient}>
            <Sp size={20} color="white" style={{ marginRight: 10 }} />
            <Text style={styles.chatBtnText}>Profundizar en Chat</Text>
          </LG>
        </TO>

        {/* Audio player (only if entry has audio) */}
        {entry.audio_url && (
          <TouchableOpacity
            style={styles.audioPlayer}
            onPress={toggleAudioPlayback}
            disabled={isAudioLoading}
            activeOpacity={0.85}
          >
            <View style={styles.audioPlayBtn}>
              {isAudioLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : isAudioPlaying ? (
                <Pause size={20} color="white" fill="white" />
              ) : (
                <Play size={20} color="white" fill="white" />
              )}
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.audioPlayerLabel}>Grabación original</Text>
              <Text style={styles.audioPlayerTime}>
                {audioDurationMs > 0
                  ? `${fmtMs(audioPositionMs)} / ${fmtMs(audioDurationMs)}`
                  : isAudioLoading
                    ? 'Cargando…'
                    : 'Toca para escuchar'}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Delete Action */}
        <TO style={styles.deleteButton} onPress={handleDelete}>
          <T2 size={18} color="#ef4444" style={{ marginRight: 8 }} />
          <Text style={styles.deleteText}>Delete memory</Text>
        </TO>

        {related.length > 0 && (
          <View style={styles.relatedSection}>
            <View style={styles.relatedHeader}>
              <Sp size={14} color="#7C3AED" strokeWidth={2.2} />
              <Text style={styles.relatedTitle}>MEMORIAS RELACIONADAS</Text>
            </View>
            {related.map((r) => (
              <TO
                key={r.id}
                style={styles.relatedCard}
                onPress={() => navigation.replace('EntryDetail', { entryId: r.id })}
                activeOpacity={0.85}
              >
                <View style={styles.relatedCardHead}>
                  <Text style={styles.relatedCardTitle} numberOfLines={1}>
                    {r.title || 'Sin título'}
                  </Text>
                  <View style={styles.relatedScorePill}>
                    <Text style={styles.relatedScoreText}>
                      {(r.similarity ?? 0).toFixed(2)}
                    </Text>
                  </View>
                </View>
                {!!r.summary && (
                  <Text style={styles.relatedCardSnippet} numberOfLines={2}>
                    {r.summary}
                  </Text>
                )}
                <Text style={styles.relatedCardMeta}>
                  {formatRelativeDate(r.created_at)} · {r.category || 'GENERAL'}
                </Text>
              </TO>
            ))}
          </View>
        )}
      </ScrollView>

      <AILoadingOverlay visible={isSaving} message="Procesando tu BlackBoxMind.ai..." />
    </SAV>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 15,
    paddingBottom: 10
  },
  backButton: {
    padding: 8,
    marginLeft: -8
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12
  },
  actionCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  content: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: 60,
    paddingHorizontal: 24
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
    gap: 12
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  metaText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600'
  },
  title: {
    color: '#0F172A',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 36,
    marginBottom: 20
  },
  moodBadgeDetail: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(15, 23, 42, 0.04)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  titleInput: {
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  contentInput: {
    backgroundColor: 'rgba(15, 23, 42, 0.04)',
    borderRadius: 16,
    padding: 20,
    minHeight: 200,
    textAlignVertical: 'top'
  },
  divider: {
    height: 4,
    width: 40,
    backgroundColor: '#6366f1',
    borderRadius: 2,
    marginBottom: 30
  },
  bodyText: {
    color: '#475569',
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '400',
    marginBottom: 40
  },
  counterText: {
    color: '#059669',
    fontSize: 13,
    lineHeight: 18
  },
  audioPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderColor: 'rgba(99, 102, 241, 0.2)',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 30,
    marginTop: 10,
  },
  audioPlayBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioPlayerLabel: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  audioPlayerTime: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)'
  },
  deleteText: {
    color: '#ef4444',
    fontWeight: 'bold',
    fontSize: 16
  },
  chatBtn: {
    marginTop: 20,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8
  },
  chatBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  chatBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5
  },
  relatedSection: { marginTop: 32, marginBottom: 16 },
  relatedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  relatedTitle: { color: '#7C3AED', fontSize: 11, fontWeight: '700', letterSpacing: 1.8 },
  relatedCard: {
    backgroundColor: '#0F172A',
    borderColor: '#E2E8F0',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  relatedCardHead: { flexDirection: 'row', justifyContent: 'space-between',
                     alignItems: 'flex-start', marginBottom: 6, gap: 8 },
  relatedCardTitle: { color: '#0F172A', fontSize: 14, fontWeight: '700', flex: 1 },
  relatedScorePill: { backgroundColor: 'rgba(192,132,252,0.15)',
                      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  relatedScoreText: { color: '#7C3AED', fontSize: 11, fontWeight: '700' },
  relatedCardSnippet: { color: '#94a3b8', fontSize: 12, lineHeight: 18, marginBottom: 6 },
  relatedCardMeta: { color: '#64748b', fontSize: 10, letterSpacing: 0.5 },
});

const LG = LinearGradient as any;

export default EntryDetailScreen;

