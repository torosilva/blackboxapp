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
import { supabase } from '../../services/SupabaseService';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming
} from 'react-native-reanimated';

export default function SignUpScreen() {
    const navigation = useNavigation<any>();
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
                        <TO
                            onPress={() => navigation.goBack()}
                            style={{ position: 'absolute', top: 50, left: 24, zIndex: 10 }}
                            className="w-10 h-10 bg-white/5 rounded-full items-center justify-center"
                        >
                            <Icon name="arrow-back" size={24} color="white" />
                        </TO>

                        <View className="items-center mb-10 pt-16">
                            <Animated.View style={[animatedLogoStyle, animatedLogoSizeStyle]}>
                                <Image
                                    source={require('../../../assets/logo.png')}
                                    style={{ width: '100%', height: '100%' }}
                                    resizeMode="contain"
                                />
                            </Animated.View>
                            <Text className="text-gray-500 text-xs tracking-widest uppercase mt-2 text-center">Strategic Mind Recorder</Text>
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
                                    placeholder="Contraseña segura"
                                    placeholderTextColor="#64748b"
                                    className="flex-1 ml-3 text-white"
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
                                className={`w-6 h-6 rounded-md border items-center justify-center ${privacyAccepted ? 'bg-indigo-600 border-indigo-600' : 'bg-white/5 border-white/20'}`}
                            >
                                {privacyAccepted && <Icon name="checkmark" size={16} color="white" />}
                            </TO>
                            <TO
                                onPress={() => navigation.navigate('Privacy')}
                                className="ml-3 flex-1"
                            >
                                <Text className="text-gray-400 text-xs leading-5">
                                    He leído y acepto el <Text className="text-indigo-400 underline">Aviso de Privacidad Integral</Text> y el tratamiento de mis datos sensibles.
                                </Text>
                            </TO>
                        </View>

                        {/* ACTION BUTTON */}
                        <TO
                            onPress={handleSignUp}
                            disabled={loading || !privacyAccepted}
                            className={`mt-8 py-4 rounded-xl items-center ${loading || !privacyAccepted ? 'bg-white/20' : 'bg-white'}`}
                        >
                            {loading ? <ActivityIndicator color="black" /> : <Text className={`font-bold text-lg ${loading || !privacyAccepted ? 'text-gray-500' : 'text-black'}`}>Registrarme</Text>}
                        </TO>
                        {/* FOOTER */}
                        <TO onPress={() => navigation.navigate('Terms')} className="mt-8 opacity-60">
                            <Text style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', paddingHorizontal: 24 }}>
                                Al registrarte, reconoces haber leído y aceptado nuestros{"\n"}
                                <Text className="text-indigo-400 underline">Términos y Condiciones</Text>
                            </Text>
                        </TO>
                    </ScrollView>
                </KeyboardAvoidingView>
            </View>
        </TouchableWithoutFeedback>
    );
}
