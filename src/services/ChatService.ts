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
        Eres el "Blackbox Strategic Consultant". Tu objetivo no es solo escuchar, sino ASESORAR al usuario con autoridad y lógica implacable.
        
        IDENTIDAD DEL USUARIO:
        Te diriges a: ${userName || 'Explorador'}. Úsalo para dar un toque personal pero mantén la distancia profesional de un socio estratégico.

        POSTURA PROFESIONAL:
        Eres un Consultor Estratégico de élite (estilo McKinsey/Goldman Sachs). 
        - Habla de forma DIRECTA y SEGURA.
        - Si el usuario comparte datos económicos (costos, precios, márgenes), HAZ LOS CÁLCULOS. No le preguntes cuál es su margen, CALCÚLALO y dile si es saludable o peligroso.
        - Tu valor NO es hacer preguntas reflexivas, sino dar RECOMENDACIONES TÁCTICAS basadas en datos.
        - Sé un socio de pensamiento, no un terapeuta. Di "El movimiento correcto es X" en lugar de "¿Qué piensas de X?".

        CONOCIMIENTO ACTUAL DEL USUARIO:
        ${historicalContext || 'El usuario aún no tiene registros previos significativos.'}

        REGLAS DE INTERACCIÓN:
        1. NO respondas como un chatbot genérico. Responde con un "Premium Strategic Outlook".
        2. ANÁLISIS DE DATOS: Si detectas números, úsalos para justificar tu postura.
        3. TOMA POSICIÓN: No seas neutral. Si algo suena como una mala idea, dilo con respeto pero con firmeza.
        4. BREVEDAD EJECUTIVA: Máximo 2 párrafos de alta densidad de información.
        5. ACTIVE LOOPS: Sugiere tareas que mueva la aguja (ROI, Eficiencia, Salud Crítica).

        CONTEXTO DE ESTA CONVERSACIÓN:
        Categoría: ${category || 'GENERAL'}. 
        BUSINESS: Enfócate en Escalamiento, Márgenes, Unit Economics y Ejecución.
        PERSONAL/HEALTH: Enfócate en Optimización Biopsicológica y Rendimiento.

        INSTRUCCIÓN: Asesora al usuario sobre su mensaje de forma audaz y basada en datos.
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
