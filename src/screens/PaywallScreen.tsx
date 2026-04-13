import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Brain, Mic, MessageSquare, TrendingUp, ChevronLeft, Crown, Check } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Purchases from 'react-native-purchases';

// Pricing
const MONTHLY_PRICE = 29.99;
const ANNUAL_PRICE = +(MONTHLY_PRICE * 12 * 0.85).toFixed(2); // 15% discount → $305.90
const ANNUAL_MONTHLY = +(ANNUAL_PRICE / 12).toFixed(2);       // ~$25.49/mo

const PaywallScreen = () => {
    const navigation = useNavigation<any>();
    const [loading, setLoading] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');

    const handlePurchase = async () => {
        try {
            setLoading(true);
            const offerings = await Purchases.getOfferings();
            if (offerings.current !== null && offerings.current.availablePackages.length !== 0) {
                // Pick package based on selected plan identifier
                const pkg = offerings.current.availablePackages.find(p =>
                    selectedPlan === 'annual'
                        ? p.packageType === 'ANNUAL'
                        : p.packageType === 'MONTHLY'
                ) || offerings.current.availablePackages[0];

                const { customerInfo } = await Purchases.purchasePackage(pkg);
                if (customerInfo.entitlements.active['pro'] !== undefined) {
                    Alert.alert('¡Bienvenido a PRO!', 'Tu acceso completo está activo.');
                    navigation.goBack();
                }
            }
        } catch (e: any) {
            if (!e.userCancelled) {
                Alert.alert('Error', e.message || 'Ocurrió un error en la compra.');
            }
        } finally {
            setLoading(false);
        }
    };

    const restorePurchases = async () => {
        try {
            setLoading(true);
            const customerInfo = await Purchases.restorePurchases();
            if (customerInfo.entitlements.active['pro'] !== undefined) {
                Alert.alert('Éxito', 'Suscripción restaurada.');
                navigation.goBack();
            } else {
                Alert.alert('Info', 'No se encontraron suscripciones activas.');
            }
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Error al restaurar.');
        } finally {
            setLoading(false);
        }
    };

    const features = [
        {
            icon: Brain,
            color: '#6366f1',
            title: 'Registros ilimitados',
            description: 'Sin límite mensual. Registra cuando quieras.',
        },
        {
            icon: MessageSquare,
            color: '#22c55e',
            title: 'Chat Estratégico BLACKBOX',
            description: 'Consultas ilimitadas con tu asesor de IA.',
        },
        {
            icon: TrendingUp,
            color: '#38bdf8',
            title: 'Reporte Semanal',
            description: 'Diagnóstico profundo de tus metas y rendimiento.',
        },
        {
            icon: Mic,
            color: '#a855f7',
            title: 'Grabación de voz',
            description: 'Transcripción automática con IA.',
        },
    ];

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0B1021' }}>
            <StatusBar barStyle="light-content" />

            <ScrollView style={{ flex: 1, paddingHorizontal: 24 }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
                        <ChevronLeft color="#94a3b8" size={24} />
                    </TouchableOpacity>
                    <Crown color="#facc15" size={24} />
                </View>

                {/* Hero */}
                <View style={{ alignItems: 'center', marginTop: 32, marginBottom: 40 }}>
                    <View style={{ backgroundColor: 'rgba(99,102,241,0.15)', padding: 24, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)', marginBottom: 24 }}>
                        <Brain size={72} color="#6366f1" />
                    </View>
                    <Text style={{ color: 'white', fontSize: 30, fontWeight: 'bold', textAlign: 'center', letterSpacing: 0.5 }}>
                        Desbloquea el Arsenal Táctico
                    </Text>
                    <Text style={{ color: '#94a3b8', textAlign: 'center', marginTop: 12, fontSize: 16, lineHeight: 24, paddingHorizontal: 16 }}>
                        Tienes el potencial básico. Hazte PRO para dominar tu ejecución sin restricciones.
                    </Text>
                </View>

                {/* Features */}
                <View style={{ gap: 20, marginBottom: 40 }}>
                    {features.map((f, i) => {
                        const Icon = f.icon as any;
                        return (
                            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}>
                                <View style={{ backgroundColor: `${f.color}18`, padding: 10, borderRadius: 14 }}>
                                    <Icon size={20} color={f.color} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16, marginBottom: 2 }}>{f.title}</Text>
                                    <Text style={{ color: '#64748b', fontSize: 14 }}>{f.description}</Text>
                                </View>
                                <Check size={18} color="#22c55e" style={{ marginTop: 2 }} />
                            </View>
                        );
                    })}
                </View>

                {/* Plan Selector */}
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                    {/* Annual — recommended */}
                    <TouchableOpacity
                        onPress={() => setSelectedPlan('annual')}
                        style={{
                            flex: 1, padding: 16, borderRadius: 20, borderWidth: 2,
                            borderColor: selectedPlan === 'annual' ? '#6366f1' : '#1e293b',
                            backgroundColor: selectedPlan === 'annual' ? 'rgba(99,102,241,0.1)' : '#0f172a',
                        }}
                    >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <Text style={{ color: selectedPlan === 'annual' ? '#818cf8' : '#475569', fontWeight: 'bold', fontSize: 12, letterSpacing: 1 }}>ANUAL</Text>
                            <View style={{ backgroundColor: '#22c55e', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 }}>
                                <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>-15%</Text>
                            </View>
                        </View>
                        <Text style={{ color: 'white', fontSize: 22, fontWeight: 'bold' }}>${ANNUAL_MONTHLY}<Text style={{ fontSize: 13, color: '#64748b' }}>/mes</Text></Text>
                        <Text style={{ color: '#475569', fontSize: 12, marginTop: 2 }}>${ANNUAL_PRICE} facturado anualmente</Text>
                    </TouchableOpacity>

                    {/* Monthly */}
                    <TouchableOpacity
                        onPress={() => setSelectedPlan('monthly')}
                        style={{
                            flex: 1, padding: 16, borderRadius: 20, borderWidth: 2,
                            borderColor: selectedPlan === 'monthly' ? '#6366f1' : '#1e293b',
                            backgroundColor: selectedPlan === 'monthly' ? 'rgba(99,102,241,0.1)' : '#0f172a',
                        }}
                    >
                        <Text style={{ color: selectedPlan === 'monthly' ? '#818cf8' : '#475569', fontWeight: 'bold', fontSize: 12, letterSpacing: 1, marginBottom: 4 }}>MENSUAL</Text>
                        <Text style={{ color: 'white', fontSize: 22, fontWeight: 'bold' }}>${MONTHLY_PRICE}<Text style={{ fontSize: 13, color: '#64748b' }}>/mes</Text></Text>
                        <Text style={{ color: '#475569', fontSize: 12, marginTop: 2 }}>Cancela cuando quieras</Text>
                    </TouchableOpacity>
                </View>

                {/* CTA */}
                <View style={{ marginBottom: 40, gap: 12 }}>
                    <TouchableOpacity
                        onPress={handlePurchase}
                        disabled={loading}
                        style={{ overflow: 'hidden', borderRadius: 20 }}
                    >
                        <LinearGradient
                            colors={['#6366f1', '#4f46e5']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{ paddingVertical: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 }}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <>
                                    <Crown size={18} color="white" />
                                    <Text style={{ color: 'white', fontWeight: 'black', fontSize: 17, letterSpacing: 0.5 }}>
                                        {selectedPlan === 'annual'
                                            ? `Activar PRO · $${ANNUAL_PRICE}/año`
                                            : `Activar PRO · $${MONTHLY_PRICE}/mes`}
                                    </Text>
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={restorePurchases} style={{ alignItems: 'center', paddingVertical: 8 }}>
                        <Text style={{ color: '#64748b', fontSize: 14 }}>Restaurar compras</Text>
                    </TouchableOpacity>

                    <Text style={{ color: '#334155', fontSize: 11, textAlign: 'center', lineHeight: 18 }}>
                        Al suscribirte aceptas nuestros Términos de Servicio y Política de Privacidad. La suscripción se renueva automáticamente. Cancela en cualquier momento desde la tienda de tu dispositivo.
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default PaywallScreen;
