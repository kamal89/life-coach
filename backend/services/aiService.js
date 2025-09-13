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
    
    // Validate and provide defaults for context
    const safeContext = this.validateContext(context);
    const { user, goals, recentMessages, progressData } = safeContext;
    
    console.log('🤖 Generating coaching response for user:', user?.name || 'Unknown');
    
    const systemPrompt = this.buildSystemPrompt(user, goals, progressData);
    const conversationHistory = this.formatConversationHistory(recentMessages);

    // Build messages array with validation
    const messages = this.buildMessagesArray(systemPrompt, conversationHistory, userMessage);
    
    console.log(`📝 Sending ${messages.length} messages to OpenAI`);

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: messages,
        temperature: 0.7,
        max_tokens: 800,
      });

      console.log('✅ OpenAI response received successfully');

      return {
        content: completion.choices[0].message.content,
        metadata: await this.analyzeResponse(userMessage, completion.choices[0].message.content)
      };
    } catch (error) {
      console.error('❌ OpenAI API Error:', error);
      
      // Log specific error details for debugging
      if (error.status) {
        console.error('Error Status:', error.status);
      }
      if (error.message) {
        console.error('Error Message:', error.message);
      }
      
      return this.getFallbackResponse(userMessage, safeContext);
    }
  }

  // New method to validate context and provide safe defaults
  validateContext(context) {
    if (!context || typeof context !== 'object') {
      console.log('⚠️  No context provided, using defaults');
      return this.getDefaultContext();
    }

    return {
      user: context.user || this.getDefaultUser(),
      goals: Array.isArray(context.goals) ? context.goals : [],
      recentMessages: Array.isArray(context.recentMessages) ? context.recentMessages : [],
      progressData: Array.isArray(context.progressData) ? context.progressData : []
    };
  }

  // New method to build messages array with validation
  buildMessagesArray(systemPrompt, conversationHistory, userMessage) {
    const messages = [];

    // Add system message
    if (systemPrompt && typeof systemPrompt === 'string') {
      messages.push({ 
        role: "system", 
        content: systemPrompt 
      });
    } else {
      console.log('⚠️  Invalid system prompt, using default');
      messages.push({ 
        role: "system", 
        content: "You are a helpful life coach. Provide supportive and actionable advice." 
      });
    }

    // Add conversation history
    if (Array.isArray(conversationHistory)) {
      conversationHistory.forEach((msg, index) => {
        if (this.isValidMessage(msg)) {
          messages.push(msg);
        } else {
          console.log(`⚠️  Invalid message at index ${index}:`, msg);
        }
      });
    }

    // Add current user message
    if (userMessage && typeof userMessage === 'string') {
      messages.push({ 
        role: "user", 
        content: userMessage.trim()
      });
    } else {
      console.error('❌ Invalid user message:', userMessage);
      messages.push({ 
        role: "user", 
        content: "Hello" 
      });
    }

    return messages;
  }

  // New method to validate individual messages
  isValidMessage(msg) {
    return (
      msg && 
      typeof msg === 'object' && 
      typeof msg.role === 'string' && 
      ['system', 'user', 'assistant'].includes(msg.role) &&
      typeof msg.content === 'string' &&
      msg.content.trim().length > 0
    );
  }

  // Provide default context for new users
  getDefaultContext() {
    return {
      user: this.getDefaultUser(),
      goals: [],
      recentMessages: [],
      progressData: []
    };
  }

  getDefaultUser() {
    return {
      name: 'User',
      preferences: {
        coachingStyle: 'supportive',
        focusAreas: ['general wellbeing']
      },
      metrics: {
        streakDays: 0
      }
    };
  }

  buildSystemPrompt(user, goals, progressData) {
    const activeGoals = goals.filter(g => g.status === 'active');
    const completedGoals = goals.filter(g => g.status === 'completed');
    const avgProgress = activeGoals.length > 0 
      ? activeGoals.reduce((sum, goal) => sum + goal.progress, 0) / activeGoals.length 
      : 0;

    // Handle case where user might not have full data
    const userName = user?.name || 'there';
    const coachingStyle = user?.preferences?.coachingStyle || 'supportive';
    const focusAreas = user?.preferences?.focusAreas || ['general wellbeing'];
    const streakDays = user?.metrics?.streakDays || 0;

    let systemPrompt = `You are an expert AI life coach helping ${userName}. Your coaching style should be ${coachingStyle}.

CONTEXT:
- Active Goals: ${activeGoals.length}
- Completed Goals: ${completedGoals.length}  
- Average Progress: ${Math.round(avgProgress)}%
- Streak: ${streakDays} days
- Focus Areas: ${focusAreas.join(', ')}`;

    if (activeGoals.length > 0) {
      systemPrompt += `

CURRENT GOALS:
${activeGoals.map(goal => 
  `• ${goal.title} (${goal.category}) - ${goal.progress}% complete, due ${goal.targetDate}`
).join('\n')}`;
    } else {
      systemPrompt += `

This user doesn't have any active goals yet. Help them identify areas where they'd like to grow and suggest starting with small, achievable goals.`;
    }

    systemPrompt += `

COACHING PRINCIPLES:
1. Be specific and actionable, not generic
2. Reference their actual goals and progress when available
3. Ask targeted questions to uncover obstacles
4. Celebrate wins and reframe setbacks
5. Focus on systems and habits over just outcomes
6. Match their preferred coaching style: ${coachingStyle}

RECENT PATTERNS:
${this.analyzeProgressPatterns(progressData)}

Respond in a conversational, supportive tone. Keep responses under 300 words unless providing detailed guidance.`;

    return systemPrompt;
  }

  analyzeProgressPatterns(progressData) {
    // Analyze recent progress trends
    if (!progressData || progressData.length === 0) {
      return "This appears to be a new conversation. Focus on understanding their current situation and goals.";
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

  findRelevantGoals(message) {
    // Placeholder - would analyze message against user's goals
    return [];
  }

  getFallbackResponse(userMessage, context) {
    console.log('🔄 Using fallback response');
    
    const responses = [
      "I understand you're working on your goals. Can you tell me more about what specific challenge you're facing right now?",
      "I'm here to help you with your personal development. What area would you like to focus on improving?",
      "Let's break this down step by step. What's the most important thing you could do today to move forward?",
      "I'd love to help you with that. Could you share a bit more about your current situation?",
    ];
    
    return {
      content: responses[Math.floor(Math.random() * responses.length)],
      metadata: { intent: 'fallback', confidence: 0.5 }
    };
  }

  async generateEmbedding(text) {
    try {
      const openai = this.getOpenAI();
      console.log(`🔍 Generating embedding for text length: ${text?.length || 0} chars`);
      
      const response = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: text,
      });
      
      console.log(`📊 Embedding generated with ${response.data[0].embedding.length} dimensions`);
      
      // Try different possible structures
      if (response.data && response.data[0] && response.data[0].embedding) {
        return response.data[0].embedding;
      } else if (response.embedding) {
        return response.embedding;
      } else if (response[0] && response[0].embedding) {
        return response[0].embedding;
      }
      
      console.error('❌ Unexpected embedding response structure:', Object.keys(response));
      return null;
    } catch (error) {
      console.error('❌ Embedding generation error:', error);
      return null;
    }
  }

  formatConversationHistory(messages) {
    if (!messages || !Array.isArray(messages)) {
      console.log('ℹ️  No conversation history provided');
      return [];
    }
    
    const formattedMessages = messages
      .filter(msg => this.isValidMessage(msg))
      .map(msg => ({
        role: msg.role, // 'user' or 'assistant'
        content: msg.content
      }));
    
    console.log(`📝 Formatted ${formattedMessages.length} history messages`);
    return formattedMessages;
  }
}

export default new AIService();