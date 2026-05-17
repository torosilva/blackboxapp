import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WELCOME_HTML } from './welcomeHtml';

const STORAGE_KEY = 'BLACKBOX_WELCOME_V1_SEEN';

interface Props { forceShow?: boolean; onClose?: () => void; }

const WelcomeModal: React.FC<Props> = ({ forceShow, onClose }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (forceShow) { setVisible(true); return; }
        AsyncStorage.getItem(STORAGE_KEY).then(seen => { if (!seen) setVisible(true); });
    }, [forceShow]);

    const handleClose = async () => {
        await AsyncStorage.setItem(STORAGE_KEY, 'true');
        setVisible(false);
        onClose?.();
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
            <View style={styles.overlay}>
                <View style={styles.sheet}>
                    <View style={styles.handle} />
                    <WebView
                        originWhitelist={['*']}
                        source={{ html: WELCOME_HTML }}
                        style={styles.web}
                        containerStyle={styles.web}
                        showsVerticalScrollIndicator={false}
                        scrollEnabled
                    />
                    <TouchableOpacity style={styles.cta} onPress={handleClose} activeOpacity={0.85}>
                        <Text style={styles.ctaText}>Empezar</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: '#020617',
        borderTopLeftRadius: 32, borderTopRightRadius: 32,
        paddingTop: 12, paddingBottom: 24, paddingHorizontal: 16,
        height: '92%',
        borderTopWidth: 1, borderColor: 'rgba(99,102,241,0.3)',
    },
    handle: { width: 40, height: 4, backgroundColor: '#334155', borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
    web: { flex: 1, backgroundColor: '#020617' },
    cta: {
        backgroundColor: '#6366f1', paddingVertical: 18, borderRadius: 20,
        alignItems: 'center', marginTop: 14,
        shadowColor: '#6366f1', shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
    },
    ctaText: { color: 'white', fontWeight: 'bold', fontSize: 17, letterSpacing: 0.3 },
});

export default WelcomeModal;
