// services/vectorStore.js

// =============================================================================
// VECTOR STORE SERVICE
// =============================================================================


import Pinecone from '@pinecone-database/pinecone';
import Faiss from 'faiss-node';

class VectorStore {
  constructor() {
    this.conversations = this.conversations || [];
    this.pinecone = process.env.PINECONE_API_KEY 
      ? new Pinecone.Pinecone({ 
          apiKey: process.env.PINECONE_API_KEY 
        })
      : null;
    
    this.faissIndex = null;
    this.initializeFAISS();
    if (this.pinecone) {
      this.initializePinecone();
    }
  }

  async initializePinecone() {
    if (!this.pinecone || !process.env.PINECONE_INDEX_NAME) return;
    
    try {
      this.index = this.pinecone.index(process.env.PINECONE_INDEX_NAME);
      console.log('✅ Pinecone connected');
    } catch (error) {
      console.error('❌ Pinecone initialization error:', error);
    }
  }

  async initializeFAISS() {
    try {
      // Initialize FAISS index for local vector storage
      const dimension = 1536; // OpenAI embedding dimension
      this.faissIndex = new Faiss.IndexFlatL2(dimension);
      this.faissVectors = [];
      this.faissMetadata = [];
      console.log('✅ FAISS index initialized');
    } catch (error) {
      console.error('❌ FAISS initialization error:', error);
    }
  }

  async storeConversation(userId, messageId, text, embedding, metadata) {
    const vector = {
      id: `${userId}_${messageId}`,
      values: embedding,
      metadata: {
        userId,
        messageId,
        text: text.substring(0, 500), // Truncate for storage
        timestamp: Date.now(),
        ...metadata
      }
    };

    // Try Pinecone first, fallback to FAISS
    if (this.index) {
      try {
        await this.index.upsert([vector]);
        return true;
      } catch (error) {
        console.error('Pinecone storage error:', error);
      }
    }

    // FAISS fallback
    if (this.faissIndex) {
      this.faissIndex.add(embedding);
      this.faissVectors.push(embedding);
      this.faissMetadata.push(vector.metadata);
      return true;
    }

    return false;
  }

  async findSimilarConversations(queryEmbedding, userId, k = 5) {
    try {
      // First, get the total count of conversations for this user
      const totalConversations = await this.getTotalConversationCount(userId);
      
      // Adjust k to not exceed total available conversations
      const adjustedK = Math.min(k, totalConversations);
      
      console.log(`📊 Searching for ${adjustedK} similar conversations (requested: ${k}, available: ${totalConversations})`);
      
      // If no conversations exist, return empty array
      if (totalConversations === 0) {
        console.log('ℹ️  No conversations found for user');
        return [];
      }

      // If only 1 conversation exists and k > 1, adjust accordingly
      if (adjustedK === 0) {
        console.log('ℹ️  No similar conversations to search');
        return [];
      }

      // Your existing similarity search logic here, but with adjustedK
      const similarConversations = await this.performSimilaritySearch(queryEmbedding, userId, adjustedK);
      
      return similarConversations;
      
    } catch (error) {
      console.error('❌ Error finding similar conversations:', error);
      // Return empty array instead of throwing error
      return [];
    }
  }

  async getConversationContext(userMessage, userId, k = 3) {
    try {
      console.log(`🔍 Getting conversation context for user: ${userId}`);
      
      // Get total conversations with error handling
      let totalConversations;
      try {
        totalConversations = await this.getTotalConversationCount(userId);
      } catch (countError) {
        console.error('⚠️  Failed to get conversation count:', countError);
        totalConversations = 0;
      }
      
      // Ensure it's a valid number
      if (isNaN(totalConversations) || totalConversations < 0) {
        totalConversations = 0;
      }
      
      const adjustedK = Math.min(k, Math.max(0, totalConversations));
      console.log(`🔍 Getting context with ${adjustedK} conversations (total: ${totalConversations})`);
      
      // If no conversations, return empty context
      if (totalConversations === 0) {
        return {
          similarConversations: [],
          contextSummary: "This is the user's first conversation.",
          conversationCount: 0
        };
      }

      // Find similar conversations (keep your existing logic here)
      let similarConversations = [];
      if (adjustedK > 0) {
        try {
          const queryEmbedding = await this.generateEmbedding(userMessage);
          similarConversations = await this.findSimilarConversations(queryEmbedding, userId, adjustedK);
        } catch (embeddingError) {
          console.error('⚠️  Failed to find similar conversations:', embeddingError);
        }
      }
      
      return {
        similarConversations,
        contextSummary: this.generateContextSummary(similarConversations),
        conversationCount: totalConversations
      };
      
    } catch (error) {
      console.error('❌ Error getting conversation context:', error);
      return {
        similarConversations: [],
        contextSummary: "Unable to retrieve conversation context.",
        conversationCount: 0
      };
    }
  }

  // Helper method to get total conversation count
  async getTotalConversationCount(userId) {
    try {
      console.log(`📊 Getting conversation count for user: ${userId}`);
      
      if (this.useDatabase && this.db) {
        // If using MongoDB
        const count = await this.db.collection('conversations')
          .countDocuments({ userId: userId });
        console.log(`📈 Database conversation count: ${count}`);
        return count;
      } else {
        // If using in-memory storage
        if (!this.conversations || !Array.isArray(this.conversations)) {
          console.log('⚠️  Conversations array not initialized');
          this.conversations = [];
          return 0;
        }
        
        const userConversations = this.conversations.filter(conv => conv.userId === userId);
        const count = userConversations.length;
        console.log(`📈 In-memory conversation count: ${count}`);
        return count;
      }
    } catch (error) {
      console.error('❌ Error getting conversation count:', error);
      return 0;
    }
  }

  // Enhanced similarity search with better error handling
  async performSimilaritySearch(queryEmbedding, userId, k) {
    try {
      // Your existing similarity search logic
      // Make sure to handle the case where k might still be problematic
      
      // Example implementation (adjust based on your vector store):
      let results;
      
      if (this.useFAISS) {
        // FAISS implementation
        results = await this.faissIndex.search(queryEmbedding, k);
      } else if (this.usePinecone) {
        // Pinecone implementation
        results = await this.pineconeIndex.query({
          vector: queryEmbedding,
          topK: k,
          filter: { userId: userId }
        });
      } else {
        // Custom similarity calculation
        results = this.calculateSimilarity(queryEmbedding, userId, k);
      }
      
      return results;
      
    } catch (error) {
      console.error('❌ Error in similarity search:', error);
      
      // If the error is still about k being too large, try with k=1
      if (error.message.includes('greater than `ntotal`')) {
        console.log('⚠️  Retrying with k=1');
        try {
          return await this.performSimilaritySearch(queryEmbedding, userId, 1);
        } catch (retryError) {
          console.error('❌ Retry also failed:', retryError);
          return [];
        }
      }
      
      throw error;
    }
  }

  // Helper to generate context summary
  generateContextSummary(similarConversations) {
    if (!similarConversations || similarConversations.length === 0) {
      return "No previous conversation context available.";
    }
    
    const topics = similarConversations
      .map(conv => conv.topic || conv.summary)
      .filter(Boolean)
      .slice(0, 3);
    
    if (topics.length > 0) {
      return `Previous conversations covered: ${topics.join(', ')}`;
    }
    
    return `Found ${similarConversations.length} related previous conversations.`;
  }
}

export default new VectorStore();