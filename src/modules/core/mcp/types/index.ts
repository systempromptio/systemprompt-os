/**
 * MCP (Model Context Protocol) type definitions.
 */

/**
 * MCP role enumeration.
 */
export const enum MCPRoleEnum {
  SYSTEM = 'system',
  USER = 'user',
  ASSISTANT = 'assistant'
}

/**
 * MCP session status enumeration.
 */
export const enum MCPSessionStatusEnum {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ERROR = 'error'
}

/**
 * MCP context configuration.
 */
export interface IMCPConfig {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
}

/**
 * MCP context entity.
 */
export interface IMCPContext {
  id: string;
  name: string;
  model: string;
  description?: string;
  config?: IMCPConfig;
  maxTokens: number;
  temperature: number;
  systemPrompt?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * MCP session entity.
 */
export interface IMCPSession {
  id: string;
  contextId: string;
  status: MCPSessionStatusEnum;
  metadata?: Record<string, unknown>;
  startedAt: Date;
  endedAt?: Date;
}

/**
 * MCP message entity.
 */
export interface IMCPMessage {
  id: number;
  sessionId: string;
  role: MCPRoleEnum;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

/**
 * MCP service interface.
 */
export interface IMCPService {
  createContext(
    name: string,
    model: string,
    config?: IMCPConfig
  ): Promise<IMCPContext>;
  getContext(id: string): Promise<IMCPContext | null>;
  listContexts(): Promise<IMCPContext[]>;
  deleteContext(id: string): Promise<void>;
  createSession(contextId: string): Promise<IMCPSession>;
  addMessage(
    sessionId: string,
    role: MCPRoleEnum,
    content: string
  ): Promise<IMCPMessage>;
  getSessionMessages(sessionId: string): Promise<IMCPMessage[]>;
}