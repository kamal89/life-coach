// services/vectorStore.js

// =============================================================================
// VECTOR STORE SERVICE
// =============================================================================


const { Pinecone } = require('@pinecone-database/pinecone');
const faiss = require('faiss-node');

class VectorStore {
  constructor() {
    this.pinecone = process.env.PINECONE_API_KEY 
      ? new Pinecone({ apiKey: process.env.PINECONE_API_KEY })
      : null;
    
    this.faissIndex = null; // Local FAISS index as fallback
    this.initializeFAISS();
  }

  async initializePinecone() {
    if (!this.pinecone) return;
    
    try {
      this.index = this.pinecone.Index(process.env.PINECONE_INDEX_NAME);
      console.log('✅ Pinecone connected');
    } catch (error) {
      console.error('❌ Pinecone initialization error:', error);
    }
  }

  async initializeFAISS() {
    try {
      // Initialize FAISS index for local vector storage
      const dimension = 1536; // OpenAI embedding dimension
      this.faissIndex = new faiss.IndexFlatL2(dimension);
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

  async findSimilarConversations(userId, queryEmbedding, limit = 5) {
    if (this.index) {
      try {
        const queryResponse = await this.index.query({
          vector: queryEmbedding,
          topK: limit,
          filter: { userId },
          includeMetadata: true
        });
        
        return queryResponse.matches.map(match => ({
          score: match.score,
          metadata: match.metadata
        }));
      } catch (error) {
        console.error('Pinecone query error:', error);
      }
    }

    // FAISS fallback
    if (this.faissIndex && this.faissVectors.length > 0) {
      const results = this.faissIndex.search(queryEmbedding, limit);
      return results.labels.map((idx, i) => ({
        score: results.distances[i],
        metadata: this.faissMetadata[idx]
      }));
    }

    return [];
  }

  async getConversationContext(userId, currentMessage, embedding) {
    const similarConversations = await this.findSimilarConversations(
      userId, 
      embedding, 
      3
    );

    return similarConversations
      .filter(conv => conv.score > 0.7) // Similarity threshold
      .map(conv => ({
        text: conv.metadata.text,
        timestamp: conv.metadata.timestamp,
        relevance: conv.score
      }));
  }
}

module.exports = new VectorStore();