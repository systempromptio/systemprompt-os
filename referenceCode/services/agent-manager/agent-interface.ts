/**
 * @fileoverview Agent interface definitions for AI agent implementations
 * @module services/agent-manager/agent-interface
 * 
 * @remarks
 * This module defines the core interfaces and types for implementing AI agents
 * in the system. It provides a common contract that all agent implementations
 * must follow, enabling polymorphic agent handling and extensibility.
 * 
 * @example
 * ```typescript
 * import type { IAgent, AgentConfig } from './agent-interface';
 * 
 * class MyCustomAgent extends EventEmitter implements IAgent {
 *   readonly sessionId: string;
 *   readonly agentType = 'custom';
 *   readonly status: AgentStatus;
 *   
 *   async sendCommand(command: string): Promise<void> {
 *     // Implementation
 *   }
 *   
 *   // ... other required methods
 * }
 * ```
 */

import { EventEmitter } from "events";

/**
 * Base interface for all AI agent implementations
 * 
 * @interface IAgent
 * @extends EventEmitter
 * 
 * @remarks
 * All agent implementations must extend EventEmitter and implement this interface.
 * Agents are responsible for managing their own lifecycle and emitting appropriate events.
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
   * 
   * @param command - The command or prompt to send
   * @returns Promise that resolves when command is acknowledged
   */
  sendCommand(command: string): Promise<void>;

  /**
   * Terminate the agent session
   * 
   * @returns Promise that resolves when termination is complete
   */
  terminate(): Promise<void>;

  /**
   * Check if the agent is active
   * 
   * @returns True if agent is in READY or PROCESSING state
   */
  isActive(): boolean;

  /**
   * Get agent metadata
   * 
   * @returns Current agent metadata
   */
  getMetadata(): AgentMetadata;
}

/**
 * Agent status enumeration
 * 
 * @enum {string}
 */
export enum AgentStatus {
  /**
   * Agent is starting up
   */
  INITIALIZING = "initializing",
  
  /**
   * Agent is ready to receive commands
   */
  READY = "ready",
  
  /**
   * Agent is processing a command
   */
  PROCESSING = "processing",
  
  /**
   * Agent encountered an error
   */
  ERROR = "error",
  
  /**
   * Agent has been terminated
   */
  TERMINATED = "terminated"
}

/**
 * Agent metadata interface
 * 
 * @interface AgentMetadata
 */
export interface AgentMetadata {
  /**
   * When the agent session started
   */
  startedAt: Date;
  
  /**
   * Last time the agent showed activity
   */
  lastActivityAt: Date;
  
  /**
   * Number of commands sent to the agent
   */
  commandCount: number;
  
  /**
   * Number of errors encountered
   */
  errorCount: number;
  
  /**
   * Current prompt being processed
   */
  currentPrompt?: string;
  
  /**
   * Working directory for the agent
   */
  workingDirectory?: string;
}

/**
 * Agent event types
 * 
 * @interface AgentEvents
 * 
 * @remarks
 * Defines the events that agents must emit during their lifecycle
 */
export interface AgentEvents {
  /**
   * Emitted when agent is ready to receive commands
   */
  ready: () => void;
  
  /**
   * Emitted when agent produces output
   */
  output: (data: AgentOutput) => void;
  
  /**
   * Emitted when agent encounters an error
   */
  error: (error: Error) => void;
  
  /**
   * Emitted when agent is terminated
   */
  terminated: (reason?: string) => void;
  
  /**
   * Emitted when agent status changes
   */
  status_changed: (status: AgentStatus) => void;
}

/**
 * Agent output structure
 * 
 * @interface AgentOutput
 */
export interface AgentOutput {
  /**
   * Type of output stream
   */
  type: "stdout" | "stderr" | "system";
  
  /**
   * Content of the output
   */
  content: string;
  
  /**
   * When the output was generated
   */
  timestamp: Date;
}

/**
 * Configuration for creating an agent
 * 
 * @interface AgentConfig
 */
export interface AgentConfig {
  /**
   * Task ID to associate with the agent
   */
  taskId?: string;
  
  /**
   * Working directory for the agent
   */
  workingDirectory?: string;
  
  /**
   * Environment variables for the agent
   */
  environment?: Record<string, string>;
  
  /**
   * Command timeout in milliseconds
   */
  timeout?: number;
  
  /**
   * Maximum number of retry attempts
   */
  maxRetries?: number;
}

/**
 * Factory interface for creating agent instances
 * 
 * @interface IAgentFactory
 * @template T - The specific agent type this factory creates
 */
export interface IAgentFactory<T extends IAgent = IAgent> {
  /**
   * Create a new agent instance
   * 
   * @param config - Configuration for the agent
   * @returns Promise resolving to the created agent
   */
  create(config: AgentConfig): Promise<T>;

  /**
   * Check if the factory supports a given agent type
   * 
   * @param agentType - The agent type to check
   * @returns True if this factory can create the specified agent type
   */
  supports(agentType: string): boolean;

  /**
   * Get the agent type this factory creates
   * 
   * @returns The agent type identifier
   */
  getAgentType(): string;
}

/**
 * Registry for agent factories
 * 
 * @interface IAgentRegistry
 * 
 * @remarks
 * Provides a central location for registering and retrieving agent factories
 */
export interface IAgentRegistry {
  /**
   * Register an agent factory
   * 
   * @param factory - The factory to register
   */
  register(factory: IAgentFactory): void;

  /**
   * Get a factory for a specific agent type
   * 
   * @param agentType - The agent type to get a factory for
   * @returns The factory if found, undefined otherwise
   */
  getFactory(agentType: string): IAgentFactory | undefined;

  /**
   * List all registered agent types
   * 
   * @returns Array of registered agent type identifiers
   */
  listAgentTypes(): string[];
}