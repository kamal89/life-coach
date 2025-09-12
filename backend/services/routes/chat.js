// routes/chat.js
import { Router } from 'express';
const router = Router();
import Message from '../../models/Message.js';
import Goal from '../../models/Goals.js';
import AiService from '../aiService.js';
import VectorStore from '../vectorStore.js';
import Auth from '../../../middleware/auth.js';

// POST /api/chat/message - Send message to AI coach
router.post('/message', Auth.auth, async (req, res) => {
  try {
    const { message, conversationId } = req.body;
    const userId = req.user.id;

    // Store user message
    const userMessage = new Message({
      userId,
      conversationId: conversationId || `conv_${Date.now()}`,
      type: 'user',
      content: message
    });

    // Generate embedding for context search
    const embedding = await AiService.generateEmbedding(message);
    if (embedding) {
      userMessage.embedding = embedding;
    }

    await userMessage.save();

    // Get user context
    const goals = await Goal.find({ userId, status: { $in: ['active', 'paused'] } });
    const recentMessages = await Message.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10);

    // Get conversation context from vector store
    const conversationContext = embedding 
      ? await VectorStore.getConversationContext(userId, message, embedding)
      : [];

    // Prepare context for AI
    const context = {
      user: req.user,
      goals,
      recentMessages: recentMessages.reverse(),
      conversationContext,
      progressData: await getProgressData(userId)
    };

    // Generate AI response
    const aiResponse = await AiService.generateCoachingResponse(message, context);

    // Store AI message
    const aiMessage = new Message({
      userId,
      conversationId: userMessage.conversationId,
      type: 'ai',
      content: aiResponse.content,
      metadata: aiResponse.metadata
    });

    // Generate and store AI response embedding
    if (AiService.generateEmbedding) {
      const aiEmbedding = await AiService.generateEmbedding(aiResponse.content);
      if (aiEmbedding) {
        aiMessage.embedding = aiEmbedding;
        
        // Store in vector database for future context
        await VectorStore.storeConversation(
          userId,
          aiMessage._id,
          aiResponse.content,
          aiEmbedding,
          aiResponse.metadata
        );
      }
    }

    await aiMessage.save();

    res.json({
      success: true,
      userMessage: userMessage,
      aiMessage: aiMessage,
      conversationId: userMessage.conversationId
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process message',
      fallback: 'I apologize, but I encountered an error. Please try again.'
    });
  }
});

// GET /api/chat/history - Get conversation history
router.get('/history', Auth.auth, async (req, res) => {
  try {
    const { conversationId, limit = 50 } = req.query;
    const userId = req.user.id;

    const query = { userId };
    if (conversationId) {
      query.conversationId = conversationId;
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('-embedding'); // Don't send embeddings to frontend

    res.json({
      success: true,
      messages: messages.reverse(),
      total: messages.length
    });

  } catch (error) {
    console.error('Chat history error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch chat history' });
  }
});

// POST /api/chat/feedback - Provide feedback on AI response
router.post('/feedback', Auth.auth, async (req, res) => {
  try {
    const { messageId, rating, feedback } = req.body;
    const userId = req.user.id;

    const message = await Message.findOneAndUpdate(
      { _id: messageId, userId },
      { 
        $set: { 
          'metadata.userRating': rating,
          'metadata.userFeedback': feedback,
          'metadata.feedbackDate': new Date()
        }
      },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    res.json({ success: true, message: 'Feedback recorded' });

  } catch (error) {
    console.error('Feedback error:', error);
    res.status(500).json({ success: false, error: 'Failed to record feedback' });
  }
});

async function getProgressData(userId) {
  const goals = await Goal.find({ userId });
  const progressData = [];

  goals.forEach(goal => {
    goal.progressHistory.forEach(entry => {
      progressData.push({
        goalId: goal._id,
        goalTitle: goal.title,
        date: entry.date,
        progress: entry.progress,
        category: goal.category
      });
    });
  });

  return progressData.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 50);
}

export default router;