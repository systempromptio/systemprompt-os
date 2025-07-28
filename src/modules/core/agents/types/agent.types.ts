/**
 * Represents the current operational status of an agent.
 */
export type AgentStatus = 'idle' | 'active' | 'stopped' | 'error';
/**
 * Defines the type or role of an agent within the system.
 */
export type AgentType = 'worker' | 'monitor' | 'coordinator';
/**
 * Represents the current state of a task in its lifecycle.
 */
export type TaskStatus = 'pending' | 'assigned' | 'running' | 'completed' | 'failed' | 'cancelled';
/**
 * Defines the priority level for task execution ordering.
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Represents an agent in the system with its configuration and metrics.
 */
export interface IAgent {
  id: string;
  name: string;
  description: string;
  instructions: string;
  type: AgentType;
  status: AgentStatus;
  config: Record<string, unknown>;
  capabilities: string[];
  tools: string[];
  created_at: Date;
  updated_at: Date;
  assigned_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
}

/**
 * Data transfer object for creating a new agent.
 */
export interface ICreateAgentDto {
  name: string;
  description: string;
  instructions: string;
  type: AgentType;
  config?: Record<string, unknown>;
  capabilities?: string[];
  tools?: string[];
}

/**
 * Data transfer object for updating an existing agent.
 */
export interface IUpdateAgentDto {
  name?: string;
  description?: string;
  instructions?: string;
  status?: AgentStatus;
  config?: Record<string, unknown>;
  capabilities?: string[];
  tools?: string[];
}

/**
 * Represents a task assigned to an agent for execution.
 */
export interface IAgentTask {
  id: string;
  agent_id: string;
  name: string;
  priority: TaskPriority;
  status: TaskStatus;
  payload: Record<string, unknown>;
  created_at: Date;
  assigned_at?: Date;
  started_at?: Date;
  completed_at?: Date;
  retry_count: number;
  max_retries: number;
  error_message?: string;
}

/**
 * Data transfer object for creating a new task.
 */
export interface ICreateTaskDto {
  agent_id: string;
  name: string;
  priority?: TaskPriority;
  payload: Record<string, unknown>;
  max_retries?: number;
}

/**
 * Represents a log entry for agent activity and debugging.
 */
export interface IAgentLog {
  id: string;
  agent_id: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Represents performance metrics for an agent.
 */
export interface IAgentMetrics {
  agent_id: string;
  cpu_usage: number;
  memory_usage: number;
  active_tasks: number;
  timestamp: Date;
}

/**
 * Database row representation for agents table.
 */
export interface IAgentRow {
  id: string;
  name: string;
  description: string;
  instructions: string;
  type: string;
  status: string;
  config: string;
  capabilities: string;
  tools: string;
  created_at: string;
  updated_at: string;
  assigned_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
}

/**
 * Database row representation for agent_tasks table.
 */
export interface ITaskRow {
  id: string;
  agent_id: string;
  name: string;
  priority: string;
  status: string;
  payload: string;
  created_at: string;
  assigned_at?: string;
  started_at?: string;
  completed_at?: string;
  retry_count: number;
  max_retries: number;
  error_message?: string;
}

/**
 * Database row representation for agent_logs table.
 */
export interface ILogRow {
  id: string;
  agent_id: string;
  level: string;
  message: string;
  timestamp: string;
  metadata?: string;
}
