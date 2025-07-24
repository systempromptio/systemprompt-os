/**
 * @fileoverview Type definitions for the agents module
 * @module modules/core/agents/types
 */

export type AgentStatus = 'idle' | 'active' | 'stopped' | 'error';
export type AgentType = 'worker' | 'scheduler' | 'monitor' | 'custom';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'pending' | 'assigned' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  config: Record<string, any>;
  capabilities: string[];
  created_at: Date;
  updated_at: Date;
  last_heartbeat?: Date;
  assigned_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  metadata?: Record<string, any>;
}

export interface AgentTask {
  id: string;
  agent_id: string;
  name: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  payload: Record<string, any>;
  result?: Record<string, any>;
  error?: string;
  created_at: Date;
  assigned_at?: Date;
  started_at?: Date;
  completed_at?: Date;
  timeout?: number;
  retry_count: number;
  max_retries: number;
}

export interface AgentLog {
  id: string;
  agent_id: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, any>;
  timestamp: Date;
}

export interface AgentMetrics {
  agent_id: string;
  cpu_usage?: number;
  memory_usage?: number;
  task_throughput?: number;
  average_task_duration?: number;
  error_rate?: number;
  uptime?: number;
  timestamp: Date;
}

export interface CreateAgentDto {
  name: string;
  type: AgentType;
  config?: Record<string, any>;
  capabilities?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateAgentDto {
  name?: string;
  status?: AgentStatus;
  config?: Record<string, any>;
  capabilities?: string[];
  metadata?: Record<string, any>;
}

export interface AssignTaskDto {
  agent_id: string;
  name: string;
  description?: string;
  priority?: TaskPriority;
  payload: Record<string, any>;
  timeout?: number;
  max_retries?: number;
}

export interface AgentEvent {
  type: 'created' | 'started' | 'stopped' | 'task_assigned' | 'task_completed' | 'task_failed' | 'error' | 'heartbeat' | 'updated';
  agent_id: string;
  timestamp: Date;
  data?: Record<string, any>;
}