import React, { useEffect, useState } from 'react';
import {
    Modal, View, Text, TouchableOpacity, ScrollView,
    StyleSheet, StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Sparkles, MessageSquare, Shield, Zap, Crown, X } from 'lucide-react-native';

const STORAGE_KEY = 'BLACKBOX_WHATS_NEW_V2_SEEN';

const changes = [
    {
        icon: MessageSquare,
        color: '#a855f7',
        title: 'Sesión Estratégica Post-Entrada',
        description: 'Después de registrar tu memoria, BLACKBOX abre una conversación profunda contigo — como una sesión con tu coach personal.',
    },
    {
        icon: Crown,
        color: '#facc15',
        title: 'Modelo FREE / PRO',
        description: '5 registros/mes gratis. PRO desbloquea chat estratégico, reportes semanales, voz ilimitada y registros sin límite. Planes mensual y anual.',
    },
    {
        icon: Zap,
        color: '#6366f1',
        title: 'Motor de IA Actualizado',
        description: 'Ahora usamos Gemini 3.1 Flash-Lite — más rápido, más preciso y con capacidad de razonamiento avanzado.',
    },
    {
        icon: Shield,
        color: '#10b981',
        title: 'Seguridad Mejorada',
        description: 'Todas las llamadas a IA ahora pasan por Edge Functions seguras. Tu API key nunca sale del servidor.',
    },
    {
        icon: Sparkles,
        color: '#38bdf8',
        title: 'UX de Fallos Resiliente',
        description: 'Si el micrófono o Face ID fallan, el sistema te guía con pasos claros en lugar de bloquearte.',
    },
];

interface WhatsNewModalProps {
    forceShow?: boolean;
    onClose?: () => void;
}

const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ forceShow, onClose }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (forceShow) {
            setVisible(true);
            return;
        }
        AsyncStorage.getItem(STORAGE_KEY).then(seen => {
            if (!seen) setVisible(true);
        });
    }, [forceShow]);

    const handleClose = async () => {
        await AsyncStorage.setItem(STORAGE_KEY, 'true');
        setVisible(false);
        onClose?.();
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <View style={styles.sheet}>
                    {/* Handle bar */}
                    <View style={styles.handle} />

                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.badge}>VERSIÓN 2.0</Text>
                            <Text style={styles.title}>Lo que es nuevo</Text>
                            <Text style={styles.subtitle}>Todo lo que pediste, implementado.</Text>
                        </View>
                        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                            <X size={20} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    {/* Changes list */}
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.list}
                    >
                        {changes.map((item, i) => {
                            const Icon = item.icon as any;
                            return (
                                <View key={i} style={styles.item}>
                                    <View style={[styles.iconBox, { backgroundColor: `${item.color}18` }]}>
                                        <Icon size={20} color={item.color} />
                                    </View>
                                    <View style={styles.itemText}>
                                        <Text style={styles.itemTitle}>{item.title}</Text>
                                        <Text style={styles.itemDesc}>{item.description}</Text>
                                    </View>
                                </View>
                            );
                        })}
                        <View style={{ height: 8 }} />
                    </ScrollView>

                    {/* CTA */}
                    <TouchableOpacity style={styles.cta} onPress={handleClose}>
                        <Text style={styles.ctaText}>Explorar BLACKBOX 2.0 ✦</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#0f172a',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        maxHeight: '88%',
        borderTopWidth: 1,
        borderColor: 'rgba(99,102,241,0.3)',
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: '#334155',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
    },
    badge: {
        color: '#6366f1',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 2,
        marginBottom: 4,
    },
    title: {
        color: 'white',
        fontSize: 26,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    subtitle: {
        color: '#64748b',
        fontSize: 14,
    },
    closeBtn: {
        padding: 8,
        backgroundColor: '#1e293b',
        borderRadius: 12,
    },
    list: {
        gap: 20,
        paddingBottom: 8,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 14,
    },
    iconBox: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    itemText: { flex: 1 },
    itemTitle: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 15,
        marginBottom: 4,
    },
    itemDesc: {
        color: '#64748b',
        fontSize: 13,
        lineHeight: 19,
    },
    cta: {
        backgroundColor: '#6366f1',
        paddingVertical: 18,
        borderRadius: 20,
        alignItems: 'center',
        marginTop: 20,
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    ctaText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 17,
        letterSpacing: 0.3,
    },
});

export default WhatsNewModal;
