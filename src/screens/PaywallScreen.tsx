import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Brain, ShieldCheck, Zap, TrendingUp, ChevronLeft, Crown } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Purchases from 'react-native-purchases';

const PaywallScreen = () => {
    const navigation = useNavigation();
    const [loading, setLoading] = useState(false);

    const handlePurchase = async () => {
        try {
            setLoading(true);
            // RevenueCat Logic
            const offerings = await Purchases.getOfferings();
            if (offerings.current !== null && offerings.current.availablePackages.length !== 0) {
                // For this example we pick the first available package
                const { customerInfo } = await Purchases.purchasePackage(offerings.current.availablePackages[0]);
                if (customerInfo.entitlements.active['pro'] !== undefined) {
                    Alert.alert("Éxito", "Ahora eres usuario PRO.");
                    navigation.goBack();
                }
            }
        } catch (e: any) {
            if (!e.userCancelled) {
                Alert.alert("Error", e.message || "Ocurrió un error en la compra.");
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
                Alert.alert("Éxito", "Suscripción restaurada.");
                navigation.goBack();
            } else {
                Alert.alert("Info", "No se encontraron suscripciones activas.");
            }
        } catch (e: any) {
            Alert.alert("Error", e.message || "Error al restaurar.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-[#0B1021]">
            <StatusBar barStyle="light-content" />
            
            <ScrollView className="flex-1 px-6">
                {/* Header */}
                <View className="flex-row items-center justify-between mt-4">
                    <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
                        <ChevronLeft color="#94a3b8" size={24} />
                    </TouchableOpacity>
                    <Crown color="#facc15" size={24} />
                </View>

                {/* Main Hero */}
                <View className="items-center mt-10">
                    <View className="bg-[#6366f1]/20 p-6 rounded-full border border-[#6366f1]/30">
                        <Brain size={80} color="#6366f1" />
                    </View>
                    <Text className="text-white text-3xl font-bold mt-8 text-center">
                        Auditoría Cognitiva Ilimitada
                    </Text>
                    <Text className="text-[#94a3b8] text-center mt-4 text-base leading-6 px-4">
                        Has desbloqueado el potencial básico. Hazte PRO para dominar tu ejecución táctica sin restricciones.
                    </Text>
                </View>

                {/* Benefits List */}
                <View className="mt-12 space-y-6">
                    <View className="flex-row items-start space-x-4">
                        <View className="bg-[#6366f1]/10 p-2 rounded-lg">
                            <Zap size={20} color="#6366f1" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-white font-bold text-lg">1. Detección de puntos ciegos sin límite</Text>
                            <Text className="text-[#64748b] mt-1">Sube tantas grabaciones como necesites. Sin cuotas.</Text>
                        </View>
                    </View>

                    <View className="flex-row items-start space-x-4">
                        <View className="bg-[#22c55e]/10 p-2 rounded-lg">
                            <TrendingUp size={20} color="#22c55e" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-white font-bold text-lg">2. Reportes estratégicos semanales</Text>
                            <Text className="text-[#64748b] mt-1">Análisis profundo de tus metas y loops de rendimiento.</Text>
                        </View>
                    </View>

                    <View className="flex-row items-start space-x-4">
                        <View className="bg-[#38bdf8]/10 p-2 rounded-lg">
                            <ShieldCheck size={20} color="#38bdf8" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-white font-bold text-lg">3. Zero fricción operativa</Text>
                            <Text className="text-[#64748b] mt-1">Sincronización instantánea y prioridad en procesamiento IA.</Text>
                        </View>
                    </View>
                </View>

                {/* Footer / Action */}
                <View className="mt-16 mb-10">
                    <TouchableOpacity 
                        onPress={handlePurchase}
                        disabled={loading}
                        className="overflow-hidden rounded-2xl"
                    >
                        <LinearGradient
                            colors={['#6366f1', '#4f46e5']}
                            start={{x: 0, y: 0}}
                            end={{x: 1, y: 0}}
                            className="py-5 items-center flex-row justify-center space-x-3"
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <>
                                    <Text className="text-white font-black text-lg uppercase tracking-tight">
                                        Desbloquear Arsenal Táctico
                                    </Text>
                                    <Text className="text-white/80 font-bold text-base">
                                        - $29.99/mes
                                    </Text>
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        onPress={restorePurchases} 
                        className="mt-6 items-center"
                    >
                        <Text className="text-[#64748b] font-medium text-sm">
                            Restaurar Compras
                        </Text>
                    </TouchableOpacity>

                    <Text className="text-[#475569] text-[10px] text-center mt-8 px-6">
                        Al suscribirte, aceptas nuestros Términos de Servicio y Política de Privacidad. La suscripción se renueva automáticamente.
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default PaywallScreen;
