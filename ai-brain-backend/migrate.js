require('dotenv').config();
const fs = require('fs');
const readline = require('readline');
const mongoose = require('mongoose');
const path = require('path');
const db = require('./src/db');

// Models
const { User, Conversation, Brain } = db;

async function processFile(filename, model, transformFn) {
  const filePath = path.join(__dirname, 'data', filename);
  if (!fs.existsSync(filePath)) {
    console.log(`[SKIP] File not found: ${filePath}`);
    return;
  }
  
  console.log(`[START] Parsing ${filename}...`);
  const stream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let count = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      let data = JSON.parse(line);
      // Remove nedb specific _id to let mongo generate a new one, or keep it if it is a string
      if (transformFn) {
        data = transformFn(data);
      }
      
      const doc = new model(data);
      await doc.save();
      count++;
    } catch (e) {
      if (e.code !== 11000) { // Ignore duplicate key errors
         console.error(`Error parsing/saving line in ${filename}:`, e.message);
      }
    }
  }
  console.log(`[DONE] ${filename}: Migrated ${count} records.`);
}

async function migrate() {
  try {
    await db.connect();
    console.log('--- MIGRATION STARTED ---');

    await processFile('users.db', User, (data) => {
      // transform NeDB user to Mongoose User
      return {
        _id: data._id, // Keep old ID if possible, otherwise let Mongoose create it
        name: data.name || 'Migrated User',
        email: data.email,
        password: data.password,
        role: data.role || 'agent'
      };
    });

    await processFile('chats.db', Conversation, (data) => {
      return {
        _id: data._id,
        userId: data.userId || 'system',
        phone: data.jid || data.phone || 'unknown',
        name: data.pushName || data.name || 'Unknown User',
        stage: data.stage || 'nuevo'
      };
    });

    await processFile('brains.db', Brain, (data) => {
      return {
        _id: data._id,
        userId: data.userId || 'system',
        name: data.name || 'Migrated Brain',
        tone: data.tone || 'Neutral'
      };
    });

    console.log('--- MIGRATION COMPLETED EXPERTLY ---');
    process.exit(0);
  } catch (err) {
    console.error('Core Migration Error:', err);
    process.exit(1);
  }
}

migrate();
