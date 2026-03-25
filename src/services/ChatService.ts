import axios from 'axios';
import { SupabaseService } from './SupabaseService';
import { RetryHelper } from './RetryHelper';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

export interface ChatMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
}

export const ChatService = {
    /**
     * Main function to send a message to the Strategic Consultant
     */
    async sendMessage(userId: string, userMessage: string, chatHistory: ChatMessage[] = [], userName?: string, category?: string) {
        if (!GEMINI_API_KEY) throw new Error('API Key missing');

        try {
            // 1. Gather Knowledge Base (Cost Efficiency: Summaries + Recent entries)
            const historicalContext = await SupabaseService.getRecentInsights(userId, 10);

            const systemPrompt = `
        ROL: 
        Eres el "Blackbox AI Consultant". Tu objetivo es ayudar al usuario a entender sus propios pensamientos, sesgos y progreso basándote en sus diarios.
        
        IDENTIDAD DEL USUARIO:
        Te diriges a: ${userName || 'Explorador'}. Úsalo ocasionalmente para dar un toque personal y profesional.

        POSTURA PROFESIONAL:
        Eres un Consultor Estratégico de alto nivel. Habla de forma DIRECTA, analítica y ejecutiva. No seas excesivamente humilde; tu valor es el análisis frío y táctico. Recuerda: eres un agente de IA y tu papel es dar referencia para ser discutida con un coach humano.

        CONOCIMIENTO ACTUAL DEL USUARIO:
        ${historicalContext || 'El usuario aún no tiene registros previos significativos.'}

        REGLAS DE INTERACCIÓN:
        1. NO respondas como un chat genérico. Responde como un consultor de alto nivel.
        2. Inicia o usa ocasionalmente el nombre del usuario (${userName || 'Explorador'}).
        3. Si el usuario pregunta algo sobre su pasado, usa la sección de "CONOCIMIENTO ACTUAL" arriba.
        4. Mantén tus respuestas breves y tácticas (máximo 2 párrafos).
        5. Al final de conversaciones importantes, sugiere un "Active Loop" (tarea accionable).
        6. Sé empático pero enfocado en la ejecución y la claridad.

        CONTEXTO DE ESTA CONVERSACIÓN:
        Esta consulta está categorizada como: ${category || 'GENERAL'}. 
        Ajusta tu profundidad y terminología a esta categoría.
        Si es BUSINESS, enfócate en ROI, estrategia y ejecución. 
        Si es PERSONAL, enfócate en psicología y crecimiento.
        Si es HEALTH, enfócate en biohacking y bienestar.

        INSTRUCCIÓN: Responde al mensaje del usuario manteniendo la coherencia con su historial y la categoría seleccionada.
      `;

            const modelName = 'gemini-flash-latest'; // Consistent with ai.ts
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;

            // Build the request contents: [SystemInstruction, ...History, LatestMessage]
            const contents = [
                ...chatHistory,
                { role: 'user', parts: [{ text: userMessage }] }
            ];

            // Insert system instructions as a preamble for this specific model call
            // (Gemini 1.5 allows system_instruction as a dedicated field, but we'll use prompt injection for simplicity/compatibility)
            const fullPrompt = `${systemPrompt}\n\nUsuario: ${userMessage}`;

            const response: any = await RetryHelper.withRetry(async () => {
                const res = await axios.post(url, {
                    contents: [
                        ...chatHistory,
                        { role: 'user', parts: [{ text: fullPrompt }] }
                    ],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1200,
                    }
                });
                return res;
            });

            if (response.data?.candidates?.[0]) {
                return response.data.candidates[0].content;
            }

            throw new Error('No response from AI');
        } catch (error) {
            console.error('CHAT_SERVICE: Error sending message', error);
            throw error;
        }
    }
};
