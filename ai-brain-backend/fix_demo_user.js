const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = "mongodb+srv://ricardolopez213671_db_user:V8HvnMBpKTsG1r31@cluster0.jkvvwdw.mongodb.net/darwin_crm?appName=Cluster0";

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  company: { type: String, default: '' },
  plan: { type: String, enum: ['starter','pro','enterprise'], default: 'starter' },
  role: { type: String, enum: ['admin','agent','viewer'], default: 'agent' },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

async function fix() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Conectado a MongoDB Atlas');

    const email = 'demo@darwin.ai';
    const password = 'demo123';
    const hash = await bcrypt.hash(password, 12);

    const user = await User.findOneAndUpdate(
      { email },
      { 
        name: 'Demo User',
        password: hash,
        company: 'Darwin Demo',
        plan: 'pro',
        role: 'agent',
        active: true
      },
      { upsert: true, new: true }
    );

    console.log('Usuario demo actualizado/creado:', user.email);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

fix();
