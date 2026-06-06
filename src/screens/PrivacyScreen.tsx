import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    StatusBar,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Shield, ChevronLeft, Lock, Award, Download } from 'lucide-react-native';
import { useNavigation, NavigationRouteContext } from '@react-navigation/native';
import { SupabaseService } from '../services/SupabaseService';
import { useAuth } from '../context/AuthContext';
import { generateAndSharePrivacyPact, generateCertId } from '../utils/generatePrivacyPact';
import { useTheme } from '../theme/ThemeContext';
import { ThemeTokens } from '../theme/tokens';

const PrivacyScreen = ({ isMandatory: propIsMandatory }: { isMandatory?: boolean }) => {
    const navigation = useNavigation<any>();
    const route: any = React.useContext(NavigationRouteContext);
    const { user, profile, refreshProfile } = useAuth();
    const { tokens } = useTheme();
    const styles = useMemo(() => makeStyles(tokens), [tokens]);

    const SAV = SafeAreaView as any;
    const TO = TouchableOpacity as any;
    const Sh = Shield as any;
    const CL = ChevronLeft as any;
    const L = Lock as any;
    const Aw = Award as any;
    const Dl = Download as any;

    const userName = profile?.full_name || user?.email?.split('@')[0] || 'Usuario';
    const userEmail = user?.email || '';
    const issueDate = new Date();
    const certId = user?.id ? generateCertId(user.id, issueDate) : 'BBM-PENDING';
    const formattedDate = issueDate.toLocaleDateString('es-MX', {
        day: 'numeric', month: 'long', year: 'numeric',
    });

    const [downloadingPact, setDownloadingPact] = useState(false);

    const handleDownloadPact = async () => {
        if (!user?.id) {
            Alert.alert('Inicia sesión', 'Necesitas estar autenticado para descargar tu certificado.');
            return;
        }
        setDownloadingPact(true);
        try {
            await generateAndSharePrivacyPact({
                userId: user.id,
                userEmail,
                userName,
                issueDate,
            });
        } catch (e) {
            Alert.alert('Error', 'No se pudo generar el certificado. Intenta de nuevo.');
        } finally {
            setDownloadingPact(false);
        }
    };

    const [loading, setLoading] = useState(false);

    // If this screen is shown via the mandatory flow
    const isMandatory = propIsMandatory || route?.params?.isMandatory || false;

    const handleAccept = async () => {
        const email = user?.email || `user_${user?.id}@placeholder.com`;
        if (!user) return;
        setLoading(true);
        try {
            await SupabaseService.acceptPrivacy(user.id, email);
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
        <SAV style={styles.container}>
            <StatusBar barStyle={tokens.statusBar} translucent backgroundColor="transparent" />

            <View style={styles.header}>
                {!isMandatory && (
                    <TO onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <CL color={tokens.text.primary} size={28} />
                    </TO>
                )}
                <View style={styles.titleContainer}>
                    <L size={20} color={tokens.accent.indigo} />
                    <Text style={styles.headerTitle}>AVISO DE PRIVACIDAD</Text>
                </View>
                {!isMandatory && <View style={{ width: 44 }} />}
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
                <View style={styles.certCard}>
                    <View style={styles.certHeader}>
                        <View style={styles.certBrandRow}>
                            <Aw size={14} color={tokens.accent.purple} />
                            <Text style={styles.certBrandText}>BLACKBOXMIND.AI</Text>
                        </View>
                        <View style={styles.certStatusPill}>
                            <View style={styles.certStatusDot} />
                            <Text style={styles.certStatusText}>ACTIVO</Text>
                        </View>
                    </View>

                    <Text style={styles.certTitle}>Certificado de Privacidad</Text>
                    <Text style={styles.certSubtitle}>Personal e individual</Text>

                    <View style={styles.certDivider} />

                    <Text style={styles.certRecipientLabel}>EMITIDO A NOMBRE DE</Text>
                    <Text style={styles.certRecipientName} numberOfLines={2}>{userName}</Text>
                    {!!userEmail && (
                        <Text style={styles.certRecipientEmail} numberOfLines={1}>{userEmail}</Text>
                    )}

                    <View style={styles.certMetaRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.certMetaLabel}>ID DEL CERTIFICADO</Text>
                            <Text style={styles.certMetaValue} numberOfLines={1}>{certId}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.certMetaLabel}>EMITIDO</Text>
                            <Text style={styles.certMetaValue} numberOfLines={1}>{formattedDate}</Text>
                        </View>
                    </View>

                    <TO
                        style={[styles.certBtn, downloadingPact && styles.certBtnDisabled]}
                        onPress={handleDownloadPact}
                        disabled={downloadingPact}
                    >
                        {downloadingPact ? (
                            <ActivityIndicator color={tokens.text.onAccent} size="small" />
                        ) : (
                            <>
                                <Dl size={16} color={tokens.text.onAccent} />
                                <Text style={styles.certBtnText}>Descargar PDF oficial</Text>
                            </>
                        )}
                    </TO>

                    <Text style={styles.certFooterNote}>
                        El PDF incluye los 6 compromisos detallados, firmado por Macarena Group PS Mexico.
                    </Text>
                </View>

                <View style={styles.humanSection}>
                    <View style={styles.humanHeader}>
                        <L size={18} color={tokens.accent.purple} />
                        <Text style={styles.humanTitle}>TU PRIVACIDAD EN 60 SEGUNDOS</Text>
                    </View>
                    <Text style={styles.humanSub}>
                        El detalle legal está abajo. Esto es lo que importa.
                    </Text>

                    <View style={styles.humanItem}>
                        <Text style={styles.humanItemNum}>01</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.humanItemTitle}>Sin acceso del equipo al contenido de tus entries.</Text>
                            <Text style={styles.humanItemBody}>
                                Tenemos un dashboard interno de costos (vemos cuánto cuesta cada usuario, no qué escribió). La base de datos está cifrada en reposo (AES-256) y las políticas Row-Level Security garantizan que solo tu sesión accede a tu contenido.
                            </Text>
                        </View>
                    </View>

                    <View style={styles.humanItem}>
                        <Text style={styles.humanItemNum}>02</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.humanItemTitle}>Anthropic procesa, sin entrenar modelos con tu data.</Text>
                            <Text style={styles.humanItemBody}>
                                Usamos Claude (Anthropic) para analizar tus capturas. Anthropic mantiene logs temporales (30 días) solo para detección de abuso. Tu contenido NO se usa para entrenar modelos — tenemos deshabilitado el opt-in de compartir prompts y no participamos en su programa de partners.
                            </Text>
                        </View>
                    </View>

                    <View style={styles.humanItem}>
                        <Text style={styles.humanItemNum}>03</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.humanItemTitle}>Nunca vendemos ni compartimos tu data.</Text>
                            <Text style={styles.humanItemBody}>
                                Sin terceros de marketing. Sin trackers de comportamiento dentro de tus entries. Tu data no es el producto — tu suscripción lo es.
                            </Text>
                        </View>
                    </View>

                    <View style={styles.humanItem}>
                        <Text style={styles.humanItemNum}>04</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.humanItemTitle}>Si te vas, tu data se va contigo.</Text>
                            <Text style={styles.humanItemBody}>
                                Borra tu cuenta y todo se elimina permanentemente en 30 días — incluyendo embeddings, reflejos y patrones detectados. Puedes descargar tus memorias en JSON antes de salir.
                            </Text>
                        </View>
                    </View>

                    <View style={styles.humanItem}>
                        <Text style={styles.humanItemNum}>05</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.humanItemTitle}>Compromiso firmado por escrito.</Text>
                            <Text style={styles.humanItemBody}>
                                Puedes descargar tu Certificado de Privacidad personal desde Settings — un PDF firmado digitalmente que detalla estos compromisos para tu archivo o tu equipo legal.
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={{ height: 32 }} />

                <Text style={styles.lastUpdate}>Última actualización: 20 de Enero de 2026</Text>

                <Text style={styles.bodyText}>
                    Macarena Group PS Mexico (en adelante, el "Responsable"), quien opera comercialmente bajo la marca "BlackBoxMind.ai", con domicilio ubicado en la Ciudad de México, México, es el responsable del uso, tratamiento y protección de sus datos personales, y al respecto le informa lo siguiente:
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
                <Text style={styles.bulletItem}>• Envío de boletines informativos y promociones de BlackBoxMind.ai.</Text>
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
                    Sus datos pueden ser compartidos con proveedores en la nube (ej. Supabase para alojamiento, Anthropic/Google para procesamiento de IA bajo acuerdos de cero retención de datos) con la finalidad exclusiva de alojar y procesar solicitudes de IA. Nosotros NO vendemos, rentamos ni comercializamos sus datos personales identificables.
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
                    <TO
                        style={[styles.acceptBtn, loading && styles.disabledBtn]}
                        onPress={handleAccept}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={tokens.text.onAccent} />
                        ) : (
                            <Text style={styles.acceptBtnText}>ACEPTO EL AVISO DE PRIVACIDAD</Text>
                        )}
                    </TO>
                </View>
            )}
        </SAV>
    );
};

const makeStyles = (tokens: ThemeTokens) => StyleSheet.create({
    container: { flex: 1, backgroundColor: tokens.bg.page },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingTop: Platform.OS === 'ios' ? 10 : 15,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderColor: tokens.border.default
    },
    titleContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' },
    headerTitle: { color: tokens.text.primary, fontWeight: 'bold', fontSize: 13, letterSpacing: 2, marginLeft: 10 },
    backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    content: { flex: 1 },
    scrollContent: { padding: 20 },
    lastUpdate: { color: tokens.text.muted, fontSize: 12, marginBottom: 20, fontStyle: 'italic' },
    sectionTitle: { color: tokens.text.primary, fontWeight: 'bold', fontSize: 16, marginTop: 25, marginBottom: 10 },
    subSectionTitle: { color: tokens.text.link, fontWeight: 'bold', fontSize: 14, marginTop: 15, marginBottom: 8 },
    bodyText: { color: tokens.text.secondary, fontSize: 14, lineHeight: 22, marginBottom: 10 },
    bulletItem: { color: tokens.text.secondary, fontSize: 14, lineHeight: 22, paddingLeft: 10, marginBottom: 4 },
    warningBox: {
        backgroundColor: tokens.accent.redSoft,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: tokens.accent.redSoft,
        padding: 15,
        marginTop: 20,
        marginBottom: 10
    },
    warningTitle: { color: tokens.accent.red, fontWeight: 'bold', fontSize: 14, marginBottom: 5 },
    warningText: { color: tokens.accent.red, fontSize: 13, lineHeight: 20 },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        borderColor: tokens.border.default,
        backgroundColor: tokens.bg.card
    },
    footerNote: { color: tokens.text.muted, fontSize: 12, textAlign: 'center', marginBottom: 15 },
    acceptBtn: {
        backgroundColor: tokens.accent.indigo,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center'
    },
    acceptBtnText: { color: tokens.text.onAccent, fontWeight: 'bold', fontSize: 14, letterSpacing: 1 },
    disabledBtn: { opacity: 0.5 },
    humanSection: {
        backgroundColor: tokens.accent.purpleSoft,
        borderColor: tokens.accent.purpleSoft,
        borderWidth: 1,
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
    },
    humanHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    humanTitle: { color: tokens.accent.purple, fontSize: 12, fontWeight: '700', letterSpacing: 1.8 },
    humanSub: { color: tokens.text.muted, fontSize: 12, fontStyle: 'italic', marginBottom: 16 },
    humanItem: { flexDirection: 'row', marginBottom: 14, gap: 12 },
    humanItemNum: { color: tokens.accent.purple, fontSize: 18, fontWeight: '800', width: 28 },
    humanItemTitle: { color: tokens.text.primary, fontSize: 14, fontWeight: '700', marginBottom: 4 },
    humanItemBody: { color: tokens.text.secondary, fontSize: 13, lineHeight: 19 },
    certCard: {
        backgroundColor: tokens.bg.card,
        borderColor: tokens.accent.purpleSoft,
        borderWidth: 1,
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        shadowColor: tokens.shadow.color,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
    },
    certHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    certBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    certBrandText: { color: tokens.accent.purple, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
    certStatusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: tokens.accent.greenSoft,
        borderColor: tokens.accent.greenSoft,
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    certStatusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: tokens.accent.green,
    },
    certStatusText: { color: tokens.accent.green, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
    certTitle: { color: tokens.text.primary, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
    certSubtitle: { color: tokens.text.muted, fontSize: 12, marginTop: 2 },
    certDivider: {
        height: 1,
        backgroundColor: tokens.accent.purpleSoft,
        marginVertical: 18,
    },
    certRecipientLabel: { color: tokens.accent.purple, fontSize: 10, fontWeight: '700', letterSpacing: 1.8, marginBottom: 6 },
    certRecipientName: { color: tokens.text.primary, fontSize: 20, fontWeight: '700', marginBottom: 2 },
    certRecipientEmail: { color: tokens.text.muted, fontSize: 13 },
    certMetaRow: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 20,
        marginBottom: 20,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: tokens.border.subtle,
    },
    certMetaLabel: { color: tokens.text.muted, fontSize: 9, fontWeight: '700', letterSpacing: 1.2, marginBottom: 4 },
    certMetaValue: { color: tokens.text.secondary, fontSize: 12, fontWeight: '600' },
    certBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: tokens.accent.purple,
        paddingVertical: 14,
        borderRadius: 12,
    },
    certBtnDisabled: { opacity: 0.6 },
    certBtnText: { color: tokens.text.onAccent, fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
    certFooterNote: {
        color: tokens.text.muted,
        fontSize: 11,
        textAlign: 'center',
        marginTop: 12,
        lineHeight: 16,
    },
});

export default PrivacyScreen;
