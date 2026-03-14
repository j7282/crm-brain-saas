const mongoose = require('mongoose');

const brainSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    niche: { type: String },
    shadowMode: { type: Boolean, default: false },
    learningMonths: { type: Number, default: 3 },
    catalogoProductos: { type: Array, default: [] },
    respuestasRapidas: { type: Object, default: {} },
    voiceConfig: {
        elevenLabsVoiceId: { type: String },
        sampleAudios: { type: Array, default: [] }
    },
    trainingData: [{
        query: { type: String },
        aiResponse: { type: String },
        correction: { type: String },
        timestamp: { type: Date, default: Date.now }
    }],
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Brain', brainSchema);
