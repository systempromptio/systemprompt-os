/**
 * @file Type definitions for the Agents module.
 * @module src/modules/core/agents/types
 */

export type AgentStatus = 'idle' | 'active' | 'stopped' | 'error';
export type AgentType = 'worker' | 'monitor' | 'coordinator';
export type TaskStatus = 'pending' | 'assigned' | 'running' | 'completed' | 'failed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  config: Record<string, any>;
  capabilities: string[];
  created_at: Date;
  updated_at: Date;
  assigned_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  last_heartbeat?: Date;
}

export interface CreateAgentDto {
  name: string;
  type: AgentType;
  config?: Record<string, any>;
  capabilities?: string[];
}

export interface UpdateAgentDto {
  name?: string;
  status?: AgentStatus;
  config?: Record<string, any>;
  capabilities?: string[];
}

export interface AgentTask {
  id: string;
  agent_id: string;
  name: string;
  priority: TaskPriority;
  status: TaskStatus;
  payload: Record<string, any>;
  created_at: Date;
  assigned_at?: Date;
  started_at?: Date;
  completed_at?: Date;
  retry_count: number;
  max_retries: number;
  error_message?: string;
}

export interface CreateTaskDto {
  agent_id: string;
  name: string;
  priority?: TaskPriority;
  payload: Record<string, any>;
  max_retries?: number;
}

export interface AgentLog {
  id: string;
  agent_id: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface AgentMetrics {
  agent_id: string;
  cpu_usage: number;
  memory_usage: number;
  active_tasks: number;
  timestamp: Date;
}
