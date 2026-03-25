import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, KeyboardAvoidingView,
    Platform, ScrollView, TouchableWithoutFeedback, Keyboard
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SupabaseService } from '../services/SupabaseService';

export default function ForgotPasswordScreen() {
    const navigation = useNavigation<any>();
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
            <View style={{ flex: 1, backgroundColor: '#0B1021' }}>
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
                            <Icon name="arrow-back" size={24} color="white" />
                        </TO>

                        <View style={{ alignItems: 'center', marginBottom: 40 }}>
                            <View style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', padding: 20, borderRadius: 50, marginBottom: 20 }}>
                                <Icon name="lock-open-outline" size={40} color="#818cf8" />
                            </View>
                            <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold', textAlign: 'center' }}>
                                Recuperar Acceso
                            </Text>
                            <Text style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', marginTop: 10, paddingHorizontal: 20 }}>
                                {done 
                                    ? `Hemos enviado un enlace de recuperación a ${email}. Revisa tu bandeja de entrada.`
                                    : "Ingresa el correo asociado a tu cuenta para recibir un enlace de recuperación."
                                }
                            </Text>
                        </View>

                        {!done ? (
                            <View>
                                <View style={{ backgroundColor: '#151B33', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 56 }}>
                                    <Icon name="mail-outline" size={20} color="#64748b" />
                                    <TextInput
                                        placeholder="Email"
                                        placeholderTextColor="#64748b"
                                        style={{ flex: 1, color: 'white', marginLeft: 12 }}
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                        value={email}
                                        onChangeText={setEmail}
                                    />
                                </View>

                                <TO
                                    onPress={handleReset}
                                    disabled={loading}
                                    style={{ backgroundColor: '#6366f1', height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 24 }}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Enviar Enlace</Text>
                                    )}
                                </TO>
                            </View>
                        ) : (
                            <TO
                                onPress={() => navigation.navigate('Login')}
                                style={{ backgroundColor: 'rgba(255,255,255,0.05)', height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
                            >
                                <Text style={{ color: 'white', fontWeight: 'semibold' }}>Volver al Login</Text>
                            </TO>
                        )}
                    </ScrollView>
                </KeyboardAvoidingView>
            </View>
        </TouchableWithoutFeedback>
    );
}
