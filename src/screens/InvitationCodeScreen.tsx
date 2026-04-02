import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { SupabaseService } from '../services/SupabaseService';
import { useAuth } from '../context/AuthContext';
import { ChevronLeft, Ticket, Sparkles } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const InvitationCodeScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { user, profile, refreshProfile } = useAuth();
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [sendingInvite, setSendingInvite] = useState(false);

    const handleSendInvite = async () => {
        if (!inviteEmail.trim() || !user || !inviteEmail.includes('@')) {
            Alert.alert('Error', 'Por favor ingresa un correo válido.');
            return;
        }

        setSendingInvite(true);
        try {
            await SupabaseService.createInvitation(inviteEmail.trim(), user.id);
            Alert.alert('¡Enviado!', `Se ha generado el código y enviado a ${inviteEmail}.`);
            setInviteEmail('');
        } catch (error) {
            console.error('SEND_INVITE_ERROR:', error);
            Alert.alert('Error', 'No se pudo generar la invitación.');
        } finally {
            setSendingInvite(false);
        }
    };
    const handleApplyCode = async () => {
        if (!code.trim()) {
            Alert.alert('Error', 'Por favor ingresa un código.');
            return;
        }

        if (!user) return;

        setLoading(true);
        try {
            const finalCode = `BB-${code.trim()}`.toUpperCase();
            const success = await SupabaseService.applyInvitationCode(user.id, finalCode);
            if (success) {
                await refreshProfile();
                Alert.alert(
                    '¡Éxito!',
                    'Código de invitación aplicado. Ahora eres usuario PRO.',
                    [{ text: 'Explorar Blackbox', onPress: () => navigation.navigate('Home') }]
                );
            } else {
                Alert.alert('Código Inválido', 'El código ingresado no es válido o ya ha sido utilizado.');
            }
        } catch (error) {
            console.error('INVITATION_CODE_ERROR:', error);
            Alert.alert('Error', 'Hubo un problema al validar el código.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <ChevronLeft size={28} color="#ffffff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>CÓDIGO DE INVITACIÓN</Text>
                    <View style={{ width: 28 }} />
                </View>

                <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
                    <View style={styles.content}>
                        <View style={styles.iconContainer}>
                            <Ticket size={80} color="#6366f1" />
                        </View>
                        
                        <Text style={styles.title}>Desbloquea tu potencial</Text>
                        <Text style={styles.subtitle}>
                            Ingresa el código que recibiste por correo o desde el portal blackboxmind.ai para activar tu suscripción PRO.
                        </Text>

                        <View style={styles.inputWrapper}>
                            <Text style={styles.prefix}>BB-</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="XXXXXX"
                                placeholderTextColor="#475569"
                                autoCapitalize="characters"
                                value={code}
                                onChangeText={setCode}
                            />
                        </View>

                        <TouchableOpacity 
                            style={[styles.applyButton, !code.trim() && styles.disabledButton]} 
                            onPress={handleApplyCode}
                            disabled={loading || !code.trim()}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <>
                                    <Sparkles size={20} color="white" style={{ marginRight: 10 }} />
                                    <Text style={styles.applyButtonText}>ACTIVAR SUSCRIPCIÓN PRO</Text>
                                </>
                            )}
                        </TouchableOpacity>
                        
                        <Text style={styles.footerText}>
                            ¿No tienes un código? Adquiere uno en blackboxmind.ai
                        </Text>

                        {profile?.is_pro && (
                            <View style={styles.adminSection}>
                                <View style={styles.separator} />
                                <Text style={styles.adminTitle}>ENVIAR INVITACIÓN (PRO)</Text>
                                <Text style={styles.adminSubtitle}>Como usuario PRO, puedes invitar a otros enviándoles un código por email.</Text>
                                
                                <View style={styles.inputWrapper}>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="correo@ejemplo.com"
                                        placeholderTextColor="#475569"
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        value={inviteEmail}
                                        onChangeText={setInviteEmail}
                                    />
                                </View>

                                <TouchableOpacity 
                                    style={[styles.applyButton, { backgroundColor: '#10b981' }, (!inviteEmail.trim() || sendingInvite) && styles.disabledButton]} 
                                    onPress={handleSendInvite}
                                    disabled={sendingInvite || !inviteEmail.trim()}
                                >
                                    {sendingInvite ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <Text style={styles.applyButtonText}>GENERAR Y ENVIAR</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#020617' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 10,
    },
    backButton: { padding: 8 },
    headerTitle: { color: 'white', fontSize: 14, fontWeight: 'bold', letterSpacing: 1.5 },
    content: {
        flex: 1,
        paddingHorizontal: 30,
        paddingTop: 40,
        alignItems: 'center',
    },
    iconContainer: {
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 30,
    },
    title: { color: 'white', fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
    subtitle: { color: '#94a3b8', fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 40 },
    inputWrapper: {
        width: '100%',
        backgroundColor: '#1e293b',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        marginBottom: 24,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20
    },
    prefix: {
        color: '#6366f1',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 2,
    },
    input: {
        flex: 1,
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        paddingVertical: 18,
        paddingLeft: 5,
        textAlign: 'left',
        letterSpacing: 2,
    },
    applyButton: {
        width: '100%',
        height: 56,
        backgroundColor: '#6366f1',
        borderRadius: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#6366f1",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    disabledButton: { backgroundColor: '#334155', elevation: 0 },
    applyButtonText: { color: 'white', fontSize: 15, fontWeight: 'bold' },
    footerText: { color: '#475569', fontSize: 13, marginTop: 40, textAlign: 'center' },
    adminSection: { marginTop: 40, width: '100%' },
    separator: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 30, width: '100%' },
    adminTitle: { color: '#10b981', fontSize: 13, fontWeight: '900', textAlign: 'center', letterSpacing: 2, marginBottom: 10 },
    adminSubtitle: { color: '#64748b', fontSize: 12, textAlign: 'center', marginBottom: 20, paddingHorizontal: 10 }
});

export default InvitationCodeScreen;
