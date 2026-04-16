import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Image,
    ScrollView,
    Keyboard,
    TouchableWithoutFeedback
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase, SupabaseService } from '../services/SupabaseService';
import { FontAwesome5 } from '@expo/vector-icons';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming
} from 'react-native-reanimated';

export default function LoginScreen() {
    const navigation = useNavigation<any>();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);

    useEffect(() => {
        const showSubscription = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
        const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    // FLOATING ANIMATION LOGIC
    const translateY = useSharedValue(0);
    useEffect(() => {
        translateY.value = withRepeat(
            withTiming(-15, { duration: 2500 }),
            -1,
            true
        );
    }, []);

    const animatedLogoStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const logoScale = useSharedValue(1);

    useEffect(() => {
        logoScale.value = withTiming(isKeyboardVisible ? 0.6 : 1, { duration: 300 });
    }, [isKeyboardVisible]);

    const animatedLogoSizeStyle = useAnimatedStyle(() => ({
        width: 320 * logoScale.value,
        height: 192 * logoScale.value,
        opacity: withTiming(isKeyboardVisible ? 0.8 : 1),
    }));

    const handleLogin = async () => {
        if (!email || !password) return Alert.alert("Error", "Por favor ingresa email y contraseña.");

        setLoading(true);
        console.log('LOGIN_DEBUG: Attempting login for:', email);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            console.log('LOGIN_DEBUG: Response received. User:', data?.user?.id, 'Error:', error?.message);

            if (error) {
                Alert.alert("Error de acceso", error.message);
            } else {
                console.log('LOGIN_DEBUG: Login successful! Navigating should happen via AuthContext listener...');
            }
        } catch (err: any) {
            console.error('LOGIN_DEBUG: Fatal error during login:', err);
            Alert.alert("Error Fatal", err.message || "Ocurrió un error inesperado");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        console.log('UI_DEBUG: Google button pressed');
        try {
            setLoading(true);
            await SupabaseService.signInWithGoogle();
            console.log('UI_DEBUG: Google service call finished');
        } catch (error: any) {
            console.error('UI_DEBUG: Google Login Error:', error.message);
            Alert.alert("Error de acceso Google", error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAppleLogin = async () => {
        try {
            setLoading(true);
            await SupabaseService.signInWithApple();
        } catch (error: any) {
            Alert.alert("Error de acceso Apple", error.message);
        } finally {
            setLoading(false);
        }
    };

    const TO = TouchableOpacity as any;
    const Icon = Ionicons as any;
    const FA = FontAwesome5 as any;

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View className="flex-1 bg-[#0B1021]">
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 40}
                >
                    <ScrollView
                        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 40 }}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* LOGO AREA */}
                        <View className="items-center mb-10">
                            <Animated.View style={[animatedLogoStyle, animatedLogoSizeStyle]}>
                                <Image
                                    source={require('../../assets/logo.png')}
                                    style={{ width: '100%', height: '100%' }}
                                    resizeMode="contain"
                                />
                            </Animated.View>
                            <Text className="text-gray-500 text-sm tracking-widest uppercase mt-2 text-center">Strategic Mind Recorder</Text>
                        </View>
                        {/* INPUTS */}
                        <View className="space-y-4">
                            <View className="bg-[#151B33] rounded-xl border border-white/10 px-4 py-3 flex-row items-center">
                                <Icon name="mail-outline" size={20} color="#64748b" />
                                <TextInput
                                    placeholder="Email"
                                    placeholderTextColor="#64748b"
                                    className="flex-1 ml-3 text-white"
                                    autoCapitalize="none"
                                    value={email}
                                    onChangeText={setEmail}
                                />
                            </View>

                            <View className="bg-[#151B33] rounded-xl border border-white/10 px-4 py-3 flex-row items-center">
                                <Icon name="lock-closed-outline" size={20} color="#64748b" />
                                <TextInput
                                    placeholder="Contraseña"
                                    placeholderTextColor="#64748b"
                                    className="flex-1 ml-3 text-white"
                                    secureTextEntry
                                    value={password}
                                    onChangeText={setPassword}
                                />
                            </View>
                        </View>

                        <TO
                            onPress={() => navigation.navigate('ForgotPassword')}
                            className="mt-4 self-end"
                        >
                            <Text className="text-gray-400 text-sm">¿Olvidaste tu contraseña?</Text>
                        </TO>

                        {/* ACTION BUTTON */}
                        <TO
                            onPress={handleLogin}
                            disabled={loading}
                            className="bg-indigo-600 mt-8 py-4 rounded-xl items-center shadow-lg shadow-indigo-500/30"
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text className="text-white font-bold text-lg">Entrar a la Caja</Text>
                            )}
                        </TO>

                        {/* SOCIAL LOGINS */}
                        <View className="mt-8 flex-row items-center space-x-4">
                            <View className="flex-1 h-[1px] bg-white/10" />
                            <Text className="text-gray-500 text-xs uppercase font-bold tracking-widest">O continúa con</Text>
                            <View className="flex-1 h-[1px] bg-white/10" />
                        </View>

                        <View className="mt-6 flex-row space-x-4">
                            <TO
                                onPress={handleGoogleLogin}
                                className="flex-1 bg-white/5 border border-white/10 py-4 rounded-xl flex-row items-center justify-center space-x-3"
                            >
                                <FA name="google" size={18} color="white" />
                                <Text className="text-white font-semibold">Google</Text>
                            </TO>

                            <TO
                                onPress={handleAppleLogin}
                                className="flex-1 bg-white/5 border border-white/10 py-4 rounded-xl flex-row items-center justify-center space-x-3"
                            >
                                <FA name="apple" size={20} color="white" />
                                <Text className="text-white font-semibold">Apple</Text>
                            </TO>
                        </View>

                        {/* FOOTER */}
                        <View className="mt-6 items-center">
                            <TO onPress={() => navigation.navigate('SignUp')} className="mb-4">
                                <Text className="text-gray-400">
                                    ¿Nuevo aquí? <Text className="text-indigo-400 font-bold">Crear cuenta</Text>
                                </Text>
                            </TO>

                            <TO onPress={() => navigation.navigate('Terms')} className="opacity-60">
                                <Text className="text-gray-500 text-xs text-center px-4">
                                    Al continuar, aceptas nuestros{"\n"}
                                    <Text className="text-indigo-400 underline">Términos y Condiciones</Text>
                                </Text>
                            </TO>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </View>
        </TouchableWithoutFeedback>
    );
}
