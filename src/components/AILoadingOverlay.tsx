import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    withDelay
} from 'react-native-reanimated';
import { Brain, Box } from 'lucide-react-native';

interface AILoadingOverlayProps {
    visible: boolean;
    message?: string;
}

const AILoadingOverlay: React.FC<AILoadingOverlayProps> = ({ visible, message = "Analizando tu mente..." }) => {
    const brainScale = useSharedValue(1);
    const cubeRotate = useSharedValue(0);
    const cubeTranslateY = useSharedValue(0);
    const [progress, setProgress] = React.useState(0);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (visible) {
            setProgress(0);
            interval = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 98) return prev;
                    const increment = Math.random() * 15;
                    return Math.min(prev + increment, 98);
                });
            }, 800);
        }
        return () => clearInterval(interval);
    }, [visible]);

    useEffect(() => {
        let timeout: NodeJS.Timeout;
        if (visible) {
            // Pulse animation for the brain
            brainScale.value = withRepeat(
                withSequence(
                    withTiming(1.2, { duration: 800 }),
                    withTiming(1, { duration: 800 })
                ),
                -1,
                true
            );

            // Float and rotate animation for the cube
            cubeTranslateY.value = withRepeat(
                withSequence(
                    withTiming(-10, { duration: 1200 }),
                    withTiming(0, { duration: 1200 })
                ),
                -1,
                true
            );

            cubeRotate.value = withRepeat(
                withTiming(360, { duration: 3000 }),
                -1,
                false
            );

            // SAFETY TIMEOUT: Auto-close after 30 seconds if stuck
            timeout = setTimeout(() => {
                if (visible) {
                    console.warn('AI_LOADING_OVERLAY: Safety timeout reached. Closing overlay.');
                    // Note: We can't change the parent's state here, but we can stop animations or log it.
                    // Usually this implies a hung promise in the caller.
                }
            }, 30000);
        } else {
            brainScale.value = 1;
            cubeRotate.value = 0;
            cubeTranslateY.value = 0;
        }
        return () => clearTimeout(timeout);
    }, [visible]);

    const animatedBrainStyle = useAnimatedStyle(() => ({
        transform: [{ scale: brainScale.value }],
    }));

    const animatedCubeStyle = useAnimatedStyle(() => ({
        transform: [
            { translateY: cubeTranslateY.value },
            { rotate: `${cubeRotate.value}deg` }
        ],
    }));

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="fade">
            <View style={styles.overlay}>
                <View style={styles.content}>
                    <View style={styles.animationContainer}>
                        {/* The "Cube" */}
                        <Animated.View style={[styles.iconWrapper, animatedCubeStyle]}>
                            <Box size={40} color="#818cf8" strokeWidth={1.5} />
                        </Animated.View>

                        {/* The "Brain" */}
                        <Animated.View style={[styles.iconWrapper, animatedBrainStyle, styles.brainIcon]}>
                            <Brain size={60} color="#a855f7" strokeWidth={1.5} />
                        </Animated.View>
                    </View>

                    <Text style={styles.loadingText}>{message} {Math.round(progress)}%</Text>
                    <View style={styles.progressBarBg}>
                        <Animated.View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(11, 16, 33, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        width: '80%',
    },
    animationContainer: {
        height: 120,
        width: 120,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 30,
    },
    iconWrapper: {
        position: 'absolute',
    },
    brainIcon: {
        // The brain is central
    },
    loadingText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: 20,
        textAlign: 'center',
    },
    progressBarBg: {
        width: '100%',
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBarFill: {
        width: '60%', // Static for now, or could be animated
        height: '100%',
        backgroundColor: '#818cf8',
    }
});

export default AILoadingOverlay;
