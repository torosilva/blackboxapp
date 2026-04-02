import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

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
            const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
            if (!GEMINI_API_KEY) throw new Error('Gemini API Key missing');

            console.log('VoiceService: Starting real transcription...');

            // 1. Read file as base64
            const base64 = await FileSystem.readAsStringAsync(uri, {
                encoding: 'base64',
            });

            // 2. Discover available model
            let modelName = 'gemini-flash-latest'; // Default
            try {
                const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;
                const listResponse = await fetch(listUrl);
                const listData = await listResponse.json();
                const selected = listData.models?.find((m: any) =>
                    (m.name || '').includes('flash') &&
                    (m.supportedGenerationMethods || []).includes('generateContent')
                );
                if (selected) modelName = selected.name.split('/').pop();
            } catch (e) {
                console.log('VoiceService: Model discovery failed, using default');
            }

            // 3. Call Gemini for audio-to-text
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;
            console.log(`VoiceService: Using model ${modelName}`);

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: "Verbatim transcription of this audio. Return ONLY the text or '[No speech detected]'." },
                            { inline_data: { mime_type: "audio/mp4", data: base64 } }
                        ]
                    }]
                })
            });

            const data = await response.json();
            console.log('VoiceService: Raw response data:', JSON.stringify(data).substring(0, 200));

            if (data.error) {
                console.error('VoiceService: Gemini API Error:', data.error.message);
                return `(Error: ${data.error.message})`;
            }

            const transcription = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!transcription) {
                console.warn('VoiceService: No transcription returned. Candidates:', JSON.stringify(data.candidates));
                return "(Audio captured, but the AI could not hear any clear speech)";
            }

            console.log('VoiceService: Transcription success');
            return transcription.trim();

        } catch (err: any) {
            console.error('VoiceService: Transcription failed:', err.message);
            return `(Transcription failed: ${err.message})`;
        }
    }
}

export const voiceService = new VoiceService();
