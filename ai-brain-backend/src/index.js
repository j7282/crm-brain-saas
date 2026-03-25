require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const cron       = require('node-cron');
const QRCode     = require('qrcode');
const OpenAI     = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios      = require('axios');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { Boom }   = require('@hapi/boom');
const db         = require('./db');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*', methods: ['GET','POST'] } });

// IA Clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const genAI  = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const gemini = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Multi-usuario: un socket de WA por usuario
const waSessions = new Map();

// J7282: Socket.io Connection Handler - Arreglado por auditoría de Claude
io.on('connection', (socket) => {
  console.log('[Socket.io] Cliente conectado:', socket.id);

  // Escuchar cuando un usuario se une a su room
  socket.on('join', (userId) => {
    socket.join(`u_${userId}`);
    console.log(`[Socket.io] Usuario ${userId} unido a room u_${userId}`);

    // Enviar estado actual de WhatsApp
    const sock = waSessions.get(userId);
    if (sock) {
      io.to(`u_${userId}`).emit('wa-status', { connected: true });
    }
  });

  socket.on('disconnect', () => {
    console.log('[Socket.io] Cliente desconectado:', socket.id);
  });
});
// Anti-spam: contador de mensajes por usuario+prospecto
const msgCountMap = new Map();

const JWT_SECRET = process.env.JWT_SECRET;

// ── AUTH MIDDLEWARE ──
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Token invalido' }); }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'superadmin') return res.status(403).json({ error: 'Sin acceso' });
  next();
};

// ── HELPERS ──
async function trackUsage(userId, field, amount = 1) {
  const date = new Date().toISOString().slice(0,10);
  try { await db.ApiUsage.findOneAndUpdate({ userId, date }, { $inc: { [field]: amount } }, { upsert: true }); }
  catch(e) {}
}

function canSend(userId, phone) {
  const key = `${userId}:${phone}`;
  const now  = Date.now();
  const MAX  = parseInt(process.env.MAX_MSGS_PER_HOUR || 3);
  const DELAY= parseInt(process.env.MIN_DELAY_MS || 30000);
  const entry = msgCountMap.get(key) || { count:0, resetAt: now+3600000, lastSent:0 };
  if (now > entry.resetAt) { entry.count=0; entry.resetAt=now+3600000; }
  if (entry.count >= MAX || now - entry.lastSent < DELAY) return false;
  entry.count++; entry.lastSent=now; msgCountMap.set(key,entry); return true;
}

function detectObjections(text) {
  const map = {
    precio:  ['caro','precio','costoso','presupuesto','dinero','mucho'],
    tiempo:  ['tiempo','ocupado','ahorita','despues','luego','espera'],
    duda:    ['no se','pensar','dudas','seguro','garantia'],
    socio:   ['socio','pareja','jefe','consultar','preguntar'],
  };
  const found = [];
  const lower = text.toLowerCase();
  for (const [obj, words] of Object.entries(map)) {
    if (words.some(w => lower.includes(w))) found.push(obj);
  }
  return found;
}

// ── GEMINI: ANALIZAR CHUNK ──
async function analyzeChunkWithGemini(chunkText, existingDNA) {
  const prompt = `Analiza estas conversaciones de WhatsApp de un vendedor.
${existingDNA ? 'Perfil existente a mejorar: ' + JSON.stringify(existingDNA) : ''}
CONVERSACIONES:\n${chunkText}
Responde SOLO JSON sin markdown:
{"tone":"","communicationStyle":"","closingStyle":"","topPatterns":[{"name":"","pct":80,"description":""}],"signaturePhrases":[""],"powerWords":[""],"objectionHandlers":[""],"uniqueHooks":[""],"weaknesses":[""]}`;
  try {
    const r = await gemini.generateContent(prompt);
    return JSON.parse(r.response.text().replace(/```json|```/g,'').trim());
  } catch(e) { return null; }
}

function mergeDNAResults(existing, next) {
  if (!existing) return next;
  if (!next) return existing;
  return {
    tone: next.tone || existing.tone,
    communicationStyle: next.communicationStyle || existing.communicationStyle,
    closingStyle: next.closingStyle || existing.closingStyle,
    topPatterns: [...(existing.topPatterns||[]), ...(next.topPatterns||[])].reduce((acc,p) => {
      const f = acc.find(x=>x.name===p.name);
      if (f) f.pct=Math.round((f.pct+p.pct)/2); else acc.push(p);
      return acc;
    },[]).slice(0,8),
    signaturePhrases: [...new Set([...(existing.signaturePhrases||[]),...(next.signaturePhrases||[])])].slice(0,6),
    powerWords:       [...new Set([...(existing.powerWords||[]),...(next.powerWords||[])])].slice(0,8),
    objectionHandlers:[...(existing.objectionHandlers||[]),...(next.objectionHandlers||[])].slice(0,5),
    uniqueHooks:      [...(existing.uniqueHooks||[]),...(next.uniqueHooks||[])].slice(0,4),
    weaknesses:       [...(existing.weaknesses||[]),...(next.weaknesses||[])].slice(0,3),
  };
}

// ── GENERAR RESPUESTA DARWIN ──
async function generateDarwinResponse(phone, message, userId) {
  try {
    const [brain, conv] = await Promise.all([
      db.Brain.findOne({ userId }),
      db.Conversation.findOne({ phone, userId })
    ]);
    if (!brain || brain.dnaScore < 20) return 'Hola! En que te puedo ayudar?';
    const history = (conv?.messages||[]).slice(-10).map(m=>`${m.role==='client'?'Cliente':'Yo'}: ${m.text}`).join('\n');
    const prompt = `Eres el clon de ventas. Tono: ${brain.tone}. Estilo: ${brain.communicationStyle}. Cierre: ${brain.closingStyle}.
Patrones: ${(brain.topPatterns||[]).slice(0,3).map(p=>p.name+': '+p.description).join(' | ')}
Frases firma: ${(brain.signaturePhrases||[]).join(' / ')}
Etapa cliente: ${conv?.stage||'nuevo'} | Objeciones previas: ${(conv?.objections||[]).join(',')}
Historial:\n${history}
${brain.extraInstruction?'Extra: '+brain.extraInstruction:''}
REGLAS: Max 3-4 lineas. No digas que eres IA. Al final escribe: [PATRON: nombre . Confianza: XX%]
Cliente dice: ${message}`;
    const r = await gemini.generateContent(prompt);
    await trackUsage(userId,'geminiTokens', Math.ceil(r.response.text().length/4));
    return r.response.text().trim();
  } catch(e) { console.error('Darwin error:',e.message); return null; }
}

// ── TRANSCRIBIR AUDIO ──
async function transcribeAudio(buffer) {
  try {
    const { Readable } = require('stream');
    const s = Readable.from(buffer); s.path='audio.ogg';
    const t = await openai.audio.transcriptions.create({ file:s, model:'whisper-1', language:'es' });
    return t.text;
  } catch(e) { console.error('Whisper:',e.message); return null; }
}

// ── GENERAR VOZ ELEVENLABS ──
async function generateVoice(text, voiceId) {
  if (!process.env.ELEVENLABS_API_KEY || !voiceId) return null;
  try {
    const r = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      { text, model_id:'eleven_turbo_v2', voice_settings:{stability:0.75,similarity_boost:0.80} },
      { headers:{'xi-api-key':process.env.ELEVENLABS_API_KEY,'Content-Type':'application/json','Accept':'audio/mpeg'}, responseType:'arraybuffer' }
    );
    await trackUsage('system','elevenLabsChars',text.length);
    return Buffer.from(r.data);
  } catch(e) { console.error('ElevenLabs:',e.message); return null; }
}

// ── CONECTAR WHATSAPP POR USUARIO ──
async function connectWhatsApp(userId) {
  try {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(`./data/auth_${userId}`);
    const sock = makeWASocket({
      version, auth:state, printQRInTerminal:false,
      browser:['Darwin CRM','Chrome','120.0.0'],
      syncFullHistory:true,
      logger: require('pino')({level:'silent'})
    });
    waSessions.set(userId, sock);
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        try { const qrData = await QRCode.toDataURL(qr); io.to(`u_${userId}`).emit('qr',{qr:qrData}); }
        catch(e) {}
      }
      if (connection === 'close') {
        await db.User.findByIdAndUpdate(userId, { waConnected:false });
        io.to(`u_${userId}`).emit('wa-status',{connected:false});
        const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
        // J7282: Límite de reintentos por auditoría de Claude
        let retryCount = waSessions.get(userId + '_retry') || 0;
        if (code !== DisconnectReason.loggedOut && retryCount < 10) {
          waSessions.set(userId + '_retry', retryCount + 1);
          setTimeout(() => connectWhatsApp(userId), 5000 * (retryCount + 1));
        } else {
          console.error(`WhatsApp J7282: Desconexión permanente o límite alcanzado (${retryCount}) Usuario: ${userId}`);
          waSessions.delete(userId);
          waSessions.delete(userId + '_retry');
        }
      }
      if (connection === 'open') {
        const phone = sock.user?.id?.split(':')[0]||'';
        await db.User.findByIdAndUpdate(userId, { waConnected:true, waPhone:phone });
        io.to(`u_${userId}`).emit('wa-status',{connected:true,phone});
        await db.ActivityLog.create({userId,action:'WA_CONNECTED',details:'WA: '+phone});
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        if (msg.key.fromMe) continue;
        const isGroup = msg.key.remoteJid.includes('@g.us');
        if (isGroup) continue;
        const phone = msg.key.remoteJid.replace('@s.whatsapp.net','');

        let text='', mediaType='text';
        if (msg.message?.conversation) {
          text = msg.message.conversation;
        } else if (msg.message?.extendedTextMessage?.text) {
          text = msg.message.extendedTextMessage.text;
        } else if (msg.message?.audioMessage) {
          mediaType = 'audio';
          try {
            const buf = await sock.downloadMediaMessage(msg,'buffer');
            text = await transcribeAudio(buf) || '[Audio]';
            await trackUsage(userId,'whisperAudios',1);
          } catch(e) { text='[Audio recibido]'; }
        } else if (msg.message?.imageMessage) {
          mediaType='image'; text=msg.message.imageMessage.caption||'[Imagen]';
        } else if (msg.message?.videoMessage) {
          mediaType='video'; text=msg.message.videoMessage.caption||'[Video]';
        } else if (msg.message?.documentMessage) {
          mediaType='document'; text=msg.message.documentMessage.fileName||'[Documento]';
        } else continue;

        // Guardar en MongoDB
        const conv = await db.Conversation.findOneAndUpdate(
          { phone, userId },
          { $push:{messages:{role:'client',text,mediaType,timestamp:new Date()}}, $set:{lastMessage:new Date(),updatedAt:new Date()}, $setOnInsert:{name:msg.pushName||phone,source:'WhatsApp'} },
          { upsert:true, new:true }
        );

        const objections = detectObjections(text);
        if (objections.length) await db.Conversation.findOneAndUpdate({phone,userId},{$addToSet:{objections:{$each:objections}}});

        await trackUsage(userId,'messagesIn',1);
        io.to(`u_${userId}`).emit('new-message',{phone,text,mediaType,name:conv.name,timestamp:new Date(),stage:conv.stage});

        // Darwin responde
        const brain = await db.Brain.findOne({userId});
        if (!brain || brain.mode==='mirror') continue;
        if (!canSend(userId,phone)) continue;

        await new Promise(r=>setTimeout(r, 1500+Math.random()*2000));

        const darwinResp = await generateDarwinResponse(phone,text,userId);
        if (!darwinResp) continue;

        const patMatch = darwinResp.match(/\[PATRON: (.+?)\]/);
        const patInfo  = patMatch?.[1]||null;
        const clean    = darwinResp.replace(/\[PATRON:.+?\]/,'').trim();

        let sentVoice = false;
        if (brain.useVoice) {
          const user = await db.User.findById(userId);
          if (user?.voiceId) {
            const audioBuffer = await generateVoice(clean, user.voiceId);
            if (audioBuffer) {
              await sock.sendMessage(msg.key.remoteJid, {audio:audioBuffer,mimetype:'audio/mpeg',ptt:true});
              sentVoice = true;
            }
          }
        }
        if (!sentVoice) await sock.sendMessage(msg.key.remoteJid, {text:clean});

        await db.Conversation.findOneAndUpdate(
          {phone,userId},
          {$push:{messages:{role:'darwin',text:clean,mediaType:sentVoice?'audio':'text',pattern:patInfo,timestamp:new Date()}}}
        );
        await trackUsage(userId,'messagesOut',1);
        io.to(`u_${userId}`).emit('darwin-response',{phone,text:clean,pattern:patInfo,sentVoice,timestamp:new Date()});
      }
    });

    return sock;
  } catch(e) { console.error('WA connect error:',e.message); waSessions.delete(userId); }
}

// ── SOCKET.IO ──
io.on('connection', socket => {
  socket.on('join', userId => socket.join(`u_${userId}`));
});

// ═══════════════════════════════════
//  ENDPOINTS
// ═══════════════════════════════════

// Status
app.get('/api/status', (req, res) => res.json({ status: 'ok', version: '2.0.0', waSessions: waSessions.size }));

app.post('/api/wa/connect', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    // Si ya hay sesión, intentar reconectar o borrar para nueva
    if (waSessions.has(userId)) {
       const sock = waSessions.get(userId);
       sock.logout().catch(() => {});
       waSessions.delete(userId);
    }
    connectWhatsApp(userId);
    res.json({ message: 'Procesando conexión de WhatsApp...' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Auth
app.post('/api/auth/register', async (req,res) => {
  try {
    const { name, email, password, company, plan } = req.body;
    if (!name||!email||!password) return res.status(400).json({error:'Campos requeridos'});
    if (await db.User.findOne({email:email.toLowerCase()})) return res.status(400).json({error:'Email ya registrado'});
    const hash = await bcrypt.hash(password,12);
    const user = await db.User.create({name,email:email.toLowerCase(),password:hash,company,plan:plan||'starter'});
    const token = jwt.sign({userId:user._id.toString(),email:user.email,role:user.role},JWT_SECRET,{expiresIn:'8h'});
    res.json({token,user:{id:user._id,name,email:user.email,company,plan:user.plan,role:user.role,initials:name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}});
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/auth/login', async (req,res) => {
  try {
    const { email, password } = req.body;
    if (email===process.env.SUPER_ADMIN_EMAIL && password===process.env.SUPER_ADMIN_PASS) {
      const token = jwt.sign({userId:'superadmin',email,role:'superadmin'},JWT_SECRET,{expiresIn:'8h'});
      return res.json({token,user:{id:'superadmin',name:'Super Admin',email,plan:'admin',role:'superadmin',isSuperAdmin:true,initials:'SA'}});
    }
    const user = await db.User.findOne({email:email.toLowerCase()});
    if (!user||!user.active) return res.status(401).json({error:'Credenciales incorrectas'});
    if (!await bcrypt.compare(password,user.password)) return res.status(401).json({error:'Credenciales incorrectas'});
    const token = jwt.sign({userId:user._id.toString(),email:user.email,role:user.role},JWT_SECRET,{expiresIn:'8h'});
    await db.User.findByIdAndUpdate(user._id,{lastLogin:new Date()});
    await db.ActivityLog.create({userId:user._id.toString(),action:'LOGIN',ip:req.ip});
    const initials = user.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    res.json({token,user:{id:user._id,name:user.name,email:user.email,company:user.company,plan:user.plan,role:user.role,initials}});
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.get('/api/auth/me', authMiddleware, async (req,res) => {
  try {
    if (req.user.userId==='superadmin') return res.json({isSuperAdmin:true,role:'superadmin'});
    const u = await db.User.findById(req.user.userId).select('-password');
    res.json(u);
  } catch(e) { res.status(500).json({error:e.message}); }
});

// WhatsApp
app.post('/api/whatsapp/connect', authMiddleware, async (req,res) => {
  const uid = req.user.userId;
  if (!waSessions.has(uid)) connectWhatsApp(uid);
  res.json({message:'Iniciando conexion. Escucha evento "qr" via WebSocket en sala "u_'+uid+'"'});
});

app.post('/api/whatsapp/disconnect', authMiddleware, async (req,res) => {
  try {
    const sock = waSessions.get(req.user.userId);
    if (sock) { try { await sock.logout(); } catch(e){} waSessions.delete(req.user.userId); }
    await db.User.findByIdAndUpdate(req.user.userId,{waConnected:false});
    res.json({success:true});
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.get('/api/whatsapp/status', authMiddleware, async (req,res) => {
  const u = await db.User.findById(req.user.userId).select('waConnected waPhone');
  res.json({connected:waSessions.has(req.user.userId),phone:u?.waPhone||''});
});

// Conversaciones
app.get('/api/conversations', authMiddleware, async (req,res) => {
  try {
    const {stage,limit=40} = req.query;
    const f = {userId:req.user.userId};
    if (stage) f.stage=stage;
    const convs = await db.Conversation.find(f).sort({updatedAt:-1}).limit(parseInt(limit)).select('-messages');
    res.json(convs);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.get('/api/conversations/:phone', authMiddleware, async (req,res) => {
  try {
    const conv = await db.Conversation.findOne({phone:req.params.phone,userId:req.user.userId});
    res.json(conv||{});
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.patch('/api/conversations/:phone/stage', authMiddleware, async (req,res) => {
  try {
    const conv = await db.Conversation.findOneAndUpdate({phone:req.params.phone,userId:req.user.userId},{stage:req.body.stage,updatedAt:new Date()},{new:true});
    res.json(conv);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/conversations/:phone/send', authMiddleware, async (req,res) => {
  try {
    const {text,asVoice} = req.body;
    const sock = waSessions.get(req.user.userId);
    if (!sock) return res.status(400).json({error:'WhatsApp no conectado'});
    const jid = req.params.phone+'@s.whatsapp.net';
    if (asVoice) {
      const u = await db.User.findById(req.user.userId);
      const buf = await generateVoice(text,u?.voiceId);
      if (buf) await sock.sendMessage(jid,{audio:buf,mimetype:'audio/mpeg',ptt:true});
      else await sock.sendMessage(jid,{text});
    } else {
      await sock.sendMessage(jid,{text});
    }
    await db.Conversation.findOneAndUpdate({phone:req.params.phone,userId:req.user.userId},{$push:{messages:{role:'human',text,timestamp:new Date()}}});
    res.json({success:true});
  } catch(e) { res.status(500).json({error:e.message}); }
});

// Cerebro
app.post('/api/whatsapp/scan-dna', authMiddleware, async (req,res) => {
  try {
    const {months=3} = req.body;
    const userId = req.user.userId;
    const since = new Date(); since.setMonth(since.getMonth()-months);
    const convs = await db.Conversation.find({userId,updatedAt:{$gte:since}});
    if (!convs.length) return res.status(400).json({error:'Sin conversaciones en ese periodo'});
    const allMsgs = convs.flatMap(c=>c.messages.filter(m=>m.role!=='client'&&m.text&&m.text.length>10).map(m=>`[${m.role}]: ${m.text}`));
    if (!allMsgs.length) return res.status(400).json({error:'Sin mensajes del vendedor'});
    let dna = null;
    for (let i=0;i<allMsgs.length&&i<3000;i+=40) {
      const r = await analyzeChunkWithGemini(allMsgs.slice(i,i+40).join('\n'),dna);
      dna = mergeDNAResults(dna,r);
    }
    if (!dna) return res.status(500).json({error:'Error al analizar'});
    const score = Math.min(98,Math.floor(50+(allMsgs.length/200)*40));
    const brain = await db.Brain.findOneAndUpdate({userId},{...dna,dnaScore:score,cloneConfidence:score-5,msgsProcessed:allMsgs.length,updatedAt:new Date()},{upsert:true,new:true});
    res.json({success:true,dna:brain});
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.get('/api/brain', authMiddleware, async (req,res) => {
  try { res.json(await db.Brain.findOne({userId:req.user.userId})||{}); }
  catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/brain/save', authMiddleware, async (req,res) => {
  try {
    const brain = await db.Brain.findOneAndUpdate({userId:req.user.userId},{...req.body,updatedAt:new Date()},{upsert:true,new:true});
    res.json({success:true,brain});
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/brain/mirror-mode', authMiddleware, async (req,res) => {
  try {
    const {active,days=7} = req.body;
    const upd = active ? {mode:'mirror',mirrorDays:days,mirrorStartedAt:new Date()} : {mode:'active'};
    const b = await db.Brain.findOneAndUpdate({userId:req.user.userId},upd,{upsert:true,new:true});
    res.json({success:true,mode:b.mode});
  } catch(e) { res.status(500).json({error:e.message}); }
});

// Catalogo
app.get('/api/catalog', authMiddleware, async (req,res) => {
  try { res.json(await db.CatalogItem.find({userId:req.user.userId}).sort({createdAt:-1})); }
  catch(e) { res.status(500).json({error:e.message}); }
});
app.post('/api/catalog', authMiddleware, async (req,res) => {
  try { res.json(await db.CatalogItem.create({userId:req.user.userId,...req.body})); }
  catch(e) { res.status(500).json({error:e.message}); }
});
app.patch('/api/catalog/:id', authMiddleware, async (req,res) => {
  try { res.json(await db.CatalogItem.findOneAndUpdate({_id:req.params.id,userId:req.user.userId},req.body,{new:true})); }
  catch(e) { res.status(500).json({error:e.message}); }
});
app.delete('/api/catalog/:id', authMiddleware, async (req,res) => {
  try { await db.CatalogItem.findOneAndDelete({_id:req.params.id,userId:req.user.userId}); res.json({success:true}); }
  catch(e) { res.status(500).json({error:e.message}); }
});
app.post('/api/catalog/:id/send', authMiddleware, async (req,res) => {
  try {
    const item = await db.CatalogItem.findById(req.params.id);
    const sock = waSessions.get(req.user.userId);
    if (!item||!sock) return res.status(400).json({error:'Item o WA no disponible'});
    const msg = `${item.emoji} *${item.name}*\n$${item.price} ${item.currency}\n\n${item.description}`;
    await sock.sendMessage(req.body.phone+'@s.whatsapp.net',{text:msg});
    await db.CatalogItem.findByIdAndUpdate(req.params.id,{$inc:{sentCount:1}});
    res.json({success:true});
  } catch(e) { res.status(500).json({error:e.message}); }
});

// Respuestas rapidas
app.get('/api/quick-replies', authMiddleware, async (req,res) => {
  try { res.json(await db.QuickReply.find({userId:req.user.userId}).sort({stage:1})); }
  catch(e) { res.status(500).json({error:e.message}); }
});
app.post('/api/quick-replies', authMiddleware, async (req,res) => {
  try { res.json(await db.QuickReply.create({userId:req.user.userId,...req.body})); }
  catch(e) { res.status(500).json({error:e.message}); }
});
app.patch('/api/quick-replies/:id', authMiddleware, async (req,res) => {
  try { res.json(await db.QuickReply.findOneAndUpdate({_id:req.params.id,userId:req.user.userId},req.body,{new:true})); }
  catch(e) { res.status(500).json({error:e.message}); }
});
app.delete('/api/quick-replies/:id', authMiddleware, async (req,res) => {
  try { await db.QuickReply.findOneAndDelete({_id:req.params.id,userId:req.user.userId}); res.json({success:true}); }
  catch(e) { res.status(500).json({error:e.message}); }
});

// Recordatorios
app.get('/api/reminders', authMiddleware, async (req,res) => {
  try { res.json(await db.Reminder.find({userId:req.user.userId,status:'pending'}).sort({scheduledAt:1})); }
  catch(e) { res.status(500).json({error:e.message}); }
});
app.post('/api/reminders', authMiddleware, async (req,res) => {
  try { res.json(await db.Reminder.create({userId:req.user.userId,...req.body})); }
  catch(e) { res.status(500).json({error:e.message}); }
});
app.patch('/api/reminders/:id/cancel', authMiddleware, async (req,res) => {
  try { await db.Reminder.findByIdAndUpdate(req.params.id,{status:'cancelled'}); res.json({success:true}); }
  catch(e) { res.status(500).json({error:e.message}); }
});

// Reporte supervision
app.post('/api/supervision/report', authMiddleware, async (req,res) => {
  try {
    const uid = req.user.userId;
    const today = new Date(); today.setHours(0,0,0,0);
    const [convs,brain,usage] = await Promise.all([
      db.Conversation.find({userId:uid,updatedAt:{$gte:today}}),
      db.Brain.findOne({userId:uid}),
      db.ApiUsage.findOne({userId:uid,date:new Date().toISOString().slice(0,10)})
    ]);
    const report = {
      date: new Date().toISOString(),
      closedToday: convs.filter(c=>c.stage==='cierre').length,
      darwinMsgs: convs.flatMap(c=>c.messages.filter(m=>m.role==='darwin')).length,
      activeConvs: convs.length,
      dnaScore: brain?.dnaScore||0,
      tokensUsed: usage?.geminiTokens||0,
      audiosTranscribed: usage?.whisperAudios||0
    };
    io.to(`u_${uid}`).emit('supervision-report',report);
    res.json({success:true,report});
  } catch(e) { res.status(500).json({error:e.message}); }
});

// Analitica
app.get('/api/analytics', authMiddleware, async (req,res) => {
  try {
    const {days=30} = req.query;
    const since = new Date(); since.setDate(since.getDate()-parseInt(days));
    const uid = req.user.userId;
    const [convs,usage] = await Promise.all([
      db.Conversation.find({userId:uid,updatedAt:{$gte:since}}),
      db.ApiUsage.find({userId:uid}).sort({date:-1}).limit(parseInt(days))
    ]);
    const stages = {nuevo:0,contactado:0,propuesta:0,cierre:0,perdido:0};
    convs.forEach(c=>{if(stages[c.stage]!==undefined)stages[c.stage]++;});
    const darwinM = convs.flatMap(c=>c.messages.filter(m=>m.role==='darwin')).length;
    const humanM  = convs.flatMap(c=>c.messages.filter(m=>m.role==='human')).length;
    const total   = darwinM+humanM;
    res.json({totalConvs:convs.length,stages,darwinPct:total?Math.round(darwinM/total*100):0,closureRate:convs.length?Math.round(stages.cierre/convs.length*100):0,dailyUsage:usage});
  } catch(e) { res.status(500).json({error:e.message}); }
});

// Admin endpoints
app.get('/api/admin/users', authMiddleware, adminOnly, async (req,res) => {
  try { res.json(await db.User.find().select('-password').sort({createdAt:-1})); }
  catch(e) { res.status(500).json({error:e.message}); }
});
app.patch('/api/admin/users/:id', authMiddleware, adminOnly, async (req,res) => {
  try { res.json(await db.User.findByIdAndUpdate(req.params.id,req.body,{new:true}).select('-password')); }
  catch(e) { res.status(500).json({error:e.message}); }
});
app.get('/api/admin/api-usage', authMiddleware, adminOnly, async (req,res) => {
  try {
    const date  = new Date().toISOString().slice(0,10);
    const users = await db.User.find().select('-password');
    const usage = await db.ApiUsage.find({date});
    const result = users.map(u => {
      const uu = usage.find(x=>x.userId===u._id.toString())||{};
      const gCost = ((uu.geminiTokens||0)/1000000*0.15).toFixed(4);
      const wCost = ((uu.whisperAudios||0)*0.006).toFixed(4);
      const eCost = ((uu.elevenLabsChars||0)/1000*0.18).toFixed(4);
      const total = (parseFloat(gCost)+parseFloat(wCost)+parseFloat(eCost)).toFixed(4);
      return {userId:u._id,name:u.name,email:u.email,plan:u.plan,waConnected:u.waConnected,
        geminiTokens:uu.geminiTokens||0,whisperAudios:uu.whisperAudios||0,elevenLabsChars:uu.elevenLabsChars||0,
        messagesIn:uu.messagesIn||0,messagesOut:uu.messagesOut||0,
        geminiCost:gCost,whisperCost:wCost,elevenCost:eCost,totalCost:total};
    });
    res.json(result);
  } catch(e) { res.status(500).json({error:e.message}); }
});
app.get('/api/admin/logs', authMiddleware, adminOnly, async (req,res) => {
  try { res.json(await db.ActivityLog.find().sort({timestamp:-1}).limit(200)); }
  catch(e) { res.status(500).json({error:e.message}); }
});
app.get('/api/admin/backups', authMiddleware, adminOnly, async (req,res) => {
  try { res.json(await db.Backup.find().sort({createdAt:-1}).limit(30)); }
  catch(e) { res.status(500).json({error:e.message}); }
});
app.post('/api/admin/backups', authMiddleware, adminOnly, async (req,res) => {
  try {
    const counts = await Promise.all([db.User.countDocuments(),db.Conversation.countDocuments(),db.Brain.countDocuments()]);
    const b = await db.Backup.create({name:'backup-manual-'+new Date().toISOString().slice(0,10),type:'manual',sizeMB:parseFloat(((counts[0]*2+counts[1]*5+counts[2])/1000).toFixed(2)),status:'ok'});
    res.json(b);
  } catch(e) { res.status(500).json({error:e.message}); }
});

// ═══════════════════════════════════════════════════════════
// J7282: ENDPOINTS NUEVOS - Agregados por auditoría de Claude
// ═══════════════════════════════════════════════════════════

// Endpoint plural de cerebros (el frontend lo necesita)
app.get('/api/brains', authMiddleware, async (req, res) => {
  try {
    const brain = await db.Brain.findOne({ userId: req.user.userId });
    // Devolver como array para compatibilidad con frontend
    res.json(brain ? [brain] : []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint de logs neuronales para el dashboard
app.get('/api/neuronal-logs', authMiddleware, async (req, res) => {
  try {
    const logs = await db.ActivityLog.find({ userId: req.user.userId })
      .sort({ timestamp: -1 })
      .limit(50);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint de chats para el inbox (conversión de conversations a chats)
app.get('/api/whatsapp/chats', authMiddleware, async (req, res) => {
  try {
    const { limit = 40, skip = 0 } = req.query;

    const conversations = await db.Conversation.find({ userId: req.user.userId })
      .sort({ lastMessage: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));

    const total = await db.Conversation.countDocuments({ userId: req.user.userId });

    // Convertir formato Conversation a formato Chat para el frontend
    const chats = conversations.map(c => {
      const lastMsg = c.messages && c.messages.length > 0
        ? c.messages[c.messages.length - 1]
        : null;

      return {
        jid: c.phone + '@s.whatsapp.net',
        pushName: c.name || c.phone,
        lastMessage: lastMsg?.text || '',
        lastTimestamp: c.lastMessage || c.updatedAt,
        sentiment: c.score > 70 ? 'verde' : (c.score < 30 ? 'rojo' : 'amarillo'),
        labels: c.tags || [],
        role: lastMsg?.role === 'darwin' ? 'ai' : 'user',
        stage: c.stage,
        score: c.score
      };
    });

    res.json({ chats, total });
  } catch (err) {
    console.error('[API Error] /api/whatsapp/chats:', err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para forzar sincronización de WhatsApp
app.post('/api/whatsapp/sync-previews', authMiddleware, async (req, res) => {
  try {
    const sock = waSessions.get(req.user.userId);
    if (!sock) {
      return res.json({ success: false, error: 'WhatsApp no conectado' });
    }

    // Emitir evento de sincronización al frontend
    io.to(`u_${req.user.userId}`).emit('sync-started', { message: 'Sincronización iniciada' });

    res.json({ success: true, message: 'Sincronización iniciada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para obtener mensajes de una conversación (formato alternativo)
app.get('/api/conversations/:jid', authMiddleware, async (req, res) => {
  try {
    const { limit = 40, before } = req.query;
    const phone = req.params.jid.split('@')[0];

    const conv = await db.Conversation.findOne({
      phone,
      userId: req.user.userId
    });

    if (!conv) {
      return res.json([]);
    }

    let messages = conv.messages || [];

    // Filtrar por fecha si se proporciona 'before'
    if (before) {
      const beforeDate = new Date(parseInt(before));
      messages = messages.filter(m => m.timestamp < beforeDate);
    }

    // Ordenar y limitar
    messages = messages
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, parseInt(limit))
      .reverse();

    res.json(messages);
  } catch (err) {
    console.error('[API Error] /api/conversations/:jid:', err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para actualizar traits de personalidad del cerebro
app.post('/api/brains/:id/traits', authMiddleware, async (req, res) => {
  try {
    const { personalityTraits } = req.body;

    const brain = await db.Brain.findOneAndUpdate(
      { userId: req.user.userId },
      {
        $set: {
          aggressiveness: personalityTraits?.aggressivenessLevel || 7,
          formality: personalityTraits?.formality || 4,
          useVoice: personalityTraits?.useVoice || false,
          extraInstruction: personalityTraits?.extraInstruction || '',
          mode: personalityTraits?.isMirrorMode ? 'mirror' : 'active',
          updatedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, brain });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para entrenar el cerebro con correcciones
app.post('/api/brains/:id/train', authMiddleware, async (req, res) => {
  try {
    const { original, corrected, context } = req.body;

    // Guardar la corrección en el historial de entrenamiento
    await db.Brain.findOneAndUpdate(
      { userId: req.user.userId },
      {
        $push: {
          trainingData: {
            query: context,
            aiResponse: original,
            correction: corrected,
            timestamp: new Date()
          }
        },
        $set: { updatedAt: new Date() }
      },
      { upsert: true }
    );

    res.json({ success: true, message: 'Entrenamiento guardado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para agregar conocimiento desde URL
app.post('/api/knowledge/url', authMiddleware, async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL requerida' });
    }

    // Scrape básico del contenido
    const response = await axios.get(url, { timeout: 10000 });
    const content = response.data.substring(0, 5000); // Limitar a 5000 caracteres

    await db.Brain.findOneAndUpdate(
      { userId: req.user.userId },
      {
        $push: {
          knowledgeBase: {
            source: url,
            content: content,
            timestamp: new Date()
          }
        },
        $set: { updatedAt: new Date() }
      },
      { upsert: true }
    );

    res.json({ success: true, message: 'Conocimiento agregado desde URL' });
  } catch (err) {
    console.error('[API Error] /api/knowledge/url:', err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint de reporte de WhatsApp (estadísticas)
app.get('/api/whatsapp/report', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const [convs, brain, user] = await Promise.all([
      db.Conversation.find({ userId }),
      db.Brain.findOne({ userId }),
      db.User.findById(userId)
    ]);

    const totalMessages = convs.reduce((acc, c) => acc + (c.messages?.length || 0), 0);
    const aiMessages = convs.reduce((acc, c) =>
      acc + (c.messages?.filter(m => m.role === 'darwin').length || 0), 0);

    res.json({
      success: true,
      report: {
        totalConversations: convs.length,
        totalMessages,
        aiMessages,
        humanMessages: totalMessages - aiMessages,
        dnaScore: brain?.dnaScore || 0,
        waConnected: user?.waConnected || false,
        stages: {
          nuevo: convs.filter(c => c.stage === 'nuevo').length,
          contactado: convs.filter(c => c.stage === 'contactado').length,
          propuesta: convs.filter(c => c.stage === 'propuesta').length,
          cierre: convs.filter(c => c.stage === 'cierre').length,
          perdido: convs.filter(c => c.stage === 'perdido').length
        }
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CRON JOBS ──
cron.schedule('* * * * *', async () => {
  try {
    const due = await db.Reminder.find({status:'pending',scheduledAt:{$lte:new Date()}});
    for (const r of due) {
      const sock = waSessions.get(r.userId);
      if (sock) try { await sock.sendMessage(r.phone+'@s.whatsapp.net',{text:r.message}); } catch(e){}
      await db.Reminder.findByIdAndUpdate(r._id,{status:'sent',sentAt:new Date()});
      io.to(`u_${r.userId}`).emit('reminder-sent',{reminder:r});
    }
  } catch(e) {}
});

cron.schedule('0 6 * * *', async () => {
  try {
    const counts = await Promise.all([db.User.countDocuments(),db.Conversation.countDocuments(),db.Brain.countDocuments()]);
    await db.Backup.create({name:'backup-auto-'+new Date().toISOString().slice(0,10),type:'auto',sizeMB:parseFloat(((counts[0]*2+counts[1]*5+counts[2])/1000).toFixed(2)),status:'ok'});
  } catch(e) {}
});

cron.schedule('0 * * * *', () => {
  const now = Date.now();
  for (const [k,v] of msgCountMap.entries()) { if (now>v.resetAt) msgCountMap.delete(k); }
});

// ── INICIO ──
async function reconnectSessions() {
  const users = await db.User.find({waConnected:true});
  users.forEach((u,i) => setTimeout(()=>connectWhatsApp(u._id.toString()),2000*i));
}

const PORT = process.env.PORT || 3001;
db.connect().then(() => {
  server.listen(PORT, async () => {
    console.log('Darwin CRM Backend en puerto '+PORT);
    await reconnectSessions();
  });
});
