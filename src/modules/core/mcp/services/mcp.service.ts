/* eslint-disable
  logical-assignment-operators,
  @typescript-eslint/no-unnecessary-condition,
  @typescript-eslint/strict-boolean-expressions,
  systemprompt-os/no-block-comments
*/
/**
 * MCP service implementation - manages Model Context Protocol operations.
 * @file MCP service implementation.
 * @module mcp/services
 * Provides business logic for MCP context and session management.
 */

import { randomUUID } from 'crypto';
import type { ILogger } from '@/modules/core/logger/types/manual';
import { LogSource } from '@/modules/core/logger/types/manual';
import { MCPRepository } from '@/modules/core/mcp/repositories/mcp.repository';
import type {
  IMCPService,
} from '@/modules/core/mcp/types/manual';
import type {
  IMcpContextsRow,
  IMcpMessagesRow,
  IMcpSessionsRow,
  McpMessagesRole,
} from '@/modules/core/mcp/types/database.generated';
import { McpSessionsStatus } from '@/modules/core/mcp/types/database.generated';

/**
 * Service for managing MCP contexts and sessions.
 */
export class MCPService implements IMCPService {
  private static instance: MCPService;
  private readonly repository: MCPRepository;
  private logger?: ILogger;
  private initialized = false;

  /**
   * Private constructor for singleton.
   */
  private constructor() {
    this.repository = MCPRepository.getInstance();
  }

  /**
   * Get singleton instance.
   * @returns The MCP service instance.
   */
  static getInstance(): MCPService {
    if (!MCPService.instance) {
      MCPService.instance = new MCPService();
    }
    return MCPService.instance;
  }

  /**
   * Set logger instance.
   * @param logger - The logger instance to use.
   */
  setLogger(logger: ILogger): void {
    this.logger = logger;
  }

  /**
   * Initialize service.
   * @returns Promise that resolves when initialized.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.repository.initialize();
    this.initialized = true;
    this.logger?.info(LogSource.MCP, 'MCPService initialized');
  }

  /**
   * Create a new MCP context.
   * @param name - The context name.
   * @param model - The model identifier.
   * @param options - Optional context configuration.
   * @param options.description
   * @param options.maxTokens
   * @param options.temperature
   * @param options.topP
   * @param options.frequencyPenalty
   * @param options.presencePenalty
   * @param options.stopSequences
   * @param options.systemPrompt
   * @returns Promise that resolves to the created context.
   */
  async createContext(
    name: string,
    model: string,
    options?: {
      description?: string;
      maxTokens?: number;
      temperature?: number;
      topP?: number;
      frequencyPenalty?: number;
      presencePenalty?: number;
      stopSequences?: string;
      systemPrompt?: string;
    }
  ): Promise<IMcpContextsRow> {
    await this.ensureInitialized();

    const id = randomUUID();
    this.logger?.info(LogSource.MCP, `Creating MCP context: ${name} (${model})`);

    const context = this.repository.createContext({
      id,
      name,
      model,
      ...options,
    });

    this.logger?.info(LogSource.MCP, `Created MCP context: ${id}`);
    return context;
  }

  /**
   * Get context by ID.
   * @param id - The context ID.
   * @returns Promise that resolves to the context or null if not found.
   */
  async getContext(id: string): Promise<IMcpContextsRow | null> {
    await this.ensureInitialized();
    return this.repository.findContextById(id);
  }

  /**
   * List all contexts.
   * @returns Promise that resolves to array of contexts.
   */
  async listContexts(): Promise<IMcpContextsRow[]> {
    await this.ensureInitialized();
    return this.repository.findAllContexts();
  }

  /**
   * Delete a context.
   * @param id - The context ID.
   * @returns Promise that resolves when deleted.
   */
  async deleteContext(id: string): Promise<void> {
    await this.ensureInitialized();

    const context = this.repository.findContextById(id);
    if (context === null) {
      throw new Error(`Context not found: ${id}`);
    }

    this.logger?.info(LogSource.MCP, `Deleting MCP context: ${id}`);
    this.repository.deleteContext(id);
    this.logger?.info(LogSource.MCP, `Deleted MCP context: ${id}`);
  }

  /**
   * Create a new session.
   * @param contextId - The context ID.
   * @param options - Optional session data.
   * @param options.sessionName
   * @param options.userId
   * @returns Promise that resolves to the created session.
   */
  async createSession(contextId: string, options?: {
    sessionName?: string;
    userId?: string;
  }): Promise<IMcpSessionsRow> {
    await this.ensureInitialized();

    const context = this.repository.findContextById(contextId);
    if (context === null) {
      throw new Error(`Context not found: ${contextId}`);
    }

    const id = randomUUID();
    this.logger?.info(LogSource.MCP, `Creating MCP session for context: ${contextId}`);

    const session = this.repository.createSession(id, contextId, options);
    this.logger?.info(LogSource.MCP, `Created MCP session: ${id}`);

    return session;
  }

  /**
   * Add a message to a session.
   * @param sessionId - The session ID.
   * @param role - The message role.
   * @param content - The message content.
   * @param options - Optional message data.
   * @param options.tokenCount
   * @param options.cost
   * @param options.modelUsed
   * @param options.processingTimeMs
   * @returns Promise that resolves to the created message.
   */
  async addMessage(
    sessionId: string,
    role: McpMessagesRole,
    content: string,
    options?: {
      tokenCount?: number;
      cost?: number;
      modelUsed?: string;
      processingTimeMs?: number;
    }
  ): Promise<IMcpMessagesRow> {
    await this.ensureInitialized();

    const session = this.repository.findSessionById(sessionId);
    if (session === null) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.status !== McpSessionsStatus.ACTIVE) {
      throw new Error(`Session not active: ${sessionId}`);
    }

    this.logger?.info(LogSource.MCP, `Adding message to session: ${sessionId}`);
    const message = this.repository.createMessage(sessionId, role, content, options);
    this.logger?.info(LogSource.MCP, `Added message: ${String(message.id)}`);

    return message;
  }

  /**
   * Get all messages for a session.
   * @param sessionId - The session ID.
   * @returns Promise that resolves to array of messages.
   */
  async getSessionMessages(sessionId: string): Promise<IMcpMessagesRow[]> {
    await this.ensureInitialized();

    const session = this.repository.findSessionById(sessionId);
    if (session === null) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return this.repository.findMessagesBySessionId(sessionId);
  }

  /**
   * Ensure service is initialized.
   * @returns Promise that resolves when initialized.
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}
