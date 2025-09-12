// models/Message.js
import { Schema, model } from 'mongoose';

const messageSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
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
      goalId: Schema.Types.ObjectId,
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

export default model('Message', messageSchema);