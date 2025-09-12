// routes/analytics.js - Analytics and insights routes
import { Router } from 'express';
const router = Router();
import Goal from '../../models/Goals.js';
import Message from '../../models/Message.js';
import User from '../../models/User.js';
import Auth from '../../../middleware/auth.js';
import GoalAnalysis from '../goalAnalysis.js';
import Logger from '../../../utils/logger.js';

// GET /api/analytics/dashboard - Get dashboard analytics
router.get('/dashboard', Auth.auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { timeframe = '30d' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (timeframe) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // Parallel queries for dashboard data
    const [
      goals,
      recentMessages,
      progressData,
      userStats
    ] = await Promise.all([
      Goal.find({ userId }).lean(),
      Message.find({ 
        userId, 
        createdAt: { $gte: startDate }
      }).countDocuments(),
      Goal.aggregate([
        { $match: { userId, updatedAt: { $gte: startDate } } },
        {
          $project: {
            _id: 1,
            title: 1,
            category: 1,
            progress: 1,
            status: 1,
            createdAt: 1,
            progressHistory: 1
          }
        }
      ]),
      User.findById(userId).select('metrics createdAt').lean()
    ]);

    // Process goal statistics
    const goalStats = {
      total: goals.length,
      active: goals.filter(g => g.status === 'active').length,
      completed: goals.filter(g => g.status === 'completed').length,
      paused: goals.filter(g => g.status === 'paused').length,
      averageProgress: goals.length > 0 
        ? Math.round(goals.reduce((sum, goal) => sum + goal.progress, 0) / goals.length)
        : 0
    };

    // Category breakdown
    const categoryStats = goals.reduce((acc, goal) => {
      acc[goal.category] = (acc[goal.category] || 0) + 1;
      return acc;
    }, {});

    // Progress trends (last 7 days)
    const progressTrends = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));

      const dayProgress = progressData.reduce((acc, goal) => {
        const dayEntries = goal.progressHistory.filter(entry => {
          const entryDate = new Date(entry.date);
          return entryDate >= dayStart && entryDate <= dayEnd;
        });
        
        if (dayEntries.length > 0) {
          const avgDayProgress = dayEntries.reduce((sum, entry) => sum + entry.progress, 0) / dayEntries.length;
          acc += avgDayProgress;
        }
        return acc;
      }, 0);

      progressTrends.push({
        date: dayStart.toISOString().split('T')[0],
        progress: progressData.length > 0 ? Math.round(dayProgress / progressData.length) : 0
      });
    }

    // Recent achievements
    const recentAchievements = goals
      .filter(goal => goal.status === 'completed' && goal.completedDate)
      .sort((a, b) => new Date(b.completedDate) - new Date(a.completedDate))
      .slice(0, 5)
      .map(goal => ({
        id: goal._id,
        title: goal.title,
        category: goal.category,
        completedDate: goal.completedDate
      }));

    const dashboardData = {
      overview: goalStats,
      categories: categoryStats,
      trends: progressTrends,
      recentAchievements,
      activityStats: {
        messagesThisPeriod: recentMessages,
        daysSinceJoined: Math.floor((now - new Date(userStats.createdAt)) / (1000 * 60 * 60 * 24)),
        currentStreak: userStats.metrics?.streakDays || 0
      },
      timeframe
    };

    res.json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard analytics'
    });
  }
});

// GET /api/analytics/goals - Get detailed goal analytics
router.get('/goals', Auth.auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { timeframe = '30d', category } = req.query;

    const goals = await find({ 
      userId,
      ...(category && { category })
    }).lean();

    if (goals.length === 0) {
      return res.json({
        success: true,
        data: {
          analysis: GoalAnalysis.analyzeGoalProgress([]),
          insights: [],
          recommendations: []
        }
      });
    }

    // Run goal analysis
    const analysis = GoalAnalysis.analyzeGoalProgress(goals, parseInt(timeframe));

    // Generate weekly report
    const weeklyReport = GoalAnalysis.generateWeeklyReport(userId, goals);

    // Progress velocity (goals completed per month)
    const completedGoals = goals.filter(g => g.status === 'completed' && g.completedDate);
    const velocityData = {};
    
    completedGoals.forEach(goal => {
      const month = new Date(goal.completedDate).toISOString().substring(0, 7); // YYYY-MM
      velocityData[month] = (velocityData[month] || 0) + 1;
    });

    // Success rate by category
    const categoryAnalysis = {};
    goals.forEach(goal => {
      if (!categoryAnalysis[goal.category]) {
        categoryAnalysis[goal.category] = { total: 0, completed: 0, avgProgress: 0 };
      }
      categoryAnalysis[goal.category].total++;
      if (goal.status === 'completed') {
        categoryAnalysis[goal.category].completed++;
      }
      categoryAnalysis[goal.category].avgProgress += goal.progress;
    });

    Object.keys(categoryAnalysis).forEach(category => {
      const cat = categoryAnalysis[category];
      cat.successRate = Math.round((cat.completed / cat.total) * 100);
      cat.avgProgress = Math.round(cat.avgProgress / cat.total);
    });

    res.json({
      success: true,
      data: {
        analysis,
        weeklyReport,
        velocityData,
        categoryAnalysis,
        totalGoals: goals.length
      }
    });

  } catch (error) {
    console.error('Goal analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch goal analytics'
    });
  }
});

// GET /api/analytics/progress/:goalId - Get specific goal progress analytics
router.get('/progress/:goalId', Auth.auth, async (req, res) => {
  try {
    const { goalId } = req.params;
    const userId = req.user._id;

    const goal = await Goal.findOne({ _id: goalId, userId }).lean();
    
    if (!goal) {
      return res.status(404).json({
        success: false,
        error: 'Goal not found'
      });
    }

    // Process progress history
    const progressHistory = goal.progressHistory || [];
    const sortedHistory = progressHistory.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate progress velocity (progress per day)
    let velocity = 0;
    if (sortedHistory.length >= 2) {
      const firstEntry = sortedHistory[0];
      const lastEntry = sortedHistory[sortedHistory.length - 1];
      const daysDiff = (new Date(lastEntry.date) - new Date(firstEntry.date)) / (1000 * 60 * 60 * 24);
      const progressDiff = lastEntry.progress - firstEntry.progress;
      velocity = daysDiff > 0 ? progressDiff / daysDiff : 0;
    }

    // Estimate completion date
    let estimatedCompletion = null;
    if (velocity > 0 && goal.progress < 100) {
      const remainingProgress = 100 - goal.progress;
      const daysToComplete = remainingProgress / velocity;
      estimatedCompletion = new Date();
      estimatedCompletion.setDate(estimatedCompletion.getDate() + Math.ceil(daysToComplete));
    }

    // Check-in frequency analysis
    const checkIns = goal.checkIns || [];
    const checkInFrequency = checkIns.length > 0 
      ? Math.round((Date.now() - new Date(goal.createdAt)) / (1000 * 60 * 60 * 24) / checkIns.length)
      : 0;

    // Progress consistency (standard deviation)
    let consistency = 'N/A';
    if (sortedHistory.length >= 3) {
      const progressValues = sortedHistory.map(entry => entry.progress);
      const mean = progressValues.reduce((sum, val) => sum + val, 0) / progressValues.length;
      const variance = progressValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / progressValues.length;
      const stdDev = Math.sqrt(variance);
      
      if (stdDev < 10) consistency = 'High';
      else if (stdDev < 20) consistency = 'Medium';
      else consistency = 'Low';
    }

    const analytics = {
      goal: {
        id: goal._id,
        title: goal.title,
        category: goal.category,
        currentProgress: goal.progress,
        status: goal.status,
        createdAt: goal.createdAt,
        targetDate: goal.targetDate
      },
      metrics: {
        progressVelocity: Math.round(velocity * 100) / 100, // progress per day
        estimatedCompletion,
        consistency,
        checkInFrequency: `Every ${checkInFrequency} days`,
        totalCheckIns: checkIns.length,
        milestonesCompleted: goal.milestones ? goal.milestones.filter(m => m.completed).length : 0,
        totalMilestones: goal.milestones ? goal.milestones.length : 0
      },
      progressHistory: sortedHistory,
      recentCheckIns: checkIns.slice(-5).reverse()
    };

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('Progress analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch progress analytics'
    });
  }
});

// GET /api/analytics/chat - Get chat interaction analytics
router.get('/chat', Auth.auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { timeframe = '30d' } = req.query;

    // Calculate date range
    const now = new Date();
    const startDate = new Date();
    startDate.setDate(now.getDate() - parseInt(timeframe));

    // Get chat messages within timeframe
    const messages = await Message.find({
      userId,
      createdAt: { $gte: startDate }
    }).lean();

    const userMessages = messages.filter(msg => msg.type === 'user');
    const aiMessages = messages.filter(msg => msg.type === 'ai');

    // Daily message activity
    const dailyActivity = {};
    messages.forEach(msg => {
      const date = new Date(msg.createdAt).toISOString().split('T')[0];
      if (!dailyActivity[date]) {
        dailyActivity[date] = { user: 0, ai: 0, total: 0 };
      }
      dailyActivity[date][msg.type]++;
      dailyActivity[date].total++;
    });

    // Conversation topics (based on message content analysis)
    const topicKeywords = {
      motivation: ['stuck', 'unmotivated', 'difficult', 'hard', 'struggle'],
      progress: ['progress', 'update', 'completed', 'achieved', 'done'],
      goals: ['goal', 'target', 'objective', 'aim', 'plan'],
      advice: ['help', 'advice', 'suggest', 'recommend', 'what should'],
      celebration: ['success', 'completed', 'achieved', 'finished', 'won']
    };

    const topicCounts = {};
    Object.keys(topicKeywords).forEach(topic => {
      topicCounts[topic] = userMessages.filter(msg => {
        const content = msg.content.toLowerCase();
        return topicKeywords[topic].some(keyword => content.includes(keyword));
      }).length;
    });

    // AI response quality (based on user feedback)
    const feedbackMessages = aiMessages.filter(msg => 
      msg.metadata && msg.metadata.userRating
    );
    
    const avgRating = feedbackMessages.length > 0
      ? feedbackMessages.reduce((sum, msg) => sum + msg.metadata.userRating, 0) / feedbackMessages.length
      : null;

    // Response time analysis (time between user message and AI response)
    const responseTimes = [];
    for (let i = 0; i < messages.length - 1; i++) {
      if (messages[i].type === 'user' && messages[i + 1].type === 'ai') {
        const responseTime = new Date(messages[i + 1].createdAt) - new Date(messages[i].createdAt);
        responseTimes.push(responseTime / 1000); // in seconds
      }
    }

    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;

    const chatAnalytics = {
      overview: {
        totalMessages: messages.length,
        userMessages: userMessages.length,
        aiMessages: aiMessages.length,
        conversationsStarted: userMessages.length > 0 ? Math.ceil(userMessages.length / 3) : 0, // Rough estimate
        avgMessagesPerDay: Math.round(messages.length / parseInt(timeframe))
      },
      engagement: {
        dailyActivity: Object.entries(dailyActivity).map(([date, data]) => ({
          date,
          ...data
        })).sort((a, b) => new Date(a.date) - new Date(b.date)),
        topicBreakdown: topicCounts,
        avgResponseTime: Math.round(avgResponseTime * 100) / 100,
        userSatisfaction: avgRating ? Math.round(avgRating * 10) / 10 : null,
        feedbackCount: feedbackMessages.length
      },
      insights: generateChatInsights(messages, topicCounts, avgRating)
    };

    res.json({
      success: true,
      data: chatAnalytics
    });

  } catch (error) {
    console.error('Chat analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chat analytics'
    });
  }
});

// Helper function to generate chat insights
function generateChatInsights(messages, topicCounts, avgRating) {
  const insights = [];
  
  // Most active topic
  const mostActiveTopic = Object.entries(topicCounts)
    .sort(([,a], [,b]) => b - a)[0];
  
  if (mostActiveTopic && mostActiveTopic[1] > 0) {
    insights.push({
      type: 'topic',
      message: `You most frequently discuss ${mostActiveTopic[0]} (${mostActiveTopic[1]} conversations)`
    });
  }

  // Engagement pattern
  const recentWeek = messages.filter(msg => 
    new Date(msg.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  ).length;
  
  const previousWeek = messages.filter(msg => {
    const msgDate = new Date(msg.createdAt);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    return msgDate > twoWeeksAgo && msgDate <= weekAgo;
  }).length;

  if (recentWeek > previousWeek) {
    insights.push({
      type: 'engagement',
      message: `Your engagement increased by ${Math.round(((recentWeek - previousWeek) / Math.max(previousWeek, 1)) * 100)}% this week`
    });
  }

  // Satisfaction insight
  if (avgRating) {
    if (avgRating >= 4) {
      insights.push({
        type: 'satisfaction',
        message: `High satisfaction rate (${avgRating}/5) - you're getting valuable coaching!`
      });
    } else if (avgRating < 3) {
      insights.push({
        type: 'satisfaction',
        message: `Let's improve our conversations - current rating: ${avgRating}/5`
      });
    }
  }

  return insights;
}

// GET /api/analytics/export - Export analytics data
router.get('/export', Auth.auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { format = 'json' } = req.query;

    // Get all analytics data
    const [goals, messages, user] = await Promise.all([
      find({ userId }).lean(),
      Message.find({ userId }).lean(),
      User.findById(userId).select('metrics createdAt name email').lean()
    ]);

    // Generate comprehensive analytics
    const analytics = {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        joinDate: user.createdAt,
        metrics: user.metrics
      },
      goals: {
        total: goals.length,
        byStatus: goals.reduce((acc, goal) => {
          acc[goal.status] = (acc[goal.status] || 0) + 1;
          return acc;
        }, {}),
        byCategory: goals.reduce((acc, goal) => {
          acc[goal.category] = (acc[goal.category] || 0) + 1;
          return acc;
        }, {}),
        averageProgress: goals.length > 0 
          ? Math.round(goals.reduce((sum, goal) => sum + goal.progress, 0) / goals.length)
          : 0,
        completionRate: goals.length > 0
          ? Math.round((goals.filter(g => g.status === 'completed').length / goals.length) * 100)
          : 0
      },
      chat: {
        totalMessages: messages.length,
        userMessages: messages.filter(m => m.type === 'user').length,
        aiMessages: messages.filter(m => m.type === 'ai').length,
        avgRating: messages
          .filter(m => m.metadata && m.metadata.userRating)
          .reduce((sum, m, _, arr) => sum + m.metadata.userRating / arr.length, 0)
      },
      exportDate: new Date().toISOString(),
      version: '1.0'
    };

    if (format === 'csv') {
      // Convert to CSV format
      const csv = convertToCSV(analytics);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=analytics-${userId}-${Date.now()}.csv`);
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=analytics-${userId}-${Date.now()}.json`);
      res.json({
        success: true,
        data: analytics
      });
    }

    Logger.metricsLogger.dataExported(userId, format);

  } catch (error) {
    console.error('Export analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export analytics data'
    });
  }
});

// Helper function to convert analytics to CSV
function convertToCSV(analytics) {
  const csvRows = [];
  
  // Header
  csvRows.push('Metric,Value');
  
  // User metrics
  csvRows.push(`Total Goals,${analytics.goals.total}`);
  csvRows.push(`Completed Goals,${analytics.goals.byStatus.completed || 0}`);
  csvRows.push(`Active Goals,${analytics.goals.byStatus.active || 0}`);
  csvRows.push(`Average Progress,${analytics.goals.averageProgress}%`);
  csvRows.push(`Completion Rate,${analytics.goals.completionRate}%`);
  csvRows.push(`Total Messages,${analytics.chat.totalMessages}`);
  csvRows.push(`User Messages,${analytics.chat.userMessages}`);
  csvRows.push(`AI Messages,${analytics.chat.aiMessages}`);
  
  if (analytics.chat.avgRating) {
    csvRows.push(`Average Rating,${analytics.chat.avgRating}`);
  }
  
  return csvRows.join('\n');
}

// GET /api/analytics/insights - Get AI-powered insights
router.get('/insights', Auth.auth, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get recent goals and progress data
    const goals = await find({ userId }).lean();
    const recentMessages = await Message.find({ 
      userId,
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    }).lean();

    // Generate insights using goal analysis service
    const analysis = GoalAnalysis.analyzeGoalProgress(goals);
    
    // Additional AI-powered insights
    const insights = [
      ...analysis.insights,
      ...analysis.recommendations.slice(0, 3), // Top 3 recommendations
    ];

    // Add engagement insights
    if (recentMessages.length < 5) {
      insights.push({
        type: 'engagement',
        priority: 'medium',
        message: 'Consider chatting with your AI coach more frequently to get personalized guidance.',
        action: 'Schedule regular check-ins with your coach'
      });
    }

    // Add progress insights
    const activeGoals = goals.filter(g => g.status === 'active');
    const stagnantGoals = activeGoals.filter(goal => {
      const recentProgress = goal.progressHistory?.slice(-5) || [];
      return recentProgress.length >= 3 && 
             recentProgress.every((entry, i) => 
               i === 0 || Math.abs(entry.progress - recentProgress[i-1].progress) < 2
             );
    });

    if (stagnantGoals.length > 0) {
      insights.push({
        type: 'progress',
        priority: 'high',
        message: `${stagnantGoals.length} goal(s) haven't shown progress recently. Consider breaking them into smaller steps.`,
        action: 'Review and adjust your approach for stagnant goals'
      });
    }

    res.json({
      success: true,
      data: {
        insights: insights.slice(0, 10), // Limit to top 10 insights
        generatedAt: new Date().toISOString(),
        period: '30 days'
      }
    });

  } catch (error) {
    console.error('Insights generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate insights'
    });
  }
});

export default router;