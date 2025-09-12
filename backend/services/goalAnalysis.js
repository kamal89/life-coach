// services/goalAnalysis.js

// =============================================================================
// GOAL ANALYSIS SERVICE
// =============================================================================


class GoalAnalysisService {
  constructor() {
    this.progressThresholds = {
      excellent: 80,
      good: 60,
      fair: 40,
      needsAttention: 20
    };
  }

  analyzeGoalProgress(goals, timeframe = 30) {
    const analysis = {
      overall: this.calculateOverallProgress(goals),
      trends: this.analyzeTrends(goals, timeframe),
      insights: this.generateInsights(goals),
      recommendations: this.generateRecommendations(goals)
    };

    return analysis;
  }

  calculateOverallProgress(goals) {
    const activeGoals = goals.filter(goal => goal.status === 'active');
    const completedGoals = goals.filter(goal => goal.status === 'completed');
    
    if (activeGoals.length === 0) {
      return {
        averageProgress: completedGoals.length > 0 ? 100 : 0,
        activeCount: 0,
        completedCount: completedGoals.length,
        status: completedGoals.length > 0 ? 'all_completed' : 'no_goals'
      };
    }

    const avgProgress = activeGoals.reduce((sum, goal) => sum + goal.progress, 0) / activeGoals.length;
    
    return {
      averageProgress: Math.round(avgProgress),
      activeCount: activeGoals.length,
      completedCount: completedGoals.length,
      status: this.getProgressStatus(avgProgress)
    };
  }

  getProgressStatus(avgProgress) {
    if (avgProgress >= this.progressThresholds.excellent) return 'excellent';
    if (avgProgress >= this.progressThresholds.good) return 'good';
    if (avgProgress >= this.progressThresholds.fair) return 'fair';
    return 'needs_attention';
  }

  analyzeTrends(goals, days) {
    const trends = {};
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    goals.forEach(goal => {
      const recentProgress = goal.progressHistory.filter(
        entry => new Date(entry.date) >= cutoffDate
      );

      if (recentProgress.length >= 2) {
        const first = recentProgress[0].progress;
        const last = recentProgress[recentProgress.length - 1].progress;
        const trend = last - first;

        trends[goal._id] = {
          direction: trend > 5 ? 'improving' : trend < -5 ? 'declining' : 'stable',
          change: trend,
          consistency: this.calculateConsistency(recentProgress)
        };
      }
    });

    return trends;
  }

  calculateConsistency(progressData) {
    if (progressData.length < 3) return 'insufficient_data';
    
    const changes = [];
    for (let i = 1; i < progressData.length; i++) {
      changes.push(Math.abs(progressData[i].progress - progressData[i-1].progress));
    }
    
    const avgChange = changes.reduce((sum, change) => sum + change, 0) / changes.length;
    
    if (avgChange < 3) return 'high';
    if (avgChange < 8) return 'medium';
    return 'low';
  }

  generateInsights(goals) {
    const insights = [];
    const activeGoals = goals.filter(goal => goal.status === 'active');
    
    // Category analysis
    const categoryProgress = this.analyzeByCategory(activeGoals);
    const bestCategory = Object.entries(categoryProgress)
      .sort(([,a], [,b]) => b.avgProgress - a.avgProgress)[0];
    
    if (bestCategory) {
      insights.push({
        type: 'strength',
        message: `Your ${bestCategory[0]} goals are performing best with ${Math.round(bestCategory[1].avgProgress)}% average progress.`
      });
    }

    // Timeline analysis
    const overdueGoals = activeGoals.filter(goal => 
      goal.targetDate && new Date(goal.targetDate) < new Date()
    );
    
    if (overdueGoals.length > 0) {
      insights.push({
        type: 'warning',
        message: `${overdueGoals.length} goal(s) have passed their target date. Consider adjusting timelines or increasing focus.`
      });
    }

    // Progress stagnation
    const stagnantGoals = activeGoals.filter(goal => {
      const recentProgress = goal.progressHistory.slice(-7); // Last 7 entries
      return recentProgress.length >= 3 && 
             recentProgress.every(entry => 
               Math.abs(entry.progress - recentProgress[0].progress) < 2
             );
    });

    if (stagnantGoals.length > 0) {
      insights.push({
        type: 'action',
        message: `${stagnantGoals.length} goal(s) haven't shown progress recently. Time to reassess strategy or break down into smaller steps.`
      });
    }

    return insights;
  }

  analyzeByCategory(goals) {
    const categories = {};
    
    goals.forEach(goal => {
      if (!categories[goal.category]) {
        categories[goal.category] = { goals: [], totalProgress: 0 };
      }
      categories[goal.category].goals.push(goal);
      categories[goal.category].totalProgress += goal.progress;
    });

    Object.keys(categories).forEach(category => {
      const cat = categories[category];
      cat.avgProgress = cat.totalProgress / cat.goals.length;
      cat.count = cat.goals.length;
    });

    return categories;
  }

  generateRecommendations(goals) {
    const recommendations = [];
    const activeGoals = goals.filter(goal => goal.status === 'active');
    
    // Too many active goals
    if (activeGoals.length > 5) {
      recommendations.push({
        priority: 'high',
        type: 'focus',
        message: `Consider focusing on fewer goals. You have ${activeGoals.length} active goals. Research shows 2-3 goals is optimal for success.`,
        action: 'Prioritize top 3 goals and pause others'
      });
    }

    // No recent check-ins
    const goalsNeedingCheckIn = activeGoals.filter(goal => {
      const lastCheckIn = goal.checkIns[goal.checkIns.length - 1];
      if (!lastCheckIn) return true;
      
      const daysSinceCheckIn = (Date.now() - new Date(lastCheckIn.date)) / (1000 * 60 * 60 * 24);
      return daysSinceCheckIn > 7;
    });

    if (goalsNeedingCheckIn.length > 0) {
      recommendations.push({
        priority: 'medium',
        type: 'checkin',
        message: `${goalsNeedingCheckIn.length} goal(s) need a progress check-in.`,
        action: 'Schedule weekly goal reviews'
      });
    }

    // Missing milestones
    const goalsWithoutMilestones = activeGoals.filter(goal => 
      goal.milestones.length === 0 && goal.progress < 50
    );

    if (goalsWithoutMilestones.length > 0) {
      recommendations.push({
        priority: 'medium',
        type: 'structure',
        message: `${goalsWithoutMilestones.length} goal(s) would benefit from milestone planning.`,
        action: 'Break down goals into smaller, measurable milestones'
      });
    }

    return recommendations.sort((a, b) => {
      const priority = { high: 3, medium: 2, low: 1 };
      return priority[b.priority] - priority[a.priority];
    });
  }

  generateWeeklyReport(userId, goals) {
    const analysis = this.analyzeGoalProgress(goals, 7);
    
    return {
      userId,
      weekOf: new Date(),
      summary: {
        goalsReviewed: goals.length,
        averageProgress: analysis.overall.averageProgress,
        completedThisWeek: goals.filter(goal => {
          if (goal.status !== 'completed' || !goal.completedDate) return false;
          const completedDate = new Date(goal.completedDate);
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return completedDate >= weekAgo;
        }).length
      },
      insights: analysis.insights,
      recommendations: analysis.recommendations.slice(0, 3), // Top 3
      trends: analysis.trends
    };
  }
}

export default new GoalAnalysisService();