import React, { useEffect } from 'react';
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

    useEffect(() => {
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
        } else {
            brainScale.value = 1;
            cubeRotate.value = 0;
            cubeTranslateY.value = 0;
        }
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

                    <Text style={styles.loadingText}>{message}</Text>
                    <View style={styles.progressBarBg}>
                        <Animated.View style={styles.progressBarFill} />
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
