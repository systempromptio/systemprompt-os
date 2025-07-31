// Auto-generated database types for agents module
// Generated on: 2025-07-31T10:03:21.448Z
// Do not modify this file manually - it will be overwritten

import { z } from 'zod';

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

// Zod schemas for enums
export const AgentsTypeSchema = z.nativeEnum(AgentsType);
export const AgentsStatusSchema = z.nativeEnum(AgentsStatus);
export const AgentTasksPrioritySchema = z.nativeEnum(AgentTasksPriority);
export const AgentTasksStatusSchema = z.nativeEnum(AgentTasksStatus);
export const AgentLogsLevelSchema = z.nativeEnum(AgentLogsLevel);

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

// Zod schemas for database row validation
export const AgentsRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  instructions: z.string(),
  type: z.nativeEnum(AgentsType),
  status: z.nativeEnum(AgentsStatus),
  created_at: z.string().datetime().nullable(),
  updated_at: z.string().datetime().nullable(),
  assigned_tasks: z.number().nullable(),
  completed_tasks: z.number().nullable(),
  failed_tasks: z.number().nullable(),
});

export const AgentCapabilitiesRowSchema = z.object({
  agent_id: z.string(),
  capability: z.string(),
});

export const AgentToolsRowSchema = z.object({
  agent_id: z.string(),
  tool: z.string(),
});

export const AgentConfigRowSchema = z.object({
  agent_id: z.string(),
  config_key: z.string(),
  config_value: z.string(),
});

export const AgentTasksRowSchema = z.object({
  id: z.string().uuid(),
  agent_id: z.string(),
  name: z.string(),
  priority: z.nativeEnum(AgentTasksPriority),
  status: z.nativeEnum(AgentTasksStatus),
  payload: z.string(),
  created_at: z.string().datetime().nullable(),
  assigned_at: z.string().datetime().nullable(),
  started_at: z.string().datetime().nullable(),
  completed_at: z.string().datetime().nullable(),
  retry_count: z.number().nullable(),
  max_retries: z.number().nullable(),
  error_message: z.string().nullable(),
});

export const AgentLogsRowSchema = z.object({
  id: z.string().uuid(),
  agent_id: z.string(),
  level: z.nativeEnum(AgentLogsLevel),
  message: z.string(),
  timestamp: z.string().datetime().nullable(),
  metadata: z.string().nullable(),
});

export const AgentMetricsRowSchema = z.object({
  agent_id: z.string(),
  cpu_usage: z.number().nullable(),
  memory_usage: z.number().nullable(),
  active_tasks: z.number().nullable(),
  timestamp: z.string().datetime().nullable(),
});

/**
 * Union type of all database row types in this module
 */
export type AgentsDatabaseRow = IAgentsRow | IAgentCapabilitiesRow | IAgentToolsRow | IAgentConfigRow | IAgentTasksRow | IAgentLogsRow | IAgentMetricsRow;

/**
 * Union Zod schema for all database row types in this module
 */
export const AgentsDatabaseRowSchema = z.union([AgentsRowSchema, AgentCapabilitiesRowSchema, AgentToolsRowSchema, AgentConfigRowSchema, AgentTasksRowSchema, AgentLogsRowSchema, AgentMetricsRowSchema]);

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
