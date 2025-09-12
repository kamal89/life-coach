// services/aiService.js

// =============================================================================
// AI SERVICE INTEGRATION
// =============================================================================


import OpenAI from 'openai';

class AIService {
  constructor() {
    this.openai = null; // Don't create it yet
  }

  // Create OpenAI instance when first needed
  getOpenAI() {
    if (!this.openai) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY environment variable is required');
      }
      this.openai = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY 
      });
    }
    return this.openai;
  }

  async generateCoachingResponse(userMessage, context) {
    const openai = this.getOpenAI();
    const { user, goals, recentMessages, progressData } = context;
    
    const systemPrompt = this.buildSystemPrompt(user, goals, progressData);
    const conversationHistory = this.formatConversationHistory(recentMessages);

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory,
          { role: "user", content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 800,
      });

      return {
        content: completion.choices[0].message.content,
        metadata: await this.analyzeResponse(userMessage, completion.choices[0].message.content)
      };
    } catch (error) {
      console.error('OpenAI API Error:', error);
      return this.getFallbackResponse(userMessage, context);
    }
  }

  buildSystemPrompt(user, goals, progressData) {
    const activeGoals = goals.filter(g => g.status === 'active');
    const completedGoals = goals.filter(g => g.status === 'completed');
    const avgProgress = activeGoals.length > 0 
      ? activeGoals.reduce((sum, goal) => sum + goal.progress, 0) / activeGoals.length 
      : 0;

    return `You are an expert AI life coach helping ${user.name}. Your coaching style should be ${user.preferences.coachingStyle}.

CONTEXT:
- Active Goals: ${activeGoals.length}
- Completed Goals: ${completedGoals.length}  
- Average Progress: ${Math.round(avgProgress)}%
- Streak: ${user.metrics.streakDays} days
- Focus Areas: ${user.preferences.focusAreas.join(', ')}

CURRENT GOALS:
${activeGoals.map(goal => 
  `• ${goal.title} (${goal.category}) - ${goal.progress}% complete, due ${goal.targetDate}`
).join('\n')}

COACHING PRINCIPLES:
1. Be specific and actionable, not generic
2. Reference their actual goals and progress
3. Ask targeted questions to uncover obstacles
4. Celebrate wins and reframe setbacks
5. Focus on systems and habits over just outcomes
6. Match their preferred coaching style: ${user.preferences.coachingStyle}

RECENT PATTERNS:
${this.analyzeProgressPatterns(progressData)}

Respond in a conversational, supportive tone. Keep responses under 300 words unless providing detailed guidance.`;
  }

  analyzeProgressPatterns(progressData) {
    // Analyze recent progress trends
    if (!progressData || progressData.length === 0) {
      return "No recent progress data available.";
    }

    const recentTrend = progressData.slice(-7); // Last 7 days
    const isImproving = recentTrend[recentTrend.length - 1].progress > recentTrend[0].progress;
    const consistency = this.calculateConsistency(recentTrend);

    return `Recent trend: ${isImproving ? 'improving' : 'stable'}, consistency: ${consistency}`;
  }

  calculateConsistency(data) {
    if (data.length < 3) return 'insufficient data';
    
    const progressChanges = data.slice(1).map((item, i) => 
      Math.abs(item.progress - data[i].progress)
    );
    const avgChange = progressChanges.reduce((sum, change) => sum + change, 0) / progressChanges.length;
    
    return avgChange < 5 ? 'high' : avgChange < 15 ? 'medium' : 'low';
  }

  async analyzeResponse(userMessage, aiResponse) {
    // Extract intent, sentiment, and relevant goals
    return {
      intent: this.extractIntent(userMessage),
      sentiment: await this.analyzeSentiment(userMessage),
      confidence: 0.85, // Placeholder - would use actual confidence scoring
      goalRelevance: this.findRelevantGoals(userMessage)
    };
  }

  extractIntent(message) {
    const intents = {
      'progress_check': ['progress', 'how am i doing', 'update'],
      'motivation': ['stuck', 'unmotivated', 'give up', 'difficult'],
      'goal_creation': ['new goal', 'want to', 'plan to', 'thinking about'],
      'strategy': ['how to', 'what should', 'best way', 'help me'],
      'celebration': ['completed', 'finished', 'achieved', 'success']
    };

    const messageLower = message.toLowerCase();
    for (const [intent, keywords] of Object.entries(intents)) {
      if (keywords.some(keyword => messageLower.includes(keyword))) {
        return intent;
      }
    }
    return 'general';
  }

  async analyzeSentiment(text) {
    // Simple sentiment analysis - in production, use proper NLP service
    const positiveWords = ['good', 'great', 'excited', 'happy', 'progress', 'achieved'];
    const negativeWords = ['stuck', 'difficult', 'frustrated', 'behind', 'failed'];
    
    const words = text.toLowerCase().split(' ');
    const positive = words.filter(word => positiveWords.includes(word)).length;
    const negative = words.filter(word => negativeWords.includes(word)).length;
    
    return (positive - negative) / Math.max(words.length / 10, 1); // Normalize
  }

  getFallbackResponse(userMessage, context) {
    const responses = [
      "I understand you're working on your goals. Can you tell me more about what specific challenge you're facing right now?",
      "Based on your current progress, you're making steady advancement. What area would you like to focus on improving?",
      "Let's break this down step by step. What's the most important thing you could do today to move forward?",
    ];
    
    return {
      content: responses[Math.floor(Math.random() * responses.length)],
      metadata: { intent: 'fallback', confidence: 0.5 }
    };
  }

  async generateEmbedding(text) {
    try {
      const openai = this.getOpenAI();
      const response = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: text,
      });
      
      // Debug - log the response structure
      console.log('Embedding response:', JSON.stringify(response, null, 2));
      
      // Try different possible structures
      if (response.data && response.data[0] && response.data[0].embedding) {
        return response.data[0].embedding;
      } else if (response.embedding) {
        return response.embedding;
      } else if (response[0] && response[0].embedding) {
        return response[0].embedding;
      }
      
      console.error('Unexpected embedding response structure:', response);
      return null;
    } catch (error) {
      console.error('Embedding generation error:', error);
      return null;
    }
  }

  formatConversationHistory(messages) {
    if (!messages || !Array.isArray(messages)) {
      return [];
    }
    
    return messages.map(msg => ({
      role: msg.role, // 'user' or 'assistant'
      content: msg.content
    }));
  }
}

export default new AIService();