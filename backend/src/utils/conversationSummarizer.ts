import OpenAI from "openai";
import { getSettingsValue } from "../services/SettingServices/getSettingsValue";
import OpenAIMessage from "../models/OpenAIMessage";

interface SummaryResult {
  summary: string;
  keyPoints: string[];
  sentiment: string;
}

class ConversationSummarizer {
  private openai: OpenAI | null = null;
  private maxTokensPerSummary: number = 1000; // Limit summary size

  constructor() {
    this.initializeOpenAI();
  }

  private initializeOpenAI(): void {
    const openAiKey = process.env.OPENAI_API_KEY;
    if (openAiKey) {
      this.openai = new OpenAI({ apiKey: openAiKey });
    }
  }

  /**
   * Create a summary of a conversation
   */
  async createSummary(
    messages: Array<{ role: string; content: string; timestamp?: Date }>,
    ticketId?: number
  ): Promise<SummaryResult> {
    if (!this.openai) {
      // Fallback to simple summarization if OpenAI is not available
      return this.createSimpleSummary(messages);
    }

    try {
      // Format messages for summary
      const formattedMessages = this.formatMessagesForSummary(messages);
      
      const prompt = `
        Faça um resumo conciso e objetivo da seguinte conversa, destacando os principais pontos discutidos e o sentimento geral:
        
        ${formattedMessages}
        
        O resumo deve:
        1. Ter no máximo 300 palavras
        2. Destacar os tópicos principais
        3. Identificar o sentimento geral da conversa (positivo, negativo, neutro)
        4. Preservar informações críticas para o contexto futuro
      `;

      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: this.maxTokensPerSummary
      });

      const summaryText = response.choices[0].message?.content?.trim() || "Não foi possível gerar um resumo.";
      
      // Extract key points (in a real implementation, you'd parse the summary better)
      const keyPoints = this.extractKeyPoints(summaryText);
      const sentiment = this.estimateSentiment(messages);
      
      const summaryResult: SummaryResult = {
        summary: summaryText,
        keyPoints,
        sentiment
      };

      // Optionally save the summary to the database
      if (ticketId) {
        await this.saveSummaryToDatabase(ticketId, summaryResult);
      }

      return summaryResult;
      
    } catch (error) {
      console.error("Error creating summary with OpenAI:", error);
      // Fallback to simple summarization
      return this.createSimpleSummary(messages);
    }
  }

  /**
   * Format messages for summary creation
   */
  private formatMessagesForSummary(
    messages: Array<{ role: string; content: string; timestamp?: Date }>
  ): string {
    return messages
      .map((msg, index) => {
        const role = msg.role === 'user' ? 'Cliente' : 'Atendente';
        return `${index + 1}. ${role}: ${msg.content}`;
      })
      .join('\n');
  }

  /**
   * Create a simple summary without OpenAI
   */
  private createSimpleSummary(
    messages: Array<{ role: string; content: string; timestamp?: Date }>
  ): SummaryResult {
    const totalMessages = messages.length;
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    
    const summary = `Conversa com ${totalMessages} mensagens no total, incluindo ${userMessages.length} mensagens do cliente e ${assistantMessages.length} respostas. O cliente iniciou a conversa solicitando ajuda, e o atendimento foi fornecido.`;
    
    const keyPoints = [
      `Total de mensagens: ${totalMessages}`,
      `Mensagens do cliente: ${userMessages.length}`,
      `Respostas: ${assistantMessages.length}`
    ];
    
    return {
      summary,
      keyPoints,
      sentiment: "neutro"
    };
  }

  /**
   * Extract key points from summary text
   */
  private extractKeyPoints(summary: string): string[] {
    // Simple implementation - in practice, you'd use NLP to extract key points
    const sentences = summary.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    // Return up to 5 key sentences
    return sentences.slice(0, 5).map(s => s.trim()).filter(s => s.length > 0);
  }

  /**
   * Estimate sentiment from messages
   */
  private estimateSentiment(
    messages: Array<{ role: string; content: string; timestamp?: Date }>
  ): string {
    // Simple sentiment analysis based on keywords
    const positiveKeywords = ['obrigado', 'ótimo', 'bom', 'excelente', 'satisfeito', 'perfeito', 'agradecido', 'feliz'];
    const negativeKeywords = ['problema', 'erro', 'não', 'mal', 'ruim', 'pessimo', 'insatisfeito', 'frustrado', 'irritado'];
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    messages.forEach(msg => {
      const content = msg.content.toLowerCase();
      
      positiveKeywords.forEach(keyword => {
        if (content.includes(keyword)) positiveCount++;
      });
      
      negativeKeywords.forEach(keyword => {
        if (content.includes(keyword)) negativeCount++;
      });
    });
    
    if (negativeCount > positiveCount) return 'negativo';
    if (positiveCount > negativeCount) return 'positivo';
    return 'neutro';
  }

  /**
   * Save summary to the database
   */
  private async saveSummaryToDatabase(ticketId: number, summary: SummaryResult): Promise<void> {
    try {
      // Save the summary as a system message in the OpenAI messages table
      await OpenAIMessage.create({
        ticketId: ticketId,
        content: `Resumo da conversa: ${summary.summary}\n\nPrincipais pontos: ${summary.keyPoints.join('; ')}\nSentimento: ${summary.sentiment}`,
        from: "system",
        to: "",
        message: JSON.stringify(summary)
      });
    } catch (error) {
      console.error("Error saving summary to database:", error);
    }
  }

  /**
   * Determine if a conversation should be summarized based on length
   */
  shouldSummarize(conversationLength: number, messageThreshold: number = 30): boolean {
    return conversationLength >= messageThreshold;
  }
}

export default new ConversationSummarizer();