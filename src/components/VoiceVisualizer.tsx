import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withRepeat,
    withTiming,
    interpolate,
    Extrapolate,
    SharedValue
} from 'react-native-reanimated';

interface VoiceVisualizerProps {
    isActive: boolean;
    metering: number; // -160 to 0
}

const BAR_COUNT = 9;

const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({ isActive, metering }) => {
    const pulse = useSharedValue(1);
    const volume = useSharedValue(-160);

    useEffect(() => {
        if (isActive) {
            pulse.value = withRepeat(withTiming(1.4, { duration: 1000 }), -1, true);
        } else {
            pulse.value = withTiming(1);
        }
    }, [isActive]);

    useEffect(() => {
        // Smooth the volume change
        volume.value = withSpring(metering, { damping: 15, stiffness: 100 });
    }, [metering]);

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulse.value }],
        opacity: interpolate(pulse.value, [1, 1.4], [0.6, 0], Extrapolate.CLAMP),
    }));

    return (
        <View style={styles.container}>
            {isActive && (
                <Animated.View style={[styles.pulseCircle, pulseStyle]} />
            )}
            <View style={styles.barsContainer}>
                {[...Array(BAR_COUNT)].map((_, i) => (
                    <Bar key={i} index={i} volume={volume} isActive={isActive} />
                ))}
            </View>
        </View>
    );
};

const Bar = ({ index, volume, isActive }: { index: number; volume: SharedValue<number>; isActive: boolean }) => {
    const barHeight = useAnimatedStyle(() => {
        // Map -160..0 to 4..40
        const baseHeight = interpolate(volume.value, [-160, -60, 0], [4, 15, 45], Extrapolate.CLAMP);
        // Add some random-looking variation based on index
        const variator = Math.sin(index * 0.8) * 5;
        const finalHeight = isActive ? baseHeight + (variator * (baseHeight / 10)) : 4;

        return {
            height: withTiming(Math.max(4, finalHeight), { duration: 100 }),
        };
    });

    return <Animated.View style={[styles.bar, barHeight]} />;
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        height: 60,
        width: '100%',
        marginBottom: 20
    },
    pulseCircle: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#6366f1',
        zIndex: -1
    },
    barsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 50,
    },
    bar: {
        width: 4,
        backgroundColor: '#6366f1',
        marginHorizontal: 2,
        borderRadius: 2,
    }
});

export default VoiceVisualizer;
