import cache from "../libs/cache";

interface ChatMessage {
  role: string;
  content: string;
  timestamp?: Date;
}

interface SessionContext {
  conversationHistory: ChatMessage[];
  currentQueue?: string;
  tags: string[];
  summary?: string;
  lastInteraction?: Date;
  contactId?: number;
  ticketId?: number;
}

class SessionContextManager {
  private cache: typeof cache;
  private maxMessages: number = 20; // Reduced to manage tokens better
  private summaryThreshold: number = 15;

  constructor() {
    this.cache = cache;
  }

  /**
   * Get the current context for a session (contact or ticket)
   */
  async getContext(sessionId: string): Promise<SessionContext> {
    const cachedContext = await this.cache.get(`context:${sessionId}`);
    
    if (cachedContext) {
      return JSON.parse(cachedContext);
    }

    // If not in cache, create a new context
    const newContext: SessionContext = {
      conversationHistory: [],
      tags: [],
      lastInteraction: new Date(),
    };

    return newContext;
  }

  /**
   * Save context to cache
   */
  async saveContext(sessionId: string, context: SessionContext): Promise<void> {
    await this.cache.set(
      `context:${sessionId}`,
      JSON.stringify(context),
      "EX",
      60 * 60 * 24 // 24 hours expiration
    );
  }

  /**
   * Add a message to the session context
   */
  async addMessage(
    sessionId: string,
    message: ChatMessage,
    ticketId?: number
  ): Promise<SessionContext> {
    let context = await this.getContext(sessionId);
    
    // Add the new message
    context.conversationHistory.push({
      ...message,
      timestamp: message.timestamp || new Date()
    });
    
    // Update last interaction
    context.lastInteraction = new Date();
    
    // Update ticketId if provided
    if (ticketId) {
      context.ticketId = ticketId;
    }

    // Check if we need to limit the number of messages to manage tokens
    if (context.conversationHistory.length > this.maxMessages) {
      context.conversationHistory = context.conversationHistory.slice(-this.maxMessages);
    }

    await this.saveContext(sessionId, context);
    return context;
  }

  /**
   * Get conversation history for AI processing
   */
  async getConversationHistory(sessionId: string): Promise<ChatMessage[]> {
    const context = await this.getContext(sessionId);
    
    // If we have a summary, prepend it to the conversation
    if (context.summary) {
      return [
        { 
          role: 'system', 
          content: `Resumo da conversa anterior: ${context.summary}` 
        },
        ...context.conversationHistory
      ];
    }
    
    return context.conversationHistory;
  }

  /**
   * Set current queue for the session
   */
  async setCurrentQueue(sessionId: string, queueName: string): Promise<void> {
    let context = await this.getContext(sessionId);
    context.currentQueue = queueName;
    await this.saveContext(sessionId, context);
  }

  /**
   * Get current queue for the session
   */
  async getCurrentQueue(sessionId: string): Promise<string | undefined> {
    const context = await this.getContext(sessionId);
    return context.currentQueue;
  }

  /**
   * Add a tag to the session
   */
  async addTag(sessionId: string, tag: string): Promise<void> {
    let context = await this.getContext(sessionId);
    
    if (!context.tags.includes(tag)) {
      context.tags.push(tag);
      await this.saveContext(sessionId, context);
    }
  }

  /**
   * Remove a tag from the session
   */
  async removeTag(sessionId: string, tag: string): Promise<void> {
    let context = await this.getContext(sessionId);
    context.tags = context.tags.filter(t => t !== tag);
    await this.saveContext(sessionId, context);
  }

  /**
   * Get all tags for the session
   */
  async getTags(sessionId: string): Promise<string[]> {
    const context = await this.getContext(sessionId);
    return context.tags;
  }

  /**
   * Clear context for a session
   */
  async clearContext(sessionId: string): Promise<void> {
    await this.cache.del(`context:${sessionId}`);
  }

  /**
   * Get context size (number of messages)
   */
  async getContextSize(sessionId: string): Promise<number> {
    const context = await this.getContext(sessionId);
    return context.conversationHistory.length;
  }
}

export default new SessionContextManager();