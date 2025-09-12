// models/Goal.js
import { Schema, model } from 'mongoose';

const milestoneSchema = new Schema({
  text: { type: String, required: true },
  completed: { type: Boolean, default: false },
  completedAt: Date,
  dueDate: Date
});

const goalSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: { type: String, required: true },
  description: String,
  category: {
    type: String,
    enum: ['fitness', 'career', 'personal', 'learning', 'relationships', 'finance', 'health'],
    required: true
  },
  type: {
    type: String,
    enum: ['short-term', 'long-term'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'archived'],
    default: 'active'
  },
  progress: { type: Number, min: 0, max: 100, default: 0 },
  targetDate: Date,
  startDate: { type: Date, default: Date.now },
  completedDate: Date,
  milestones: [milestoneSchema],
  tags: [String],
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  // Analytics
  progressHistory: [{
    date: Date,
    progress: Number,
    note: String
  }],
  checkIns: [{
    date: Date,
    mood: { type: Number, min: 1, max: 5 },
    confidence: { type: Number, min: 1, max: 5 },
    obstacles: [String],
    wins: [String],
    note: String
  }]
}, {
  timestamps: true
});

goalSchema.methods.updateProgress = function(newProgress, note) {
  this.progress = Math.max(0, Math.min(100, newProgress));
  this.progressHistory.push({
    date: new Date(),
    progress: this.progress,
    note: note
  });
  
  if (this.progress === 100 && this.status !== 'completed') {
    this.status = 'completed';
    this.completedDate = new Date();
  }
};

export default model('Goal', goalSchema);