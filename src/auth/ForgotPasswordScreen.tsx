import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, KeyboardAvoidingView,
    Platform, ScrollView, TouchableWithoutFeedback, Keyboard
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SupabaseService } from '../services/SupabaseService';
import { useTheme } from '../theme/ThemeContext';

export default function ForgotPasswordScreen() {
    const navigation = useNavigation<any>();
    const { tokens } = useTheme();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);

    const handleReset = async () => {
        if (!email) return Alert.alert("Error", "Ingresa tu correo.");

        setLoading(true);
        try {
            await SupabaseService.resetPassword(email);
            setDone(true);
        } catch (error: any) {
            Alert.alert("Error", error.message);
        } finally {
            setLoading(false);
        }
    };

    const TO = TouchableOpacity as any;
    const Icon = Ionicons as any;

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={{ flex: 1, backgroundColor: tokens.bg.page }}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    <ScrollView
                        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, justifyContent: 'center' }}
                        keyboardShouldPersistTaps="handled"
                    >
                        <TO
                            onPress={() => navigation.goBack()}
                            style={{ position: 'absolute', top: 50, left: 20, zIndex: 10, padding: 10 }}
                        >
                            <Icon name="arrow-back" size={24} color={tokens.text.primary} />
                        </TO>

                        <View style={{ alignItems: 'center', marginBottom: 40 }}>
                            <View style={{ backgroundColor: tokens.accent.indigoSoft, padding: 20, borderRadius: 50, marginBottom: 20 }}>
                                <Icon name="lock-open-outline" size={40} color={tokens.text.link} />
                            </View>
                            <Text style={{ color: tokens.text.primary, fontSize: 24, fontWeight: 'bold', textAlign: 'center' }}>
                                Recuperar Acceso
                            </Text>
                            <Text style={{ color: tokens.text.muted, fontSize: 14, textAlign: 'center', marginTop: 10, paddingHorizontal: 20 }}>
                                {done
                                    ? `Hemos enviado un enlace de recuperación a ${email}. Revisa tu bandeja de entrada.`
                                    : "Ingresa el correo asociado a tu cuenta para recibir un enlace de recuperación."
                                }
                            </Text>
                        </View>

                        {!done ? (
                            <View>
                                <View style={{ backgroundColor: tokens.bg.card, borderRadius: 12, borderWidth: 1, borderColor: tokens.border.subtle, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 56 }}>
                                    <Icon name="mail-outline" size={20} color={tokens.text.muted} />
                                    <TextInput
                                        placeholder="Email"
                                        placeholderTextColor={tokens.text.muted}
                                        style={{ flex: 1, color: tokens.text.primary, marginLeft: 12 }}
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                        value={email}
                                        onChangeText={setEmail}
                                    />
                                </View>

                                <TO
                                    onPress={handleReset}
                                    disabled={loading}
                                    style={{ backgroundColor: tokens.accent.indigo, height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 24 }}
                                >
                                    {loading ? (
                                        <ActivityIndicator color={tokens.text.onAccent} />
                                    ) : (
                                        <Text style={{ color: tokens.text.onAccent, fontWeight: 'bold', fontSize: 16 }}>Enviar Enlace</Text>
                                    )}
                                </TO>
                            </View>
                        ) : (
                            <TO
                                onPress={() => navigation.navigate('Login')}
                                style={{ backgroundColor: tokens.bg.scrim, height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: tokens.border.subtle }}
                            >
                                <Text style={{ color: tokens.text.primary, fontWeight: 'semibold' }}>Volver al Login</Text>
                            </TO>
                        )}
                    </ScrollView>
                </KeyboardAvoidingView>
            </View>
        </TouchableWithoutFeedback>
    );
}
