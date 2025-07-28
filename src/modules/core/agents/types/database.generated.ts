// Auto-generated database types for agents module
// Generated on: 2025-07-28T19:59:56.313Z
// Do not modify this file manually - it will be overwritten

/**
 * Generated from database table: agents
 * Do not modify this file manually - it will be overwritten
 */
export interface IAgentsRow {
  id: string;
  name: string;
  description: string;
  instructions: string;
  type: string;
  status: string;
  config: string | null;
  capabilities: string | null;
  tools: string | null;
  created_at: string | null;
  updated_at: string | null;
  assigned_tasks: number | null;
  completed_tasks: number | null;
  failed_tasks: number | null;
  last_heartbeat: string | null;
}

/**
 * Generated from database table: agent_tasks
 * Do not modify this file manually - it will be overwritten
 */
export interface IAgentTasksRow {
  id: string;
  agent_id: string;
  name: string;
  priority: string;
  status: string;
  payload: string;
  created_at: string | null;
  assigned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  retry_count: number | null;
  max_retries: number | null;
  error_message: string | null;
}

/**
 * Generated from database table: agent_logs
 * Do not modify this file manually - it will be overwritten
 */
export interface IAgentLogsRow {
  id: string;
  agent_id: string;
  level: string;
  message: string;
  timestamp: string | null;
  metadata: string | null;
}

/**
 * Generated from database table: agent_metrics
 * Do not modify this file manually - it will be overwritten
 */
export interface IAgentMetricsRow {
  agent_id: string;
  cpu_usage: number | null;
  memory_usage: number | null;
  active_tasks: number | null;
  timestamp: string | null;
}

/**
 * Union type of all database row types in this module
 */
export type AgentsDatabaseRow = IAgentsRow | IAgentTasksRow | IAgentLogsRow | IAgentMetricsRow;

/**
 * Database table names for this module
 */
export const AGENTS_TABLES = {
  AGENTS: 'agents',
  AGENTTASKS: 'agent_tasks',
  AGENTLOGS: 'agent_logs',
  AGENTMETRICS: 'agent_metrics',
} as const;
