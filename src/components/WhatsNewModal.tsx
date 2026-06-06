import React, { useEffect, useMemo, useState } from 'react';
import {
    Modal, View, Text, TouchableOpacity, ScrollView,
    StyleSheet, StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Sparkles, MessageSquare, Shield, Zap, Crown, X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { ThemeTokens } from '../theme/tokens';

const STORAGE_KEY = 'BLACKBOX_WHATS_NEW_V2_SEEN';

interface WhatsNewModalProps {
    forceShow?: boolean;
    onClose?: () => void;
}

const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ forceShow, onClose }) => {
    const { tokens } = useTheme();
    const styles = useMemo(() => makeStyles(tokens), [tokens]);
    const [visible, setVisible] = useState(false);

    const changes = useMemo(() => ([
        {
            icon: MessageSquare,
            color: tokens.accent.purple,
            title: 'Sesión Estratégica Post-Entrada',
            description: 'Después de registrar tu memoria, BlackBoxMind abre una conversación profunda contigo — como una sesión con tu coach personal.',
        },
        {
            icon: Crown,
            color: tokens.accent.yellow,
            title: 'Modelo FREE / PRO',
            description: '5 registros/mes gratis. PRO desbloquea chat estratégico, reportes semanales, voz ilimitada y registros sin límite. Planes mensual y anual.',
        },
        {
            icon: Zap,
            color: tokens.accent.indigo,
            title: 'Motor de IA Actualizado',
            description: 'Ahora usamos Gemini 3.1 Flash-Lite — más rápido, más preciso y con capacidad de razonamiento avanzado.',
        },
        {
            icon: Shield,
            color: tokens.accent.green,
            title: 'Seguridad Mejorada',
            description: 'Todas las llamadas a IA ahora pasan por Edge Functions seguras. Tu API key nunca sale del servidor.',
        },
        {
            icon: Sparkles,
            color: tokens.accent.sky,
            title: 'UX de Fallos Resiliente',
            description: 'Si el micrófono o Face ID fallan, el sistema te guía con pasos claros en lugar de bloquearte.',
        },
    ]), [tokens]);

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
                            <X size={20} color={tokens.text.muted} />
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
                        <Text style={styles.ctaText}>Explorar BlackBoxMind 2.0 ✦</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const makeStyles = (tokens: ThemeTokens) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: tokens.bg.overlay,
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: tokens.bg.page,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        maxHeight: '88%',
        borderTopWidth: 1,
        borderColor: tokens.accent.indigo,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: tokens.border.strong,
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
        color: tokens.accent.indigo,
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 2,
        marginBottom: 4,
    },
    title: {
        color: tokens.text.primary,
        fontSize: 26,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    subtitle: {
        color: tokens.text.muted,
        fontSize: 14,
    },
    closeBtn: {
        padding: 8,
        backgroundColor: tokens.bg.input,
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
        color: tokens.text.primary,
        fontWeight: 'bold',
        fontSize: 15,
        marginBottom: 4,
    },
    itemDesc: {
        color: tokens.text.muted,
        fontSize: 13,
        lineHeight: 19,
    },
    cta: {
        backgroundColor: tokens.accent.indigo,
        paddingVertical: 18,
        borderRadius: 20,
        alignItems: 'center',
        marginTop: 20,
        shadowColor: tokens.accent.indigo,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    ctaText: {
        color: tokens.text.onAccent,
        fontWeight: 'bold',
        fontSize: 17,
        letterSpacing: 0.3,
    },
});

export default WhatsNewModal;
