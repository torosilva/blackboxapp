import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ActivityIndicator, AppState, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldCheck, Fingerprint, KeyRound, LogOut } from 'lucide-react-native';
import { BioAuthService } from '../services/BioAuthService';

const MAX_ATTEMPTS = 5;

interface LockScreenProps {
    onUnlock: () => void;
    onSignOut?: () => void; // Emergency escape — sign out if biometrics are damaged/locked
}

const LockScreen: React.FC<LockScreenProps> = ({ onUnlock, onSignOut }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [attempts, setAttempts] = useState(0);
    const [biometricAvailable, setBiometricAvailable] = useState<boolean | null>(null);
    const appStateRef = useRef(AppState.currentState);

    // Pre-check biometric availability once on mount
    useEffect(() => {
        BioAuthService.isAvailableAsync().then(setBiometricAvailable);
    }, []);

    const handleAuth = async () => {
        if (loading) return;
        setLoading(true);
        setError(null);

        try {
            const isAvailable = await BioAuthService.isAvailableAsync();

            if (!isAvailable) {
                // No biometrics enrolled → unlock directly (device has no protection)
                onUnlock();
                return;
            }

            const success = await BioAuthService.authenticateAsync();

            if (success) {
                setAttempts(0);
                onUnlock();
            } else {
                const newAttempts = attempts + 1;
                setAttempts(newAttempts);

                if (newAttempts >= MAX_ATTEMPTS) {
                    // Too many failures — offer emergency escape options
                    Alert.alert(
                        'Demasiados intentos fallidos',
                        'FaceID no está reconociéndote. Puedes intentar con el código del dispositivo o cerrar sesión para recuperar acceso.',
                        [
                            {
                                text: 'Usar código del dispositivo',
                                onPress: () => {
                                    setAttempts(0);
                                    // Re-trigger with fallback enabled (iOS device PIN)
                                    BioAuthService.authenticateAsync('Usa el código de tu dispositivo para entrar');
                                },
                            },
                            {
                                text: 'Cerrar sesión',
                                style: 'destructive',
                                onPress: () => onSignOut?.(),
                            },
                            { text: 'Cancelar', style: 'cancel' },
                        ]
                    );
                } else {
                    const remaining = MAX_ATTEMPTS - newAttempts;
                    setError(
                        newAttempts >= 3
                            ? `Autenticación fallida. ${remaining} intento${remaining === 1 ? '' : 's'} restante${remaining === 1 ? '' : 's'}.`
                            : 'Autenticación fallida. Intenta de nuevo.'
                    );
                }
            }
        } catch (e: any) {
            console.error('LockScreen: auth error', e);
            setError('Error al acceder a la biometría.');
        } finally {
            setLoading(false);
        }
    };

    // Auto-trigger on mount and when app returns to foreground
    useEffect(() => {
        if (biometricAvailable === null) return; // wait for availability check

        const subscription = AppState.addEventListener('change', (nextState) => {
            if (appStateRef.current !== 'active' && nextState === 'active') {
                handleAuth();
            }
            appStateRef.current = nextState;
        });

        handleAuth();

        return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [biometricAvailable]);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <ShieldCheck size={64} color="#6366f1" style={styles.icon} />
                <Text style={styles.title}>B L A C K B O X</Text>
                <Text style={styles.subtitle}>Tu diario está protegido</Text>

                {loading ? (
                    <ActivityIndicator size="large" color="#6366f1" style={styles.loader} />
                ) : (
                    <View style={styles.actions}>
                        {/* Primary: biometric */}
                        <TouchableOpacity
                            style={styles.authButton}
                            onPress={handleAuth}
                            activeOpacity={0.8}
                        >
                            <Fingerprint size={24} color="white" />
                            <Text style={styles.authText}>Desbloquear con Biometría</Text>
                        </TouchableOpacity>

                        {/* Fallback: device PIN (only shown after 1st failure) */}
                        {attempts >= 1 && (
                            <TouchableOpacity
                                style={styles.fallbackButton}
                                onPress={() =>
                                    BioAuthService.authenticateAsync('Usa el código de tu dispositivo')
                                        .then((ok) => { if (ok) onUnlock(); })
                                }
                                activeOpacity={0.8}
                            >
                                <KeyRound size={18} color="#94a3b8" />
                                <Text style={styles.fallbackText}>Usar código del dispositivo</Text>
                            </TouchableOpacity>
                        )}

                        {/* Emergency: sign out (shown after 3+ failures) */}
                        {attempts >= 3 && onSignOut && (
                            <TouchableOpacity
                                style={styles.signOutButton}
                                onPress={() =>
                                    Alert.alert(
                                        'Cerrar sesión',
                                        'Se cerrará tu sesión. Podrás volver a entrar con tu correo y contraseña.',
                                        [
                                            { text: 'Cancelar', style: 'cancel' },
                                            { text: 'Cerrar sesión', style: 'destructive', onPress: onSignOut },
                                        ]
                                    )
                                }
                                activeOpacity={0.8}
                            >
                                <LogOut size={16} color="#ef4444" />
                                <Text style={styles.signOutText}>Cerrar sesión</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {error && (
                    <Text style={[
                        styles.errorText,
                        attempts >= MAX_ATTEMPTS - 1 && styles.errorTextCritical,
                    ]}>
                        {error}
                    </Text>
                )}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#020617',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    icon: {
        marginBottom: 20,
        opacity: 0.9,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: 'white',
        letterSpacing: 4,
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: '#94a3b8',
        marginBottom: 40,
    },
    loader: {
        marginTop: 20,
    },
    actions: {
        alignItems: 'center',
        gap: 12,
        width: '100%',
    },
    authButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1e293b',
        paddingVertical: 15,
        paddingHorizontal: 30,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#334155',
        width: '100%',
        justifyContent: 'center',
    },
    authText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 10,
    },
    fallbackButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#1e293b',
        width: '100%',
        justifyContent: 'center',
    },
    fallbackText: {
        color: '#94a3b8',
        fontSize: 14,
        marginLeft: 8,
    },
    signOutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 20,
        marginTop: 4,
    },
    signOutText: {
        color: '#ef4444',
        fontSize: 13,
        marginLeft: 6,
    },
    errorText: {
        color: '#f59e0b',
        marginTop: 20,
        fontSize: 14,
        textAlign: 'center',
    },
    errorTextCritical: {
        color: '#ef4444',
    },
});

export default LockScreen;
