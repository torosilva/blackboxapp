import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldCheck, Fingerprint } from 'lucide-react-native';
import { BioAuthService } from '../services/BioAuthService';

interface LockScreenProps {
    onUnlock: () => void;
}

const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAuth = async () => {
        setLoading(true);
        setError(null);
        try {
            const isAvailable = await BioAuthService.isAvailableAsync();
            if (!isAvailable) {
                // If no biometrics, just unlock (or we could fallback to PIN in a real app)
                onUnlock();
                return;
            }

            const success = await BioAuthService.authenticateAsync();
            if (success) {
                onUnlock();
            } else {
                setError('Autenticación fallida. Intenta de nuevo.');
            }
        } catch (e) {
            setError('Error al acceder a la biometría.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        handleAuth();
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <ShieldCheck size={64} color="#6366f1" style={styles.icon} />
                <Text style={styles.title}>B L A C K B O X</Text>
                <Text style={styles.subtitle}>Tu diario está protegido</Text>

                {loading ? (
                    <ActivityIndicator size="large" color="#6366f1" style={styles.loader} />
                ) : (
                    <TouchableOpacity
                        style={styles.authButton}
                        onPress={handleAuth}
                        activeOpacity={0.8}
                    >
                        <Fingerprint size={24} color="white" />
                        <Text style={styles.authText}>Desbloquear con Biometría</Text>
                    </TouchableOpacity>
                )}

                {error && <Text style={styles.errorText}>{error}</Text>}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#020617', // Consistent with app theme
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
    authButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1e293b',
        paddingVertical: 15,
        paddingHorizontal: 30,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#334155',
    },
    authText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 10,
    },
    errorText: {
        color: '#ef4444',
        marginTop: 20,
        fontSize: 14,
    }
});

export default LockScreen;
