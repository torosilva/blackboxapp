import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Zap, Sparkles } from 'lucide-react-native';
import { WellnessRecommendation } from '../core-types';
import { useTheme } from '../theme/ThemeContext';
import { ThemeTokens } from '../theme/tokens';

interface Props {
    recommendation: WellnessRecommendation | string | null | undefined;
    summary?: string | null;
}

export const WellnessActionCard: React.FC<Props> = ({ recommendation, summary }) => {
    const { tokens } = useTheme();
    const styles = useMemo(() => makeStyles(tokens), [tokens]);

    if (!recommendation && !summary) return null;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Sparkles size={20} color={tokens.accent.purple} />
                <Text style={styles.title}>INSIGHT ESTRATÉGICO BlackBoxMind.ai</Text>
            </View>

            {summary && (
                <View style={styles.summaryBox}>
                    <Text style={styles.summaryText}>{summary}</Text>
                </View>
            )}

            {recommendation && (
                <View style={styles.recommendationBox}>
                    <View style={styles.recHeader}>
                        <Zap size={16} color={tokens.accent.amber} />
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

const makeStyles = (tokens: ThemeTokens) => StyleSheet.create({
    container: {
        backgroundColor: tokens.accent.purpleSoft,
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: tokens.accent.purple,
        marginBottom: 30
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 10
    },
    title: {
        color: tokens.accent.purple,
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1.5
    },
    summaryBox: {
        marginBottom: 20
    },
    summaryText: {
        color: tokens.text.primary,
        fontSize: 15,
        lineHeight: 24,
        fontStyle: 'italic'
    },
    recommendationBox: {
        backgroundColor: tokens.bg.scrim,
        borderRadius: 16,
        padding: 16,
        borderLeftWidth: 3,
        borderLeftColor: tokens.accent.amber
    },
    recHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8
    },
    recTitle: {
        color: tokens.text.primary,
        fontSize: 14,
        fontWeight: 'bold'
    },
    recDesc: {
        color: tokens.text.muted,
        fontSize: 13,
        lineHeight: 18
    }
});
