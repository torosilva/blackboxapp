import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    ActivityIndicator,
    Alert,
    StatusBar,
    Platform
} from 'react-native';
import { Shield, ChevronLeft, Lock } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SupabaseService } from '../services/SupabaseService';
import { useAuth } from '../context/AuthContext';

const PrivacyScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { user, refreshProfile } = useAuth();
    const [loading, setLoading] = useState(false);

    // If this screen is shown via the mandatory flow
    const isMandatory = route.params?.isMandatory || false;

    const handleAccept = async () => {
        if (!user) return;
        setLoading(true);
        try {
            await SupabaseService.acceptPrivacy(user.id);
            await refreshProfile();

            if (isMandatory) {
                // Just let the RootNavigator re-evaluate the stack
            } else {
                navigation.goBack();
            }
        } catch (error) {
            Alert.alert('Error', 'No se pudo registrar tu consentimiento. Intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <View style={styles.header}>
                {!isMandatory && (
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <ChevronLeft color="white" size={28} />
                    </TouchableOpacity>
                )}
                <View style={styles.titleContainer}>
                    <Lock size={20} color="#6366f1" />
                    <Text style={styles.headerTitle}>AVISO DE PRIVACIDAD</Text>
                </View>
                {!isMandatory && <View style={{ width: 44 }} />}
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
                <Text style={styles.lastUpdate}>Última actualización: 20 de Enero de 2026</Text>

                <Text style={styles.bodyText}>
                    Macarena Group PS Mexico (en adelante, el "Responsable"), quien opera comercialmente bajo la marca "Blackbox Mind" o "Blackboxmind.ai", con domicilio ubicado en la Ciudad de México, México, es el responsable del uso, tratamiento y protección de sus datos personales, y al respecto le informa lo siguiente:
                </Text>

                <Text style={styles.sectionTitle}>1. ¿PARA QUÉ FINES UTILIZAREMOS SUS DATOS PERSONALES?</Text>
                <Text style={styles.bodyText}>
                    Los datos personales que recabamos de usted los utilizaremos para las siguientes finalidades que son necesarias para el servicio que solicita:
                </Text>
                <Text style={styles.subSectionTitle}>Finalidades Primarias (Esenciales):</Text>
                <Text style={styles.bulletItem}>• Creación y gestión de su cuenta de usuario y perfil.</Text>
                <Text style={styles.bulletItem}>• Procesamiento, transcripción y almacenamiento de grabaciones de voz.</Text>
                <Text style={styles.bulletItem}>• Análisis automatizado mediante Inteligencia Artificial para detectar patrones, sesgos y estados de ánimo.</Text>
                <Text style={styles.bulletItem}>• Generación de reportes de desempeño y recomendaciones estratégicas.</Text>
                <Text style={styles.bulletItem}>• Gestión de pagos y suscripciones.</Text>
                <Text style={styles.bulletItem}>• Atención al cliente y soporte técnico.</Text>

                <Text style={styles.subSectionTitle}>Finalidades Secundarias (Opcionales):</Text>
                <Text style={styles.bulletItem}>• Envío de boletines informativos y promociones de Blackbox Mind.</Text>
                <Text style={styles.bulletItem}>• Uso de datos anonimizados para el entrenamiento y mejora de nuestros algoritmos de IA.</Text>
                <Text style={styles.bulletItem}>• Estudios estadísticos y de mercado internos.</Text>

                <Text style={styles.sectionTitle}>2. ¿QUÉ DATOS PERSONALES RECABAMOS Y UTILIZAMOS?</Text>
                <Text style={styles.bodyText}>
                    Categorías de datos: Identificación (Nombre, correo, imagen), Contacto, y Datos Patrimoniales (procesados por terceros como Apple/Google).
                </Text>

                <View style={styles.warningBox}>
                    <Text style={styles.warningTitle}>DATOS PERSONALES SENSIBLES</Text>
                    <Text style={styles.warningText}>
                        Trataremos datos biométricos (vibraciones de voz) y datos sobre estados mentales y emocionales inferidos del análisis de sus audios y textos. El tratamiento se realiza bajo las más estrictas medidas de seguridad.
                    </Text>
                </View>

                <Text style={styles.sectionTitle}>3. TRANSFERENCIAS DE DATOS</Text>
                <Text style={styles.bodyText}>
                    Sus datos pueden ser compartidos con proveedores en la nube (ej. Supabase, Google Gemini API) con la finalidad exclusiva de alojar y procesar solicitudes de IA. Nosotros NO vendemos, rentamos ni comercializamos sus datos personales identificables.
                </Text>

                <Text style={styles.sectionTitle}>4. DERECHOS ARCO</Text>
                <Text style={styles.bodyText}>
                    Usted tiene derecho a conocer qué datos tenemos (Acceso), solicitar correcciones (Rectificación), que los eliminemos (Cancelación) u oponerse a su uso (Oposición). Para ejercerlos, contacte a: privacidad@blackboxmind.ai
                </Text>

                <Text style={styles.sectionTitle}>5. USO DE COOKIES</Text>
                <Text style={styles.bodyText}>
                    Utilizamos tecnologías para monitorear el comportamiento y brindar una mejor experiencia, incluyendo dirección IP y sistema operativo.
                </Text>

                <Text style={styles.sectionTitle}>6. CAMBIOS AL AVISO</Text>
                <Text style={styles.bodyText}>
                    Este aviso puede sufrir actualizaciones derivadas de requerimientos legales o necesidades propias. Le informaremos via App o correo electrónico.
                </Text>

                <View style={{ height: 40 }} />
            </ScrollView>

            {isMandatory && (
                <View style={styles.footer}>
                    <Text style={styles.footerNote}>Debes aceptar el Aviso de Privacidad para continuar.</Text>
                    <TouchableOpacity
                        style={[styles.acceptBtn, loading && styles.disabledBtn]}
                        onPress={handleAccept}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.acceptBtnText}>ACEPTO EL AVISO DE PRIVACIDAD</Text>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#020617' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 15 : 15,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderColor: '#1e293b'
    },
    titleContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' },
    headerTitle: { color: 'white', fontWeight: 'bold', fontSize: 13, letterSpacing: 2, marginLeft: 10 },
    backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    content: { flex: 1 },
    scrollContent: { padding: 20 },
    lastUpdate: { color: '#94a3b8', fontSize: 12, marginBottom: 20, fontStyle: 'italic' },
    sectionTitle: { color: 'white', fontWeight: 'bold', fontSize: 16, marginTop: 25, marginBottom: 10 },
    subSectionTitle: { color: '#818cf8', fontWeight: 'bold', fontSize: 14, marginTop: 15, marginBottom: 8 },
    bodyText: { color: '#cbd5e1', fontSize: 14, lineHeight: 22, marginBottom: 10 },
    bulletItem: { color: '#cbd5e1', fontSize: 14, lineHeight: 22, paddingLeft: 10, marginBottom: 4 },
    warningBox: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
        padding: 15,
        marginTop: 20,
        marginBottom: 10
    },
    warningTitle: { color: '#f87171', fontWeight: 'bold', fontSize: 14, marginBottom: 5 },
    warningText: { color: '#fca5a5', fontSize: 13, lineHeight: 20 },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        borderColor: '#1e293b',
        backgroundColor: '#0f172a'
    },
    footerNote: { color: '#94a3b8', fontSize: 12, textAlign: 'center', marginBottom: 15 },
    acceptBtn: {
        backgroundColor: '#6366f1',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center'
    },
    acceptBtnText: { color: 'white', fontWeight: 'bold', fontSize: 14, letterSpacing: 1 },
    disabledBtn: { opacity: 0.5 }
});

export default PrivacyScreen;
