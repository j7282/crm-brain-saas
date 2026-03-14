require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const FormData = require('form-data');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');

// Modelos
const User = require('./models/User');
const Brain = require('./models/Brain');


const app = express();
const port = process.env.PORT || 3000;

// Configuración de middlewares
app.use(cors());
app.use(express.json());

// Conexión a MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/brain-clone-saas')
    .then(() => console.log('[DB] Conectado a MongoDB'))
    .catch(err => console.error('[DB] Error de conexión:', err));

const JWT_SECRET = process.env.JWT_SECRET || 'secret_para_cerebros_clonados';

// Middleware de autenticación
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) throw new Error();
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        res.status(401).json({ error: 'Por favor, autentícate.' });
    }
};


// Inicialización de Clientes API
const geminiApi = new GoogleGenerativeAI(process.env.GEMINI_API_KEY, { apiVersion: 'v1' });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

// Gestión de WhatsApp (Real QR)
let waSocket = null;
let currentQR = null;
let connectionStatus = 'disconnected'; // 'disconnected', 'connecting', 'qr', 'connected'

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    waSocket = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' })
    });

    waSocket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            currentQR = await QRCode.toDataURL(qr);
            connectionStatus = 'qr';
            console.log('[WhatsApp] Nuevo QR generado.');
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('[WhatsApp] Conexión cerrada. Reintentando:', shouldReconnect);
            connectionStatus = 'disconnected';
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('[WhatsApp] ¡Conectado exitosamente!');
            connectionStatus = 'connected';
            currentQR = null;
        }
    });

    waSocket.ev.on('creds.update', saveCreds);

    waSocket.ev.on('messages.upsert', async m => {
        // Aquí se integrará la lógica de respuesta automática real
        // console.log(JSON.stringify(m, undefined, 2));
    });
}

// Inicializar conexión
connectToWhatsApp();

// Configuración de Multer para recibir audios temporales
const upload = multer({ dest: 'uploads/' });

// Ruta de Prueba y Estado
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        services: {
            cerebro: !!process.env.GEMINI_API_KEY,
            oido: !!process.env.OPENAI_API_KEY,
            voz: !!process.env.ELEVENLABS_API_KEY
        }
    });
});

/**
 * SERVICIO 0: AUTENTICACIÓN
 */
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = new User({ email, password });
        await user.save();
        const token = jwt.sign({ userId: user._id }, JWT_SECRET);
        res.status(201).json({ user: { id: user._id, email: user.email }, token });
    } catch (error) {
        console.error("Error en Registro:", error);
        if (error.code === 11000) {
            return res.status(400).json({ error: 'Ese correo electrónico ya está registrado.' });
        }
        res.status(400).json({ error: error.message || 'Error al registrar usuario.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }
        const token = jwt.sign({ userId: user._id }, JWT_SECRET);
        res.json({ token, user: { id: user._id, email: user.email } });
    } catch (error) {
        res.status(500).json({ error: 'Error en el login.' });
    }
});

/**
 * SERVICIO DE GESTIÓN DE CEREBROS
 */
app.post('/api/brains', auth, async (req, res) => {
    try {
        const brain = new Brain({ ...req.body, userId: req.user.userId });
        await brain.save();
        res.status(201).json(brain);
    } catch (error) {
        res.status(400).json({ error: 'Error al crear cerebro.' });
    }
});

app.get('/api/brains', auth, async (req, res) => {
    try {
        const brains = await Brain.find({ userId: req.user.userId });
        res.json(brains);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener cerebros.' });
    }
});

/**
 * SERVICIO DE ENTRENAMIENTO (Human Intervention)
 */
app.post('/api/brains/:id/train', auth, async (req, res) => {
    try {
        const { query, aiResponse, correction } = req.body;
        const brain = await Brain.findOne({ _id: req.params.id, userId: req.user.userId });
        if (!brain) return res.status(404).json({ error: 'Cerebro no encontrado.' });

        brain.trainingData.push({ query, aiResponse, correction });
        await brain.save();
        res.json({ success: true, message: 'Entrenamiento guardado correctamente.' });
    } catch (error) {
        res.status(500).json({ error: 'Error al entrenar el cerebro.' });
    }
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
 * SERVICIO 1.5: WHATSAPP REAL QR
 */
app.get('/api/whatsapp/qr', auth, (req, res) => {
    res.json({
        status: connectionStatus,
        qr: currentQR
    });
});

/**
 * SERVICIO 2: CEREBRO (Generación de Respuesta y Sentimientos con Gemini)
 */
app.post('/api/cerebro', auth, async (req, res) => {
    try {
        const {
            mensajeCliente,
            historial = [],
            brainId,
            ultimoItemEnviadoPorHumano = null
        } = req.body;

        // Cargar contexto del Cerebro desde la DB
        let catalogoProductos = [];
        let respuestasRapidas = {};
        let brainName = "Cerebro General";
        let extraExamples = "";

        if (brainId) {
            const brain = await Brain.findOne({ _id: brainId, userId: req.user.userId });
            if (brain) {
                catalogoProductos = brain.catalogoProductos;
                respuestasRapidas = brain.respuestasRapidas;
                brainName = brain.name;

                // Inyectar ejemplos de entrenamiento previo
                if (brain.trainingData && brain.trainingData.length > 0) {
                    extraExamples = "\nEJEMPLOS DE CORRECCIONES PREVIAS (Aprende de esto):\n" +
                        brain.trainingData.slice(-5).map(t => `Cliente: "${t.query}"\nIA propuso: "${t.aiResponse}"\nHumano corrigió a: "${t.correction}"`).join("\n---\n");
                }
            }
        }

        const model = geminiApi.getGenerativeModel({ model: "gemini-1.5-flash" });

        const systemPrompt = `
      Eres una 'Instancia de Cerebro Clonado' llamada "${brainName}".
      Actúas de manera 100% natural, como un humano real. Tu meta es cerrar el 90% de las ventas.
      
      ESTADO ACTUAL DE LA MEMORIA:
      - Historial del chat: ${JSON.stringify(historial)}
      - Último producto que el humano envió manualmente: ${ultimoItemEnviadoPorHumano ? JSON.stringify(ultimoItemEnviadoPorHumano) : 'Ninguno'}
      
      ACTIVOS DEL CRM A TU DISPOSICIÓN:
      1. Catálogo de Productos Info:
      ${JSON.stringify(catalogoProductos)}
      
      2. Estilo de Respuestas Rápidas:
      ${JSON.stringify(respuestasRapidas)}
      ${extraExamples}
      
      REGLAS DE DECISIÓN:
      - Si está MOLESTO (Rojo): Eres empático, no discutas, busca solución.
      - Si está DUDOSO (Amarillo): Usa pruebas sociales y escasez.
      - Si está LISTO (Verde): Ve al cierre (datos bancarios, contrato).
      
      Mensaje actual del cliente: "${mensajeCliente}"
      
      Devuelve un JSON exacto con la siguiente estructura:
      {
         "sentiment": "rojo|amarillo|verde",
         "reasoning": "Breve explicación",
         "respuestaTexto": "Respuesta final",
         "requiereMultimedia": "ninguno|video_demostrativo|pdf_ficha_tecnica|pdf_contrato|datos_bancarios"
      }
    `;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const response = await axios.post(geminiUrl, {
            contents: [{ role: 'user', parts: [{ text: systemPrompt }] }]
        });

        const textResponse = response.data.candidates[0].content.parts[0].text;
        const jsonString = textResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        const brainOutput = JSON.parse(jsonString);

        res.json(brainOutput);
    } catch (error) {
        console.error("Error en Cerebro Gemini:", error.message);
        res.status(500).json({ error: 'Fallo en la generación.' });
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

app.listen(port, () => {
    console.log(`[Cerebro Central] Motor Backend corriendo en puerto ${port}`);
    console.log(`- Oído Whisper: ACTIVO`);
    console.log(`- Cerebro Gemini: ACTIVO`);
    console.log(`- Voz ElevenLabs: ACTIVO`);
});
