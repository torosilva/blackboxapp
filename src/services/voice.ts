import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Alert, Linking } from 'react-native';
import { supabase } from './supabase';
import { getGlobalAccessToken } from '../context/AuthContext';

export class VoiceService {
    private recording: Audio.Recording | null = null;

    async startRecording(onStatusUpdate?: (status: Audio.RecordingStatus) => void): Promise<boolean> {
        const permission = await Audio.requestPermissionsAsync();
        if (permission.status !== 'granted') {
            Alert.alert(
                'Micrófono bloqueado',
                'Blackbox necesita acceso al micrófono para grabar tu voz. Actívalo en Configuración.',
                [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                        text: 'Abrir Configuración',
                        onPress: () => Linking.openSettings(),
                    },
                ]
            );
            return false;
        }

        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY,
                onStatusUpdate,
                100
            );
            this.recording = recording;
            // Stop the screen from auto-locking mid-dictation, which would
            // background the app and cut the recording short.
            activateKeepAwakeAsync('recording').catch(() => {});
            return true;
        } catch (err: any) {
            console.error('VoiceService: Failed to create recording:', err);
            throw new Error(`Error al iniciar grabación: ${err.message}`);
        }
    }

    async stopRecording() {
        deactivateKeepAwake('recording').catch(() => {});
        if (!this.recording) return null;

        await this.recording.stopAndUnloadAsync();
        const uri = this.recording.getURI();
        this.recording = null;
        return uri;
    }

    /**
     * Transcribe a local recording via the Edge Function.
     * - Throws on connectivity/HTTP failure so the caller can preserve the
     *   audio and offer a retry (mobile signal drops mid-session).
     * - Returns '' when the audio had no clear speech (a normal, non-error case).
     * Never returns a fabricated string — that used to get analyzed as if it
     * were the user's own words.
     */
    async transcribeAudio(uri: string): Promise<string> {
        console.log('VoiceService: Starting transcription via Edge Function...');

        // Read file as base64 (stays on device, sent securely to Edge Function)
        const audioBase64 = await FileSystem.readAsStringAsync(uri, {
            encoding: 'base64',
        });

        const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/transcribe-audio`;
        const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

        const token = getGlobalAccessToken();
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': anonKey,
                'Authorization': `Bearer ${token || anonKey}`
            },
            body: JSON.stringify({ audioBase64, mimeType: 'audio/mp4' }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('VOICE RAW ERROR:', response.status, errText);
            throw new Error(`Transcripción falló (HTTP ${response.status})`);
        }

        const data = await response.json();
        const transcription = data?.transcription;
        if (!transcription || !transcription.trim()) {
            console.warn('VoiceService: No clear speech detected.');
            return '';
        }

        console.log('VoiceService: Transcription success');
        return transcription;
    }
}

export const voiceService = new VoiceService();
