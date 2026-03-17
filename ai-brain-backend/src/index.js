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
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion,
    downloadMediaMessage,
    downloadContentFromMessage,
    BufferJSON,
    proto
} = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');
const Datastore = require('@seald-io/nedb');
const { scrapeUrl } = require('./services/scraper');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// =============================================
// PERSISTENCIA HÍBRIDA: NeDB (Local) + MongoDB (Nube) J7282
// =============================================
const mongoUri = process.env.MONGODB_URI;
let isMongoConnected = false;

if (mongoUri) {
    mongoose.connect(mongoUri)
        .then(() => {
            console.log('[MongoDB] ✅ Conectado a Atlas - Mente Blindada');
            isMongoConnected = true;
            runCloudMigration(); // Sincronizar NeDB -> Mongo al iniciar J7282
        })
        .catch(err => console.error('[MongoDB] ❌ Error de conexión:', err.message));
}

// Schemas de Mongoose para Inmortalidad J7282
const UserSchema = new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const MUser = mongoose.model('User', UserSchema);

const BrainSchema = new mongoose.Schema({
    userId: String,
    name: String,
    nombre: String,
    catalogo: Array,
    shortcuts: Array,
    trainingData: Array,
    knowledgeBase: Array,
    personalityTraits: Object,
    createdAt: Date
});
const MBrain = mongoose.model('Brain', BrainSchema);

// Schema para Sesión Inmortal J7282
const SessionSchema = new mongoose.Schema({
    id: { type: String, unique: true, required: true },
    data: { type: String, required: true }
});
const MSession = mongoose.model('Session', SessionSchema);

// Helper para Auth State en MongoDB J7282
async function useMongoDBAuthState() {
    const writeData = (data, id) => {
        return MSession.updateOne(
            { id },
            { $set: { data: JSON.stringify(data, BufferJSON.replacer) } },
            { upsert: true }
        );
    };

    const readData = async (id) => {
        const res = await MSession.findOne({ id });
        return res ? JSON.parse(res.data, BufferJSON.reviver) : null;
    };

    const removeData = async (id) => {
        await MSession.deleteOne({ id });
    };

    const creds = await readData('creds') || (await useMultiFileAuthState(WA_AUTH_DIR)).state.creds;

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(
                        ids.map(async id => {
                            let value = await readData(`${type}-${id}`);
                            if (type === 'app-state-sync-key' && value) {
                                value = proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            data[id] = value;
                        })
                    );
                    return data;
                },
                set: async (data) => {
                    const promises = [];
                    for (const type in data) {
                        for (const id in data[type]) {
                            const value = data[type][id];
                            if (value) {
                                promises.push(writeData(value, `${type}-${id}`));
                            } else {
                                promises.push(removeData(`${type}-${id}`));
                            }
                        }
                    }
                    await Promise.all(promises);
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds')
    };
}

const NeuronalLogSchema = new mongoose.Schema({
    message: String,
    type: String,
    metadata: Object,
    timestamp: { type: Date, default: Date.now }
});
const MNeuronalLog = mongoose.model('NeuronalLog', NeuronalLogSchema);

// =============================================
// BASE DE DATOS LOCAL (NeDB - Sin configuración)
// Los datos se guardan en archivos .db en el servidor
// =============================================
const dbDir = path.join(__dirname, '../data');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const usersDb = new Datastore({ filename: path.join(dbDir, 'users.db'), autoload: true });
const brainsDb = new Datastore({ filename: path.join(dbDir, 'brains.db'), autoload: true });
const chatsDb = new Datastore({ filename: path.join(dbDir, 'chats.db'), autoload: true });
const messagesDb = new Datastore({ filename: path.join(dbDir, 'messages.db'), autoload: true });
const neuronalLogsDb = new Datastore({ filename: path.join(dbDir, 'neuronal_logs.db'), autoload: true });

// Índice único en email para evitar duplicados
usersDb.ensureIndex({ fieldName: 'email', unique: true }, err => {
    if (err) console.error('[DB] Error creando índice users:', err);
});

// Índice en jid para búsquedas rápidas de historial
messagesDb.ensureIndex({ fieldName: 'jid' }, err => {
    if (err) console.error('[DB] Error creando índice messages:', err);
    else console.log('[DB] ✅ Índices de base de datos creados correctamente');
});

// Helpers para promisificar NeDB
const dbFind = (db, query) => new Promise((res, rej) => db.find(query, (e, d) => e ? rej(e) : res(d)));
const dbFindOne = (db, query) => new Promise((res, rej) => db.findOne(query, (e, d) => e ? rej(e) : res(d)));
const dbInsert = (db, doc) => new Promise((res, rej) => db.insert(doc, (e, d) => e ? rej(e) : res(d)));
const dbUpdate = (db, q, u, opt) => new Promise((res, rej) => db.update(q, u, opt || {}, (e, n) => e ? rej(e) : res(n)));
const dbCount = (db, query) => new Promise((res, rej) => db.count(query, (e, n) => e ? rej(e) : res(n)));

// Helper para logs neuronales
async function addNeuronalLog(message, type = 'info', metadata = {}) {
    try {
        const log = {
            message,
            type,
            metadata,
            timestamp: new Date()
        };
        await dbInsert(neuronalLogsDb, log);
        if (isMongoConnected) await MNeuronalLog.create(log); // Backup en nube J7282
        
        io.emit('neuronal-log', log); 
        console.log(`[NeuronalLog] [${type.toUpperCase()}] ${message}`);
    } catch (e) {
        console.error('Error guardando log neuronal:', e);
    }
}

/**
 * MOTOR DE MIGRACIÓN: NeDB -> MongoDB J7282
 * Asegura que si ya tenías cerebros locales, se suban a Atlas.
 */
async function runCloudMigration() {
    if (!isMongoConnected) return;
    try {
        console.log('[Migration] 🔄 Verificando migración de cerebros...');
        const localBrains = await dbFind(brainsDb, {});
        for (const brain of localBrains) {
            const exists = await MBrain.findOne({ _id: brain._id });
            if (!exists) {
                console.log(`[Migration] 📤 Subiendo cerebro: ${brain.name}`);
                await MBrain.create(brain);
            }
        }
        
        const localUsers = await dbFind(usersDb, {});
        for (const user of localUsers) {
            const exists = await MUser.findOne({ email: user.email });
            if (!exists) {
                console.log(`[Migration] 👤 Subiendo usuario: ${user.email}`);
                await MUser.create(user);
            }
        }
        console.log('[Migration] ✅ Sincronización con la nube completada.');
    } catch (e) {
        console.error('[Migration] ❌ Error:', e.message);
    }
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // En producción deberías restringir esto
        methods: ["GET", "POST"]
    }
});

io.on('connection', async (socket) => {
    console.log(`[Socket] Cliente conectado: ${socket.id}`);
    // Enviar chats actuales al conectar
    const allChats = await dbFind(chatsDb, {});
    socket.emit('all-chats', allChats);
});

const port = process.env.PORT || 3000;

// Configuración de middlewares
app.use(cors());
app.use(express.json());
app.use('/media', express.static(path.join(__dirname, 'public/media'))); // Servir multimedia J7282

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

    try {
        // PRIORIDAD: Sesión Inmortal en MongoDB si está conectado J7282
        let state, saveCreds;
        if (isMongoConnected) {
            console.log('[WhatsApp] 🔐 Usando Motor de Sesión Inmortal (MongoDB)');
            const mongoAuth = await useMongoDBAuthState();
            state = mongoAuth.state;
            saveCreds = mongoAuth.saveCreds;
        } else {
            console.log('[WhatsApp] 📂 Usando Almacenamiento Local (Carpeta wa_auth)');
            const localAuth = await useMultiFileAuthState(WA_AUTH_DIR);
            state = localAuth.state;
            saveCreds = localAuth.saveCreds;
        }

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
            logger: pino({ level: 'silent' }),
            browser: ['Ubuntu', 'Chrome', '110.0.5563.147'],
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 0,
            keepAliveIntervalMs: 10000, 
            generateHighQualityLinkPreview: true,
            syncFullHistory: true, 
            shouldSyncHistoryMessage: () => true 
        });

        waSocket.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                try {
                    currentQR = await QRCode.toDataURL(qr);
                    connectionStatus = 'qr';
                    console.log('[WhatsApp] ✨ NUEVO QR GENERADO ✨');
                    await addNeuronalLog('Nuevo código QR generado. Escanea para conectar.', 'system');
                } catch (qrErr) {
                    console.error('[WhatsApp] ❌ Error convirtiendo QR:', qrErr.message);
                }
            }

            if (connection === 'open') {
                console.log('[WhatsApp] ✅ CONEXIÓN ABIERTA');
                connectionStatus = 'connected';
                currentQR = null;
                isConnecting = false;
                await addNeuronalLog('WhatsApp conectado exitosamente. Sincronizando chats...', 'system');
                // Al conectar, forzar una actualización de previsualizaciones
                setTimeout(syncChatPreviews, 5000);
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

        // Captura de HISTORIAL COMPLETO (Estilo WhatsApp Web) - OPTIMIZADO PARA 500+ CHATS
        waSocket.ev.on('messaging-history.set', async ({ chats: newChats, contacts, messages: newMessages, isLatest }) => {
            console.log(`[WhatsApp] 📥 RECIBIDO HISTORIAL MASIVO: ${newChats.length} chats, ${newMessages.length} mensajes.`);
            await addNeuronalLog(`Sincronización masiva iniciada (${newChats.length} chats detectados)...`, 'system');

            // 1. Mapa de contactos
            const contactMap = {};
            if (contacts) {
                contacts.forEach(c => {
                    contactMap[c.id] = c.name || c.notify || c.verifiedName;
                });
            }

            // 2. Procesar TODOS los chats en trozos de 100 para no saturar memoria
            const CHUNK_SIZE = 100;
            for (let i = 0; i < newChats.length; i += CHUNK_SIZE) {
                const chunk = newChats.slice(i, i + CHUNK_SIZE);
                const chunkPromises = chunk.map(async chat => {
                    const chatMsgs = newMessages.filter(m => m.key.remoteJid === chat.id);
                    let lastText = chat.conversation || "";
                    let lastTime = chat.tcStr ? parseInt(chat.tcStr) * 1000 : (chat.timestamp ? chat.timestamp * 1000 : Date.now());

                    if (chatMsgs.length > 0) {
                        const lastM = chatMsgs[chatMsgs.length - 1];
                        lastText = lastM.message?.conversation || 
                                   lastM.message?.extendedTextMessage?.text || 
                                   lastM.message?.imageMessage?.caption || 
                                   lastM.message?.videoMessage?.caption;

                        if (!lastText) {
                            if (lastM.message?.imageMessage) lastText = "📷 Imagen";
                            else if (lastM.message?.videoMessage) lastText = "🎥 Video";
                            else if (lastM.message?.audioMessage) lastText = "🎤 Audio";
                            else if (lastM.message?.documentMessage) lastText = "📄 Documento";
                            else lastText = "Multimedia";
                        }
                        if (lastM.messageTimestamp) lastTime = lastM.messageTimestamp * 1000;
                    }

                    const updateData = {
                        jid: chat.id,
                        pushName: contactMap[chat.id] || chat.name || chat.id.split('@')[0],
                        lastTimestamp: new Date(lastTime)
                    };
                    if (lastText) updateData.lastMessage = lastText;

                    return dbUpdate(chatsDb, { jid: chat.id }, { $set: updateData }, { upsert: true });
                });

                await Promise.all(chunkPromises);
                console.log(`[WhatsApp] ⏳ Procesado bloque ${i/CHUNK_SIZE + 1} de chats...`);
                // Emitir avance parcial para que el usuario no espere al final
                const currentChats = await dbFind(chatsDb, {});
                io.emit('all-chats', currentChats);
            }
            
            await addNeuronalLog(`Chats sincronizados. Procesando mensajes históricos...`, 'system');

            // 3. Procesar Mensajes (Bulk Insert) - Más profundo
            const messagesToInsert = [];
            const historyLimit = 2000; // Aumentamos límite
            const recentMessages = newMessages.slice(-historyLimit);

            for (const m of recentMessages) {
                if (!m.message) continue;
                // Extracción de texto + Multimedia para el historial
                let hText = m.message?.conversation || 
                           m.message?.extendedTextMessage?.text || 
                           m.message?.imageMessage?.caption || 
                           m.message?.videoMessage?.caption;
                
                let hIsMultimedia = false;
                let hMediaType = null;

                if (!hText) {
                    if (m.message?.imageMessage) { hText = "📷 Imagen"; hIsMultimedia = true; hMediaType = 'image'; }
                    else if (m.message?.videoMessage) { hText = "🎥 Video"; hIsMultimedia = true; hMediaType = 'video'; }
                    else if (m.message?.audioMessage) { hText = "🎤 Audio"; hIsMultimedia = true; hMediaType = 'audio'; }
                    else if (m.message?.documentMessage) { hText = "📄 Documento"; hIsMultimedia = true; hMediaType = 'document'; }
                    else if (m.message?.stickerMessage) { hText = "🧧 Sticker"; hIsMultimedia = true; hMediaType = 'sticker'; }
                    else if (m.message?.contactMessage || m.message?.contactsArrayMessage) { hText = "👤 Contacto"; hIsMultimedia = true; hMediaType = 'contact'; }
                    else if (m.message?.locationMessage) { hText = "📍 Ubicación"; hIsMultimedia = true; hMediaType = 'location'; }
                    else { hText = "Multimedia"; hIsMultimedia = true; } // Fallback genérico
                }

                if (hText) {
                    messagesToInsert.push({
                        jid: m.key.remoteJid,
                        text: hText,
                        role: m.key.fromMe ? 'ai' : 'client',
                        timestamp: new Date((m.messageTimestamp || Date.now() / 1000) * 1000),
                        isMultimedia: hIsMultimedia,
                        mediaType: hMediaType
                    });
                }
            }

            if (messagesToInsert.length > 0) {
                try {
                    await messagesDb.remove({}, { multi: true });
                    await dbInsert(messagesDb, messagesToInsert);
                    io.emit('history-sync-complete', { count: messagesToInsert.length });
                    console.log(`[WhatsApp] ✅ Sincronización completa.`);
                    await syncChatPreviews(); // Forzar última previsualización correcta
                } catch (err) {
                    console.error('[WhatsApp] Error en insert:', err.message);
                }
            }

            await addNeuronalLog(`✅ Sincronización total completada. Dashboard listo.`, 'system');
        });

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

            // Extracción ULTRA-robusta de texto + Detección Multimedia
            let text = msg.message.conversation ||
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

            let isMultimedia = false;
            let mediaType = null;
            
            if (!text) {
                if (msg.message.imageMessage) { text = "📷 Imagen"; isMultimedia = true; mediaType = 'image'; }
                else if (msg.message.videoMessage) { text = "🎥 Video"; isMultimedia = true; mediaType = 'video'; }
                else if (msg.message.audioMessage) { text = "🎤 Audio / Nota de voz"; isMultimedia = true; mediaType = 'audio'; }
                else if (msg.message.documentMessage) { text = "📄 Documento"; isMultimedia = true; mediaType = 'document'; }
                else if (msg.message.stickerMessage) { text = "🧧 Sticker"; isMultimedia = true; mediaType = 'sticker'; }
                else if (msg.message.contactMessage || msg.message.contactsArrayMessage) { text = "👤 Contacto"; isMultimedia = true; mediaType = 'contact'; }
                else if (msg.message.locationMessage) { text = "📍 Ubicación"; isMultimedia = true; mediaType = 'location'; }
            }

            if (text) {
                console.log(`[WhatsApp] 📥 RECIBIDO de ${from}: "${text}"`);
                
                // DESCARGAR MEDIA SI EXISTE J7282
                let mediaUrl = null;
                if (isMultimedia && mediaType !== 'sticker' && mediaType !== 'contact' && mediaType !== 'location') {
                    try {
                        const buffer = await downloadMediaMessage(msg, 'buffer', {}, { 
                            logger: console,
                            reuploadRequest: waSocket.updateMediaMessage 
                        });
                        const extension = mediaType === 'image' ? 'jpg' : mediaType === 'video' ? 'mp4' : 'aac';
                        const fileName = `${Date.now()}_${from.split('@')[0]}.${extension}`;
                        const filePath = path.join(__dirname, 'public/media', fileName);
                        fs.writeFileSync(filePath, buffer);
                        mediaUrl = `/media/${fileName}`;
                        console.log(`[Media] Guardado: ${mediaUrl}`);
                    } catch (mediaErr) {
                        console.error('[Media] Error al descargar:', mediaErr.message);
                    }
                }

                // Persistir Mensaje y Chat
                const msgData = {
                    jid: from,
                    text: text || (mediaType ? `[${mediaType}]` : ''),
                    role: 'client',
                    timestamp: new Date(),
                    pushName: msg.pushName,
                    isMultimedia,
                    mediaType,
                    mediaUrl // Guardar URL de media J7282
                };
                await dbInsert(messagesDb, msgData);
                
                await dbUpdate(chatsDb, { jid: from }, { 
                    $set: { 
                        jid: from, 
                        lastMessage: text || `[${mediaType}]`, 
                        lastTimestamp: new Date(),
                        pushName: msg.pushName || from.split('@')[0],
                        lastRole: 'client'
                    } 
                }, { upsert: true });

                // NOTIFICAR AL DASHBOARD EN TIEMPO REAL
                io.emit('new-message', msgData);
                io.emit('chat-update', { jid: from, lastMessage: text || `[${mediaType}]`, lastTimestamp: new Date(), pushName: msg.pushName });

                try {
                    const brains = await dbFind(brainsDb, {});
                    const activeBrain = brains[0] || { nombre: 'Cerebro Genérico', catalogo: [], shortcuts: {}, nicho: 'Ventas' };

                    await addNeuronalLog(`Procesando mensaje de ${msg.pushName || from}: "${text}"`, 'info', { from, text });
                    
                    const result = await generateAIResponse({
                        brain: activeBrain,
                        mensajeCliente: text,
                        historial: []
                    });

                    if (result && result.respuestaTexto) {
                        await addNeuronalLog(`Respuesta generada para ${from}: "${result.respuestaTexto}"`, 'ai', { sentiment: result.sentiment });
                        
                        // ¿Enviar como VOZ o TEXTO? 
                        const useVoice = activeBrain.useVoiceResponse || false; 

                        if (useVoice && ELEVENLABS_API_KEY) {
                            await addNeuronalLog(`Generando nota de voz con perfil clonado...`, 'brain');
                            try {
                                const voiceRes = await axios.post(`http://localhost:${port}/api/voice`, 
                                    { texto: result.respuestaTexto }, 
                                    { responseType: 'arraybuffer' }
                                );
                                await waSocket.sendMessage(from, { 
                                    audio: Buffer.from(voiceRes.data), 
                                    mimetype: 'audio/mp4', 
                                    ptt: true 
                                });
                                await addNeuronalLog(`Nota de voz enviada exitosamente.`, 'ai');
                            } catch (vErr) {
                                console.error('[Voice] Error generando audio:', vErr.message);
                                await waSocket.sendMessage(from, { text: result.respuestaTexto });
                            }
                        } else {
                            await waSocket.sendMessage(from, { text: result.respuestaTexto });
                        }
                        
                        // Persistir Respuesta de la IA
                        await dbInsert(messagesDb, {
                            jid: from,
                            text: result.respuestaTexto,
                            role: 'ai',
                            timestamp: new Date(),
                            sentiment: result.sentiment,
                            isVoice: useVoice
                        });
                        
                        await dbUpdate(chatsDb, { jid: from }, { 
                            $set: { 
                                lastMessage: result.respuestaTexto, 
                                lastTimestamp: new Date(),
                                sentiment: result.sentiment
                            } 
                        });

                        const aiMsgData = {
                            jid: from,
                            text: result.respuestaTexto,
                            role: 'ai',
                            timestamp: new Date(),
                            sentiment: result.sentiment,
                            isVoice: useVoice
                        };
                        io.emit('new-message', aiMsgData);
                        io.emit('chat-update', { jid: from, lastMessage: result.respuestaTexto, lastTimestamp: new Date(), sentiment: result.sentiment });

                        console.log(`[WhatsApp] ✅ Mensaje procesado exitosamente para ${from}`);
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
app.get('/api/debug/db-stats', auth, async (req, res) => {
    try {
        const usersCount = await dbCount(usersDb, {});
        const brainsCount = await dbCount(brainsDb, {});
        const chatsCount = await dbCount(chatsDb, {});
        const messagesCount = await dbCount(messagesDb, {});
        res.json({
            users: usersCount,
            brains: brainsCount,
            chats: chatsCount,
            messages: messagesCount,
            backend_version: '1.6.1-CHUNK-SYNC'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/health', async (req, res) => {
    try {
        const chatsCount = await dbCount(chatsDb, {});
        const msgsCount = await dbCount(messagesDb, {});
        res.json({
            status: 'online',
            version: '1.6.8-CLOUD-READY',
            waStatus: connectionStatus,
            mongo: isMongoConnected, // Confirmación de Blindaje J7282
            database: {
                chats: await dbCount(chatsDb, {}),
                messages: await dbCount(messagesDb, {})
            },
            services: {
                cerebro: true,
                oido: true,
                voz: !!ELEVENLABS_API_KEY
            }
        });
    } catch (e) {
        res.json({ status: 'partial', error: e.message });
    }
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
        
        // Buscar en NeDB o Mongo J7282
        let existing = await dbFindOne(usersDb, { email });
        if (!existing && isMongoConnected) {
            existing = await MUser.findOne({ email });
        }

        if (existing) {
            return res.status(400).json({ error: 'Ese correo electrónico ya está registrado.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userData = { email, password: hashedPassword, createdAt: new Date() };
        
        // Guardado Dual J7282
        const user = await dbInsert(usersDb, userData);
        if (isMongoConnected) await MUser.create({ ...userData, _id: user._id });

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
        
        // Buscar en ambos para asegurar login tras reinicios J7282
        let user = await dbFindOne(usersDb, { email });
        if (!user && isMongoConnected) {
            user = await MUser.findOne({ email });
            if (user) await dbInsert(usersDb, user); // Auto-recuperación local J7282
        }

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
        const brainData = { ...req.body, userId: req.user.userId, createdAt: new Date() };
        const brain = await dbInsert(brainsDb, brainData);
        
        // Guardado Dual en la Nube J7282
        if (isMongoConnected) await MBrain.create({ ...brainData, _id: brain._id });
        
        res.status(201).json(brain);
    } catch (error) {
        res.status(400).json({ error: 'Error al crear cerebro.' });
    }
});

app.get('/api/brains', auth, async (req, res) => {
    try {
        // Consultar Nube primero si está conectado J7282
        if (isMongoConnected) {
            const brains = await MBrain.find({ userId: req.user.userId });
            if (brains.length > 0) return res.json(brains);
        }
        const brainsLocal = await dbFind(brainsDb, { userId: req.user.userId });
        res.json(brainsLocal);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener cerebros.' });
    }
});

app.get('/api/brains/:id', auth, async (req, res) => {
    try {
        let brain = null;
        if (isMongoConnected) {
            brain = await MBrain.findOne({ _id: req.params.id, userId: req.user.userId });
        }
        if (!brain) {
            brain = await dbFindOne(brainsDb, { _id: req.params.id, userId: req.user.userId });
        }
        
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
        
        // Actualización Dual J7282
        await dbUpdate(brainsDb, { _id: req.params.id }, { $set: { trainingData: newTraining } });
        if (isMongoConnected) {
            await MBrain.updateOne({ _id: req.params.id }, { $set: { trainingData: newTraining } });
        }
        
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
        
        // Actualización Dual J7282
        await dbUpdate(brainsDb, { _id: brainId }, { $set: { knowledgeBase } });
        if (isMongoConnected) {
            await MBrain.updateOne({ _id: brainId }, { $set: { knowledgeBase } });
        }

        res.json({ success: true, message: 'URL leída y añadida a la base de conocimiento con éxito.' });
    } catch (error) {
        console.error("Error en Knowledge Scraper:", error.message);
        res.status(500).json({ error: error.message || 'Error al procesar la URL.' });
    }
});

/**
 * API WHATSAPP REAL (History & Chats)
 */
app.get('/api/whatsapp/chats', auth, async (req, res) => {
    try {
        const chats = await dbFind(chatsDb, {});
        // Ordenar por último mensaje
        chats.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
        res.json(chats);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener chats.' });
    }
});

app.get('/api/whatsapp/messages/:jid', auth, async (req, res) => {
    try {
        const messages = await dbFind(messagesDb, { jid: req.params.jid });
        // Ordenar por timestamp y limitar a los últimos 100 para velocidad total J7282
        messages.sort((a, b) => a.timestamp - b.timestamp);
        const limitedMessages = messages.slice(-100);
        res.json(limitedMessages);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener mensajes.' });
    }
});

app.get('/api/neuronal-logs', auth, async (req, res) => {
    try {
        const logs = await dbFind(neuronalLogsDb, {});
        // Devolver los últimos 50 logs por ahora
        logs.sort((a, b) => b.timestamp - a.timestamp);
        res.json(logs.slice(0, 50));
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener logs neuronales.' });
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

        // Actualización Dual J7282
        await dbUpdate(brainsDb, { _id: req.params.id }, { $set: { personalityTraits } });
        if (isMongoConnected) {
            await MBrain.updateOne({ _id: req.params.id }, { $set: { personalityTraits } });
        }

        res.json({ success: true, message: 'Rasgos de personalidad actualizados.' });
    } catch (error) {
        console.error("Error actualizando rasgos:", error);
        res.status(500).json({ error: 'Error al actualizar rasgos.' });
    }
});

/**
 * RECONSTRUIR VISTA PREVIA DE CHATS
 * Busca el último mensaje real en la DB para cada chat
 */
async function syncChatPreviews() {
    console.log('[WhatsApp] 🔍 Reconstruyendo previsualizaciones de chats...');
    try {
        const chats = await dbFind(chatsDb, {});
        for (const chat of chats) {
            const msgs = await dbFind(messagesDb, { jid: chat.jid });
            if (msgs.length > 0) {
                msgs.sort((a, b) => b.timestamp - a.timestamp);
                const last = msgs[0];
                await dbUpdate(chatsDb, { jid: chat.jid }, { 
                    $set: { 
                        lastMessage: last.text, 
                        lastTimestamp: last.timestamp 
                    } 
                });
            }
        }
        console.log('[WhatsApp] ✅ Previsualizaciones actualizadas.');
        // Notificar al frontend
        const allChats = await dbFind(chatsDb, {});
        io.emit('all-chats', allChats);
    } catch (err) {
        console.error('[WhatsApp] Error reconstruyendo previews:', err.message);
    }
}

// Ejecutar reconstrucción periódicamente (cada 5 minutos) y al inicio
setTimeout(syncChatPreviews, 10000);
setInterval(syncChatPreviews, 300000);

app.post('/api/whatsapp/sync-previews', auth, async (req, res) => {
    await syncChatPreviews();
    res.json({ success: true, message: 'Sincronización manual iniciada.' });
});

app.post('/api/whatsapp/send', auth, async (req, res) => {
    try {
        const { jid, text } = req.body;
        if (!waSocket || connectionStatus !== 'connected') {
            return res.status(400).json({ error: 'WhatsApp no está conectado.' });
        }

        await waSocket.sendMessage(jid, { text });

        // Persistir Mensaje Enviado
        await dbInsert(messagesDb, {
            jid,
            text,
            role: 'agent', // Diferenciamos AI de Agente Humano
            timestamp: new Date()
        });

        await dbUpdate(chatsDb, { jid }, { 
            $set: { 
                lastMessage: text, 
                lastTimestamp: new Date()
            } 
        });

        res.json({ success: true });
    } catch (error) {
        console.error("Error enviando mensaje manual:", error);
        res.status(500).json({ error: 'Error al enviar el mensaje.' });
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
    
    await addNeuronalLog(`Darwin activado para ${brainName}`, 'system');
    await addNeuronalLog(`Analizando mensaje: "${mensajeCliente}"`, 'brain');

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

server.listen(port, () => {
    console.log(`[Cerebro Central] Motor Backend con WebSockets en puerto ${port}`);
});

// Error Handler Global
app.use((err, req, res, next) => {
    console.error("GLOBAL ERROR:", err);
    res.status(500).json({ error: err.message || 'Error interno del servidor' });
});
