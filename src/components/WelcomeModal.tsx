import React, { useEffect, useState } from 'react';
import {
    Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Mic, Brain, Zap, Target, Search, Compass } from 'lucide-react-native';

const STORAGE_KEY = 'BLACKBOX_WELCOME_V1_SEEN';

const steps = [
    'Toca el micrófono o escribe lo que traes en la cabeza. Crudo, sin ordenarlo.',
    'Conversa. BLACKBOX te responde directo y con criterio — te conoce.',
    'Sal cuando quieras. Lo importante se guarda solo.',
];

const features = [
    { icon: Mic, color: '#6366f1', title: 'Captura por voz, texto o imagen', desc: 'Suéltalo como te salga. Lo transcribe e interpreta por ti.' },
    { icon: Brain, color: '#a855f7', title: 'Te conoce de verdad', desc: 'Usa tu historial, tus temas y tus pendientes. No le repites tu vida cada vez.' },
    { icon: Zap, color: '#facc15', title: 'Active Loops', desc: 'Tus pendientes de alto impacto, los pocos que importan hoy. Ciérralos con un toque.' },
    { icon: Target, color: '#10b981', title: 'Memorias, metas y patrones', desc: 'Tus reflexiones por categoría, metas detectadas solas y tus sesgos recurrentes.' },
    { icon: Search, color: '#38bdf8', title: 'Busca por significado', desc: 'Encuentra en tu historial por idea, no por palabra exacta. Reporte semanal exportable.' },
    { icon: Compass, color: '#f43f5e', title: 'Una sola acción', desc: 'No te abruma con métricas: te dice qué hacer hoy. Lo demás está si lo quieres.' },
];

interface Props { forceShow?: boolean; onClose?: () => void; }

const WelcomeModal: React.FC<Props> = ({ forceShow, onClose }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (forceShow) { setVisible(true); return; }
        AsyncStorage.getItem(STORAGE_KEY).then(seen => { if (!seen) setVisible(true); });
    }, [forceShow]);

    const handleClose = async () => {
        await AsyncStorage.setItem(STORAGE_KEY, 'true');
        setVisible(false);
        onClose?.();
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
            <View style={styles.overlay}>
                <View style={styles.sheet}>
                    <View style={styles.handle} />

                    <Text style={styles.badge}>BIENVENIDO</Text>
                    <Text style={styles.title}>BLACKBOX MIND</Text>
                    <Text style={styles.subtitle}>
                        No es un diario ni un chatbot. Es tu caja negra estratégica:
                        suelta el caos, recibe claridad. Mientras más la usas, mejor te conoce.
                    </Text>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
                        <View style={styles.stepsBox}>
                            <Text style={styles.stepsTitle}>EMPIEZA EN 3 PASOS</Text>
                            {steps.map((s, i) => (
                                <View key={i} style={styles.stepRow}>
                                    <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
                                    <Text style={styles.stepText}>{s}</Text>
                                </View>
                            ))}
                        </View>

                        <Text style={styles.sectionLabel}>QUÉ PUEDES HACER</Text>
                        <View style={{ gap: 18 }}>
                            {features.map((f, i) => {
                                const Icon = f.icon as any;
                                return (
                                    <View key={i} style={styles.item}>
                                        <View style={[styles.iconBox, { backgroundColor: `${f.color}18` }]}>
                                            <Icon size={20} color={f.color} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.itemTitle}>{f.title}</Text>
                                            <Text style={styles.itemDesc}>{f.desc}</Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>

                        <Text style={styles.rule}>
                            La única regla: no ordenes tus ideas antes de escribir. Ven con el
                            caos. Si solo tienes 30 segundos y una frase, con eso basta.
                        </Text>
                    </ScrollView>

                    <TouchableOpacity style={styles.cta} onPress={handleClose} activeOpacity={0.85}>
                        <Text style={styles.ctaText}>Empezar</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: '#0f172a',
        borderTopLeftRadius: 32, borderTopRightRadius: 32,
        padding: 24, maxHeight: '92%',
        borderTopWidth: 1, borderColor: 'rgba(99,102,241,0.3)',
    },
    handle: { width: 40, height: 4, backgroundColor: '#334155', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    badge: { color: '#6366f1', fontSize: 11, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
    title: { color: 'white', fontSize: 26, fontWeight: 'bold', marginBottom: 8 },
    subtitle: { color: '#94a3b8', fontSize: 14, lineHeight: 20, marginBottom: 20 },
    stepsBox: {
        backgroundColor: 'rgba(99,102,241,0.08)',
        borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)',
        borderRadius: 18, padding: 16, marginBottom: 24,
    },
    stepsTitle: { color: '#818cf8', fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 12 },
    stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 12 },
    stepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' },
    stepNumText: { color: 'white', fontSize: 12, fontWeight: '900' },
    stepText: { color: '#cbd5e1', fontSize: 13, lineHeight: 19, flex: 1 },
    sectionLabel: { color: '#6366f1', fontSize: 11, fontWeight: '900', letterSpacing: 2, marginBottom: 16 },
    item: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
    iconBox: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    itemTitle: { color: 'white', fontWeight: 'bold', fontSize: 15, marginBottom: 3 },
    itemDesc: { color: '#64748b', fontSize: 13, lineHeight: 19 },
    rule: { color: '#94a3b8', fontSize: 13, lineHeight: 20, fontStyle: 'italic', marginTop: 24 },
    cta: {
        backgroundColor: '#6366f1', paddingVertical: 18, borderRadius: 20,
        alignItems: 'center', marginTop: 18,
        shadowColor: '#6366f1', shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
    },
    ctaText: { color: 'white', fontWeight: 'bold', fontSize: 17, letterSpacing: 0.3 },
});

export default WelcomeModal;
