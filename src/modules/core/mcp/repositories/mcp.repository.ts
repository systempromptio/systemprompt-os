/**
 * MCP repository implementation - placeholder for database operations.
 */

import type {
  IMcpContextsRow,
  IMcpMessagesRow,
  IMcpSessionsRow,
  McpMessagesRole,
} from '@/modules/core/mcp/types/database.generated';
import { McpSessionsStatus } from '@/modules/core/mcp/types/database.generated';

/**
 * Repository for MCP data operations.
 */
export class MCPRepository {
  private static instance: MCPRepository | undefined;
  private readonly contexts: Map<string, IMcpContextsRow> = new Map();
  private readonly sessions: Map<string, IMcpSessionsRow> = new Map();
  private readonly messages: IMcpMessagesRow[] = [];
  private messageIdCounter = 1;

  /**
   * Private constructor for singleton.
   * Initialize empty maps and arrays - already done in field declarations.
   */
  private constructor() {
    this.messageIdCounter = 1;
  }

  /**
   * Get singleton instance.
   * @returns The repository instance.
   */
  static getInstance(): MCPRepository {
    MCPRepository.instance ??= new MCPRepository();
    return MCPRepository.instance;
  }

  /**
   * Initialize repository.
   * Repository is already initialized through constructor.
   * This method is kept for interface compatibility.
   */
  initialize(): void {
    this.messageIdCounter = 1;
    this.contexts.clear();
    this.sessions.clear();
    this.messages.length = 0;
  }

  /**
   * Create a new context.
   * @param contextData - Context creation data.
   * @param contextData.id
   * @param contextData.name
   * @param contextData.model
   * @param contextData.description
   * @param contextData.maxTokens
   * @param contextData.temperature
   * @param contextData.topP
   * @param contextData.frequencyPenalty
   * @param contextData.presencePenalty
   * @param contextData.stopSequences
   * @param contextData.systemPrompt
   * @returns The created context.
   */
  createContext(contextData: {
    id: string;
    name: string;
    model: string;
    description?: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stopSequences?: string;
    systemPrompt?: string;
  }): IMcpContextsRow {
    const context: IMcpContextsRow = {
      id: contextData.id,
      name: contextData.name,
      model: contextData.model,
      description: contextData.description ?? null,
      max_tokens: contextData.maxTokens ?? 4096,
      temperature: contextData.temperature ?? 0.7,
      top_p: contextData.topP ?? null,
      frequency_penalty: contextData.frequencyPenalty ?? null,
      presence_penalty: contextData.presencePenalty ?? null,
      stop_sequences: contextData.stopSequences ?? null,
      system_prompt: contextData.systemPrompt ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.contexts.set(contextData.id, context);
    return context;
  }

  /**
   * Find context by ID.
   * @param id - The context ID.
   * @returns The context or null.
   */
  findContextById(id: string): IMcpContextsRow | null {
    return this.contexts.get(id) ?? null;
  }

  /**
   * Find all contexts.
   * @returns Array of contexts.
   */
  findAllContexts(): IMcpContextsRow[] {
    return Array.from(this.contexts.values());
  }

  /**
   * Delete a context.
   * @param id - The context ID.
   */
  deleteContext(id: string): void {
    this.contexts.delete(id);
  }

  /**
   * Create a new session.
   * @param id - The session ID.
   * @param contextId - The context ID.
   * @param options - Optional session data.
   * @param options.sessionName
   * @param options.userId
   * @returns The created session.
   */
  createSession(id: string, contextId: string, options?: {
    sessionName?: string;
    userId?: string;
  }): IMcpSessionsRow {
    const session: IMcpSessionsRow = {
      id,
      context_id: contextId,
      status: McpSessionsStatus.ACTIVE,
      session_name: options?.sessionName ?? null,
      user_id: options?.userId ?? null,
      total_tokens: 0,
      total_cost: 0.0,
      started_at: new Date().toISOString(),
      ended_at: null,
    };

    this.sessions.set(id, session);
    return session;
  }

  /**
   * Find session by ID.
   * @param id - The session ID.
   * @returns The session or null.
   */
  findSessionById(id: string): IMcpSessionsRow | null {
    return this.sessions.get(id) ?? null;
  }

  /**
   * Create a new message.
   * @param sessionId - The session ID.
   * @param role - The message role.
   * @param content - The message content.
   * @param options - Optional message data.
   * @param options.tokenCount
   * @param options.cost
   * @param options.modelUsed
   * @param options.processingTimeMs
   * @returns The created message.
   */
  createMessage(sessionId: string, role: McpMessagesRole, content: string, options?: {
    tokenCount?: number;
    cost?: number;
    modelUsed?: string;
    processingTimeMs?: number;
  }): IMcpMessagesRow {
    const message: IMcpMessagesRow = {
      id: this.messageIdCounter,
      session_id: sessionId,
      role,
      content,
      token_count: options?.tokenCount ?? null,
      cost: options?.cost ?? null,
      model_used: options?.modelUsed ?? null,
      processing_time_ms: options?.processingTimeMs ?? null,
      created_at: new Date().toISOString(),
    };

    this.messageIdCounter += 1;
    this.messages.push(message);
    return message;
  }

  /**
   * Find messages by session ID.
   * @param sessionId - The session ID.
   * @returns Array of messages.
   */
  findMessagesBySessionId(sessionId: string): IMcpMessagesRow[] {
    return this.messages.filter((message): boolean => {
      return message.session_id === sessionId;
    });
  }
}
