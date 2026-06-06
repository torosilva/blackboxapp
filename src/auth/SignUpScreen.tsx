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
import { supabase } from '../services/SupabaseService';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';

export default function SignUpScreen() {
    const navigation = useNavigation<any>();
    const { tokens } = useTheme();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [privacyAccepted, setPrivacyAccepted] = useState(false);
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

    const handleSignUp = async () => {
        if (!email || !password) return;

        const { data, error } = await supabase.auth.signUp({ email, password });
        setLoading(false);

        if (error) {
            Alert.alert("Error", error.message);
        } else {
            // Note: In a real app with confirmed email, we might do this via Edge Function
            // or handle it after the user confirms. For now, we'll navigate.
            Alert.alert(
                "Cuenta Creada",
                "Por favor verifica tu correo electrónico para confirmar tu cuenta."
            );
            navigation.navigate('Login');
        }
    };

    const TO = TouchableOpacity as any;
    const Icon = Ionicons as any;

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
                        <TO
                            onPress={() => navigation.goBack()}
                            style={{ position: 'absolute', top: 50, left: 24, zIndex: 10, backgroundColor: tokens.bg.scrim }}
                            className="w-10 h-10 rounded-full items-center justify-center"
                        >
                            <Icon name="arrow-back" size={24} color={tokens.text.primary} />
                        </TO>

                        <View className="items-center mb-10 pt-16">
                            <Animated.View style={[animatedLogoStyle, animatedLogoSizeStyle]}>
                                <Image
                                    source={require('../../assets/logo.png')}
                                    style={{ width: '100%', height: '100%' }}
                                    resizeMode="contain"
                                />
                            </Animated.View>
                            <Text className="text-xs tracking-widest uppercase mt-2 text-center" style={{ color: tokens.text.muted }}>Strategic Mind Recorder</Text>
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
                                    placeholder="Contraseña segura"
                                    placeholderTextColor={tokens.text.muted}
                                    className="flex-1 ml-3"
                                    style={{ color: tokens.text.primary }}
                                    secureTextEntry
                                    value={password}
                                    onChangeText={setPassword}
                                />
                            </View>
                        </View>

                        {/* PRIVACY CONSENT */}
                        <View className="mt-6 flex-row items-center px-2">
                            <TO
                                onPress={() => setPrivacyAccepted(!privacyAccepted)}
                                className="w-6 h-6 rounded-md items-center justify-center"
                                style={{
                                    backgroundColor: privacyAccepted ? tokens.accent.indigoStrong : tokens.bg.scrim,
                                    borderWidth: 1,
                                    borderColor: privacyAccepted ? tokens.accent.indigoStrong : tokens.border.strong,
                                }}
                            >
                                {privacyAccepted && <Icon name="checkmark" size={16} color={tokens.text.onAccent} />}
                            </TO>
                            <TO
                                onPress={() => navigation.navigate('Privacy')}
                                className="ml-3 flex-1"
                            >
                                <Text className="text-xs leading-5" style={{ color: tokens.text.muted }}>
                                    He leído y acepto el <Text className="underline" style={{ color: tokens.text.link }}>Aviso de Privacidad Integral</Text> y el tratamiento de mis datos sensibles.
                                </Text>
                            </TO>
                        </View>

                        {/* ACTION BUTTON */}
                        <TO
                            onPress={handleSignUp}
                            disabled={loading || !privacyAccepted}
                            className="mt-8 py-4 rounded-xl items-center"
                            style={{ backgroundColor: loading || !privacyAccepted ? tokens.border.subtle : tokens.bg.inputInverted }}
                        >
                            {loading ? (
                                <ActivityIndicator color={tokens.text.onInverted} />
                            ) : (
                                <Text className="font-bold text-lg" style={{ color: loading || !privacyAccepted ? tokens.text.disabled : tokens.text.onInverted }}>Registrarme</Text>
                            )}
                        </TO>
                        {/* FOOTER */}
                        <TO onPress={() => navigation.navigate('Terms')} className="mt-8 opacity-60">
                            <Text style={{ color: tokens.text.muted, fontSize: 12, textAlign: 'center', paddingHorizontal: 24 }}>
                                Al registrarte, reconoces haber leído y aceptado nuestros{"\n"}
                                <Text className="underline" style={{ color: tokens.text.link }}>Términos y Condiciones</Text>
                            </Text>
                        </TO>
                    </ScrollView>
                </KeyboardAvoidingView>
            </View>
        </TouchableWithoutFeedback>
    );
}
