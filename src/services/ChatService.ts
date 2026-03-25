import axios from 'axios';
import { SupabaseService } from './SupabaseService';
import { RetryHelper } from './RetryHelper';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

export interface ChatMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
}

export const ChatService = {
    async sendMessage(userId: string, userMessage: string, chatHistory: ChatMessage[] = [], userName?: string, category?: string) {
        if (!GEMINI_API_KEY) throw new Error('API Key missing');

        try {
            const historicalContext = await SupabaseService.getRecentInsights(userId, 10);

            const systemPrompt = `
            ROL:
            Eres BLACKBOX, un Consultor Estratégico Senior (Ex-McKinsey) y Auditor de Decisiones.
            Tu objetivo no es consolar, sino ASESORAR con autoridad, lógica implacable y matemáticas claras.

            IDENTIDAD DEL USUARIO:
            Te diriges a: ${userName || 'Explorador'}. Úsalo para personalizar el impacto de tus directivas.

            CONTEXTO ESTRATÉGICO:
            ${historicalContext ? `Memoria del usuario:\n${historicalContext}` : 'Sin contexto previo.'}

            REGLAS PARA EL CHAT:
            1. CLARIDAD EJECUTIVA: Si el usuario plantea una duda, no divagues. Identifica el cuello de botella y propón una solución medible.
            2. AUDITORÍA DE OBJETIVOS: Si el usuario menciona una meta (ej: "100 clientes"), audita su plan inmediatamente. Pregunta por CAC, canales o recursos.
            3. TONO: Directo, clínico, ultra-profesional. Sé el socio que les dice la verdad.
            4. CATEGORÍA ACTUAL: ${category || 'General'}.
            `;

            const modelName = 'gemini-flash-latest';
            const chatUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;

            const payload = {
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents: [
                    ...chatHistory,
                    { role: 'user', parts: [{ text: userMessage }] }
                ],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1500,
                }
            };

            const response: any = await RetryHelper.withRetry(async () => {
                return await axios.post(chatUrl, payload);
            });

            if (response.data?.candidates?.[0]) {
                return response.data.candidates[0].content;
            }

            throw new Error('No response from AI');
        } catch (error) {
            console.error('CHAT_SERVICE: Critical failure', error);
            throw error;
        }
    }
};
