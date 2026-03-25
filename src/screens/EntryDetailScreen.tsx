import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Platform, StatusBar, Share, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Share2, Edit3, Trash2, Calendar, Clock, Sparkles, Zap, Check, X, Laugh, SmilePlus, Meh, Angry, UserRoundCheck, Frown, Smile, CloudRain } from 'lucide-react-native';
import { SupabaseService, supabase } from '../services/SupabaseService';
import { aiService } from '../services/ai';
import { ActionList } from '../components/ActionList';
import { BiasWarningCard } from '../components/BiasWarningCard';
import { WellnessActionCard } from '../components/WellnessActionCard';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';

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

  useEffect(() => {
    const loadEntry = async () => {
      try {
        const data = await SupabaseService.getEntryById(entryId);
        setEntry(data);
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

      const shareMessage = `BLACKBOX SESSION: ${entry.title || 'Untitled'}\n\n` +
        `📝 Content:\n${entry.content}\n\n` +
        `🧠 AI Insight:\n${entry.summary || 'No analytics yet.'}` +
        recommendationText;

      await Share.share({
        message: shareMessage,
        title: 'Share Blackbox Entry'
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
      const analysis = await aiService.generateDailySummary([editedContent]);

      const updatedPayload = {
        title: editedTitle,
        content: editedContent,
        summary: analysis.summary,
        sentiment_score: analysis.sentiment_score,
        mood_label: analysis.mood_label,
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
      Alert.alert("Éxito", "Tu memoria y el análisis de BLACKBOX han sido actualizados.");
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
      // Map mood to a category or use GENERAL
      let category: 'BUSINESS' | 'PERSONAL' | 'HEALTH' | 'GENERAL' = 'GENERAL';
      
      // Heuristic for category based on content (simple version)
      const content = entry.content.toLowerCase();
      if (content.includes('negocio') || content.includes('trabajo') || content.includes('business') || content.includes('cliente')) {
        category = 'BUSINESS';
      } else if (content.includes('salud') || content.includes('entrenar') || content.includes('dieta') || content.includes('health')) {
        category = 'HEALTH';
      } else if (content.includes('personal') || content.includes('sueño') || content.includes('emoción')) {
        category = 'PERSONAL';
      }

      const newThread = await SupabaseService.createChatThread(user.id, threadTitle, category);
      
      if (newThread) {
        // Option 1: Just navigate
        navigation.navigate('Chat' as any, {
          threadId: newThread.id,
          category: newThread.category,
          title: newThread.title
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
        <ActivityIndicator size="large" color="#6366f1" />
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
          {isEditing ? <Xi size={28} color="#ffffff" /> : <CL size={28} color="#ffffff" />}
        </TO>

        <View style={styles.headerActions}>
          {!isEditing ? (
            <>
              <TO style={styles.actionCircle} onPress={handleShare}>
                <S2 size={20} color="#ffffff" />
              </TO>
              <TO
                style={[styles.actionCircle, { backgroundColor: '#6366f1' }]}
                onPress={() => setIsEditing(true)}
              >
                <E3 size={20} color="#ffffff" />
              </TO>
            </>
          ) : (
            <TO
              style={[styles.actionCircle, { backgroundColor: '#22c55e' }]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? <ActivityIndicator size="small" color="white" /> : <Ch size={20} color="#ffffff" />}
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
        {entry.action_items && entry.action_items.length > 0 && (
          <ActionList actions={entry.action_items} entryId={entry.id} />
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
            <Text style={styles.chatBtnText}>Analizar con IA Consultant</Text>
            {isSaving && <ActivityIndicator size="small" color="white" style={{ marginLeft: 10 }} />}
          </LG>
        </TO>

        {/* Audio URL indicator if exists */}
        {entry.audio_url && (
          <View style={styles.audioBadge}>
            <Text style={styles.audioText}>🔊 Audio session recorded</Text>
          </View>
        )}

        {/* Delete Action */}
        <TO style={styles.deleteButton} onPress={handleDelete}>
          <T2 size={18} color="#ef4444" style={{ marginRight: 8 }} />
          <Text style={styles.deleteText}>Delete memory</Text>
        </TO>
      </ScrollView>
    </SAV>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a'
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
    backgroundColor: 'rgba(255,255,255,0.05)',
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
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 36,
    marginBottom: 20
  },
  moodBadgeDetail: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  titleInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  contentInput: {
    backgroundColor: 'rgba(255,255,255,0.03)',
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
    color: '#cbd5e1',
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '400',
    marginBottom: 40
  },
  counterText: {
    color: '#d1fae5',
    fontSize: 13,
    lineHeight: 18
  },
  audioBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 30,
    marginTop: 10
  },
  audioText: {
    color: '#6366f1',
    fontSize: 12,
    fontWeight: '700'
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
  }
});

const LG = LinearGradient as any;

export default EntryDetailScreen;

