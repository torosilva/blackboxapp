import * as LocalAuthentication from 'expo-local-authentication';
import { Alert } from 'react-native';

export const BioAuthService = {
    /**
     * Check if the device has biometric hardware and if any are enrolled
     */
    async isAvailableAsync(): Promise<boolean> {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        return hasHardware && isEnrolled;
    },

    /**
     * Get the available authentication types (FaceID, Fingerprint, Iris)
     */
    async getSupportedTypes(): Promise<LocalAuthentication.AuthenticationType[]> {
        return await LocalAuthentication.supportedAuthenticationTypesAsync();
    },

    /**
     * Trigger the biometric authentication prompt
     */
    async authenticateAsync(reason: string = 'Accede a tu diario de forma segura'): Promise<boolean> {
        try {
            const results = await LocalAuthentication.authenticateAsync({
                promptMessage: reason,
                fallbackLabel: 'Usar código',
                disableDeviceFallback: false,
                cancelLabel: 'Cancelar',
            });

            return results.success;
        } catch (error) {
            console.error('BIO_AUTH_SERVICE: Error during authentication', error);
            return false;
        }
    }
};
