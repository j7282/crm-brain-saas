require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const FormData = require('form-data');

const app = express();
const port = process.env.PORT || 3000;

// Configuración de middlewares
app.use(cors());
app.use(express.json());

// Inicialización de Clientes API
const geminiApi = new GoogleGenerativeAI(process.env.GEMINI_API_KEY, { apiVersion: 'v1' });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

// Configuración de Multer para recibir audios temporales
const upload = multer({ dest: 'uploads/' });

// Ruta de Prueba y Estado
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        services: {
            cerebro: !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'TU_LLAVE_AQUI_EMPIEZA_CON_AIza',
            oido: !!process.env.OPENAI_API_KEY,
            voz: !!process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID !== 'PON_EL_ID_DE_TU_VOZ_AQUI'
        }
    });
});

/**
 * SERVICIO 1: OÍDO (Transcripción de Audio con OpenAI Whisper)
 */
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se envió ningún archivo de audio.' });
        }

        const { path: filePath } = req.file;
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(filePath),
            model: 'whisper-1',
            language: 'es'
        });

        // Limpiar archivo temporal
        fs.unlinkSync(filePath);

        res.json({ text: transcription.text });
    } catch (error) {
        console.error("Error en Transcripción Whisper:", error);
        res.status(500).json({ error: 'Fallo al transcribir el audio.' });
    }
});

/**
 * SERVICIO 2: CEREBRO (Generación de Respuesta y Sentimientos con Gemini)
 */
app.post('/api/cerebro', async (req, res) => {
    try {
        const {
            mensajeCliente,
            historial = [],
            catalogoProductos = [],
            respuestasRapidas = {},
            ultimoItemEnviadoPorHumano = null
        } = req.body;

        // Obtener modelo gemini-1.5-flash
        const model = geminiApi.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Construcción del Prompt Avanzado del Agente Clonador con Activos del CRM
        const systemPrompt = `
      Eres una 'Instancia de Cerebro Clonado' para un experto en ventas de Autos y Pipas de Agua.
      Actúas de manera 100% natural, como un humano real. Tu meta es cerrar el 90% de las ventas.
      
      ESTADO ACTUAL DE LA MEMORIA:
      - Historial del chat: ${JSON.stringify(historial)}
      - Último producto que el humano envió manualmente (Sigue este contexto si existe): ${ultimoItemEnviadoPorHumano ? JSON.stringify(ultimoItemEnviadoPorHumano) : 'Ninguno'}
      
      ACTIVOS DEL CRM A TU DISPOSICIÓN:
      1. Catálogo de Productos (Usa esta info para precios/disponibilidad):
      ${JSON.stringify(catalogoProductos)}
      
      2. Respuestas Rápidas / Shortcuts del Vendedor (Usa su estilo o envíalas íntegras si aplican):
      ${JSON.stringify(respuestasRapidas)}
      
      REGLAS DE DECISIÓN (Semáforo Emocional):
      - Si está MOLESTO (Rojo): Eres empático, solucionador.
      - Si está DUDOSO (Amarillo): Usas pruebas sociales y escasez. Si es necesario, sugiere enviar un "video_demostrativo" o "pdf_ficha_tecnica".
      - Si está LISTO (Verde): Vas directo al cierre y pides datos. Sugiere enviar "pdf_contrato" o "datos_bancarios".
      
      Mensaje actual del cliente: "${mensajeCliente}"
      
      Devuelve un JSON exacto con la siguiente estructura y NADA MÁS:
      {
         "sentiment": "rojo|amarillo|verde",
         "reasoning": "Por qué elegiste ese color",
         "respuestaTexto": "La respuesta exacta que enviarás al cliente.",
         "requiereMultimedia": "ninguno|video_demostrativo|pdf_ficha_tecnica|pdf_contrato|datos_bancarios"
      }
    `;

        console.log("[Gemini] Diagnostic: Listando modelos disponibles...");
        try {
            const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;
            const listRes = await axios.get(listUrl);
            console.log("[Gemini] Modelos disponibles:", listRes.data.models.map(m => m.name).join(", "));
        } catch (listErr) {
            console.error("[Gemini] Error al listar modelos:", listErr.message);
        }

        console.log("[Gemini] API Key detectada:", process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 5) + "..." : "No detectada");
        console.log("[Gemini] Generando respuesta (v1beta REST API) para:", mensajeCliente);

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

        const response = await axios.post(geminiUrl, {
            contents: [{ role: 'user', parts: [{ text: systemPrompt }] }]
        });

        const textResponse = response.data.candidates[0].content.parts[0].text;
        console.log("[Gemini] Respuesta recibida con éxito");

        // Limpiar JSON si Gemini lo envuelve en markdown
        const jsonString = textResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        const brainOutput = JSON.parse(jsonString);

        res.json(brainOutput);
    } catch (error) {
        console.error("Error en Cerebro Gemini:", error.response?.data || error.message);
        res.status(500).json({
            error: 'Fallo en la red neuronal de generación.',
            details: error.response?.data || error.message
        });
    }
});

/**
 * SERVICIO 3: VOZ (Sintetizador Clonado con ElevenLabs)
 */
app.post('/api/voice', async (req, res) => {
    try {
        const { texto } = req.body;

        if (!texto) {
            return res.status(400).json({ error: 'No se proporcionó texto para sintetizar.' });
        }

        const voiceUrl = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`;

        const response = await axios.post(
            voiceUrl,
            {
                text: texto,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.8
                }
            },
            {
                headers: {
                    'Accept': 'audio/mpeg',
                    'xi-api-key': ELEVENLABS_API_KEY,
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer'
            }
        );

        res.setHeader('Content-Type', 'audio/mpeg');
        res.send(response.data);
    } catch (error) {
        console.error("Error en Clonación de Voz ElevenLabs:", error.message);
        res.status(500).json({ error: 'Fallo al generar el audio sintético.' });
    }
});

/**
 * BD Simulada para Activos del CRM
 */
const CRM_MEMORY = {
    catalogo: [
        { id: 'auto_01', nombre: 'Sedan Premium 2024', precio: '$350,000 MXN', stock: 2, detalles: 'Automático, Piel, Quemacocos' },
        { id: 'pipa_01', nombre: 'Pipa 10,000 Lts CDMX', precio: '$1,200 MXN', stock: 'Alto', detalles: 'Entrega en 2 horas Zona Sur' }
    ],
    shortcuts: {
        '/precio_pipa': 'El costo de la pipa de 10 mil litros es de $1,200 pesos, te la mando en 2 horas. ¿A qué dirección?',
        '/cuenta': 'Te dejo la cuenta: BBVA 0123... A nombre de Comercializadora. Mándame tu ticket porfa.'
    },
    sesiones: {} // Guarda el "ultimoItemEnviadoPorHumano" por número de teléfono
};

/**
 * FLUJO MAESTRO: Webhook para recibir mensajes de WhatsApp (Evolution API / Meta)
 */
app.post('/webhook/whatsapp', async (req, res) => {
    try {
        const { messageType, content, from, isFromMe } = req.body;

        // 1. SISTEMA DE INTELIGENCIA DE SEGUIMIENTO DE ÍTEMS (Si el vendedor envía un catálogo)
        if (isFromMe && messageType === 'catalog_message') {
            console.log(`[CRM] Vendedor humano envió un producto del catálogo a ${from}`);
            CRM_MEMORY.sesiones[from] = { ultimoItemEnviadoPorHumano: content.productId };
            return res.json({ success: true, status: 'Contexto actualizado.' });
        }

        // Ignorar si soy yo (IA) o si es otro tipo de mi propio mensaje
        if (isFromMe) return res.json({ success: true, status: 'Ignorado (es mío)' });

        let mensajeCliente = content;
        console.log(`[WhatsApp Inbound] Nuevo mensaje de ${from}: Toma de decisión iniciada.`);

        // 2. Si el messageType es 'audio', conectar con Whisper para transcribir (Lógica simulada aquí)
        if (messageType === 'audio') {
            mensajeCliente = "[AudioTranscrito]: " + mensajeCliente; // Simulando transcripción
        }

        // 3. Evaluar con el Cerebro (Gemini) inyectando los Activos del CRM
        const brainResponse = await axios.post(`http://localhost:${port}/api/cerebro`, {
            mensajeCliente: mensajeCliente,
            historial: [],
            catalogoProductos: CRM_MEMORY.catalogo,
            respuestasRapidas: CRM_MEMORY.shortcuts,
            ultimoItemEnviadoPorHumano: CRM_MEMORY.sesiones[from]?.ultimoItemEnviadoPorHumano || null
        });

        const decision = brainResponse.data;
        console.log(`[Decisión Cerebro]: Sentimiento: ${decision.sentiment} | Acción Multimedia: ${decision.requiereMultimedia}`);

        // 4. GESTIÓN DE ARCHIVOS Y MULTIMEDIA
        let payloadEnvio = { to: from, text: decision.respuestaTexto };

        if (decision.requiereMultimedia && decision.requiereMultimedia !== 'ninguno') {
            console.log(`[CRM] Extrayendo activo multimedia: ${decision.requiereMultimedia} desde la Galería.`);
            // Aquí se conectaría con la API de WhatsApp para enviar el Documento/Video correspondiente
            payloadEnvio.media = `url_del_crm_asset/${decision.requiereMultimedia}`;
        }

        // 5. Retornamos la orden de ejecución a Evolution API / WhatsApp Cloud
        res.json({ success: true, action: payloadEnvio });
    } catch (error) {
        console.error("Error en Flujo Maestro:", error);
        res.status(500).send('Error');
    }
});

/**
 * DIAGNÓSTICO: Listar Modelos de Gemini (Para resolver error 404 en Prod)
 */
app.get('/api/gemini-test', async (req, res) => {
    try {
        const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;
        const listRes = await axios.get(listUrl);
        res.json({
            keyDetected: !!process.env.GEMINI_API_KEY,
            keyStart: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 5) : "N/A",
            models: listRes.data.models.map(m => ({ name: m.name, methods: m.supportedGenerationMethods }))
        });
    } catch (error) {
        res.status(500).json({
            error: "Error al listar modelos",
            message: error.message,
            details: error.response?.data
        });
    }
});

app.listen(port, () => {
    console.log(`[Cerebro Central] Motor Backend corriendo en puerto ${port}`);
    console.log(`- Oído Whisper: ACTIVO`);
    console.log(`- Cerebro Gemini: ACTIVO`);
    console.log(`- Voz ElevenLabs: ACTIVO`);
});
