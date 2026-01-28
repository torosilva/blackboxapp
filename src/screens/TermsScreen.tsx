import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Shield, ChevronLeft } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SupabaseService } from '../services/SupabaseService';
import { useAuth } from '../context/AuthContext';

const TermsScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { user, refreshProfile } = useAuth();

    const SAV = SafeAreaView as any;
    const TO = TouchableOpacity as any;
    const Sh = Shield as any;
    const CL = ChevronLeft as any;

    const [loading, setLoading] = useState(false);

    // If this screen is shown via the mandatory flow
    const isMandatory = route.params?.isMandatory || false;

    const handleAccept = async () => {
        if (!user) return;
        setLoading(true);
        try {
            await SupabaseService.acceptTerms(user.id);
            await refreshProfile(); // Ensure the app knows terms are accepted

            if (isMandatory) {
                // Just let the RootNavigator re-evaluate the stack
                // Navigation logic will handle the redirect
            } else {
                navigation.goBack();
            }
        } catch (error) {
            Alert.alert('Error', 'No se pudieron aceptar los términos. Intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SAV style={styles.container}>
            <View style={styles.header}>
                {!isMandatory && (
                    <TO onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <CL color="white" size={28} />
                    </TO>
                )}
                <View style={styles.titleContainer}>
                    <Sh size={20} color="#6366f1" />
                    <Text style={styles.headerTitle}>TÉRMINOS Y CONDICIONES</Text>
                </View>
                {!isMandatory && <View style={{ width: 44 }} />}
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
                <Text style={styles.lastUpdate}>Última actualización: 20 de Enero de 2026</Text>

                <Text style={styles.sectionTitle}>1. ACEPTACIÓN DE LOS TÉRMINOS</Text>
                <Text style={styles.bodyText}>
                    Al descargar, instalar, acceder o utilizar la aplicación móvil y plataforma web Blackbox Mind (en adelante, el "Servicio", la "App" o la "Plataforma"), propiedad de Macarena Group PS Mexico (quien opera bajo la marca comercial Blackboxmind.ai, en adelante, "La Compañía", "Nosotros" o "Nuestro"), usted (el "Usuario") reconoce haber leído, entendido y aceptado estar legalmente vinculado por estos Términos y Condiciones (el "Acuerdo").
                </Text>
                <Text style={[styles.bodyText, styles.bold]}>
                    SI USTED NO ACEPTA ESTOS TÉRMINOS EN SU TOTALIDAD, NO DEBE ACCEDER NI UTILIZAR EL SERVICIO.
                </Text>

                <Text style={styles.sectionTitle}>2. NATURALEZA DEL SERVICIO Y LIMITACIÓN DE ALCANCE (DISCLAIMER CRÍTICO)</Text>
                <Text style={styles.subSectionTitle}>2.1. Herramienta de Autogestión, No de Asesoramiento</Text>
                <Text style={styles.bodyText}>
                    El Usuario reconoce expresamente que el Servicio es una herramienta tecnológica de registro, procesamiento de datos y análisis de patrones lingüísticos mediante Inteligencia Artificial. El Servicio NO proporciona, ni pretende proporcionar: Asesoramiento Médico, Psicológico o Psiquiátrico; Asesoramiento Legal; Asesoramiento Financiero o de Inversión; Consultoría de Negocios Certificada.
                </Text>

                <Text style={styles.subSectionTitle}>2.2. Descargo de Responsabilidad de Inteligencia Artificial (Alucinaciones)</Text>
                <Text style={styles.bodyText}>
                    El Servicio utiliza Modelos de Lenguaje Grande (LLMs) de terceros (incluyendo, pero no limitado a, Google Gemini). El Usuario acepta que la IA es probabilística, no determinista. Puede generar información falsa, inexacta ("alucinaciones") o sesgada. La Compañía no garantiza la veracidad, exactitud o utilidad de los "Insights", "Action Items" o "Análisis de Sesgos" generados. Cualquier decisión tomada con base en la información provista por la App es bajo el exclusivo riesgo y responsabilidad del Usuario.
                </Text>

                <Text style={styles.subSectionTitle}>2.3. No es un Servicio de Salud o Emergencia</Text>
                <Text style={styles.bodyText}>
                    La funcionalidad de detección de "ánimo" o "sesgos" es meramente informativa y basada en texto. La App no tiene la capacidad de diagnosticar trastornos mentales ni de detectar situaciones de riesgo vital. En caso de emergencia médica o psicológica, el Usuario debe contactar a las autoridades locales inmediatamente. La Compañía se deslinda de cualquier responsabilidad por daños físicos, mentales o suicidio.
                </Text>

                <Text style={styles.sectionTitle}>3. CUENTAS Y SEGURIDAD</Text>
                <Text style={styles.bodyText}>
                    3.1. Registro: El Usuario garantiza que la información proporcionada es veraz.
                    3.2. Custodia de Credenciales: El Usuario es el único responsable de mantener la confidencialidad de su contraseña y cuenta.
                </Text>

                <Text style={styles.sectionTitle}>4. PROPIEDAD INTELECTUAL Y CONTENIDO DEL USUARIO</Text>
                <Text style={styles.bodyText}>
                    4.1. Propiedad de la Compañía: Todo el software, código fuente, algoritmos, interfaces visuales, marcas ("Blackbox Mind", "Blackboxmind.ai") son propiedad exclusiva de Macarena Group PS Mexico.
                    4.2. Contenido del Usuario: El Usuario conserva la propiedad de los audios y textos que sube, pero otorga a La Compañía una licencia mundial para procesar dicho contenido con el fin de prestar el Servicio.
                </Text>

                <Text style={styles.sectionTitle}>5. RESTRICCIONES DE USO</Text>
                <Text style={styles.bodyText}>
                    Está prohibido utilizar el Servicio para fines ilegales, intentar ingeniería inversa, desarrollar productos competidores o subir información confidencial de terceros.
                </Text>

                <Text style={styles.sectionTitle}>6. PAGOS, SUSCRIPCIONES Y REEMBOLSOS</Text>
                <Text style={styles.bodyText}>
                    Ciertas funciones requieren pago. Salvo lo exigido por la ley aplicable, todos los pagos son finales y no reembolsables.
                </Text>

                <Text style={styles.sectionTitle}>7. DISPONIBILIDAD Y FASE BETA</Text>
                <Text style={styles.bodyText}>
                    El Servicio se proporciona "TAL CUAL" y "SEGÚN DISPONIBILIDAD". La Compañía no garantiza un tiempo de actividad del 100% debido a dependencias de terceros.
                </Text>

                <Text style={styles.sectionTitle}>8. LIMITACIÓN DE RESPONSABILIDAD</Text>
                <Text style={styles.bodyText}>
                    LA COMPAÑÍA NO SERÁ RESPONSABLE POR DAÑOS INDIRECTOS O ESPECIALES. La responsabilidad total de La Compañía se limita a la cantidad pagada por el Usuario en los últimos 12 meses, o $1,000.00 MXN en servicios gratuitos.
                </Text>

                <Text style={styles.sectionTitle}>9. INDEMNIZACIÓN</Text>
                <Text style={styles.bodyText}>
                    El Usuario acepta defender e indemnizar a Macarena Group PS Mexico contra cualquier reclamo derivado de su uso del Servicio o violación de estos términos.
                </Text>

                <Text style={styles.sectionTitle}>10. MODIFICACIONES A LOS TÉRMINOS</Text>
                <Text style={styles.bodyText}>
                    Nos reservamos el derecho de modificar estos términos en cualquier momento. El uso continuado tras la notificación constituye la aceptación.
                </Text>

                <Text style={styles.sectionTitle}>11. LEY APLICABLE Y JURISDICCIÓN</Text>
                <Text style={styles.bodyText}>
                    Estos Términos se rigen por las leyes federales de México. Para cualquier disputa, las partes se someten a la jurisdicción de los tribunales competentes de la Ciudad de México.
                </Text>

                <View style={{ height: 40 }} />
            </ScrollView>

            {isMandatory && (
                <View style={styles.footer}>
                    <Text style={styles.footerNote}>Debes aceptar los términos para continuar.</Text>
                    <TO
                        style={[styles.acceptBtn, loading && styles.disabledBtn]}
                        onPress={handleAccept}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.acceptBtnText}>ACEPTO LOS TÉRMINOS Y CONDICIONES</Text>
                        )}
                    </TO>
                </View>
            )}
        </SAV>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#020617' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingTop: Platform.OS === 'ios' ? 10 : 15,
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
    subSectionTitle: { color: '#818cf8', fontWeight: '600', fontSize: 14, marginTop: 15, marginBottom: 5 },
    bodyText: { color: '#cbd5e1', fontSize: 14, lineHeight: 22, marginBottom: 10 },
    bold: { fontWeight: 'bold', color: 'white' },
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

export default TermsScreen;
