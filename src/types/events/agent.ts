/**
 * @fileoverview Agent-related event type definitions
 * @module types/events/agent
 * @since 1.0.0
 */

import { AgentStatus, AgentError, QueryContext, QueryResult } from '../core/agent.js';
import { SessionId } from '../core/session.js';

/**
 * Map of agent event types to their handler signatures
 * @since 1.0.0
 */
export type AgentEventMap = {
  /**
   * Fired when a new agent is created
   * @since 1.0.0
   */
  'agent:created': (data: AgentCreatedEvent) => void;
  
  /**
   * Fired when an agent is initialized and ready
   * @since 1.0.0
   */
  'agent:initialized': (data: AgentInitializedEvent) => void;
  
  /**
   * Fired when an agent's status changes
   * @since 1.0.0
   */
  'agent:status:changed': (data: AgentStatusChangedEvent) => void;
  
  /**
   * Fired when an agent starts processing a query
   * @since 1.0.0
   */
  'agent:query:started': (data: AgentQueryStartedEvent) => void;
  
  /**
   * Fired when an agent completes processing a query
   * @since 1.0.0
   */
  'agent:query:completed': (data: AgentQueryCompletedEvent) => void;
  
  /**
   * Fired when an agent encounters an error
   * @since 1.0.0
   */
  'agent:error': (data: AgentErrorEvent) => void;
  
  /**
   * Fired when an agent is terminated
   * @since 1.0.0
   */
  'agent:terminated': (data: AgentTerminatedEvent) => void;
};

/**
 * Event data for agent creation
 * @interface
 * @since 1.0.0
 */
export interface AgentCreatedEvent {
  /**
   * Unique identifier for the agent
   * @since 1.0.0
   */
  readonly agentId: string;
  
  /**
   * AI provider name (e.g., 'claude', 'gemini')
   * @since 1.0.0
   */
  readonly provider: string;
  
  /**
   * Session the agent belongs to
   * @since 1.0.0
   */
  readonly sessionId: SessionId;
  
  /**
   * When the agent was created
   * @since 1.0.0
   */
  readonly timestamp: Date;
}

/**
 * Event data for agent initialization
 * @interface
 * @since 1.0.0
 */
export interface AgentInitializedEvent {
  /**
   * Unique identifier for the agent
   * @since 1.0.0
   */
  readonly agentId: string;
  
  /**
   * AI provider name (e.g., 'claude', 'gemini')
   * @since 1.0.0
   */
  readonly provider: string;
  
  /**
   * Session the agent belongs to
   * @since 1.0.0
   */
  readonly sessionId: SessionId;
  
  /**
   * When the agent was initialized
   * @since 1.0.0
   */
  readonly timestamp: Date;
  
  /**
   * Additional initialization metadata
   * @since 1.0.0
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Event data for agent status changes
 * @interface
 * @since 1.0.0
 */
export interface AgentStatusChangedEvent {
  /**
   * Unique identifier for the agent
   * @since 1.0.0
   */
  readonly agentId: string;
  
  /**
   * Session the agent belongs to
   * @since 1.0.0
   */
  readonly sessionId: SessionId;
  
  /**
   * Previous agent status
   * @since 1.0.0
   */
  readonly previousStatus: AgentStatus;
  
  /**
   * New agent status
   * @since 1.0.0
   */
  readonly newStatus: AgentStatus;
  
  /**
   * When the status changed
   * @since 1.0.0
   */
  readonly timestamp: Date;
}

/**
 * Event data for query processing start
 * @interface
 * @since 1.0.0
 */
export interface AgentQueryStartedEvent {
  /**
   * Unique identifier for the agent
   * @since 1.0.0
   */
  readonly agentId: string;
  
  /**
   * Session the agent belongs to
   * @since 1.0.0
   */
  readonly sessionId: SessionId;
  
  /**
   * Unique identifier for this query
   * @since 1.0.0
   */
  readonly queryId: string;
  
  /**
   * Query prompt text
   * @since 1.0.0
   */
  readonly prompt: string;
  
  /**
   * Additional query context
   * @since 1.0.0
   */
  readonly context?: QueryContext;
  
  /**
   * When the query started
   * @since 1.0.0
   */
  readonly timestamp: Date;
}

/**
 * Event data for query processing completion
 * @interface
 * @since 1.0.0
 */
export interface AgentQueryCompletedEvent {
  /**
   * Unique identifier for the agent
   * @since 1.0.0
   */
  readonly agentId: string;
  
  /**
   * Session the agent belongs to
   * @since 1.0.0
   */
  readonly sessionId: SessionId;
  
  /**
   * Unique identifier for this query
   * @since 1.0.0
   */
  readonly queryId: string;
  
  /**
   * Query processing result
   * @since 1.0.0
   */
  readonly result: QueryResult;
  
  /**
   * Query processing duration in milliseconds
   * @since 1.0.0
   */
  readonly duration: number;
  
  /**
   * When the query completed
   * @since 1.0.0
   */
  readonly timestamp: Date;
}

/**
 * Event data for agent errors
 * @interface
 * @since 1.0.0
 */
export interface AgentErrorEvent {
  /**
   * Unique identifier for the agent
   * @since 1.0.0
   */
  readonly agentId: string;
  
  /**
   * Session the agent belongs to
   * @since 1.0.0
   */
  readonly sessionId: SessionId;
  
  /**
   * Error information
   * @since 1.0.0
   */
  readonly error: AgentError;
  
  /**
   * Additional error context
   * @since 1.0.0
   */
  readonly context?: string;
  
  /**
   * When the error occurred
   * @since 1.0.0
   */
  readonly timestamp: Date;
}

/**
 * Event data for agent termination
 * @interface
 * @since 1.0.0
 */
export interface AgentTerminatedEvent {
  /**
   * Unique identifier for the agent
   * @since 1.0.0
   */
  readonly agentId: string;
  
  /**
   * Session the agent belonged to
   * @since 1.0.0
   */
  readonly sessionId: SessionId;
  
  /**
   * Reason for termination
   * @since 1.0.0
   */
  readonly reason?: string;
  
  /**
   * When the agent was terminated
   * @since 1.0.0
   */
  readonly timestamp: Date;
}