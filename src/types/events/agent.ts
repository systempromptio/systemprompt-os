/**
 * @fileoverview Agent-related event type definitions
 * @module types/events/agent
 */

import { AgentStatus, AgentError, QueryContext, QueryResult } from '../core/agent.js';
import { SessionId } from '../core/session.js';

/**
 * Map of agent event types to their handler signatures
 */
export type AgentEventMap = {
  /**
   * Fired when a new agent is created
   */
  'agent:created': (data: AgentCreatedEvent) => void;
  
  /**
   * Fired when an agent is initialized and ready
   */
  'agent:initialized': (data: AgentInitializedEvent) => void;
  
  /**
   * Fired when an agent's status changes
   */
  'agent:status:changed': (data: AgentStatusChangedEvent) => void;
  
  /**
   * Fired when an agent starts processing a query
   */
  'agent:query:started': (data: AgentQueryStartedEvent) => void;
  
  /**
   * Fired when an agent completes processing a query
   */
  'agent:query:completed': (data: AgentQueryCompletedEvent) => void;
  
  /**
   * Fired when an agent encounters an error
   */
  'agent:error': (data: AgentErrorEvent) => void;
  
  /**
   * Fired when an agent is terminated
   */
  'agent:terminated': (data: AgentTerminatedEvent) => void;
};

/**
 * Event data for agent creation
 * @interface
 */
export interface AgentCreatedEvent {
  /**
   * Unique identifier for the agent
   */
  readonly agentId: string;
  
  /**
   * AI provider name (e.g., 'claude', 'gemini')
   */
  readonly provider: string;
  
  /**
   * Session the agent belongs to
   */
  readonly sessionId: SessionId;
  
  /**
   * When the agent was created
   */
  readonly timestamp: Date;
}

/**
 * Event data for agent initialization
 * @interface
 */
export interface AgentInitializedEvent {
  /**
   * Unique identifier for the agent
   */
  readonly agentId: string;
  
  /**
   * AI provider name (e.g., 'claude', 'gemini')
   */
  readonly provider: string;
  
  /**
   * Session the agent belongs to
   */
  readonly sessionId: SessionId;
  
  /**
   * When the agent was initialized
   */
  readonly timestamp: Date;
  
  /**
   * Additional initialization metadata
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Event data for agent status changes
 * @interface
 */
export interface AgentStatusChangedEvent {
  /**
   * Unique identifier for the agent
   */
  readonly agentId: string;
  
  /**
   * Session the agent belongs to
   */
  readonly sessionId: SessionId;
  
  /**
   * Previous agent status
   */
  readonly previousStatus: AgentStatus;
  
  /**
   * New agent status
   */
  readonly newStatus: AgentStatus;
  
  /**
   * When the status changed
   */
  readonly timestamp: Date;
}

/**
 * Event data for query processing start
 * @interface
 */
export interface AgentQueryStartedEvent {
  /**
   * Unique identifier for the agent
   */
  readonly agentId: string;
  
  /**
   * Session the agent belongs to
   */
  readonly sessionId: SessionId;
  
  /**
   * Unique identifier for this query
   */
  readonly queryId: string;
  
  /**
   * Query prompt text
   */
  readonly prompt: string;
  
  /**
   * Additional query context
   */
  readonly context?: QueryContext;
  
  /**
   * When the query started
   */
  readonly timestamp: Date;
}

/**
 * Event data for query processing completion
 * @interface
 */
export interface AgentQueryCompletedEvent {
  /**
   * Unique identifier for the agent
   */
  readonly agentId: string;
  
  /**
   * Session the agent belongs to
   */
  readonly sessionId: SessionId;
  
  /**
   * Unique identifier for this query
   */
  readonly queryId: string;
  
  /**
   * Query processing result
   */
  readonly result: QueryResult;
  
  /**
   * Query processing duration in milliseconds
   */
  readonly duration: number;
  
  /**
   * When the query completed
   */
  readonly timestamp: Date;
}

/**
 * Event data for agent errors
 * @interface
 */
export interface AgentErrorEvent {
  /**
   * Unique identifier for the agent
   */
  readonly agentId: string;
  
  /**
   * Session the agent belongs to
   */
  readonly sessionId: SessionId;
  
  /**
   * Error information
   */
  readonly error: AgentError;
  
  /**
   * Additional error context
   */
  readonly context?: string;
  
  /**
   * When the error occurred
   */
  readonly timestamp: Date;
}

/**
 * Event data for agent termination
 * @interface
 */
export interface AgentTerminatedEvent {
  /**
   * Unique identifier for the agent
   */
  readonly agentId: string;
  
  /**
   * Session the agent belonged to
   */
  readonly sessionId: SessionId;
  
  /**
   * Reason for termination
   */
  readonly reason?: string;
  
  /**
   * When the agent was terminated
   */
  readonly timestamp: Date;
}