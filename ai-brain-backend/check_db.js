const Datastore = require('./node_modules/@seald-io/nedb');
const path = require('path');
const fs = require('fs');

async function diagnostic() {
    console.log('--- DIAGNÓSTICO DARWIN CRM J7282 ---');
    const dbDir = path.join(__dirname, 'data');
    
    const chatsDb = new Datastore({ filename: path.join(dbDir, 'chats.db'), autoload: true });
    const messagesDb = new Datastore({ filename: path.join(dbDir, 'messages.db'), autoload: true });

    const chatsCount = await new Promise((res) => chatsDb.count({}, (e, n) => res(n)));
    const msgsCount = await new Promise((res) => messagesDb.count({}, (e, n) => res(n)));

    console.log(`Chats en DB: ${chatsCount}`);
    console.log(`Mensajes en DB: ${msgsCount}`);

    if (msgsCount > 0) {
        messagesDb.find({}).sort({ timestamp: -1 }).limit(1).exec((err, docs) => {
            if (docs && docs.length > 0) {
                console.log(`Último mensaje recibido: "${docs[0].text}" a las ${docs[0].timestamp}`);
            }
        });
    } else {
        console.log('⚠️ ADVERTENCIA: La base de datos de mensajes está VACÍA.');
    }
}

diagnostic();
