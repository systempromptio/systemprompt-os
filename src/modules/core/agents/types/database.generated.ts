// Auto-generated database types for agents module
// Generated on: 2025-07-30T07:52:14.638Z
// Do not modify this file manually - it will be overwritten

// Enums generated from CHECK constraints
export enum AgentsType {
  WORKER = 'worker',
  MONITOR = 'monitor',
  COORDINATOR = 'coordinator'
}

export enum AgentsStatus {
  IDLE = 'idle',
  ACTIVE = 'active',
  STOPPED = 'stopped',
  ERROR = 'error'
}

export enum AgentTasksPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum AgentTasksStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum AgentLogsLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

/**
 * Generated from database table: agents
 * Do not modify this file manually - it will be overwritten
 */
export interface IAgentsRow {
  id: string;
  name: string;
  description: string;
  instructions: string;
  type: AgentsType;
  status: AgentsStatus;
  created_at: string | null;
  updated_at: string | null;
  assigned_tasks: number | null;
  completed_tasks: number | null;
  failed_tasks: number | null;
}

/**
 * Generated from database table: agent_capabilities
 * Do not modify this file manually - it will be overwritten
 */
export interface IAgentCapabilitiesRow {
  agent_id: string;
  capability: string;
}

/**
 * Generated from database table: agent_tools
 * Do not modify this file manually - it will be overwritten
 */
export interface IAgentToolsRow {
  agent_id: string;
  tool: string;
}

/**
 * Generated from database table: agent_config
 * Do not modify this file manually - it will be overwritten
 */
export interface IAgentConfigRow {
  agent_id: string;
  config_key: string;
  config_value: string;
}

/**
 * Generated from database table: agent_tasks
 * Do not modify this file manually - it will be overwritten
 */
export interface IAgentTasksRow {
  id: string;
  agent_id: string;
  name: string;
  priority: AgentTasksPriority;
  status: AgentTasksStatus;
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
  level: AgentLogsLevel;
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
export type AgentsDatabaseRow = IAgentsRow | IAgentCapabilitiesRow | IAgentToolsRow | IAgentConfigRow | IAgentTasksRow | IAgentLogsRow | IAgentMetricsRow;

/**
 * Database table names for this module
 */
export const AGENTS_TABLES = {
  AGENTS: 'agents',
  AGENTCAPABILITIES: 'agent_capabilities',
  AGENTTOOLS: 'agent_tools',
  AGENTCONFIG: 'agent_config',
  AGENTTASKS: 'agent_tasks',
  AGENTLOGS: 'agent_logs',
  AGENTMETRICS: 'agent_metrics',
} as const;
