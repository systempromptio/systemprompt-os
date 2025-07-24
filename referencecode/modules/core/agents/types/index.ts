/**
 * @fileoverview Agent types and interfaces
 * @module modules/core/agents/types
 */

export interface Agent {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'idle' | 'stopped' | 'error';
  config: Record<string, any>;
  capabilities: string[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  last_active_at?: string;
}

export interface CreateAgentDto {
  name: string;
  type: string;
  config?: Record<string, any>;
  capabilities?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateAgentDto {
  name?: string;
  type?: string;
  status?: 'active' | 'idle' | 'stopped' | 'error';
  config?: Record<string, any>;
  capabilities?: string[];
  metadata?: Record<string, any>;
}

export interface AgentEvent {
  id: string;
  agent_id: string;
  type: 'created' | 'started' | 'stopped' | 'heartbeat' | 'error' | 'task_assigned' | 'task_completed' | 'task_failed' | 'updated';
  data: Record<string, any>;
  created_at: string;
}

export interface AgentTask {
  id: string;
  agent_id: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface AgentCapability {
  name: string;
  description: string;
  parameters?: Record<string, any>;
}

export interface AgentConfig {
  maxConcurrentTasks?: number;
  heartbeatInterval?: number;
  taskTimeout?: number;
  retryAttempts?: number;
  customSettings?: Record<string, any>;
}

export interface AgentStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageTaskDuration: number;
  uptime: number;
  lastHeartbeat?: string;
}

export interface AgentFilter {
  status?: string;
  type?: string;
  capability?: string;
  metadata?: Record<string, any>;
}

export interface AgentLogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: Record<string, any>;
}