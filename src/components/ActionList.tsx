import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ActionItem } from '../core-types';
import { SupabaseService } from '../services/SupabaseService';

interface Props {
    actions: ActionItem[];
    entryId?: string;
}

export const ActionList: React.FC<Props> = ({ actions, entryId }) => {
    // Local state to handle visual "checks"
    const [items, setItems] = useState(
        actions.map(a => ({ ...a, is_completed: a.is_completed || false }))
    );

    const toggleAction = async (index: number) => {
        const item = items[index];
        if (!item.id) {
            console.warn('ACTION_LIST: Cannot update item without ID');
            return;
        }

        const newStatus = !item.is_completed;
        const newItems = [...items];
        newItems[index].is_completed = newStatus;

        // Optimistic UI update
        setItems(newItems);

        // Persistence in new normalized table
        const success = await SupabaseService.updateActionItemStatus(item.id, newStatus);
        if (!success) {
            // Rollback on failure
            const rollbackItems = [...items];
            rollbackItems[index].is_completed = !newStatus;
            setItems(rollbackItems);
        }
    };

    const handleShare = async (item: ActionItem) => {
        try {
            const message = `BLACKBOX DIRECTIVE:\n\n${item.task}\n\nPriority: ${item.priority}\nCategory: ${item.category}\n\nAction requested.`;
            await Share.share({
                message,
                title: 'Delegar Active Loop'
            });
        } catch (error) {
            console.error('SHARE_ERROR:', error);
        }
    };

    if (!actions || actions.length === 0) return null;

    return (
        <View style={styles.container}>
            {/* SECTION TITLE */}
            <View style={styles.headerRow}>
                <Ionicons name="flash" size={16} color="#fbbf24" />
                <Text style={styles.headerText}>
                    Active Loops (Plan de Ataque)
                </Text>
            </View>

            {/* ACTION CARDS */}
            <View style={styles.listContainer}>
                {items.map((item, index) => (
                    <TouchableOpacity
                        key={index}
                        activeOpacity={0.8}
                        onPress={() => toggleAction(index)}
                        style={[
                            styles.actionCard,
                            item.is_completed ? styles.cardCompleted : styles.cardPending
                        ]}
                    >
                        {/* CUSTOM CHECKBOX */}
                        <View style={[
                            styles.checkbox,
                            item.is_completed ? styles.checkboxChecked : styles.checkboxUnchecked
                        ]}>
                            {item.is_completed && <Ionicons name="checkmark" size={14} color="white" />}
                        </View>

                        {/* TEXT AND CATEGORY */}
                        <View style={styles.textContainer}>
                            <Text style={[
                                styles.description,
                                item.is_completed && styles.textCompleted
                            ]}>
                                {item.task}
                            </Text>

                            <View style={styles.badgeRow}>
                                {/* Category Badge */}
                                <View style={styles.categoryBadge}>
                                    <Text style={styles.categoryText}>
                                        {item.category}
                                    </Text>
                                </View>

                                {/* Priority Badge (Only if HIGH and not completed) */}
                                {item.priority === 'HIGH' && !item.is_completed && (
                                    <View style={styles.priorityBadge}>
                                        <Text style={styles.priorityText}>
                                            PRIORIDAD ALTA
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* DELEGATE (SHARE) BUTTON */}
                        <TouchableOpacity 
                            onPress={(e) => {
                                e.stopPropagation();
                                handleShare(item);
                            }}
                            style={styles.shareButton}
                        >
                            <Ionicons name="share-outline" size={20} color="#94a3b8" />
                        </TouchableOpacity>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 32,
        marginBottom: 16,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        paddingLeft: 4,
    },
    headerText: {
        color: '#fbbf24',
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 3,
        textTransform: 'uppercase',
        marginLeft: 8,
    },
    listContainer: {
        gap: 12,
    },
    actionCard: {
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardPending: {
        backgroundColor: '#151B33',
        borderColor: 'rgba(255,255,255,0.1)',
    },
    cardCompleted: {
        backgroundColor: 'rgba(16, 185, 129, 0.05)',
        borderColor: 'rgba(16, 185, 129, 0.2)',
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
        padding: 4, // Added padding to increase internal hit space if needed, though card is primary
    },
    checkboxUnchecked: {
        borderColor: '#64748b',
    },
    checkboxChecked: {
        backgroundColor: '#10b981',
        borderColor: '#10b981',
    },
    textContainer: {
        flex: 1,
    },
    description: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    textCompleted: {
        color: '#64748b',
        textDecorationLine: 'line-through',
    },
    badgeRow: {
        flexDirection: 'row',
    },
    categoryBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        marginRight: 8,
    },
    categoryText: {
        color: '#94a3b8',
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    priorityBadge: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    priorityText: {
        color: '#ef4444',
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    shareButton: {
        padding: 8,
        marginLeft: 8,
    },
});
