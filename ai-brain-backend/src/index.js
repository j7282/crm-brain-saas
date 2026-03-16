require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');
const Datastore = require('@seald-io/nedb');
const { scrapeUrl } = require('./services/scraper');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// =============================================
// BASE DE DATOS LOCAL (NeDB - Sin configuración)
// Los datos se guardan en archivos .db en el servidor
// =============================================
const dbDir = path.join(__dirname, '../data');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const usersDb = new Datastore({ filename: path.join(dbDir, 'users.db'), autoload: true });
const brainsDb = new Datastore({ filename: path.join(dbDir, 'brains.db'), autoload: true });

// Índice único en email para evitar duplicados
usersDb.ensureIndex({ fieldName: 'email', unique: true }, err => {
    if (err) console.error('[DB] Error creando índice:', err);
    else console.log('[DB] ✅ Base de datos local iniciada correctamente');
});

// Helpers para promisificar NeDB
const dbFind = (db, query) => new Promise((res, rej) => db.find(query, (e, d) => e ? rej(e) : res(d)));
const dbFindOne = (db, query) => new Promise((res, rej) => db.findOne(query, (e, d) => e ? rej(e) : res(d)));
const dbInsert = (db, doc) => new Promise((res, rej) => db.insert(doc, (e, d) => e ? rej(e) : res(d)));
const dbUpdate = (db, q, u, opt) => new Promise((res, rej) => db.update(q, u, opt || {}, (e, n) => e ? rej(e) : res(n)));

const app = express();
const port = process.env.PORT || 3000;

// Configuración de middlewares
app.use(cors());
app.use(express.json());

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
let connectionStatus = 'disconnected';
let isConnecting = false;
let lastError = null;
let lastReceivedMessage = null; // Para debug de mensajes entrantes
const WA_AUTH_DIR = path.join(process.cwd(), 'wa_auth'); // Usar CWD para evitar problemas de __dirname en Render

// Limpiar sesión caducada y forzar nuevo QR en cada inicio
function clearWASession() {
    try {
        if (fs.existsSync(WA_AUTH_DIR)) {
            fs.rmSync(WA_AUTH_DIR, { recursive: true, force: true });
            console.log('[WhatsApp] Directorio de sesión eliminado.');
        }
        fs.mkdirSync(WA_AUTH_DIR, { recursive: true });
        console.log('[WhatsApp] Directorio de sesión creado: ' + WA_AUTH_DIR);
    } catch (e) {
        console.error('[WhatsApp] Error al limpiar sesión:', e.message);
    }
    connectionStatus = 'connecting';
    currentQR = null;
}

async function connectToWhatsApp(forceNew = false) {
    if (isConnecting && !forceNew) {
        console.log('[WhatsApp] ⏳ Intento en curso, ignorando duplicado.');
        return;
    }

    console.log(`[WhatsApp] 🔄 Iniciando conexión (forceNew: ${forceNew})...`);
    isConnecting = true;
    connectionStatus = 'connecting';

    if (forceNew || !fs.existsSync(WA_AUTH_DIR)) clearWASession();

    try {
        const { state, saveCreds } = await useMultiFileAuthState(WA_AUTH_DIR);

        if (waSocket) {
            console.log('[WhatsApp] Limpiando socket previo...');
            try {
                waSocket.ev.removeAllListeners();
                waSocket.end();
            } catch (_) { }
            waSocket = null;
        }

        let version = [2, 3000, 1015901307]; // Versión forzada estable
        try {
            const { version: latestVersion, isLatest } = await fetchLatestBaileysVersion();
            console.log(`[WhatsApp] Usando versión WA Web: ${latestVersion} (isLatest: ${isLatest})`);
            version = latestVersion;
        } catch (vErr) {
            console.warn('[WhatsApp] Error obteniendo versión, usando fallback:', vErr.message);
        }

        waSocket = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: true,
            logger: pino({ level: 'info' }),
            browser: ['Ubuntu', 'Chrome', '110.0.5563.147'],
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 30000,
            keepAliveIntervalMs: 30000,
            generateHighQualityLinkPreview: false,
            syncFullHistory: false
        });

        waSocket.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                try {
                    currentQR = await QRCode.toDataURL(qr);
                    connectionStatus = 'qr';
                    console.log('[WhatsApp] ✨ NUEVO QR GENERADO ✨');
                } catch (qrErr) {
                    console.error('[WhatsApp] ❌ Error convirtiendo QR:', qrErr.message);
                }
            }

            if (connection === 'close') {
                const code = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.code;
                const reason = lastDisconnect?.error?.message || 'sin razón';
                lastError = { code, reason, timestamp: new Date() };

                console.log(`[WhatsApp] 🛑 Cerrado. Code: ${code}, Reason: ${reason}`);

                // No poner status a 'disconnected' si es un error temporal (tipo handshake)
                // para que el dashboard no parpadee, pero si code es 401/403 hay que resetear.
                const isLoggedOut = code === DisconnectReason.loggedOut;

                if (isLoggedOut) {
                    console.log('[WhatsApp] 🚪 SESIÓN CERRADA POR EL USUARIO. Limpiando...');
                    connectionStatus = 'disconnected';
                    currentQR = null;
                    clearWASession();
                    setTimeout(() => connectToWhatsApp(true), 5000);
                } else {
                    console.log('[WhatsApp] 🔄 Reintentando conexión sin borrar sesión...');
                    setTimeout(() => {
                        isConnecting = false;
                        connectToWhatsApp(false);
                    }, 5000);
                }
            } else if (connection === 'open') {
                console.log('[WhatsApp] ✅ CONEXIÓN ABIERTA');
                connectionStatus = 'connected';
                currentQR = null;
                isConnecting = false;
            }
        });

        waSocket.ev.on('creds.update', saveCreds);

        waSocket.ev.on('messages.upsert', async m => {
            const msg = m.messages[0];
            if (!msg.message) return;

            // Debug: capturar el mensaje literal para ver qué llega
            lastReceivedMessage = {
                type: m.type,
                pushName: msg.pushName,
                key: msg.key,
                message: msg.message,
                timestamp: new Date()
            };

            if (msg.key.fromMe) return;

            const from = msg.key.remoteJid;

            // Extracción ULTRA-robusta de texto
            const text = msg.message.conversation ||
                msg.message.extendedTextMessage?.text ||
                msg.message.imageMessage?.caption ||
                msg.message.videoMessage?.caption ||
                msg.message.buttonsResponseMessage?.selectedButtonId ||
                msg.message.templateButtonReplyMessage?.selectedId ||
                msg.message.listResponseMessage?.title ||
                msg.message.ephemeralMessage?.message?.conversation ||
                msg.message.viewOnceMessage?.message?.conversation ||
                msg.message.viewOnceMessageV2?.message?.conversation ||
                msg.message.documentWithCaptionMessage?.message?.documentMessage?.caption;

            if (text) {
                console.log(`[WhatsApp] 📥 RECIBIDO de ${from}: "${text}"`);

                try {
                    const brains = await dbFind(brainsDb, {});
                    const activeBrain = brains[0] || { nombre: 'Cerebro Genérico', catalogo: [], shortcuts: {}, nicho: 'Ventas' };

                    console.log(`[WhatsApp] 🧠 Procesando "${text}" con cerebro: ${activeBrain.name || activeBrain.nombre}`);

                    const result = await generateAIResponse({
                        brain: activeBrain,
                        mensajeCliente: text,
                        historial: []
                    });

                    if (result && result.respuestaTexto) {
                        console.log(`[WhatsApp] 🤖 RESPUESTA GENERADA: "${result.respuestaTexto}"`);
                        await waSocket.sendMessage(from, { text: result.respuestaTexto });
                        console.log(`[WhatsApp] ✅ Mensaje enviado exitosamente a ${from}`);
                    } else {
                        console.warn('[WhatsApp] ⚠️ La IA devolvió una respuesta vacía o inválida:', result);
                    }
                } catch (error) {
                    console.error('[WhatsApp] ❌ Error crítico en el flujo de la IA:', error);
                }
            }
        });
    } catch (err) {
        console.error('[WhatsApp] ❌ ERROR CRITICAL:', err);
        lastError = { code: 'CRITICAL', reason: err.message, timestamp: new Date() };
        connectionStatus = 'disconnected';
        isConnecting = false;
        setTimeout(() => connectToWhatsApp(false), 10000); // Reintentar sin borrar sesión por defecto
    }
}

// Inicializar intentando recuperar sesión existente
setTimeout(() => connectToWhatsApp(false), 2000);


// Configuración de Multer para recibir audios temporales
const upload = multer({ dest: 'uploads/' });

// Ruta de Prueba y Estado
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        database: 'connected (local NeDB)',
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
        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña son requeridos.' });
        }
        const existing = await dbFindOne(usersDb, { email });
        if (existing) {
            return res.status(400).json({ error: 'Ese correo electrónico ya está registrado.' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await dbInsert(usersDb, { email, password: hashedPassword, createdAt: new Date() });
        const token = jwt.sign({ userId: user._id }, JWT_SECRET);
        res.status(201).json({ user: { id: user._id, email: user.email }, token });
    } catch (error) {
        console.error("Error en Registro:", error);
        res.status(400).json({ error: error.message || 'Error al registrar usuario.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await dbFindOne(usersDb, { email });
        if (!user) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
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
        const brain = await dbInsert(brainsDb, { ...req.body, userId: req.user.userId, createdAt: new Date() });
        res.status(201).json(brain);
    } catch (error) {
        res.status(400).json({ error: 'Error al crear cerebro.' });
    }
});

app.get('/api/brains', auth, async (req, res) => {
    try {
        const brains = await dbFind(brainsDb, { userId: req.user.userId });
        res.json(brains);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener cerebros.' });
    }
});

app.get('/api/brains/:id', auth, async (req, res) => {
    try {
        const brain = await dbFindOne(brainsDb, { _id: req.params.id, userId: req.user.userId });
        if (!brain) return res.status(404).json({ error: 'Cerebro no encontrado.' });
        res.json(brain);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener el cerebro.' });
    }
});

/**
 * SERVICIO DE ENTRENAMIENTO
 */
app.post('/api/brains/:id/train', auth, async (req, res) => {
    try {
        const { query, aiResponse, correction } = req.body;
        const brain = await dbFindOne(brainsDb, { _id: req.params.id, userId: req.user.userId });
        if (!brain) return res.status(404).json({ error: 'Cerebro no encontrado.' });
        const newTraining = [...(brain.trainingData || []), { query, aiResponse, correction }];
        await dbUpdate(brainsDb, { _id: req.params.id }, { $set: { trainingData: newTraining } });
        res.json({ success: true, message: 'Entrenamiento guardado correctamente.' });
    } catch (error) {
        res.status(500).json({ error: 'Error al entrenar el cerebro.' });
    }
});

/**
 * SERVICIO DE CONOCIMIENTO (Link Reader)
 */
app.post('/api/knowledge/url', auth, async (req, res) => {
    try {
        const { url, brainId } = req.body;
        if (!url || !brainId) {
            return res.status(400).json({ error: 'URL y ID de cerebro son requeridos.' });
        }

        console.log(`[Knowledge] 🌐 Scrapeando URL: ${url} para el cerebro ${brainId}`);
        const content = await scrapeUrl(url);

        const brain = await dbFindOne(brainsDb, { _id: brainId, userId: req.user.userId });
        if (!brain) return res.status(404).json({ error: 'Cerebro no encontrado.' });

        const knowledgeBase = [...(brain.knowledgeBase || []), { source: url, content, timestamp: new Date() }];
        await dbUpdate(brainsDb, { _id: brainId }, { $set: { knowledgeBase } });

        res.json({ success: true, message: 'URL leída y añadida a la base de conocimiento con éxito.' });
    } catch (error) {
        console.error("Error en Knowledge Scraper:", error.message);
        res.status(500).json({ error: error.message || 'Error al procesar la URL.' });
    }
});

/**
 * ACTUALIZAR RASGOS DE PERSONALIDAD
 */
app.patch('/api/brains/:id/traits', auth, async (req, res) => {
    try {
        const { personalityTraits } = req.body;
        const brain = await dbFindOne(brainsDb, { _id: req.params.id, userId: req.user.userId });
        if (!brain) return res.status(404).json({ error: 'Cerebro no encontrado.' });

        await dbUpdate(brainsDb, { _id: req.params.id }, { $set: { personalityTraits } });
        res.json({ success: true, message: 'Rasgos de personalidad actualizados.' });
    } catch (error) {
        console.error("Error actualizando rasgos:", error);
        res.status(500).json({ error: 'Error al actualizar rasgos.' });
    }
});


/**
 * SERVICIO 1: OÍDO (Whisper)
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

app.get('/api/whatsapp/messages/last', auth, (req, res) => {
    res.json(lastReceivedMessage || { message: "No se ha recibido ningún mensaje aún." });
});

app.get('/api/whatsapp/debug', auth, (req, res) => {
    res.json({
        status: connectionStatus,
        isConnecting,
        lastError,
        authDirExists: fs.existsSync(WA_AUTH_DIR),
        authFiles: fs.existsSync(WA_AUTH_DIR) ? fs.readdirSync(WA_AUTH_DIR) : [],
        time: new Date()
    });
});

app.get('/api/debug/brains', auth, async (req, res) => {
    try {
        const brains = await dbFind(brainsDb, {});
        res.json({ count: brains.length, brains: brains.map(b => ({ name: b.name || b.nombre, id: b._id })) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Resetear sesión de WhatsApp y forzar nuevo QR
app.post('/api/whatsapp/reset', auth, async (req, res) => {
    console.log('[WhatsApp] Reset solicitado.');
    connectionStatus = 'disconnected';
    currentQR = null;
    isConnecting = false;
    clearWASession();
    setTimeout(() => connectToWhatsApp(true), 1000);
    res.json({ success: true, message: 'Sesión reseteada. Nuevo QR generándose...' });
});

/**
 * Helper: Generador de Respuestas con Gemini
 */
async function generateAIResponse({ brain, mensajeCliente, historial = [], ultimoItemEnviadoPorHumano = null }) {
    const brainName = brain?.nombre || "Cerebro Clon";
    const catalogoProductos = brain?.catalogoProductos || brain?.catalogo || CRM_MEMORY.catalogo;
    const respuestasRapidas = brain?.respuestasRapidas || brain?.shortcuts || CRM_MEMORY.shortcuts;

    let extraExamples = "";
    if (brain?.trainingData && brain.trainingData.length > 0) {
        extraExamples = "\nEJEMPLOS DE CORRECCIONES PREVIAS:\n" +
            brain.trainingData.slice(-5).map(t => `Cliente: "${t.query}"\nIA propuso: "${t.aiResponse}"\nHumano corrigió a: "${t.correction}"`).join("\n---\n");
    }

    const personality = brain?.personalityTraits || { isWhatsAppStyle: true, aggressivenessLevel: 5, forbidLongLinks: false };
    let personalityRules = `\nRASGOS DE PERSONALIDAD DE ESTE CEBERO:\n`;
    if (personality.isWhatsAppStyle) {
        personalityRules += "- ESTILO WHATSAPP: Sé casual, usa emojis, responde corto. JAMÁS pidas que te envíen un correo electrónico.\n";
    }
    if (personality.forbidLongLinks) {
        personalityRules += "- PROHIBICIÓN DE LINKS: NO envíes ninguna URL o enlace bajo ninguna circunstancia.\n";
    }
    personalityRules += `- AGRESIVIDAD DE CIERRE (1-10): ${personality.aggressivenessLevel}. (1=Muy pasivo, 10=Cierre súper agresivo y persuasivo).\n`;

    let externalKnowledge = "";
    if (brain?.knowledgeBase && brain.knowledgeBase.length > 0) {
        externalKnowledge = "\nINFORMACIÓN EXTRAÍDA DE FUENTES EXTERNAS (DOCUMENTOS/URLS):\n" +
            brain.knowledgeBase.slice(-3).map(k => `Fuente: ${k.source}\nContenido: ${k.content}`).join("\n---\n");
    }

    const systemPrompt = `
      Eres una 'Instancia de Cerebro Clonado' llamada "${brainName}".
      Actúas de manera 100% natural, como un humano real. Tu meta es cerrar el 90% de las ventas.
      
      ESTADO ACTUAL DE LA MEMORIA:
      - Historial del chat: ${JSON.stringify(historial)}
      - Último producto que el humano envió manualmente: ${ultimoItemEnviadoPorHumano ? JSON.stringify(ultimoItemEnviadoPorHumano) : 'Ninguno'}
      ${personalityRules}
      ${externalKnowledge}
      
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
      
      Devuelve un JSON exacto:
      {
         "sentiment": "rojo|amarillo|verde",
         "reasoning": "...",
         "respuestaTexto": "...",
         "requiereMultimedia": "ninguno|video_demostrativo|pdf_ficha_tecnica|pdf_contrato|datos_bancarios"
      }
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    const textResponse = response.text();
    
    const jsonString = textResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    return JSON.parse(jsonString);
}

/**
 * SERVICIO 2: CEREBRO (Gemini)
 */
app.post('/api/cerebro', auth, async (req, res) => {
    try {
        const {
            mensajeCliente,
            historial = [],
            brainId,
            ultimoItemEnviadoPorHumano = null
        } = req.body;

        if (!mensajeCliente) return res.status(400).json({ error: 'No se envió mensaje.' });

        let brain = null;
        if (brainId) {
            brain = await dbFindOne(brainsDb, { _id: brainId, userId: req.user.userId });
        }

        const brainOutput = await generateAIResponse({ brain, mensajeCliente, historial, ultimoItemEnviadoPorHumano });
        res.json(brainOutput);
    } catch (error) {
        console.error("Error Cerebro Gemini:", error.message);
        res.status(500).json({ error: 'Fallo en la generación.' });
    }
});

/**
 * SERVICIO 3: VOZ (ElevenLabs)
 */
app.post('/api/voice', async (req, res) => {
    try {
        const { texto } = req.body;
        if (!texto) return res.status(400).json({ error: 'No se envió texto.' });

        const voiceUrl = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`;
        const response = await axios.post(
            voiceUrl,
            { text: texto, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.8 } },
            { headers: { 'Accept': 'audio/mpeg', 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json' }, responseType: 'arraybuffer' }
        );

        res.setHeader('Content-Type', 'audio/mpeg');
        res.send(response.data);
    } catch (error) {
        console.error("Error Voz ElevenLabs:", error.message);
        res.status(500).json({ error: 'Fallo al generar audio.' });
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
        '/cuenta': 'Te dejo la cuenta: BBVA 0123... A nombre de Comercializadora.'
    },
    sesiones: {}
};

/**
 * Webhook Evolution API
 */
app.post('/webhook/whatsapp', async (req, res) => {
    try {
        const { messageType, content, from, isFromMe } = req.body;

        if (isFromMe && messageType === 'catalog_message') {
            CRM_MEMORY.sesiones[from] = { ultimoItemEnviadoPorHumano: content.productId };
            return res.json({ success: true });
        }

        if (isFromMe) return res.json({ success: true });

        let mensajeCliente = content;
        if (messageType === 'audio') mensajeCliente = "[Audio]: " + mensajeCliente;

        const brainResponse = await axios.post(`http://localhost:${port}/api/cerebro`, {
            mensajeCliente,
            historial: [],
            ultimoItemEnviadoPorHumano: CRM_MEMORY.sesiones[from]?.ultimoItemEnviadoPorHumano || null
        });

        const decision = brainResponse.data;
        let payloadEnvio = { to: from, text: decision.respuestaTexto };

        if (decision.requiereMultimedia && decision.requiereMultimedia !== 'ninguno') {
            payloadEnvio.media = `url_del_crm_asset/${decision.requiereMultimedia}`;
        }

        res.json({ success: true, action: payloadEnvio });
    } catch (error) {
        console.error("Error Webhook:", error);
        res.status(500).send('Error');
    }
});

app.listen(port, () => {
    console.log(`[Cerebro Central] Motor Backend en puerto ${port}`);
});

// Error Handler Global
app.use((err, req, res, next) => {
    console.error("GLOBAL ERROR:", err);
    res.status(500).json({ error: err.message || 'Error interno del servidor' });
});
