import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';

const REVENUECAT_API_KEY_IOS = 'goog_example_ios'; // Reemplazar con real
const REVENUECAT_API_KEY_ANDROID = 'goog_example_android'; // Reemplazar con real

export const RevenueCatService = {
    async configure() {
        if (Platform.OS === 'ios') {
            await Purchases.configure({ apiKey: REVENUECAT_API_KEY_IOS });
        } else if (Platform.OS === 'android') {
            await Purchases.configure({ apiKey: REVENUECAT_API_KEY_ANDROID });
        }
        console.log('REVENUECAT: Configurado correctamente');
    },

    async identify(userId: string) {
        try {
            await Purchases.logIn(userId);
        } catch (e) {
            console.error('REVENUECAT_ID_ERROR:', e);
        }
    }
};
