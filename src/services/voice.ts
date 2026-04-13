import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';

export class VoiceService {
    private recording: Audio.Recording | null = null;

    async startRecording(onStatusUpdate?: (status: Audio.RecordingStatus) => void) {
        const permission = await Audio.requestPermissionsAsync();
        if (permission.status !== 'granted') {
            throw new Error('Permisos de micrófono denegados. Actívalos en configuración.');
        }

        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: false, // Ensures it doesn't try to activate as background
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY,
                onStatusUpdate,
                100 
            );
            this.recording = recording;
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

            const { data, error } = await supabase.functions.invoke('transcribe-audio', {
                body: { audioBase64, mimeType: 'audio/mp4' },
            });

            if (error) throw error;

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
