const mongoose = require('mongoose');

const connect = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Atlas conectado');
  } catch (err) {
    console.error('Error MongoDB:', err.message);
    process.exit(1);
  }
};

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  company: { type: String, default: '' },
  plan: { type: String, enum: ['starter','pro','enterprise'], default: 'starter' },
  role: { type: String, enum: ['admin','agent','viewer'], default: 'agent' },
  isSuperAdmin: { type: Boolean, default: false },
  waConnected: { type: Boolean, default: false },
  waPhone: { type: String, default: '' },
  voiceId: { type: String, default: '' },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  lastLogin: Date
});

const ConversationSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  phone: { type: String, required: true },
  name: { type: String, default: '' },
  stage: { type: String, enum: ['nuevo','contactado','propuesta','cierre','perdido'], default: 'nuevo' },
  source: { type: String, default: 'WhatsApp' },
  score: { type: Number, default: 50 },
  messages: [{
    role: { type: String, enum: ['client','darwin','human'] },
    text: String,
    mediaType: { type: String, default: 'text' },
    pattern: String,
    confidence: Number,
    timestamp: { type: Date, default: Date.now }
  }],
  objections: [String],
  tags: [String],
  darwinThought: { type: String, default: '' },
  lastMessage: Date,
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

ConversationSchema.index({ userId: 1, phone: 1 }, { unique: true });

const BrainSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  dnaScore: { type: Number, default: 0 },
  cloneConfidence: { type: Number, default: 0 },
  tone: { type: String, default: '' },
  communicationStyle: { type: String, default: '' },
  closingStyle: { type: String, default: '' },
  topPatterns: { type: Array, default: [] },
  signaturePhrases: { type: Array, default: [] },
  powerWords: { type: Array, default: [] },
  objectionHandlers: { type: Array, default: [] },
  uniqueHooks: { type: Array, default: [] },
  weaknesses: { type: Array, default: [] },
  mode: { type: String, enum: ['mirror','scan','active'], default: 'active' },
  mirrorDays: { type: Number, default: 7 },
  mirrorStartedAt: Date,
  aggressiveness: { type: Number, default: 7 },
  empathy: { type: Number, default: 8 },
  urgency: { type: Number, default: 6 },
  formality: { type: Number, default: 4 },
  useVoice: { type: Boolean, default: true },
  useCatalog: { type: Boolean, default: true },
  useQuickReplies: { type: Boolean, default: true },
  extraInstruction: { type: String, default: '' },
  msgsProcessed: { type: Number, default: 0 },
  // J7282: Campos nuevos agregados por auditoría de Claude
  knowledgeBase: [{
    source: { type: String },
    content: { type: String },
    timestamp: { type: Date, default: Date.now }
  }],
  trainingData: [{
    query: { type: String },
    aiResponse: { type: String },
    correction: { type: String },
    timestamp: { type: Date, default: Date.now }
  }],
  updatedAt: { type: Date, default: Date.now }
});

const ReminderSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  prospectName: { type: String, required: true },
  phone: { type: String, required: true },
  message: { type: String, required: true },
  scheduledAt: { type: Date, required: true },
  status: { type: String, enum: ['pending','sent','cancelled'], default: 'pending' },
  sentAt: Date,
  createdAt: { type: Date, default: Date.now }
});

const ActivityLogSchema = new mongoose.Schema({
  userId: { type: String, index: true },
  action: String,
  details: String,
  ip: String,
  timestamp: { type: Date, default: Date.now, index: true }
});

const CatalogItemSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  description: { type: String, default: '' },
  emoji: { type: String, default: 'box' },
  imageUrl: { type: String, default: '' },
  active: { type: Boolean, default: true },
  sentCount: { type: Number, default: 0 },
  convRate: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const QuickReplySchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  stage: { type: String, required: true },
  text: { type: String, required: true, maxlength: 20 },
  desc: { type: String, default: '' },
  usedCount: { type: Number, default: 0 },
  convRate: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const ApiUsageSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  date: { type: String, required: true },
  geminiTokens: { type: Number, default: 0 },
  whisperAudios: { type: Number, default: 0 },
  elevenLabsChars: { type: Number, default: 0 },
  messagesIn: { type: Number, default: 0 },
  messagesOut: { type: Number, default: 0 }
});
ApiUsageSchema.index({ userId: 1, date: 1 }, { unique: true });

const BackupSchema = new mongoose.Schema({
  name: String,
  type: { type: String, enum: ['auto','manual'], default: 'auto' },
  sizeMB: Number,
  status: { type: String, default: 'ok' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = {
  connect,
  User:         mongoose.model('User', UserSchema),
  Conversation: mongoose.model('Conversation', ConversationSchema),
  Brain:        mongoose.model('Brain', BrainSchema),
  Reminder:     mongoose.model('Reminder', ReminderSchema),
  ActivityLog:  mongoose.model('ActivityLog', ActivityLogSchema),
  CatalogItem:  mongoose.model('CatalogItem', CatalogItemSchema),
  QuickReply:   mongoose.model('QuickReply', QuickReplySchema),
  ApiUsage:     mongoose.model('ApiUsage', ApiUsageSchema),
  Backup:       mongoose.model('Backup', BackupSchema),
};
