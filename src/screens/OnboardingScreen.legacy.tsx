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
import { Brain, TrendingUp, Shield, Zap, LayoutDashboard, Check } from 'lucide-react-native';
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
        title: 'BIENVENIDO A BLACKBOX',
        subtitle: 'Tu Coach de Alto Rendimiento',
        description: 'BLACKBOX no es un diario; es un motor de ejecución clínica para mentes que no se detienen.',
        icon: <Brain size={120} color="#6366f1" />,
        color: '#6366f1'
    },
    {
        id: '2',
        title: 'PASO 1: CAPTURA',
        subtitle: 'Vacía tu mente al instante',
        description: 'Usa el botón "QuickCapture" o el icono del Micrófono. Habla sin filtros. BLACKBOX extraerá lo esencial.',
        icon: <Zap size={120} color="#c084fc" />,
        color: '#c084fc'
    },
    {
        id: '3',
        title: 'PASO 2: ANÁLISIS',
        subtitle: 'Auditoría Cognitiva',
        description: 'La IA analizará tus sesgos, generará un plan de ataque y extraerá "Active Loops" para que nada se pierda.',
        icon: <Shield size={120} color="#38bdf8" />,
        color: '#38bdf8'
    },
    {
        id: '4',
        title: 'PASO 3: LOOPS',
        subtitle: 'Cierra el Ciclo Ejecutivo',
        description: 'Gestiona tus tareas en el Centro Estratégico. Lo que no marcas como verde, BLACKBOX lo perseguirá con alertas de 72h.',
        icon: <TrendingUp size={120} color="#22c55e" />,
        color: '#22c55e'
    },
    {
        id: '5',
        title: 'PASO 4: CONSULTA',
        subtitle: 'Profundiza en el Chat',
        description: 'Entra al Chat Hub para debatir estrategias, debugear ideas o pedir planes de wellness con tu coach de IA.',
        icon: <LayoutDashboard size={120} color="#facc15" />,
        color: '#facc15'
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
    const [dontShowAgain, setDontShowAgain] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const scrollX = useSharedValue(0);

    const handleComplete = async () => {
        try {
            if (dontShowAgain) {
                await AsyncStorage.setItem('HIDE_GUIDE', 'true');
            }
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
                {item.subtitle && <Text style={styles.subtitle}>{item.subtitle}</Text>}
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

                {/* DON'T SHOW AGAIN CHECKBOX */}
                <TO
                    style={styles.checkboxRow}
                    onPress={() => setDontShowAgain(!dontShowAgain)}
                >
                    <View style={[styles.checkbox, dontShowAgain && styles.checkboxActive]}>
                        {dontShowAgain && <Check size={14} color="white" />}
                    </View>
                    <Text style={styles.checkboxLabel}>No volver a mostrar esta guía</Text>
                </TO>

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
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#6366f1',
        textAlign: 'center',
        marginBottom: 20,
        letterSpacing: 2,
        textTransform: 'uppercase',
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
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        gap: 10
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#6366f1',
        justifyContent: 'center',
        alignItems: 'center'
    },
    checkboxActive: {
        backgroundColor: '#6366f1'
    },
    checkboxLabel: {
        color: '#94a3b8',
        fontSize: 14,
        fontWeight: '500'
    }
});
