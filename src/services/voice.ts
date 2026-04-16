import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
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
            return true;
        } catch (err: any) {
            console.error('VoiceService: Failed to create recording:', err);
            throw new Error(`Error al iniciar grabación: ${err.message}`);
        }
    }

    async stopRecording() {
        if (!this.recording) return null;

        await this.recording.stopAndUnloadAsync();
        const uri = this.recording.getURI();
        this.recording = null;
        return uri;
    }

    async transcribeAudio(uri: string): Promise<string> {
        try {
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
                console.error("VOICE RAW ERROR:", response.status, errText);
                throw new Error(`Error ${response.status}: ${errText}`);
            }
            
            const data = await response.json();

            const transcription = data?.transcription;
            if (!transcription) {
                console.warn('VoiceService: No transcription returned from Edge Function.');
                return '(Audio captured, but the AI could not hear any clear speech)';
            }

            console.log('VoiceService: Transcription success');
            return transcription;

        } catch (err: any) {
            console.error('VoiceService: Transcription failed:', err.message);
            return `(Transcription failed: ${err.message})`;
        }
    }
}

export const voiceService = new VoiceService();
