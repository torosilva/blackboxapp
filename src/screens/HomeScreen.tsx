import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StatusBar,
  Alert,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence
} from 'react-native-reanimated';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import {
  Target,
  AlertTriangle,
  Filter,
  Settings,
  Search,
  Plus,
  ChevronRight,
  Zap,
  Stethoscope,
  Sparkles,
  Mic,
  X,
  Brain,
  Diamond,
  Smile,
  Frown,
  CloudRain,
  Lightbulb,
  Wind,
  Activity,
  Flame,
  User,
  Laugh,
  SmilePlus,
  Meh,
  Angry,
  UserRoundCheck,
  BatteryLow,
  Cloud,
  Layers,
  ZapOff,
  Bot,
  LayoutDashboard
} from 'lucide-react-native';
import { aiService } from '../services/ai';
import { useAuth } from '../context/AuthContext';
import { SupabaseService } from '../services/SupabaseService';
import AILoadingOverlay from '../components/AILoadingOverlay';
import { NotificationService } from '../services/notificationService';

const HomeScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'loops', 'biases', 'positive', 'negative'
  const [summary, setSummary] = useState<any>({ summary: 'Generating your daily insight...', recommendation: null });
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true); // Default to minimized (Zen)
  const [lastEntriesFingerprint, setLastEntriesFingerprint] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showSearch, setShowSearch] = useState(false); // NEW: Independent search visibility
  const searchInputRef = useRef<TextInput>(null);
  const isFocused = useIsFocused();

  // Auto-refresh when screen comes into focus
  useEffect(() => {
    if (isFocused && user) {
      fetchData();
    }
  }, [isFocused, user]);

  // PULSING BRAIN ANIMATION
  const brainPulse = useSharedValue(1);
  useEffect(() => {
    brainPulse.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      true
    );
  }, []);

  // NOTIFICATION INITIALIZATION
  useEffect(() => {
    const initNotifications = async () => {
      const hasPermission = await NotificationService.registerForPushNotificationsAsync();
      if (hasPermission) {
        // We'll schedule it every time for now, the service handles avoiding duplicates
        await NotificationService.scheduleDailyReminder();
      }
    };
    initNotifications();
  }, []);

  const animatedBrainStyle = useAnimatedStyle(() => ({
    transform: [{ scale: brainPulse.value }],
    opacity: withTiming(isMinimized ? 0.6 : 1)
  }));

  // Helper for mood visual representation
  const getMoodIcon = (label: string, score: number = 0) => {
    const size = 24;
    const color = getMoodColor(score).replace('0.2', '1'); // More solid color for icons

    const F = Flame as any;
    const L = Lightbulb as any;
    const B = BatteryLow as any;
    const La = Layers as any;
    const Zp = ZapOff as any;
    const A = Activity as any;
    const W = Wind as any;
    const SP = SmilePlus as any;
    const Sm = Smile as any;

    switch (label) {
      case 'En Flow': return <F size={size} color="#22c55e" />;
      case 'Inspirado': return <L size={size} color="#eab308" />;
      case 'Agotado': return <B size={size} color="#ef4444" />;
      case 'Disperso': return <La size={size} color="#94a3b8" />;
      case 'Frustrado': return <Zp size={size} color="#f97316" />;
      case 'Determinado': return <A size={size} color="#818cf8" />;
      case 'Ansioso': return <W size={size} color="#3b82f6" />;
      case 'Satisfecho': return <SP size={size} color="#10b981" />;
      default: return <Sm size={size} color={color} />;
    }
  };

  const getMoodColor = (score?: number) => {
    if (score === undefined) return 'rgba(255,255,255,0.05)';
    if (score > 0.3) return 'rgba(34, 197, 94, 0.2)'; // Green
    if (score < -0.3) return 'rgba(239, 68, 68, 0.2)'; // Red
    return 'rgba(59, 130, 246, 0.2)'; // Blue
  };

  const fetchData = async () => {
    if (!user) return;
    console.log('HOME_DEBUG: Current User ID is:', user.id);
    setRefreshing(true);
    try {
      const data = await SupabaseService.getEntries(user.id);
      setEntries(data || []);

      const fingerprint = data && data.length > 0 ? `${data.length}_${data[0].id}` : 'empty';
      if (data && data.length > 0) {
        if (fingerprint !== lastEntriesFingerprint) {
          console.log('HOME_DEBUG: Change detected. Fingerprint:', fingerprint);
          generateSummary(data.map((e: any) => ({ title: e.title, content: e.content })), fingerprint);
          setLastEntriesFingerprint(fingerprint);
        } else {
          console.log('HOME_DEBUG: No changes detected. Summary is fresh.');
        }
      } else {
        setSummary({ summary: 'Start writing to see your daily AI summary!', recommendation: null });
        setLastEntriesFingerprint('');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const generateSummary = async (contentArray: (string | { title: string, content: string })[], fingerprint: string) => {
    if (!user) return;
    setSummaryLoading(true);
    try {
      // 1. Check persistent cache first
      const cached = await SupabaseService.getCachedInsight(user.id, 'daily', fingerprint);

      // VALIDATION: Only use cache if it doesn't look like the placeholder/fallback
      const isFallback = cached?.summary && cached.summary.includes("Analizando rendimiento");

      if (cached && !isFallback) {
        console.log('HOME_DEBUG: Using valid persistent cache for daily insight.');
        setSummary(cached);
        return;
      }

      // 2. Generate with Gemini
      console.log('HOME_DEBUG: Cache miss or placeholder found. Calling Gemini API...');
      const res = await aiService.generateDailySummary(contentArray);
      setSummary(res);

      // 3. Save to cache ONLY IF it's a real result (not the fallback)
      const isNewFallback = res.summary.includes("Analizando rendimiento");
      if (!isNewFallback) {
        await SupabaseService.saveCachedInsight(user.id, 'daily', fingerprint, res);
      }

    } catch (error) {
      setSummary({ summary: 'Could not generate summary at this time.', recommendation: null });
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleRecommendationAction = async () => {
    if (!summary?.wellness_recommendation || !user) return;

    const rec = summary.wellness_recommendation;

    Alert.alert(
      "🎯 Ejecutar",
      `${rec.title}\n\n${rec.description}`,
      [
        { text: "Entendido", style: "cancel" },
        {
          text: "Agregar a Timeline",
          onPress: async () => {
            try {
              setLoading(true);
              await SupabaseService.createEntry({
                user_id: user.id,
                title: `ACCION: ${rec.title}`,
                content: `Iniciando acción sugerida por BLACKBOX: ${rec.description}`,
                sentiment_score: 0.5,
                mood_label: "Determinado",
                summary: "Acción estratégica iniciada desde el Daily Insight.",
                wellness_recommendation: rec,
                strategic_insight: summary && typeof summary === 'object' ? summary.strategic_insight : null,
                action_items: summary && typeof summary === 'object' ? summary.action_items : [],
                audio_url: null,
                original_text: `Iniciando: ${rec.description}`
              });
              fetchData();
              Alert.alert("Éxito", "La idea ha sido integrada en tu Timeline.");
            } catch (error) {
              Alert.alert("Error", "No se pudo agregar a tu timeline.");
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleDeleteEntry = async (entryId: string) => {
    Alert.alert(
      "Eliminar Entrada",
      "¿Estás seguro de que deseas eliminar este registro? Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await SupabaseService.deleteEntry(entryId);
              fetchData();
              Alert.alert("Eliminado", "El registro ha sido eliminado.");
            } catch (error) {
              Alert.alert("Error", "No se pudo eliminar el registro.");
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    const syncAndFetch = async () => {
      if (user) {
        await SupabaseService.upsertProfile(user.id, user.email || 'user@blackboxmind.ai');
        fetchData();
      } else {
        setLoading(false);
      }
    };
    syncAndFetch();
  }, [user]);

  const getFilteredCounts = () => {
    const searchLower = searchQuery.toLowerCase();
    const baseMatch = (e: any) => (e.title || '').toLowerCase().includes(searchLower) ||
      (e.content || '').toLowerCase().includes(searchLower) ||
      (e.mood_label || '').toLowerCase().includes(searchLower) ||
      (Array.isArray(e.action_items) && e.action_items.some((ai: any) => (ai.task || ai.description || '').toLowerCase().includes(searchLower)));

    const entriesMatchingSearch = entries.filter(baseMatch);

    return {
      all: entriesMatchingSearch.length,
      loops: entriesMatchingSearch.filter(e => e.action_items && e.action_items.length > 0).length,
      biases: entriesMatchingSearch.filter(e => e.strategic_insight?.detected_bias).length,
      positive: entriesMatchingSearch.filter(e => e.sentiment_score > 0.3).length,
      negative: entriesMatchingSearch.filter(e => e.sentiment_score < -0.3).length,
      BUSINESS: entriesMatchingSearch.filter(e => e.category === 'BUSINESS').length,
      PERSONAL: entriesMatchingSearch.filter(e => e.category === 'PERSONAL').length,
      DEVELOPMENT: entriesMatchingSearch.filter(e => e.category === 'DEVELOPMENT').length,
      WELLNESS: entriesMatchingSearch.filter(e => e.category === 'WELLNESS').length,
    };
  };

  const filterCounts = getFilteredCounts();

  const filteredEntries = entries.filter(e => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = (e.title || '').toLowerCase().includes(searchLower) ||
      (e.content || '').toLowerCase().includes(searchLower) ||
      (e.mood_label || '').toLowerCase().includes(searchLower) ||
      (e.category || '').toLowerCase().includes(searchLower) ||
      (Array.isArray(e.action_items) && e.action_items.some((ai: any) => (ai.task || ai.description || '').toLowerCase().includes(searchLower)));

    if (!matchesSearch) return false;

    switch (activeFilter) {
      case 'loops': return e.action_items && e.action_items.length > 0;
      case 'biases': return e.strategic_insight?.detected_bias;
      case 'positive': return e.sentiment_score > 0.3;
      case 'negative': return e.sentiment_score < -0.3;
      case 'BUSINESS': return e.category === 'BUSINESS';
      case 'PERSONAL': return e.category === 'PERSONAL';
      case 'DEVELOPMENT': return e.category === 'DEVELOPMENT';
      case 'WELLNESS': return e.category === 'WELLNESS';
      default: return true;
    }
  });

  const TO = TouchableOpacity as any;
  const B = Brain as any;
  const D = Diamond as any;
  const S = Settings as any;
  const SR = Search as any;
  const F = Filter as any;
  const T = Target as any;
  const AT = AlertTriangle as any;
  const L = Laugh as any;
  const FR = Frown as any;
  const SP = Sparkles as any;
  const Xi = X as any;
  const Z = Zap as any;
  const P = Plus as any;
  const Bo = Bot as any;
  const SAV = SafeAreaView as any;
  const Overlay = AILoadingOverlay as any;

  return (
    <SAV style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Premium AI Loading Overlay */}
      <Overlay
        visible={summaryLoading}
        message="Consultando a tu Coach de Rendimiento..."
      />

      <View style={styles.header}>
        <TO
          style={styles.iconButton}
          onPress={() => setIsMinimized(!isMinimized)}
        >
          <Animated.View style={[styles.brainIconContainer, animatedBrainStyle]}>
            <B size={24} color={!isMinimized ? "#6366f1" : "#94a3b8"} />
            <View style={styles.gemOverlay}>
              <D size={10} color="#00f2ff" fill="#38bdf8" />
            </View>
          </Animated.View>
          {isMinimized && <View style={styles.notificationDot} />}
        </TO>
        <TO
          style={styles.logoCenterContainer}
          onPress={() => setShowSearch(!showSearch)}
          activeOpacity={0.7}
        >
          <Image
            source={require('../../assets/logo.png')}
            style={[styles.headerLogo, showSearch && { opacity: 0.8 }]}
            resizeMode="contain"
          />
          {showSearch && <View style={styles.searchIndicator} />}
        </TO>
        <TO
          style={styles.iconButton}
          onPress={() => navigation.navigate('Dashboard')}
        >
          <LayoutDashboard size={22} color="#94a3b8" />
        </TO>
      </View>

      {/* Tactical Control Overlay (Search & Filters) - Now tied to CENTRAL LOGO */}
      {showSearch && (
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <TO
              onPress={() => searchInputRef.current?.focus()}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              style={{ padding: 4 }}
            >
              <SR size={20} color="#94a3b8" />
            </TO>

            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Explorar memorias..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={(text: any) => {
                setSearchQuery(text);
              }}
            />

            <TO
              style={[styles.miniFilterBtn, (activeFilter !== 'all' || showFilters) && styles.miniFilterBtnActive]}
              onPress={() => setShowFilters(!showFilters)}
            >
              <F size={20} color={activeFilter !== 'all' || showFilters ? 'white' : '#94a3b8'} />
            </TO>
          </View>

          {showFilters && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
              contentContainerStyle={styles.filterContent}
            >
              {[
                { id: 'all', label: 'Todo' },
                { id: 'BUSINESS', label: 'Estrategia', icon: <Z size={14} color="currentColor" /> },
                { id: 'PERSONAL', label: 'Personales', icon: <User size={14} color="currentColor" /> },
                { id: 'DEVELOPMENT', label: 'Desarrollo Personal', icon: <SP size={14} color="currentColor" /> },
                { id: 'WELLNESS', label: 'Bienestar', icon: <Stethoscope size={14} color="currentColor" /> },
                { id: 'loops', label: 'Loops Activos', icon: <T size={14} color="currentColor" /> },
                { id: 'biases', label: 'Sesgos', icon: <AT size={14} color="currentColor" /> },
                { id: 'positive', label: 'Positivo', icon: <L size={14} color="currentColor" /> },
                { id: 'negative', label: 'Negativo', icon: <FR size={14} color="currentColor" /> },
              ].map(filter => (
                <TO
                  key={filter.id}
                  onPress={() => {
                    setActiveFilter(filter.id);
                  }}
                  style={[
                    styles.filterChip,
                    activeFilter === filter.id && styles.filterChipActive
                  ]}
                >
                  {filter.icon && <View style={{ marginRight: 6 }}>{filter.icon}</View>}
                  <Text style={[
                    styles.filterChipText,
                    activeFilter === filter.id && styles.filterChipTextActive
                  ]}>
                    {filter.label} ({filterCounts[filter.id as keyof typeof filterCounts]})
                  </Text>
                </TO>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchData} tintColor="#6366f1" />}
      >
        {/* AI Summary & Wellness Card */}
        {!isMinimized && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={styles.sparkleIcon}>
                  <Sparkles size={16} color="white" />
                </View>
                <Text style={styles.summaryTitle}>Insight Diario - BLACKBOX</Text>
              </View>
              <TouchableOpacity onPress={() => setIsMinimized(true)} style={styles.minimizeBtn}>
                <X size={16} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            {!!summaryLoading ? (
              <ActivityIndicator size="small" color="#a855f7" style={{ marginVertical: 10 }} />
            ) : (
              <>
                <Text style={styles.summaryContent}>
                  {typeof summary === 'string' ? summary : (summary?.summary || 'No summary available')}
                </Text>
                {/* ACTIVE LOOPS (NEXT STEPS) PREVIEW */}
                {!!(summary && typeof summary === 'object' && summary.action_items && summary.action_items.length > 0) && (
                  <TouchableOpacity
                    style={styles.miniLoopsList}
                    onPress={() => navigation.navigate('Settings', { initialViewMode: 'pending' })}
                    activeOpacity={0.7}
                  >
                    {summary.action_items.slice(0, 2).map((item: any, idx: number) => (
                      <View key={idx} style={styles.miniLoopItem}>
                        <Zap size={12} color="#818cf8" />
                        <Text style={styles.miniLoopText} numberOfLines={1}>{item.description}</Text>
                      </View>
                    ))}
                    {summary.action_items.length > 2 && (
                      <Text style={styles.moreLoopsText}>+ {summary.action_items.length - 2} tareas más...</Text>
                    )}
                  </TouchableOpacity>
                )}

                {!!(summary && typeof summary === 'object' && summary.wellness_recommendation) && (
                  <View style={styles.recommendationBox}>
                    <View style={styles.recommendationHeader}>
                      <Text style={styles.recommendationType}>
                        {summary.wellness_recommendation.type || 'ACTION'}
                      </Text>
                      <Text style={styles.recommendationTitle}>{summary.wellness_recommendation.title}</Text>
                    </View>
                    <Text style={styles.recommendationDesc}>{summary.wellness_recommendation.description}</Text>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={handleRecommendationAction}
                    >
                      <Text style={styles.actionButtonText}>Ejecutar</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        )}
        {/* Weekly Analysis Button removed (already in Strategic Hub) */}

        <Text style={styles.sectionTitle}>Línea de Tiempo</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
        ) : filteredEntries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay registros aún.</Text>
          </View>
        ) : (
          filteredEntries.map((entry) => (
            <TouchableOpacity
              key={entry.id}
              onPress={() => navigation.navigate('EntryDetail', { entryId: entry.id })}
              onLongPress={() => handleDeleteEntry(entry.id)}
              delayLongPress={500}
              style={[styles.card, { borderColor: getMoodColor(entry.sentiment_score) }]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  {entry.action_items && entry.action_items.length > 0 && (
                    <Target size={14} color="#818cf8" style={{ marginRight: 6 }} />
                  )}
                  {entry.strategic_insight?.detected_bias && (
                    <AlertTriangle size={14} color="#f59e0b" style={{ marginRight: 6 }} />
                  )}
                  <View>
                    <Text style={styles.entryDate}>{new Date(entry.created_at).toLocaleDateString()}</Text>
                    {!!entry.mood_label && <Text style={styles.moodBadge}>{entry.mood_label}</Text>}
                  </View>
                </View>
                <View style={styles.moodIconContainer}>
                  {getMoodIcon(entry.mood_label, entry.sentiment_score)}
                </View>
              </View>
              <Text style={styles.entryTitle}>{entry.title}</Text>
              <Text style={styles.entryPreview} numberOfLines={3}>{entry.content}</Text>
              {/* Individual AI Insight Section */}
              {!!(entry.summary || entry.wellness_recommendation) && (
                <View style={styles.cardAnalysis}>
                  <View style={styles.analysisDivider} />
                  <View style={styles.analysisHeader}>
                    <Sparkles size={14} color="#a855f7" />
                    <Text style={styles.analysisLabel}>REPORTE BLACKBOX</Text>
                  </View>
                  {!!entry.summary && (
                    <Text style={styles.analysisSummary} numberOfLines={3}>
                      {entry.summary}
                    </Text>
                  )}
                  {!!entry.wellness_recommendation && (
                    <View style={styles.miniRecommendation}>
                      <Zap size={12} color="#f59e0b" />
                      <Text style={styles.miniRecommendationText} numberOfLines={1}>
                        {typeof entry.wellness_recommendation === 'string'
                          ? entry.wellness_recommendation
                          : (entry.wellness_recommendation.title || 'Recomendación lista')}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Floating Action Buttons */}
      <View style={styles.fabContainer}>
        <TO
          onPress={() => navigation.navigate('NewEntry', {})}
          style={styles.fabMain}
        >
          <P size={24} color="white" style={{ marginRight: 8 }} />
          <Text style={styles.fabText}>Nueva Entrada</Text>
        </TO>

        <TO
          onPress={() => navigation.navigate('ChatHub')}
          style={styles.fabSecondary}
        >
          <Bo size={24} color="white" />
        </TO>
      </View>
    </SAV>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 10 : 15,
    paddingBottom: 15
  },
  dateText: { color: '#6366f1', fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  logoCenterContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  headerLogo: { width: 280, height: 100 },
  searchIndicator: {
    position: 'absolute',
    bottom: 25,
    width: 40,
    height: 3,
    backgroundColor: '#6366f1',
    borderRadius: 2
  },
  iconButton: { backgroundColor: 'rgba(255,255,255,0.03)', width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', position: 'relative' },
  notificationDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, backgroundColor: '#6366f1', borderRadius: 4, borderWidth: 1, borderColor: '#0f172a' },
  brainIconContainer: { position: 'relative', width: 24, height: 24, justifyContent: 'center', alignItems: 'center' },
  gemOverlay: { position: 'absolute', top: -2, right: -2, shadowColor: '#00f2ff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 4 },
  moodIconContainer: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12 },
  searchContainer: { paddingHorizontal: 24, marginBottom: 10 },
  filterScroll: { marginTop: 16 },
  filterContent: { gap: 10, paddingRight: 24 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  filterChipActive: {
    backgroundColor: 'rgba(129, 140, 248, 0.2)',
    borderColor: '#818cf8',
  },
  filterChipText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  filterChipTextActive: { color: 'white' },
  filterBtnActive: { backgroundColor: '#818cf8' },
  searchBar: {
    backgroundColor: '#1e293b', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, height: 56, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)'
  },
  searchInput: { color: '#ffffff', flex: 1, marginLeft: 12, fontSize: 16 },
  searchBarRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  miniFilterBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  miniFilterBtnActive: {
    backgroundColor: '#6366f1',
  },
  filterBtn: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: '#1e293b',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)'
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  scroll: { flex: 1, paddingHorizontal: 24 },
  summaryCard: {
    backgroundColor: 'rgba(168, 85, 247, 0.1)', borderRadius: 24, padding: 24,
    marginBottom: 30, borderWidth: 1, borderColor: 'rgba(168, 85, 247, 0.3)'
  },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sparkleIcon: { backgroundColor: '#a855f7', padding: 6, borderRadius: 8, marginRight: 10 },
  summaryTitle: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  minimizeBtn: { padding: 4 },
  summaryContent: { color: '#e9d5ff', fontSize: 15, lineHeight: 22, fontStyle: 'italic' },
  sectionTitle: { color: '#ffffff', fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
  card: {
    backgroundColor: '#1e293b', borderRadius: 24, padding: 24, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)'
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  entryDate: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  entryTitle: { color: '#ffffff', fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  entryPreview: { color: '#94a3b8', fontSize: 15, lineHeight: 22 },
  moodBadge: {
    color: '#6366f1', fontSize: 10, fontWeight: 'bold',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 6, marginTop: 4, textTransform: 'uppercase'
  },
  cardAnalysis: {
    marginTop: 24,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  analysisDivider: {
    display: 'none', // Removed in favor of box background
  },
  analysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6
  },
  analysisLabel: {
    color: '#a855f7',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase'
  },
  analysisSummary: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
    marginBottom: 8
  },
  miniRecommendation: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)'
  },
  miniRecommendationText: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '700'
  },
  recommendationBox: {
    marginTop: 20, padding: 16, backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16, borderLeftWidth: 3, borderLeftColor: '#a855f7'
  },
  recommendationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  recommendationType: {
    backgroundColor: '#a855f7', color: 'white', fontSize: 9,
    fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4
  },
  recommendationTitle: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
  recommendationDesc: { color: '#94a3b8', fontSize: 13, lineHeight: 18, marginBottom: 12 },
  actionButton: {
    backgroundColor: '#ffffff', paddingVertical: 8, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center'
  },
  actionButtonText: { color: '#0f172a', fontSize: 13, fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#475569', fontSize: 16 },
  weeklyCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.2)',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4
  },
  weeklyIconContainer: {
    width: 48,
    height: 48,
    backgroundColor: '#1e1b4b',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: '#3730a3'
  },
  weeklyTitle: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  weeklySubtitle: { color: '#64748b', fontSize: 12, marginTop: 2 },
  fabContainer: { position: 'absolute', bottom: 30, left: 24, right: 24, flexDirection: 'row', gap: 12 },
  fabMain: {
    flex: 1, backgroundColor: '#6366f1', height: 64, borderRadius: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center'
  },
  fabSecondary: {
    backgroundColor: '#ec4899', width: 64, height: 64, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center'
  },
  fabText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  miniLoopsList: {
    marginTop: 15,
    marginBottom: 5,
    gap: 8,
    backgroundColor: 'rgba(129, 140, 248, 0.05)',
    padding: 12,
    borderRadius: 16
  },
  miniLoopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  miniLoopText: {
    color: '#e0e7ff',
    fontSize: 13,
    fontWeight: '500',
    flex: 1
  },
  moreLoopsText: {
    color: '#818cf8',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 22,
    marginTop: 2
  }
});

export default HomeScreen;

