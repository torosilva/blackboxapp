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
import { useTheme } from '../theme/ThemeContext';

export default function LoginScreen() {
    const navigation = useNavigation<any>();
    const { tokens } = useTheme();
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

    const TO = TouchableOpacity as any;
    const Icon = Ionicons as any;
    const FA = FontAwesome5 as any;

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View className="flex-1" style={{ backgroundColor: tokens.bg.page }}>
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
                            <Text className="text-sm tracking-widest uppercase mt-2 text-center" style={{ color: tokens.text.muted }}>Strategic Mind Recorder</Text>
                        </View>
                        {/* INPUTS */}
                        <View className="space-y-4">
                            <View className="rounded-xl px-4 py-3 flex-row items-center" style={{ backgroundColor: tokens.bg.card, borderWidth: 1, borderColor: tokens.border.subtle }}>
                                <Icon name="mail-outline" size={20} color={tokens.text.muted} />
                                <TextInput
                                    placeholder="Email"
                                    placeholderTextColor={tokens.text.muted}
                                    className="flex-1 ml-3"
                                    style={{ color: tokens.text.primary }}
                                    autoCapitalize="none"
                                    value={email}
                                    onChangeText={setEmail}
                                />
                            </View>

                            <View className="rounded-xl px-4 py-3 flex-row items-center" style={{ backgroundColor: tokens.bg.card, borderWidth: 1, borderColor: tokens.border.subtle }}>
                                <Icon name="lock-closed-outline" size={20} color={tokens.text.muted} />
                                <TextInput
                                    placeholder="Contraseña"
                                    placeholderTextColor={tokens.text.muted}
                                    className="flex-1 ml-3"
                                    style={{ color: tokens.text.primary }}
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
                            <Text className="text-sm" style={{ color: tokens.text.muted }}>¿Olvidaste tu contraseña?</Text>
                        </TO>

                        {/* ACTION BUTTON */}
                        <TO
                            onPress={handleLogin}
                            disabled={loading}
                            className="mt-8 py-4 rounded-xl items-center shadow-lg"
                            style={{ backgroundColor: tokens.accent.indigoStrong }}
                        >
                            {loading ? (
                                <ActivityIndicator color={tokens.text.onAccent} />
                            ) : (
                                <Text className="font-bold text-lg" style={{ color: tokens.text.onAccent }}>Entrar a la Caja</Text>
                            )}
                        </TO>

                        {/* SOCIAL LOGINS */}
                        <View className="mt-8 flex-row items-center space-x-4">
                            <View className="flex-1 h-[1px]" style={{ backgroundColor: tokens.border.subtle }} />
                            <Text className="text-xs uppercase font-bold tracking-widest" style={{ color: tokens.text.muted }}>O continúa con</Text>
                            <View className="flex-1 h-[1px]" style={{ backgroundColor: tokens.border.subtle }} />
                        </View>

                        <View className="mt-6">
                            <TO
                                onPress={handleGoogleLogin}
                                disabled={loading}
                                className="py-4 rounded-xl flex-row items-center justify-center space-x-3"
                                style={{ backgroundColor: tokens.bg.scrim, borderWidth: 1, borderColor: tokens.border.subtle }}
                            >
                                <FA name="google" size={18} color={tokens.text.primary} />
                                <Text className="font-semibold" style={{ color: tokens.text.primary }}>Continuar con Google</Text>
                            </TO>
                        </View>

                        {/* FOOTER */}
                        <View className="mt-6 items-center">
                            <TO onPress={() => navigation.navigate('SignUp')} className="mb-4">
                                <Text style={{ color: tokens.text.muted }}>
                                    ¿Nuevo aquí? <Text className="font-bold" style={{ color: tokens.text.link }}>Crear cuenta</Text>
                                </Text>
                            </TO>

                            <TO onPress={() => navigation.navigate('Terms')} className="opacity-60">
                                <Text className="text-xs text-center px-4" style={{ color: tokens.text.muted }}>
                                    Al continuar, aceptas nuestros{"\n"}
                                    <Text className="underline" style={{ color: tokens.text.link }}>Términos y Condiciones</Text>
                                </Text>
                            </TO>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </View>
        </TouchableWithoutFeedback>
    );
}
