import React, { useEffect, useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Platform, StatusBar, Share, Alert, TextInput } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Share2, Edit3, Trash2, Calendar, Clock, Sparkles, Zap, Check, X, Laugh, SmilePlus, Meh, Angry, UserRoundCheck, Frown, Smile, CloudRain } from 'lucide-react-native';
import { SupabaseService, supabase } from '../services/SupabaseService';
import { aiService } from '../services/ai';
import { ActionList } from '../components/ActionList';
import { BiasWarningCard } from '../components/BiasWarningCard';
import { WellnessActionCard } from '../components/WellnessActionCard';

const EntryDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { entryId } = route.params as { entryId: string };

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
      case 'En Flow': return <Laugh size={size} color={color} />;
      case 'Inspirado': return <SmilePlus size={size} color={color} />;
      case 'Agotado': return <Frown size={size} color={color} />;
      case 'Disperso': return <Meh size={size} color={color} />;
      case 'Frustrado': return <Angry size={size} color={color} />;
      case 'Determinado': return <UserRoundCheck size={size} color={color} />;
      case 'Ansioso': return <CloudRain size={size} color={color} />;
      case 'Satisfecho': return <SmilePlus size={size} color={color} />;
      default: return <Smile size={size} color={color} />;
    }
  };

  const dateObject = new Date(entry.created_at);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => isEditing ? setIsEditing(false) : navigation.goBack()} style={styles.backButton}>
          {isEditing ? <X size={28} color="#ffffff" /> : <ChevronLeft size={28} color="#ffffff" />}
        </TouchableOpacity>

        <View style={styles.headerActions}>
          {!isEditing ? (
            <>
              <TouchableOpacity style={styles.actionCircle} onPress={handleShare}>
                <Share2 size={20} color="#ffffff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionCircle, { backgroundColor: '#6366f1' }]}
                onPress={() => setIsEditing(true)}
              >
                <Edit3 size={20} color="#ffffff" />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.actionCircle, { backgroundColor: '#22c55e' }]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? <ActivityIndicator size="small" color="white" /> : <Check size={20} color="#ffffff" />}
            </TouchableOpacity>
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
            <Calendar size={14} color="#6366f1" style={{ marginRight: 6 }} />
            <Text style={styles.metaText}>{dateObject.toLocaleDateString()}</Text>
          </View>
          <View style={styles.metaBadge}>
            <Clock size={14} color="#6366f1" style={{ marginRight: 6 }} />
            <Text style={styles.metaText}>{dateObject.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
          </View>
          <View style={styles.moodBadgeDetail}>
            {getMoodIcon(entry.mood_label, entry.sentiment_score)}
          </View>
        </View>

        {/* Title */}
        {isEditing ? (
          <TextInput
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
          <TextInput
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

        {/* Audio URL indicator if exists */}
        {entry.audio_url && (
          <View style={styles.audioBadge}>
            <Text style={styles.audioText}>🔊 Audio session recorded</Text>
          </View>
        )}

        {/* Delete Action */}
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Trash2 size={18} color="#ef4444" style={{ marginRight: 8 }} />
          <Text style={styles.deleteText}>Delete memory</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
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
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 15 : 10,
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
  }
});

export default EntryDetailScreen;

