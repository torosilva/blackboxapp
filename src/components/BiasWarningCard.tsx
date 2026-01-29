import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { UserRoundCheck } from 'lucide-react-native';
import { StrategicInsight } from '../core-types';

interface Props {
    insight: StrategicInsight | null | undefined;
}

export const BiasWarningCard: React.FC<Props> = ({ insight }) => {
    if (!insight) return null;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <UserRoundCheck size={20} color="#fbbf24" />
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

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'rgba(251, 191, 36, 0.05)',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.2)',
        marginBottom: 20
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 10
    },
    title: {
        color: '#fbbf24',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1.5
    },
    biasRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8
    },
    biasLabel: {
        color: '#fbbf24',
        fontSize: 12,
        fontWeight: 'bold'
    },
    biasValue: {
        color: '#fef3c7',
        fontSize: 14,
        fontWeight: '600'
    },
    warningText: {
        color: '#fef3c7',
        fontSize: 14,
        lineHeight: 20,
        fontStyle: 'italic',
        marginBottom: 16
    },
    counterBox: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 16,
        padding: 16,
        borderLeftWidth: 3,
        borderLeftColor: '#22c55e'
    },
    counterTitle: {
        color: '#22c55e',
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 4
    },
    counterText: {
        color: '#d1fae5',
        fontSize: 13,
        lineHeight: 18
    }
});
