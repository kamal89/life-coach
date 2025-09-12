// routes/goals.js
import { Router } from 'express';
const router = Router();
import Goal from '../../models/Goals.js';
import User from '../../models/User.js';
import GoalAnalysis from '../goalAnalysis.js';
import Auth from '../../../middleware/auth.js';

// GET /api/goals - Get all user goals
router.get('/', Auth.auth, async (req, res) => {
  try {
    const { status, category, type } = req.query;
    const userId = req.user.id;

    const filter = { userId };
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (type) filter.type = type;

    const goals = await Goal.find(filter).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      goals,
      total: goals.length
    });

  } catch (error) {
    console.error('Get goals error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch goals' });
  }
});

// POST /api/goals - Create new goal
router.post('/', Auth.auth, async (req, res) => {
  try {
    const { title, description, category, type, targetDate, milestones = [] } = req.body;
    const userId = req.user.id;

    if (!title || !category || !type) {
      return res.status(400).json({ 
        success: false, 
        error: 'Title, category, and type are required' 
      });
    }

    const goal = new Goal({
      userId,
      title,
      description,
      category,
      type,
      targetDate: targetDate ? new Date(targetDate) : null,
      milestones: milestones.map(m => ({
        text: m.text,
        dueDate: m.dueDate ? new Date(m.dueDate) : null
      }))
    });

    await goal.save();

    // Update user metrics
    await User.findByIdAndUpdate(userId, {
      $inc: { 'metrics.totalGoals': 1 }
    });

    res.status(201).json({
      success: true,
      goal,
      message: 'Goal created successfully'
    });

  } catch (error) {
    console.error('Create goal error:', error);
    res.status(500).json({ success: false, error: 'Failed to create goal' });
  }
});

// PUT /api/goals/:id/progress - Update goal progress
router.put('/:id/progress', Auth.auth, async (req, res) => {
  try {
    const { progress, note } = req.body;
    const goalId = req.params.id;
    const userId = req.user.id;

    const goal = await Goal.findOne({ _id: goalId, userId });
    if (!goal) {
      return res.status(404).json({ success: false, error: 'Goal not found' });
    }

    goal.updateProgress(progress, note);
    await goal.save();

    // Update user metrics if goal completed
    if (goal.status === 'completed') {
      await User.findByIdAndUpdate(userId, {
        $inc: { 'metrics.completedGoals': 1 }
      });
    }

    res.json({
      success: true,
      goal,
      message: 'Progress updated successfully'
    });

  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({ success: false, error: 'Failed to update progress' });
  }
});

// POST /api/goals/:id/checkin - Add goal check-in
router.post('/:id/checkin', Auth.auth, async (req, res) => {
  try {
    const { mood, confidence, obstacles = [], wins = [], note } = req.body;
    const goalId = req.params.id;
    const userId = req.user.id;

    const goal = await Goal.findOne({ _id: goalId, userId });
    if (!goal) {
      return res.status(404).json({ success: false, error: 'Goal not found' });
    }

    goal.checkIns.push({
      date: new Date(),
      mood,
      confidence,
      obstacles,
      wins,
      note
    });

    await goal.save();

    res.json({
      success: true,
      goal,
      message: 'Check-in recorded successfully'
    });

  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ success: false, error: 'Failed to record check-in' });
  }
});

// GET /api/goals/analytics - Get goal analytics
router.get('/analytics', Auth.auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const goals = await Goal.find({ userId });

    const analysis = GoalAnalysis.analyzeGoalProgress(goals);
    const weeklyReport = GoalAnalysis.generateWeeklyReport(userId, goals);

    res.json({
      success: true,
      analysis,
      weeklyReport
    });

  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate analytics' });
  }
});

export default router;