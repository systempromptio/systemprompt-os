/**
 * Core types for the events module
 */

// Import and re-export enums from core.ts
import { 
  EventPriority, 
  EventStatus, 
  EventTriggerType,
  ConditionOperator,
  RetryStrategy,
  ScheduleType,
  ExecutorType,
  HandlerType,
  WorkflowStepType,
  ErrorHandlingStrategy
} from './core.js';

export { 
  EventPriority, 
  EventStatus, 
  EventTriggerType,
  ConditionOperator,
  RetryStrategy,
  ScheduleType,
  ExecutorType,
  HandlerType,
  WorkflowStepType,
  ErrorHandlingStrategy
};

/**
 * Type assertions for string to enum conversions
 */
export function isEventTriggerType(value: string): value is EventTriggerType {
  return Object.values(EventTriggerType).includes(value as EventTriggerType);
}

export function isEventPriority(value: string): value is EventPriority {
  return Object.values(EventPriority).includes(value as EventPriority);
}

/**
 * Base event definition
 */
export interface Event {
  id: string;
  name: string;
  type: string;
  priority: EventPriority;
  data: Record<string, unknown>;
  metadata: Record<string, unknown>;
  trigger_type: EventTriggerType;
  trigger_id?: string;
  scheduled_at?: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * Event execution record
 */
export interface EventExecution {
  id: string;
  event_id: string;
  status: EventStatus;
  started_at: Date;
  completed_at?: Date;
  duration_ms?: number;
  executor_type: string;
  executor_id: string;
  context: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  retry_count: number;
  max_retries: number;
  next_retry_at?: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * Event handler configuration
 */
export interface EventHandler {
  id: string;
  event_type: string;
  executor_type: string;
  configuration: Record<string, unknown>;
  priority: number;
  enabled: boolean;
  conditions?: EventCondition[];
  retry_policy?: RetryPolicy;
  timeout_ms?: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Event condition for filtering
 */
export interface EventCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'exists' | 'regex';
  value: unknown;
}

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  strategy: 'exponential' | 'linear' | 'fixed';
  max_attempts: number;
  initial_delay_ms: number;
  max_delay_ms?: number;
  multiplier?: number;
}

/**
 * Event schedule configuration
 */
export interface EventSchedule {
  id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  schedule_type: 'cron' | 'interval' | 'once';
  cron_expression?: string;
  interval_ms?: number;
  next_run_at: Date;
  last_run_at?: Date;
  enabled: boolean;
  timezone?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Event listener registration
 */
export interface EventListener {
  id: string;
  event_pattern: string; // supports wildcards like "webhook.*" or "system.health.*"
  handler_type: 'webhook' | 'function' | 'workflow' | 'command';
  handler_config: Record<string, unknown>;
  filter_conditions?: EventCondition[];
  priority: number;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Base interface for event executors
 */
export interface IEventExecutor {
  type: string;
  
  /**
   * Execute an event
   */
  execute(event: Event, execution: EventExecution): Promise<ExecutionResult>;
  
  /**
   * Validate executor configuration
   */
  validateConfig(config: Record<string, unknown>): Promise<boolean>;
  
  /**
   * Get executor capabilities
   */
  getCapabilities(): ExecutorCapabilities;
}

/**
 * Execution result
 */
export interface ExecutionResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  shouldRetry?: boolean;
  nextRetryDelay?: number;
}

/**
 * Executor capabilities
 */
export interface ExecutorCapabilities {
  supportsAsync: boolean;
  supportsRetry: boolean;
  supportsTimeout: boolean;
  maxConcurrency?: number;
  requiredPermissions?: string[];
}

/**
 * Event statistics
 */
export interface EventStats {
  event_type: string;
  total_count: number;
  success_count: number;
  failure_count: number;
  pending_count: number;
  average_duration_ms: number;
  last_execution_at?: Date;
  last_success_at?: Date;
  last_failure_at?: Date;
}

// Re-export event bus types
export type { IEventBus, EventHandlerFunction } from './event-bus.types.js';

/**
 * Event query filters
 */
export interface EventQueryFilter {
  type?: string | string[];
  status?: EventStatus | EventStatus[];
  priority?: EventPriority | EventPriority[];
  trigger_type?: EventTriggerType | EventTriggerType[];
  created_after?: Date;
  created_before?: Date;
  limit?: number;
  offset?: number;
  order_by?: 'created_at' | 'scheduled_at' | 'priority';
  order_direction?: 'asc' | 'desc';
}

/**
 * Workflow integration types (migrated from workflows module)
 */
export interface WorkflowEvent extends Event {
  workflow_definition: WorkflowDefinition;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version: number;
  steps: WorkflowStep[];
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error_handling?: ErrorHandlingConfig;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'action' | 'condition' | 'parallel' | 'loop' | 'subflow';
  action?: string;
  inputs?: Record<string, unknown>;
  conditions?: EventCondition[];
  next_steps?: string[];
  retry_policy?: RetryPolicy;
  timeout_ms?: number;
}

export interface ErrorHandlingConfig {
  on_step_failure: 'fail' | 'continue' | 'retry';
  on_workflow_failure: 'rollback' | 'compensate' | 'ignore';
  compensation_steps?: WorkflowStep[];
}

/**
 * Task integration types (migrated from scheduler module)
 */
export interface ScheduledTaskEvent extends Event {
  task_config: TaskConfiguration;
}

export interface TaskConfiguration {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  working_directory?: string;
  timeout_ms?: number;
  retry_policy?: RetryPolicy;
}

/**
 * Database row types for type safety
 */
export interface EventRow {
  id: string;
  name: string;
  type: string;
  priority: string;
  data: string;
  metadata: string;
  trigger_type: string;
  trigger_id: string | null;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventExecutionRow {
  id: string;
  event_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  executor_type: string;
  executor_id: string;
  context: string;
  result: string | null;
  error: string | null;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventHandlerRow {
  id: string;
  event_type: string;
  executor_type: string;
  configuration: string;
  priority: number;
  enabled: number;
  conditions: string | null;
  retry_policy: string | null;
  timeout_ms: number | null;
  created_at: string;
  updated_at: string;
}

export interface EventListenerRow {
  id: string;
  event_pattern: string;
  handler_type: string;
  handler_config: string;
  filter_conditions: string | null;
  priority: number;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export interface EventScheduleRow {
  id: string;
  event_type: string;
  event_data: string;
  schedule_type: string;
  cron_expression: string | null;
  interval_ms: number | null;
  next_run_at: string;
  last_run_at: string | null;
  enabled: number;
  timezone: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventStatsRow {
  event_type: string;
  total_count: number;
  success_count: number;
  failure_count: number;
  pending_count: number;
  average_duration_ms: number | null;
  last_execution_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
}

export interface WorkflowDefinitionRow {
  id: string;
  name: string;
  description: string | null;
  version: number;
  steps: string;
  inputs: string | null;
  outputs: string | null;
  error_handling: string | null;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export interface WorkflowExecutionRow {
  id: string;
  workflow_id: string;
  event_execution_id: string;
  status: string;
  context: string;
  current_step_id: string | null;
  step_results: string;
  started_at: string;
  completed_at: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowCheckpointRow {
  id: string;
  execution_id: string;
  step_id: string;
  state: string;
  created_at: string;
}