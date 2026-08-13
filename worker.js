// ================================================================
// worker.js - Cloudflare Worker para AstroChat
// Proxy seguro para la API de Groq
// ================================================================

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    // Manejar CORS preflight (OPTIONS)
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400',
            },
        });
    }

    // Solo aceptar POST
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Método no permitido. Usa POST.' }), {
            status: 405,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    }

    try {
        const body = await request.json();
        const { messages, systemPrompt, isSummary } = body;

        // Validar que existan mensajes
        if (!messages || !Array.isArray(messages)) {
            return new Response(JSON.stringify({ error: 'Se requiere un array de mensajes.' }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        // Obtener la API Key desde las variables de entorno
        const GROQ_API_KEY = env.GROQ_API_KEY;
        if (!GROQ_API_KEY) {
            return new Response(JSON.stringify({ error: 'La API Key de Groq no está configurada.' }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        // Construir el prompt del sistema
        const systemMessage = {
            role: 'system',
            content: systemPrompt || `Eres AstroChat, un tutor de medios de comunicación para estudiantes de 12 a 18 años. 
            Tu tono es amigable, entusiasta y cercano. Usas emojis espaciales como 🚀🌌🌠🛸☀️🪐.
            Respondes con claridad, máximo 3 párrafos, a menos que el usuario pida un resumen extenso.
            Si no sabes algo, admítelo con honestidad y ofrece orientación.
            Evita usar emojis de dinero.
            Sé educativo, inspirador y fomenta la curiosidad.`
        };

        // Si es una solicitud de resumen, modificar el system prompt
        let finalSystemPrompt = systemMessage.content;
        if (isSummary) {
            finalSystemPrompt = `Eres AstroChat, un tutor de medios de comunicación. 
            El usuario ha solicitado un resumen extenso. Genera un resumen detallado de al menos 400 palabras 
            sobre el tema indicado, adecuado para estudiantes de 12 a 18 años. 
            Incluye título, introducción, puntos clave y conclusión. Usa párrafos claros. 
            No uses lenguaje técnico complejo. Usa emojis espaciales para hacerlo atractivo.`;
        }

        // Preparar los mensajes para la API de Groq
        const groqMessages = [
            { role: 'system', content: finalSystemPrompt },
            ...messages
        ];

        // Llamar a la API de Groq
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',  // Modelo de 70B
                messages: groqMessages,
                max_tokens: isSummary ? 1500 : 600,
                temperature: 0.7,
                top_p: 0.9,
            }),
        });

        if (!groqResponse.ok) {
            const errorText = await groqResponse.text();
            console.error('Error de Groq:', groqResponse.status, errorText);
            return new Response(JSON.stringify({ 
                error: `Error de la API de Groq: ${groqResponse.status}` 
            }), {
                status: groqResponse.status,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        const data = await groqResponse.json();
        const reply = data.choices?.[0]?.message?.content || 'Lo siento, no pude generar una respuesta.';

        return new Response(JSON.stringify({ reply }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache',
            },
        });

    } catch (error) {
        console.error('Error en el Worker:', error);
        return new Response(JSON.stringify({ 
            error: 'Error interno del Worker: ' + error.message 
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    }
}
