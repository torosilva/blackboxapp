import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    Dimensions,
    StyleSheet,
    Image,
    SafeAreaView,
    StatusBar
} from 'react-native';
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
        title: 'Tu Bóveda Estratégica',
        description: 'Tus pensamientos, grabaciones y datos están seguros bajo llave en la BLACKBOX.',
        icon: 'shield-checkmark-outline',
        color: '#6366f1',
        isLucide: false
    },
    {
        id: '2',
        title: 'Procesamiento IA',
        description: 'Gemini analiza cada palabra para extraer insights y patrones estratégicos ocultos.',
        icon: 'brain',
        color: '#c084fc',
        isLucide: true
    },
    {
        id: '3',
        title: 'Línea de Tiempo Mental',
        description: 'Visualiza tu progreso emocional y trayectoria cognitiva a través de visualizaciones inteligentes.',
        icon: 'trending-up',
        color: '#22d3ee',
        isLucide: true
    },
    {
        id: '4',
        title: 'Hábitos de Rendimiento',
        description: 'Convertimos tus reflexiones en acciones concretas para tu crecimiento y enfoque constante.',
        icon: 'zap',
        color: '#facc15',
        isLucide: true
    },
    {
        id: '5',
        title: 'Active Loops',
        description: 'Transforma ideas en planes. Tip: Sé específico ("Debo", "Tengo que") para que la IA extraiga tareas con precisión.',
        icon: 'zap',
        color: '#38bdf8',
        isLucide: true
    },
];

const ONBOARDING_KEY = 'HAS_SEEN_ONBOARDING';

export default function OnboardingScreen() {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
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

    const renderItem = ({ item, index }: { item: typeof SLIDES[0], index: number }) => {
        return (
            <View style={styles.slide}>
                <View style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}>
                    {item.isLucide ? (
                        <View>
                            {index === 1 && <Brain size={100} color={item.color} />}
                            {index === 2 && <TrendingUp size={100} color={item.color} />}
                            {index === 3 && <Zap size={100} color={item.color} />}
                            {index === 4 && <Zap size={100} color={item.color} />}
                        </View>
                    ) : (
                        <Ionicons name={item.icon as any} size={100} color={item.color} />
                    )}
                </View>

                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.description}>{item.description}</Text>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            <View style={styles.skipContainer}>
                <TouchableOpacity onPress={handleComplete}>
                    <Text style={styles.skipText}>Saltar</Text>
                </TouchableOpacity>
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
                <TouchableOpacity
                    onPress={handleNext}
                    style={[styles.button, { backgroundColor: SLIDES[currentIndex]?.color || '#6366f1' }]}
                >
                    <Text style={styles.buttonText}>
                        {currentIndex === SLIDES.length - 1 ? 'Empezar' : 'Siguiente'}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
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
