
const Datastore = require('./node_modules/@seald-io/nedb');
const path = require('path');
const fs = require('fs');

async function runTest() {
    console.log('🚀 Iniciando Test de Integridad Darwin CRM...');
    
    const dbDir = path.join(__dirname, 'test_data');
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir);
    
    const chatsDb = new Datastore({ filename: path.join(dbDir, 'chats_test.db'), autoload: true });
    const messagesDb = new Datastore({ filename: path.join(dbDir, 'messages_test.db'), autoload: true });

    const dbInsert = (db, doc) => new Promise((res, rej) => db.insert(doc, (e, d) => e ? rej(e) : res(d)));
    const dbCount = (db, query) => new Promise((res, rej) => db.count(query, (e, n) => e ? rej(e) : res(n)));

    try {
        console.log('1. Simulando llegada de 100 mensajes mixtos...');
        for(let i=0; i<100; i++) {
            await dbInsert(messagesDb, {
                jid: `52155${i}@s.whatsapp.net`,
                text: i % 10 === 0 ? "📷 Imagen de prueba" : `Mensaje de prueba ${i}`,
                role: 'client',
                timestamp: new Date(),
                isMultimedia: i % 10 === 0,
                mediaType: i % 10 === 0 ? 'image' : null
            });
        }

        const msgCount = await dbCount(messagesDb, {});
        console.log(`✅ Mensajes insertados: ${msgCount}`);

        console.log('2. Verificando persistencia de multimedia...');
        const multiCount = await dbCount(messagesDb, { isMultimedia: true });
        if (multiCount === 10) {
            console.log('✅ Detección multimedia correcta (10/100)');
        } else {
            console.error(`❌ Fallo en detección multimedia: ${multiCount}`);
        }

        console.log('3. Test finalizado exitosamente.');
    } catch (e) {
        console.error('❌ Error en el test:', e.message);
    }
}

runTest();
