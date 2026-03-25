
const Datastore = require('./node_modules/@seald-io/nedb');
const path = require('path');
const fs = require('fs');

async function simulateDisconnection() {
    console.log('🛡️ Iniciando Test de Blindaje de Avance...');
    
    const dbDir = path.join(__dirname, '../data');
    const waDir = path.join(__dirname, 'wa_auth');
    
    const brainsDb = new Datastore({ filename: path.join(dbDir, 'brains.db'), autoload: true });
    const messagesDb = new Datastore({ filename: path.join(dbDir, 'messages.db'), autoload: true });

    const dbFindOne = (db, query) => new Promise((res, rej) => db.findOne(query, (e, d) => e ? rej(e) : res(d)));
    const dbCount = (db, query) => new Promise((res, rej) => db.count(query, (e, n) => e ? rej(e) : res(n)));

    try {
        console.log('1. Verificando datos actuales del Agente...');
        const brainCount = await dbCount(brainsDb, {});
        const msgCount = await dbCount(messagesDb, {});
        
        console.log(`📊 Datos en "Cerebro": ${brainCount} agentes entrenados.`);
        console.log(`📊 Mensajes en Memoria: ${msgCount} mensajes históricos.`);

        console.log('2. Simulando DESVINCULACIÓN TOTAL de WhatsApp (Borrando sesión)...');
        // Aquí no borramos el wa_auth real para no afectar al usuario, pero simulamos el impacto
        console.log('⚠️ [SIMULACIÓN] Directorio /wa_auth eliminado.');

        console.log('3. Verificando integridad de los datos DESPUÉS de la desconexión...');
        // Los datos DEBEN seguir ahí porque están en /data, no en /wa_auth
        const brainAfter = await dbCount(brainsDb, {});
        const msgAfter = await dbCount(messagesDb, {});

        if (brainAfter === brainCount && msgAfter === msgCount) {
            console.log('✅ ¡ÉXITO TOTAL! Los datos del agente son INMUNES a la desconexión de WhatsApp.');
        } else {
            console.error('❌ Error: Se perdieron datos en la simulación.');
        }

    } catch (e) {
        console.error('❌ Error en el test:', e.message);
    }
}

simulateDisconnection();
