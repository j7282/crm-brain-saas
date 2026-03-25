# 🔑 CÓMO CONSEGUIR API KEYS PARA DARWIN CRM

**Sistema:** Darwin CRM J7282
**Última actualización:** 2026-03-23

---

## 🎯 API KEYS NECESARIAS

Tu sistema necesita 3 API keys para funcionar al 100%:

1. ✅ **JWT_SECRET** - Ya configurado
2. ❌ **GEMINI_API_KEY** - Necesitas conseguirla (GRATIS)
3. ❌ **OPENAI_API_KEY** - Necesitas conseguirla (PAGO)
4. ⚠️ **ELEVENLABS_API_KEY** - Opcional (para voz clonada)

---

## 1. GEMINI API KEY (GRATIS) 🆓

### **¿Para qué sirve?**
- Respuestas automáticas de Darwin
- Análisis de DNA de ventas
- Detección de objeciones
- Clonación de estilo de comunicación

### **Cómo conseguirla:**

#### **Paso 1: Ir a Google AI Studio**
```
https://aistudio.google.com/app/apikey
```

#### **Paso 2: Iniciar sesión**
- Usa tu cuenta de Google
- Acepta los términos de servicio

#### **Paso 3: Crear API Key**
1. Click en "Create API Key"
2. Selecciona tu proyecto de Google Cloud (o crea uno nuevo)
3. Click en "Create API key in existing project"

#### **Paso 4: Copiar la key**
```
AIzaSy... (cadena de ~40 caracteres)
```

#### **Paso 5: Configurar en Railway**

**Opción A: Por dashboard web**
1. Ve a https://railway.app/
2. Abre tu proyecto `zestful-alignment-production-c71f`
3. Click en "Variables"
4. Agrega: `GEMINI_API_KEY=AIzaSy...`
5. Click "Save"

**Opción B: Por CLI**
```bash
railway variables set GEMINI_API_KEY=AIzaSy...
```

### **Límites GRATIS:**
- ✅ 15 requests por minuto
- ✅ 1,500 requests por día
- ✅ 1 millón de tokens gratis al mes

**Suficiente para:** 5,000-10,000 mensajes de Darwin por mes

---

## 2. OPENAI API KEY (PAGO) 💰

### **¿Para qué sirve?**
- Transcripción de audios de WhatsApp (Whisper)
- Respaldo si Gemini falla
- Funciones avanzadas de IA

### **Cómo conseguirla:**

#### **Paso 1: Crear cuenta en OpenAI**
```
https://platform.openai.com/signup
```

#### **Paso 2: Agregar método de pago**
1. Ve a https://platform.openai.com/account/billing
2. Click "Add payment method"
3. Agrega tarjeta de crédito/débito

#### **Paso 3: Crear API Key**
1. Ve a https://platform.openai.com/api-keys
2. Click "+ Create new secret key"
3. Dale un nombre: "Darwin CRM Production"
4. Click "Create secret key"

#### **Paso 4: Copiar la key**
```
sk-proj-... (cadena de ~50 caracteres)
```

⚠️ **IMPORTANTE:** La key solo se muestra UNA VEZ. Guárdala en un lugar seguro.

#### **Paso 5: Configurar en Railway**
```bash
railway variables set OPENAI_API_KEY=sk-proj-...
```

### **Costos estimados:**
| Feature | Modelo | Costo por 1,000 audios |
|---------|--------|------------------------|
| Whisper (audio → texto) | whisper-1 | $6 USD |

**Estimación mensual:**
- 100 audios/día = $18 USD/mes
- 500 audios/día = $90 USD/mes

**Consejo:** Empieza con $20 USD de crédito y monitorea

---

## 3. ELEVENLABS API KEY (OPCIONAL) 🔊

### **¿Para qué sirve?**
- Clonar tu voz para respuestas por audio
- Enviar mensajes de voz automáticos
- Personalización avanzada

### **Cómo conseguirla:**

#### **Paso 1: Crear cuenta**
```
https://elevenlabs.io/sign-up
```

#### **Paso 2: Ir a perfil**
1. Click en tu avatar (esquina superior derecha)
2. Click "Profile"

#### **Paso 3: Copiar API Key**
```
Sección "API Key" → Click "Copy"
```

#### **Paso 4: Configurar en Railway**
```bash
railway variables set ELEVENLABS_API_KEY=...
```

### **Plan GRATIS:**
- ✅ 10,000 caracteres/mes gratis
- ✅ Clonación de voz básica

**Suficiente para:** ~50 mensajes de voz/mes

### **Plan PRO ($11 USD/mes):**
- ✅ 100,000 caracteres/mes
- ✅ Clonación profesional
- ✅ ~500 mensajes de voz/mes

---

## 🚀 CONFIGURACIÓN RÁPIDA EN RAILWAY

### **Todas las variables que necesitas:**

```bash
# En tu terminal:
cd /Users/ignaciovasquezdias/.gemini/antigravity/playground/primal-spirit/ai-brain-backend

# Configurar todas las keys:
railway variables set GEMINI_API_KEY=AIzaSy...
railway variables set OPENAI_API_KEY=sk-proj-...
railway variables set ELEVENLABS_API_KEY=...  # Opcional

# Verificar que se guardaron:
railway variables
```

### **O editar manualmente el archivo .env:**

```bash
# .env (SOLO PARA DESARROLLO LOCAL)
GEMINI_API_KEY=AIzaSy...
OPENAI_API_KEY=sk-proj-...
ELEVENLABS_API_KEY=...
JWT_SECRET=Darwin_Neuronal_Secure_7282_99x1!
MONGODB_URI=mongodb+srv://admin:Darwin2026@cluster-darwin.up.railway.app/darwin
PORT=3000
```

⚠️ **NUNCA** subas el archivo .env a git. Ya está en .gitignore.

---

## 🧪 PROBAR QUE FUNCIONAN

### **1. Probar Gemini:**
```bash
curl -X POST https://zestful-alignment-production-c71f.up.railway.app/api/whatsapp/scan-dna \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"months": 1}'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "dna": {
    "tone": "...",
    "communicationStyle": "...",
    "dnaScore": 85
  }
}
```

### **2. Probar OpenAI (Whisper):**
```bash
# Enviar un audio por WhatsApp a tu número conectado
# Darwin debería transcribirlo automáticamente
```

### **3. Probar ElevenLabs:**
```bash
curl -X POST https://zestful-alignment-production-c71f.up.railway.app/api/conversations/1234567890/send \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hola, este es un test de voz", "asVoice": true}'
```

---

## 💡 ALTERNATIVAS GRATIS

### **Si no quieres pagar OpenAI:**

1. **Usar solo Gemini:**
   - Gemini es gratis y muy potente
   - Darwin funcionará al 90% sin OpenAI
   - Solo perderás transcripción de audios

2. **Usar Groq (alternativa gratis):**
   ```
   https://console.groq.com/keys
   ```
   - API compatible con OpenAI
   - 100% GRATIS
   - Más rápido que OpenAI

3. **Usar Anthropic Claude (tu mismo):**
   - Si tienes créditos de Anthropic
   - API compatible
   - Excelente calidad

---

## 📊 RESUMEN DE COSTOS

### **Configuración Mínima (GRATIS):**
```
✅ Gemini API         = $0/mes
✅ MongoDB Atlas      = $0/mes (Railway incluido)
✅ Railway Hosting    = $5/mes (plan básico)
─────────────────────────────
TOTAL MÍNIMO         = $5/mes
```

### **Configuración Completa:**
```
✅ Gemini API         = $0/mes
✅ OpenAI (100 audios) = $18/mes
✅ ElevenLabs Pro     = $11/mes
✅ Railway Hosting    = $5/mes
─────────────────────────────
TOTAL COMPLETO       = $34/mes
```

### **Configuración Empresarial:**
```
✅ Gemini API         = $0/mes
✅ OpenAI (500 audios) = $90/mes
✅ ElevenLabs Pro     = $11/mes
✅ Railway Pro        = $20/mes
─────────────────────────────
TOTAL ENTERPRISE     = $121/mes
```

---

## 🆘 PROBLEMAS COMUNES

### **Error: "Invalid API Key"**
```
✅ Verifica que copiaste la key completa
✅ Revisa que no tenga espacios al inicio/final
✅ Confirma que la key está activa en el dashboard
```

### **Error: "Quota exceeded"**
```
✅ Gemini: Espera 1 minuto (límite de 15 req/min)
✅ OpenAI: Agrega más créditos a tu cuenta
✅ ElevenLabs: Upgrade a plan PRO
```

### **Error: "GEMINI_API_KEY not found"**
```bash
# Verificar variables en Railway:
railway variables

# Si no está, agregarla:
railway variables set GEMINI_API_KEY=tu-key-aqui
```

---

## 🎯 ORDEN RECOMENDADO

**Día 1:**
1. ✅ Conseguir Gemini API Key (5 minutos, GRATIS)
2. ✅ Configurarla en Railway
3. ✅ Probar que Darwin responde

**Día 2:**
4. ✅ Conseguir OpenAI API Key (10 minutos)
5. ✅ Agregar $20 USD de crédito
6. ✅ Probar transcripción de audios

**Día 3 (Opcional):**
7. ✅ Conseguir ElevenLabs API Key
8. ✅ Clonar tu voz
9. ✅ Probar mensajes de voz

---

## 📞 SOPORTE

¿Problemas para conseguir las keys?

1. **Gemini:** https://ai.google.dev/gemini-api/docs/api-key
2. **OpenAI:** https://platform.openai.com/docs/quickstart
3. **ElevenLabs:** https://docs.elevenlabs.io/api-reference/quick-start/authentication

---

**Generado por:** Claude Code (Anthropic)
**Proyecto:** Darwin CRM J7282
**Última actualización:** 2026-03-23
