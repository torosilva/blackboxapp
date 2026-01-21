import React, { useState, useEffect } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
    ChevronLeft, ShieldCheck, Clock, Database, AlertCircle, Brain,
    Zap, Stethoscope, Calendar, Target, AlertTriangle, ArrowRight,
    LogOut, Trash2, MessageSquareText, Send, X, ChevronDown, ChevronUp, User
} from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import {
    View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
    ScrollView, StatusBar, Platform, Modal, TextInput,
    ActivityIndicator, Alert, LayoutAnimation, UIManager
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SupabaseService } from '../services/SupabaseService';
import { useAuth } from '../context/AuthContext';
import { ActionItem } from '../types';
import { FeedbackService } from '../services/FeedbackService';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SettingsScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { user, signOut } = useAuth();
    const [entries, setEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [appointmentDate, setAppointmentDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [viewMode, setViewMode] = useState<'hub' | 'pending' | 'completed' | 'biases'>('hub');
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [feedbackContent, setFeedbackContent] = useState('');
    const [feedbackType, setFeedbackType] = useState<'bug' | 'improvement' | 'other'>('improvement');
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        pending: true,
        completed: false,
        biases: false,
        analysis: true,
        feedback: false,
        guide: false,
        privacy: false,
        account: false,
        profile: false,
    });
    const [fullName, setFullName] = useState('');
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    useEffect(() => {
        if (route.params?.initialViewMode) {
            setViewMode(route.params.initialViewMode);
            // If it's pending, ensure that section is expanded
            if (route.params.initialViewMode === 'pending') {
                setExpandedSections(prev => ({ ...prev, pending: true }));
            }
        }
    }, [route.params?.initialViewMode]);

    const toggleSection = (section: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    useEffect(() => {
        const fetchAll = async () => {
            if (!user) return;
            try {
                const data = await SupabaseService.getEntries(user.id);
                setEntries(data || []);
            } catch (error) {
                console.error('HUB: Error fetching entries', error);
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, [user]);

    // Aggregate Pending Tasks
    const pendingTasks = entries.reduce((acc: any[], entry) => {
        if (entry.action_items) {
            const pending = entry.action_items
                .filter((item: ActionItem) => !item.is_completed)
                .map((item: ActionItem) => ({ ...item, entryId: entry.id, entryTitle: entry.title }));
            return [...acc, ...pending];
        }
        return acc;
    }, []);

    // Aggregate Completed Tasks
    const completedTasks = entries.reduce((acc: any[], entry) => {
        if (entry.action_items) {
            const completed = entry.action_items
                .filter((item: ActionItem) => item.is_completed)
                .map((item: ActionItem) => ({ ...item, entryId: entry.id, entryTitle: entry.title }));
            return [...acc, ...completed];
        }
        return acc;
    }, []);

    // Aggregate Bias History
    const biasHistory = entries.reduce((acc: any[], entry) => {
        if (entry.strategic_insight?.detected_bias) {
            acc.push({
                bias: entry.strategic_insight.detected_bias,
                message: entry.strategic_insight.warning_message,
                entryId: entry.id,
                entryTitle: entry.title,
                date: entry.created_at
            });
        }
        return acc;
    }, []);

    const onDateChange = (event: any, selectedDate?: Date) => {
        setShowDatePicker(false);
        if (selectedDate) {
            setAppointmentDate(selectedDate);
        }
    };

    const handleSendFeedback = async () => {
        if (!feedbackContent.trim()) {
            Alert.alert('Error', 'Por favor escribe tu comentario antes de enviar.');
            return;
        }

        setIsSubmittingFeedback(true);
        try {
            const { error } = await FeedbackService.submitFeedback(user!.id, feedbackContent, feedbackType);
            if (error) throw error;

            Alert.alert('¡Gracias!', 'Tu feedback ha sido recibido. ¡Gracias por ayudarnos a mejorar BLACKBOX!');
            setFeedbackContent('');
            setShowFeedbackModal(false);
        } catch (error) {
            console.error('FEEDBACK: Error submitting', error);
            Alert.alert('Error', 'No pudimos enviar tu feedback. Intenta de nuevo más tarde.');
        } finally {
            setIsSubmittingFeedback(false);
        }
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            "⚠️ Eliminar Cuenta",
            "Esta acción eliminará permanentemente todos tus registros y datos de BLACKBOX. No se puede deshacer.\n\n¿Estás absolutamente seguro?",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Eliminar Todo",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setLoading(true);
                            await SupabaseService.deleteAccount(user!.id);
                            await signOut();
                            Alert.alert("Cuenta Eliminada", "Tus datos han sido borrados. Esperamos verte pronto.");
                        } catch (error) {
                            Alert.alert("Error", "No se pudo completar la eliminación. Contacta a soporte.");
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleUpdateProfile = async () => {
        if (!fullName.trim()) return;
        setIsSavingProfile(true);
        try {
            await SupabaseService.upsertProfile(user!.id, user!.email!, fullName);
            Alert.alert("Perfil Actualizado", "Tu nombre ha sido guardado.");
        } catch (error) {
            Alert.alert("Error", "No se pudo actualizar el perfil.");
        } finally {
            setIsSavingProfile(false);
        }
    };

    useEffect(() => {
        if (user?.email) {
            setFullName(user.email.split('@')[0]);
        }
    }, [user]);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => viewMode === 'hub' ? navigation.goBack() : setViewMode('hub')}
                    style={styles.backButton}
                >
                    <ChevronLeft size={28} color="#ffffff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {viewMode === 'hub' ? 'Centro Estratégico' :
                        viewMode === 'pending' ? 'Pendientes de Ejecución' :
                            viewMode === 'completed' ? 'Acciones Realizadas' : 'Historial de Sesgos'}
                </Text>
                <View style={{ width: 28 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {viewMode === 'hub' ? (
                    <>
                        {/* 0. PROFILE SECTION */}
                        <View style={styles.section}>
                            <TouchableOpacity
                                style={styles.sectionHeader}
                                onPress={() => toggleSection('profile')}
                                activeOpacity={0.7}
                            >
                                <User size={20} color="#6366f1" />
                                <Text style={styles.sectionTitle}>Mi Perfil</Text>
                                {expandedSections.profile ? (
                                    <ChevronUp size={20} color="#94a3b8" style={{ marginLeft: 'auto' }} />
                                ) : (
                                    <ChevronDown size={20} color="#94a3b8" style={{ marginLeft: 'auto' }} />
                                )}
                            </TouchableOpacity>

                            {expandedSections.profile && (
                                <View style={styles.clinicalCard}>
                                    <Text style={styles.clinicalDesc}>¿Cómo quieres que BLACKBOX te llame?</Text>
                                    <View style={[styles.dateSelector, { paddingHorizontal: 0, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' }]}>
                                        <TextInput
                                            style={{ color: 'white', flex: 1, fontSize: 16, paddingVertical: 10, paddingHorizontal: 15 }}
                                            value={fullName}
                                            onChangeText={setFullName}
                                            placeholder="Tu nombre"
                                            placeholderTextColor="#64748b"
                                        />
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.generateButton, { marginTop: 15 }]}
                                        onPress={handleUpdateProfile}
                                        disabled={isSavingProfile}
                                    >
                                        {isSavingProfile ? <ActivityIndicator color="white" /> : <Text style={styles.generateButtonText}>Guardar Cambios</Text>}
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>

                        {/* 1. ACTIVE LOOPS (PENDIENTES) */}
                        <View style={styles.section}>
                            <TouchableOpacity
                                style={styles.sectionHeader}
                                onPress={() => toggleSection('pending')}
                                activeOpacity={0.7}
                            >
                                <Target size={20} color="#818cf8" />
                                <Text style={styles.sectionTitle}>Active Loops Pendientes</Text>
                                {expandedSections.pending ? (
                                    <ChevronUp size={20} color="#94a3b8" style={{ marginLeft: 'auto' }} />
                                ) : (
                                    <ChevronDown size={20} color="#94a3b8" style={{ marginLeft: 'auto' }} />
                                )}
                            </TouchableOpacity>

                            {expandedSections.pending && (
                                <TouchableOpacity style={styles.hubCard} onPress={() => setViewMode('pending')}>
                                    {pendingTasks.length === 0 ? (
                                        <Text style={styles.emptyHubText}>Sin tareas pendientes. ¡Excelente ejecución!</Text>
                                    ) : (
                                        pendingTasks.slice(0, 3).map((task, idx) => (
                                            <View key={idx} style={styles.hubTaskItem}>
                                                <View style={styles.hubTaskDot} />
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.hubTaskDesc} numberOfLines={1}>{task.description}</Text>
                                                    <Text style={styles.hubTaskSource}>De: {task.entryTitle}</Text>
                                                </View>
                                            </View>
                                        ))
                                    )}
                                    {pendingTasks.length > 3 && (
                                        <Text style={styles.moreHubText}>Ver {pendingTasks.length} tareas más...</Text>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* 1.5. ACTIVE LOOPS (REALIZADOS) */}
                        {completedTasks.length > 0 && (
                            <View style={styles.section}>
                                <TouchableOpacity
                                    style={styles.sectionHeader}
                                    onPress={() => toggleSection('completed')}
                                    activeOpacity={0.7}
                                >
                                    <ShieldCheck size={20} color="#10b981" />
                                    <Text style={styles.sectionTitle}>Active Loops Realizados</Text>
                                    {expandedSections.completed ? (
                                        <ChevronUp size={20} color="#94a3b8" style={{ marginLeft: 'auto' }} />
                                    ) : (
                                        <ChevronDown size={20} color="#94a3b8" style={{ marginLeft: 'auto' }} />
                                    )}
                                </TouchableOpacity>

                                {expandedSections.completed && (
                                    <TouchableOpacity
                                        style={[styles.hubCard, { backgroundColor: 'rgba(16, 185, 129, 0.05)' }]}
                                        onPress={() => setViewMode('completed')}
                                    >
                                        {completedTasks.slice(0, 3).map((task, idx) => (
                                            <View key={idx} style={styles.hubTaskItem}>
                                                <ShieldCheck size={16} color="#10b981" style={{ marginRight: 12 }} />
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[styles.hubTaskDesc, { textDecorationLine: 'line-through', color: '#64748b' }]} numberOfLines={1}>
                                                        {task.description}
                                                    </Text>
                                                </View>
                                            </View>
                                        ))}
                                        {completedTasks.length > 3 && (
                                            <Text style={styles.moreHubText}>Ver {completedTasks.length} tareas completadas...</Text>
                                        )}
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        {/* 2. BIAS HISTORY */}
                        <View style={styles.section}>
                            <TouchableOpacity
                                style={styles.sectionHeader}
                                onPress={() => toggleSection('biases')}
                                activeOpacity={0.7}
                            >
                                <AlertTriangle size={20} color="#f59e0b" />
                                <Text style={styles.sectionTitle}>Historial de Sesgos</Text>
                                {expandedSections.biases ? (
                                    <ChevronUp size={20} color="#94a3b8" style={{ marginLeft: 'auto' }} />
                                ) : (
                                    <ChevronDown size={20} color="#94a3b8" style={{ marginLeft: 'auto' }} />
                                )}
                            </TouchableOpacity>

                            {expandedSections.biases && (
                                <TouchableOpacity style={styles.hubCard} onPress={() => setViewMode('biases')}>
                                    {biasHistory.length === 0 ? (
                                        <Text style={styles.emptyHubText}>No se han detectado sesgos recurrentes.</Text>
                                    ) : (
                                        biasHistory.slice(0, 2).map((item, idx) => (
                                            <View key={idx} style={styles.hubBiasItem}>
                                                <View style={styles.biasTag}>
                                                    <Text style={styles.biasTagText}>{item.bias}</Text>
                                                </View>
                                                <Text style={styles.hubBiasTitle} numberOfLines={1}>{item.entryTitle}</Text>
                                            </View>
                                        ))
                                    )}
                                    {biasHistory.length > 2 && (
                                        <Text style={styles.moreHubText}>Ver historial completo...</Text>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* 3. STRATEGIC ANALYSIS */}
                        <View style={styles.section}>
                            <TouchableOpacity
                                style={styles.sectionHeader}
                                onPress={() => toggleSection('analysis')}
                                activeOpacity={0.7}
                            >
                                <Stethoscope size={20} color="#a855f7" />
                                <Text style={styles.sectionTitle}>Análisis Estratégico</Text>
                                {expandedSections.analysis ? (
                                    <ChevronUp size={20} color="#94a3b8" style={{ marginLeft: 'auto' }} />
                                ) : (
                                    <ChevronDown size={20} color="#94a3b8" style={{ marginLeft: 'auto' }} />
                                )}
                            </TouchableOpacity>

                            {expandedSections.analysis && (
                                <View style={styles.clinicalCard}>
                                    <Text style={styles.clinicalDesc}>
                                        Genera un reporte estratégico de los 7 días previos a tu sesión de rendimiento.
                                    </Text>
                                    <TouchableOpacity style={styles.dateSelector} onPress={() => setShowDatePicker(true)}>
                                        <Calendar size={18} color="#94a3b8" />
                                        <Text style={styles.dateText}>Fin del reporte: {appointmentDate.toLocaleDateString()}</Text>
                                    </TouchableOpacity>
                                    {!!showDatePicker && (
                                        <DateTimePicker
                                            value={appointmentDate}
                                            mode="date"
                                            display="default"
                                            onChange={onDateChange}
                                            maximumDate={new Date()}
                                        />
                                    )}
                                    <TouchableOpacity
                                        style={styles.generateButton}
                                        onPress={() => navigation.navigate('WeeklyReport', { reportEndDate: appointmentDate.toISOString() })}
                                    >
                                        <Text style={styles.generateButtonText}>Generar Reporte Estratégico</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>

                        {/* 4. FEEDBACK (FRIENDS & FAMILY) */}
                        <View style={styles.section}>
                            <TouchableOpacity
                                style={styles.sectionHeader}
                                onPress={() => toggleSection('feedback')}
                                activeOpacity={0.7}
                            >
                                <MessageSquareText size={20} color="#38bdf8" />
                                <Text style={styles.sectionTitle}>Feedback Friends & Family</Text>
                                {expandedSections.feedback ? (
                                    <ChevronUp size={20} color="#94a3b8" style={{ marginLeft: 'auto' }} />
                                ) : (
                                    <ChevronDown size={20} color="#94a3b8" style={{ marginLeft: 'auto' }} />
                                )}
                            </TouchableOpacity>

                            {expandedSections.feedback && (
                                <TouchableOpacity
                                    style={[styles.tutorialButton, { borderColor: 'rgba(56, 189, 248, 0.2)' }]}
                                    onPress={() => setShowFeedbackModal(true)}
                                >
                                    <View style={[styles.iconCircle, { backgroundColor: 'rgba(56, 189, 248, 0.1)', width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }]}>
                                        <MessageSquareText size={18} color="#38bdf8" />
                                    </View>
                                    <View style={styles.policyTextContainer}>
                                        <Text style={[styles.policyLabel, { color: '#38bdf8' }]}>Ayúdanos a mejorar</Text>
                                        <Text style={styles.policyValue}>Reportar fallas o sugerir mejoras</Text>
                                    </View>
                                    <ArrowRight size={20} color="#38bdf8" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* 5. QUICK GUIDE */}
                        <View style={styles.section}>
                            <TouchableOpacity
                                style={styles.sectionHeader}
                                onPress={() => toggleSection('guide')}
                                activeOpacity={0.7}
                            >
                                <Zap size={20} color="#facc15" />
                                <Text style={styles.sectionTitle}>Guía Rápida</Text>
                                {expandedSections.guide ? (
                                    <ChevronUp size={20} color="#94a3b8" style={{ marginLeft: 'auto' }} />
                                ) : (
                                    <ChevronDown size={20} color="#94a3b8" style={{ marginLeft: 'auto' }} />
                                )}
                            </TouchableOpacity>

                            {expandedSections.guide && (
                                <TouchableOpacity
                                    style={styles.tutorialButton}
                                    onPress={() => navigation.navigate('Onboarding')}
                                >
                                    <View style={styles.iconCircleYellow}>
                                        <Brain size={18} color="#facc15" />
                                    </View>
                                    <View style={styles.policyTextContainer}>
                                        <Text style={styles.policyLabel}>Tutorial Interactivo</Text>
                                        <Text style={styles.policyValue}>Ver explicación de BLACKBOX</Text>
                                    </View>
                                    <ChevronLeft size={20} color="#475569" style={{ transform: [{ rotate: '180deg' }] }} />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* 6. TERMS & CONDITIONS (SUMMARY) */}
                        <View style={styles.section}>
                            <TouchableOpacity
                                style={styles.sectionHeader}
                                onPress={() => toggleSection('privacy')}
                                activeOpacity={0.7}
                            >
                                <ShieldCheck size={20} color="#6366f1" />
                                <Text style={styles.sectionTitle}>Privacidad y Datos</Text>
                                {expandedSections.privacy ? (
                                    <ChevronUp size={20} color="#94a3b8" style={{ marginLeft: 'auto' }} />
                                ) : (
                                    <ChevronDown size={20} color="#94a3b8" style={{ marginLeft: 'auto' }} />
                                )}
                            </TouchableOpacity>

                            {expandedSections.privacy && (
                                <View style={styles.legalCard}>
                                    <Text style={styles.legalIntro}>
                                        En BLACKBOX, la privacidad y el control de tus datos son pilares fundamentales.
                                    </Text>
                                    <TouchableOpacity style={styles.policyRow} onPress={() => WebBrowser.openBrowserAsync('https://blackbox.ai/privacy')}>
                                        <View style={styles.iconCircle}>
                                            <ShieldCheck size={18} color="#6366f1" />
                                        </View>
                                        <View style={styles.policyTextContainer}>
                                            <Text style={styles.policyLabel}>Aviso de Privacidad</Text>
                                            <Text style={styles.policyValue}>Lee cómo protegemos tu información.</Text>
                                        </View>
                                        <ArrowRight size={20} color="#475569" />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.policyRow} onPress={() => WebBrowser.openBrowserAsync('https://blackbox.ai/terms')}>
                                        <View style={[styles.iconCircle, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
                                            <Database size={18} color="#6366f1" />
                                        </View>
                                        <View style={styles.policyTextContainer}>
                                            <Text style={styles.policyLabel}>Términos de Servicio</Text>
                                            <Text style={styles.policyValue}>Reglas de uso de la plataforma.</Text>
                                        </View>
                                        <ArrowRight size={20} color="#475569" />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </>
                ) : (
                    /* FULL DETAIL VIEW (Tasks/Biases) */
                    <View style={{ paddingBottom: 40 }}>
                        {(viewMode === 'pending' ? pendingTasks :
                            viewMode === 'completed' ? completedTasks : biasHistory).map((item, idx) => (
                                <TouchableOpacity
                                    key={idx}
                                    style={styles.hubTaskItem}
                                    onPress={() => navigation.navigate('EntryDetail', { entryId: item.entryId })}
                                >
                                    {viewMode === 'pending' && <View style={styles.hubTaskDot} />}
                                    {viewMode === 'completed' && <ShieldCheck size={16} color="#10b981" style={{ marginRight: 12 }} />}
                                    {viewMode === 'biases' && (
                                        <View style={styles.biasTag}>
                                            <Text style={styles.biasTagText}>{item.bias}</Text>
                                        </View>
                                    )}
                                    <View style={{ flex: 1 }}>
                                        <Text style={[
                                            styles.hubTaskDesc,
                                            viewMode === 'completed' && { textDecorationLine: 'line-through', color: '#64748b' }
                                        ]}>
                                            {viewMode === 'biases' ? item.bias : item.description}
                                        </Text>
                                        <Text style={styles.hubTaskSource}>
                                            {viewMode === 'biases' ? item.entryTitle : `En: ${item.entryTitle}`}
                                        </Text>
                                    </View>
                                    <ArrowRight size={14} color="#475569" />
                                </TouchableOpacity>
                            ))}
                        <TouchableOpacity
                            style={[styles.generateButton, { marginTop: 30, backgroundColor: '#334155' }]}
                            onPress={() => setViewMode('hub')}
                        >
                            <Text style={styles.generateButtonText}>Volver al Hub</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ACCOUNT SECTION */}
                <View style={[styles.section, { marginBottom: 60 }]}>
                    <TouchableOpacity
                        style={styles.sectionHeader}
                        onPress={() => toggleSection('account')}
                        activeOpacity={0.7}
                    >
                        <ShieldCheck size={20} color="#ef4444" />
                        <Text style={styles.sectionTitle}>Cuenta</Text>
                        {expandedSections.account ? (
                            <ChevronUp size={20} color="#94a3b8" style={{ marginLeft: 'auto' }} />
                        ) : (
                            <ChevronDown size={20} color="#94a3b8" style={{ marginLeft: 'auto' }} />
                        )}
                    </TouchableOpacity>

                    {expandedSections.account && (
                        <View style={{ gap: 12 }}>
                            <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
                                <LogOut size={20} color="#ef4444" />
                                <Text style={styles.logoutBtnText}>Cerrar Sesión</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.logoutBtn, { backgroundColor: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.1)' }]}
                                onPress={handleDeleteAccount}
                            >
                                <AlertTriangle size={20} color="#ef4444" />
                                <Text style={[styles.logoutBtnText, { fontSize: 14, opacity: 0.8 }]}>Eliminar Cuenta y Datos</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                <View style={styles.footer}>
                    <Text style={styles.versionText}>BLACKBOX MIND v1.3.0</Text>
                    <Text style={styles.footerLegal}>© 2026 Blackbox AI. Todos los derechos reservados.</Text>
                </View>
            </ScrollView>

            {/* FEEDBACK MODAL */}
            <Modal
                visible={showFeedbackModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowFeedbackModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Enviar Feedback</Text>
                            <TouchableOpacity onPress={() => setShowFeedbackModal(false)}>
                                <X size={24} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalSubtitle}>¿Qué te gustaría reportar hoy?</Text>

                        <View style={styles.typeSelector}>
                            {(['improvement', 'bug', 'other'] as const).map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[
                                        styles.typeButton,
                                        feedbackType === type && styles.typeButtonActive
                                    ]}
                                    onPress={() => setFeedbackType(type)}
                                >
                                    <Text style={[
                                        styles.typeButtonText,
                                        feedbackType === type && styles.typeButtonTextActive
                                    ]}>
                                        {type === 'improvement' ? 'Mejora' : type === 'bug' ? 'Falla' : 'Otro'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TextInput
                            style={styles.feedbackInput}
                            placeholder="Cuéntanos más detalles..."
                            placeholderTextColor="#64748b"
                            multiline
                            numberOfLines={6}
                            value={feedbackContent}
                            onChangeText={setFeedbackContent}
                            textAlignVertical="top"
                        />

                        <TouchableOpacity
                            style={[styles.sendButton, isSubmittingFeedback && styles.sendButtonDisabled]}
                            onPress={handleSendFeedback}
                            disabled={isSubmittingFeedback}
                        >
                            {isSubmittingFeedback ? (
                                <ActivityIndicator color="#ffffff" />
                            ) : (
                                <>
                                    <Text style={styles.sendButtonText}>Enviar Feedback</Text>
                                    <Send size={18} color="#ffffff" style={{ marginLeft: 8 }} />
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 15 : 20,
        paddingBottom: 20,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
    },
    section: {
        marginTop: 10,
        marginBottom: 30,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 10,
    },
    sectionTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '700',
    },
    legalCard: {
        backgroundColor: '#1e293b',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    legalIntro: {
        color: '#94a3b8',
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 24,
    },
    policyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        gap: 16,
    },
    iconCircle: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconCircleYellow: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(250, 204, 21, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tutorialButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1e293b',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        gap: 16,
    },
    policyTextContainer: {
        flex: 1,
    },
    clinicalCard: {
        backgroundColor: '#1e293b',
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(168, 85, 247, 0.2)',
    },
    clinicalDesc: {
        color: '#94a3b8',
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 20,
    },
    dateSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        padding: 14,
        borderRadius: 12,
        marginBottom: 16,
        gap: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    dateText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '500',
    },
    generateButton: {
        backgroundColor: '#a855f7',
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#a855f7",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    generateButtonText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '700',
    },
    policyLabel: {
        color: '#64748b',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
    },
    policyValue: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '600',
        lineHeight: 20,
    },
    hubCard: {
        backgroundColor: '#1e293b',
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    emptyHubText: { color: '#64748b', fontSize: 14, fontStyle: 'italic', textAlign: 'center' },
    hubTaskItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
        gap: 12,
    },
    hubTaskDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#818cf8' },
    hubTaskDesc: { color: '#ffffff', fontSize: 15, fontWeight: '500' },
    hubTaskSource: { color: '#64748b', fontSize: 12, marginTop: 2 },
    moreHubText: { color: '#64748b', fontSize: 12, textAlign: 'center', marginTop: 12 },
    hubBiasItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
        gap: 12,
    },
    biasTag: {
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    biasTagText: { color: '#f59e0b', fontSize: 11, fontWeight: 'bold' },
    hubBiasTitle: { color: '#ffffff', fontSize: 14, flex: 1 },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        padding: 18,
        borderRadius: 20,
        gap: 12,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    logoutBtnText: { color: '#ef4444', fontSize: 16, fontWeight: '700' },
    footer: {
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 40,
    },
    versionText: {
        color: '#334155',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: 8,
    },
    footerLegal: {
        color: '#334155',
        fontSize: 11,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1e293b',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        color: '#ffffff',
        fontSize: 22,
        fontWeight: 'bold',
    },
    modalSubtitle: {
        color: '#94a3b8',
        fontSize: 16,
        marginBottom: 16,
    },
    typeSelector: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    typeButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    typeButtonActive: {
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        borderColor: '#38bdf8',
    },
    typeButtonText: {
        color: '#64748b',
        fontSize: 14,
        fontWeight: '600',
    },
    typeButtonTextActive: {
        color: '#38bdf8',
    },
    feedbackInput: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 16,
        padding: 16,
        color: '#ffffff',
        fontSize: 16,
        height: 150,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    sendButton: {
        flexDirection: 'row',
        backgroundColor: '#38bdf8',
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#38bdf8",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    sendButtonDisabled: {
        opacity: 0.6,
    },
    sendButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default SettingsScreen;
