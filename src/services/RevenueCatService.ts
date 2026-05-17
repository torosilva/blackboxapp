import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';

const REVENUECAT_API_KEY_IOS = 'goog_example_ios'; // Reemplazar con real
const REVENUECAT_API_KEY_ANDROID = 'goog_example_android'; // Reemplazar con real

// Until real keys are set, configuring the SDK throws "Invalid API key"
// and surfaces an ugly error toast on every launch. Skip cleanly.
function isPlaceholder(key: string) {
    return !key || key.includes('example');
}

export const RevenueCatService = {
    configured: false,

    async configure() {
        const key = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
        if (isPlaceholder(key)) {
            console.log('REVENUECAT: skipped — API key not configured yet (placeholder).');
            return;
        }
        try {
            await Purchases.configure({ apiKey: key });
            this.configured = true;
            console.log('REVENUECAT: Configurado correctamente');
        } catch (e) {
            console.warn('REVENUECAT: configure failed:', e);
        }
    },

    async identify(userId: string) {
        if (!this.configured) return;
        try {
            await Purchases.logIn(userId);
        } catch (e) {
            console.error('REVENUECAT_ID_ERROR:', e);
        }
    }
};
