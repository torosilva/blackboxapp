import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    Dimensions,
    StyleSheet,
    Image,
    StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Brain, TrendingUp, Shield, Zap } from 'lucide-react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    interpolate,
    Extrapolate
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

const SLIDES = [
    {
        id: '1',
        title: 'Tu Bóveda Digital',
        description: 'Tus pensamientos y grabaciones procesados con privacidad de grado militar. Tu mente, bajo tu control.',
        icon: <Shield size={120} color="#6366f1" />,
        color: '#6366f1'
    },
    {
        id: '2',
        title: 'Consultoría con IA',
        description: 'Blackbox analiza tus patrones cognitivos para extraer insights estratégicos que te ayudan a crecer.',
        icon: <Brain size={120} color="#c084fc" />,
        color: '#c084fc'
    },
    {
        id: '3',
        title: 'Bajos de Rendimiento',
        description: 'Transformamos cada reflexión en "Active Loops": tareas concretas y accionables para tu éxito diario.',
        icon: <Zap size={120} color="#38bdf8" />,
        color: '#38bdf8'
    },
];

const ONBOARDING_KEY = 'HAS_SEEN_ONBOARDING';

export default function OnboardingScreen() {
    const navigation = useNavigation<any>();
    const { user } = useAuth();

    const SAV = SafeAreaView as any;
    const TO = TouchableOpacity as any;
    const B = Brain as any;
    const TU = TrendingUp as any;
    const Sh = Shield as any;
    const Z = Zap as any;

    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const scrollX = useSharedValue(0);

    const handleComplete = async () => {
        try {
            await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
            if (user) {
                navigation.goBack();
            } else {
                navigation.replace('Login');
            }
        } catch (e) {
            console.error('Error saving onboarding state', e);
            if (user) {
                navigation.goBack();
            } else {
                navigation.replace('Login');
            }
        }
    };

    const handleNext = () => {
        if (currentIndex < SLIDES.length - 1) {
            const nextIndex = currentIndex + 1;
            flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
            setCurrentIndex(nextIndex);
        } else {
            handleComplete();
        }
    };

    const renderItem = ({ item }: { item: typeof SLIDES[0] }) => {
        return (
            <View style={styles.slide}>
                <View style={[styles.iconContainer, { backgroundColor: item.color + '15', borderColor: item.color + '30' }]}>
                    <View style={[styles.glow, { backgroundColor: item.color, shadowColor: item.color }]} />
                    {item.icon}
                </View>

                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.description}>{item.description}</Text>
            </View>
        );
    };

    return (
        <SAV style={styles.container}>
            <StatusBar barStyle="light-content" />

            <View style={styles.skipContainer}>
                <TO onPress={handleComplete}>
                    <Text style={styles.skipText}>Saltar</Text>
                </TO>
            </View>

            <FlatList
                ref={flatListRef}
                data={SLIDES}
                renderItem={renderItem}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={(event) => {
                    scrollX.value = event.nativeEvent.contentOffset.x;
                }}
                onMomentumScrollEnd={(event) => {
                    const index = Math.round(event.nativeEvent.contentOffset.x / width);
                    setCurrentIndex(index);
                }}
                getItemLayout={(_, index) => ({
                    length: width,
                    offset: width * index,
                    index,
                })}
                keyExtractor={(item) => item.id}
            />

            <View style={styles.footer}>
                {/* INDICATORS */}
                <View style={styles.indicatorContainer}>
                    {SLIDES.map((_, index) => {
                        const animatedDotStyle = useAnimatedStyle(() => {
                            const input = [(index - 1) * width, index * width, (index + 1) * width];
                            const dotWidth = interpolate(scrollX.value, input, [8, 20, 8], Extrapolate.CLAMP);
                            const opacity = interpolate(scrollX.value, input, [0.3, 1, 0.3], Extrapolate.CLAMP);
                            return {
                                width: dotWidth,
                                opacity,
                                backgroundColor: SLIDES[currentIndex]?.color || '#fff'
                            };
                        });

                        return <Animated.View key={index} style={[styles.dot, animatedDotStyle]} />;
                    })}
                </View>

                {/* BUTTON */}
                <TO
                    onPress={handleNext}
                    style={[styles.button, { backgroundColor: SLIDES[currentIndex]?.color || '#6366f1' }]}
                >
                    <Text style={styles.buttonText}>
                        {currentIndex === SLIDES.length - 1 ? 'Empezar' : 'Siguiente'}
                    </Text>
                </TO>
            </View>
        </SAV>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0B1021' },
    slide: {
        width: width,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    iconContainer: {
        width: 180,
        height: 180,
        borderRadius: 90,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    glow: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        opacity: 0.2,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 40,
        elevation: 10,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 20,
    },
    description: {
        fontSize: 20,
        color: '#94a3b8',
        textAlign: 'center',
        lineHeight: 30,
    },
    skipContainer: {
        paddingHorizontal: 24,
        paddingTop: 20,
        alignItems: 'flex-end',
    },
    skipText: {
        color: '#64748b',
        fontSize: 16,
    },
    footer: {
        paddingHorizontal: 40,
        paddingBottom: 50,
    },
    indicatorContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 30,
    },
    dot: {
        height: 8,
        borderRadius: 4,
        marginHorizontal: 4,
    },
    button: {
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
