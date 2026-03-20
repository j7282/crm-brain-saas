
const Datastore = require('./node_modules/@seald-io/nedb');
const path = require('path');
const fs = require('fs');

async function runTest() {
    console.log('🚀 Iniciando Test de Integridad Darwin CRM PRO J7282...');
    
    const dbDir = path.join(__dirname, 'test_data');
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir);
    
    // Limpiar para test puro J7282
    if (fs.existsSync(path.join(dbDir, 'messages_test.db'))) fs.unlinkSync(path.join(dbDir, 'messages_test.db'));

    const messagesDb = new Datastore({ filename: path.join(dbDir, 'messages_test.db'), autoload: true });
    
    // Configurar Índice Anti-Duplicados J7282
    await new Promise((res) => messagesDb.ensureIndex({ fieldName: 'msgId', unique: true }, res));

    const dbInsert = (db, doc) => new Promise((res, rej) => db.insert(doc, (e, d) => e ? rej(e) : res(d)));
    const dbUpdate = (db, q, u, opt) => new Promise((res, rej) => db.update(q, u, opt || {}, (e, n) => e ? rej(e) : res(n)));
    const dbCount = (db, query) => new Promise((res, rej) => db.count(query, (e, n) => e ? rej(e) : res(n)));

    try {
        console.log('1. Simulando ráfaga de 100 mensajes con IDs únicos...');
        for(let i=0; i<100; i++) {
            const msg = {
                msgId: `id_unique_${i}`,
                jid: `52155${i}@s.whatsapp.net`,
                text: i % 10 === 0 ? "📷 Imagen" : `Mensaje ${i}`,
                timestamp: new Date()
            };
            await dbUpdate(messagesDb, { msgId: msg.msgId }, { $set: msg }, { upsert: true });
        }

        console.log('2. Re-simulando misma ráfaga para probar ANTI-DUPLICADOS J7282...');
        for(let i=0; i<100; i++) {
            const msg = {
                msgId: `id_unique_${i}`,
                text: `Mensaje Duplicado ${i}` 
            };
            await dbUpdate(messagesDb, { msgId: msg.msgId }, { $set: msg }, { upsert: true });
        }

        const msgCount = await dbCount(messagesDb, {});
        console.log(`📊 Resultado Mensajes: ${msgCount} (Esperado: 100)`);

        if (msgCount === 100) {
            console.log('✅ TEST DE INTEGRIDAD PASADO: Cero Duplicados.');
        } else {
            console.error('❌ ERROR: Se detectaron duplicados.');
        }

    } catch (e) {
        console.error('❌ Error en el test:', e.message);
    }
}

runTest();
