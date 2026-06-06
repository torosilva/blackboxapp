import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { UserRoundCheck } from 'lucide-react-native';
import { StrategicInsight } from '../core-types';
import { useTheme } from '../theme/ThemeContext';
import { ThemeTokens } from '../theme/tokens';

interface Props {
    insight: StrategicInsight | null | undefined;
}

export const BiasWarningCard: React.FC<Props> = ({ insight }) => {
    const { tokens } = useTheme();
    const styles = useMemo(() => makeStyles(tokens), [tokens]);

    if (!insight) return null;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <UserRoundCheck size={20} color={tokens.accent.amber} />
                <Text style={styles.title}>ESTRATEGIA & SESGOS</Text>
            </View>

            {insight.detected_bias && (
                <View style={styles.biasRow}>
                    <Text style={styles.biasLabel}>Sesgo Detectado:</Text>
                    <Text style={styles.biasValue}>{insight.detected_bias}</Text>
                </View>
            )}

            <Text style={styles.warningText}>{insight.warning_message}</Text>

            <View style={styles.counterBox}>
                <Text style={styles.counterTitle}>Contrapensamiento:</Text>
                <Text style={styles.counterText}>{insight.counter_thought}</Text>
            </View>
        </View>
    );
};

const makeStyles = (tokens: ThemeTokens) => StyleSheet.create({
    container: {
        backgroundColor: tokens.accent.amberSoft,
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: tokens.accent.amber,
        marginBottom: 20
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 10
    },
    title: {
        color: tokens.accent.amber,
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1.5
    },
    biasRow: {
        flexDirection: 'column',
        marginBottom: 12
    },
    biasLabel: {
        color: tokens.accent.amber,
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 4
    },
    biasValue: {
        color: tokens.text.primary,
        fontSize: 14,
        fontWeight: '600',
        lineHeight: 20,
        flexShrink: 1
    },
    warningText: {
        color: tokens.text.primary,
        fontSize: 14,
        lineHeight: 20,
        fontStyle: 'italic',
        marginBottom: 16
    },
    counterBox: {
        backgroundColor: tokens.bg.scrim,
        borderRadius: 16,
        padding: 16,
        borderLeftWidth: 3,
        borderLeftColor: tokens.accent.green
    },
    counterTitle: {
        color: tokens.accent.green,
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 4
    },
    counterText: {
        color: tokens.accent.green,
        fontSize: 13,
        lineHeight: 18
    }
});
