// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  avatar: String,
  preferences: {
    timezone: { type: String, default: 'UTC' },
    coachingStyle: { 
      type: String, 
      enum: ['supportive', 'direct', 'analytical'], 
      default: 'supportive' 
    },
    reminderFrequency: { 
      type: String, 
      enum: ['daily', 'weekly', 'biweekly'], 
      default: 'weekly' 
    },
    focusAreas: [String]
  },
  metrics: {
    totalGoals: { type: Number, default: 0 },
    completedGoals: { type: Number, default: 0 },
    averageProgress: { type: Number, default: 0 },
    streakDays: { type: Number, default: 0 },
    lastActive: { type: Date, default: Date.now }
  }
}, {
  timestamps: true
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

module.exports = mongoose.model('User', userSchema);