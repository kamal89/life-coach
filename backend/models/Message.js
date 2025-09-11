// models/Message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  conversationId: String,
  type: {
    type: String,
    enum: ['user', 'ai', 'system'],
    required: true
  },
  content: { type: String, required: true },
  metadata: {
    goalContext: [{
      goalId: mongoose.Schema.Types.ObjectId,
      relevanceScore: Number
    }],
    sentiment: Number, // -1 to 1
    intent: String, // 'goal_update', 'motivation', 'advice', etc.
    confidence: Number
  },
  embedding: [Number] // For vector similarity search
}, {
  timestamps: true
});

module.exports = mongoose.model('Message', messageSchema);