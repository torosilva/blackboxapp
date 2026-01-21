import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Zap, Sparkles } from 'lucide-react-native';
import { WellnessRecommendation } from '../types';

interface Props {
    recommendation: WellnessRecommendation | string | null | undefined;
    summary?: string | null;
}

export const WellnessActionCard: React.FC<Props> = ({ recommendation, summary }) => {
    if (!recommendation && !summary) return null;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Sparkles size={20} color="#a855f7" />
                <Text style={styles.title}>INSIGHT ESTRATÉGICO BLACKBOX</Text>
            </View>

            {summary && (
                <View style={styles.summaryBox}>
                    <Text style={styles.summaryText}>{summary}</Text>
                </View>
            )}

            {recommendation && (
                <View style={styles.recommendationBox}>
                    <View style={styles.recHeader}>
                        <Zap size={16} color="#f59e0b" />
                        <Text style={styles.recTitle}>
                            {typeof recommendation === 'string'
                                ? 'Recomendación Estratégica'
                                : (recommendation.title || 'Acción Estratégica')}
                        </Text>
                    </View>
                    <Text style={styles.recDesc}>
                        {typeof recommendation === 'string'
                            ? recommendation
                            : (recommendation.description || 'Consulta las acciones sugeridas por la IA para mejorar tu bienestar.')}
                    </Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'rgba(168, 85, 247, 0.05)',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(168, 85, 247, 0.2)',
        marginBottom: 30
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 10
    },
    title: {
        color: '#a855f7',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1.5
    },
    summaryBox: {
        marginBottom: 20
    },
    summaryText: {
        color: '#e9d5ff',
        fontSize: 15,
        lineHeight: 24,
        fontStyle: 'italic'
    },
    recommendationBox: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 16,
        padding: 16,
        borderLeftWidth: 3,
        borderLeftColor: '#f59e0b'
    },
    recHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8
    },
    recTitle: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: 'bold'
    },
    recDesc: {
        color: '#94a3b8',
        fontSize: 13,
        lineHeight: 18
    }
});
