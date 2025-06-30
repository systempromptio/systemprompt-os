import { EventEmitter } from "events";

/**
 * Base interface for all AI agent implementations
 */
export interface IAgent extends EventEmitter {
  /**
   * Unique identifier for the agent session
   */
  readonly sessionId: string;

  /**
   * Type of agent (e.g., 'claude', 'gpt4', etc.)
   */
  readonly agentType: string;

  /**
   * Current status of the agent
   */
  readonly status: AgentStatus;

  /**
   * Task ID associated with this agent session
   */
  readonly taskId?: string;

  /**
   * Send a command/prompt to the agent
   */
  sendCommand(command: string): Promise<void>;

  /**
   * Terminate the agent session
   */
  terminate(): Promise<void>;

  /**
   * Check if the agent is active
   */
  isActive(): boolean;

  /**
   * Get agent metadata
   */
  getMetadata(): AgentMetadata;
}

/**
 * Agent status enumeration
 */
export enum AgentStatus {
  INITIALIZING = "initializing",
  READY = "ready",
  PROCESSING = "processing",
  ERROR = "error",
  TERMINATED = "terminated"
}

/**
 * Agent metadata interface
 */
export interface AgentMetadata {
  startedAt: Date;
  lastActivityAt: Date;
  commandCount: number;
  errorCount: number;
  currentPrompt?: string;
  branch?: string;
  workingDirectory?: string;
}

/**
 * Agent event types
 */
export interface AgentEvents {
  ready: () => void;
  output: (data: AgentOutput) => void;
  error: (error: Error) => void;
  terminated: (reason?: string) => void;
  status_changed: (status: AgentStatus) => void;
}

/**
 * Agent output structure
 */
export interface AgentOutput {
  type: "stdout" | "stderr" | "system";
  content: string;
  timestamp: Date;
}

/**
 * Configuration for creating an agent
 */
export interface AgentConfig {
  taskId?: string;
  branch?: string;
  workingDirectory?: string;
  environment?: Record<string, string>;
  timeout?: number;
  maxRetries?: number;
}

/**
 * Factory interface for creating agent instances
 */
export interface IAgentFactory<T extends IAgent = IAgent> {
  /**
   * Create a new agent instance
   */
  create(config: AgentConfig): Promise<T>;

  /**
   * Check if the factory supports a given agent type
   */
  supports(agentType: string): boolean;

  /**
   * Get the agent type this factory creates
   */
  getAgentType(): string;
}

/**
 * Registry for agent factories
 */
export interface IAgentRegistry {
  /**
   * Register an agent factory
   */
  register(factory: IAgentFactory): void;

  /**
   * Get a factory for a specific agent type
   */
  getFactory(agentType: string): IAgentFactory | undefined;

  /**
   * List all registered agent types
   */
  listAgentTypes(): string[];
}