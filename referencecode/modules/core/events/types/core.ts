/**
 * @fileoverview Core event types and enums
 * @module modules/core/events/types/core
 */

/**
 * Event priority enumeration
 */
export enum EventPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Event status enumeration
 */
export enum EventStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  RETRYING = 'retrying'
}

/**
 * Event trigger type enumeration
 */
export enum EventTriggerType {
  MANUAL = 'manual',
  SCHEDULED = 'scheduled',
  WEBHOOK = 'webhook',
  SYSTEM = 'system',
  API = 'api',
  WORKFLOW = 'workflow'
}

/**
 * Condition operator enumeration
 */
export enum ConditionOperator {
  EQUALS = 'eq',
  NOT_EQUALS = 'neq',
  GREATER_THAN = 'gt',
  GREATER_THAN_OR_EQUAL = 'gte',
  LESS_THAN = 'lt',
  LESS_THAN_OR_EQUAL = 'lte',
  IN = 'in',
  NOT_IN = 'nin',
  EXISTS = 'exists',
  REGEX = 'regex'
}

/**
 * Retry strategy enumeration
 */
export enum RetryStrategy {
  EXPONENTIAL = 'exponential',
  LINEAR = 'linear',
  FIXED = 'fixed'
}

/**
 * Schedule type enumeration
 */
export enum ScheduleType {
  CRON = 'cron',
  INTERVAL = 'interval',
  ONCE = 'once'
}

/**
 * Executor type enumeration
 */
export enum ExecutorType {
  SYNC = 'sync',
  WEBHOOK = 'webhook',
  FUNCTION = 'function',
  WORKFLOW = 'workflow',
  COMMAND = 'command'
}

/**
 * Handler type enumeration
 */
export enum HandlerType {
  WEBHOOK = 'webhook',
  FUNCTION = 'function',
  WORKFLOW = 'workflow',
  COMMAND = 'command'
}

/**
 * Workflow step type enumeration
 */
export enum WorkflowStepType {
  ACTION = 'action',
  CONDITION = 'condition',
  PARALLEL = 'parallel',
  LOOP = 'loop',
  SUBFLOW = 'subflow'
}

/**
 * Error handling strategy enumeration
 */
export enum ErrorHandlingStrategy {
  FAIL = 'fail',
  CONTINUE = 'continue',
  RETRY = 'retry',
  ROLLBACK = 'rollback',
  COMPENSATE = 'compensate',
  IGNORE = 'ignore'
}