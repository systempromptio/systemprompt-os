/**
 * @fileoverview Type definitions for the workflows module
 * @module modules/core/workflows/types
 */

export type WorkflowStatus = 'active' | 'inactive' | 'archived';
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
export type StepType = 'action' | 'condition' | 'parallel' | 'loop' | 'subflow';
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version: string;
  status: WorkflowStatus;
  triggers?: WorkflowTrigger[];
  inputs?: WorkflowInput[];
  outputs?: WorkflowOutput[];
  steps: WorkflowStep[];
  error_handler?: WorkflowStep;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface WorkflowTrigger {
  type: 'manual' | 'scheduled' | 'event' | 'webhook';
  config: Record<string, any>;
}

export interface WorkflowInput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  default?: any;
  description?: string;
}

export interface WorkflowOutput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  source: string; // Step reference
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: StepType;
  action?: string; // Action identifier
  condition?: ConditionConfig;
  parallel?: ParallelConfig;
  loop?: LoopConfig;
  subflow?: string; // Workflow ID
  inputs?: Record<string, any>;
  outputs?: string[]; // Output variable names
  on_error?: 'fail' | 'continue' | 'retry' | 'goto';
  retry?: RetryConfig;
  timeout?: number;
  depends_on?: string[]; // Step IDs
}

export interface ConditionConfig {
  expression: string;
  then_steps: WorkflowStep[];
  else_steps?: WorkflowStep[];
}

export interface ParallelConfig {
  branches: WorkflowStep[][];
  wait_all?: boolean;
}

export interface LoopConfig {
  over: string; // Variable or expression
  as: string; // Loop variable name
  steps: WorkflowStep[];
  max_iterations?: number;
}

export interface RetryConfig {
  attempts: number;
  delay: number;
  backoff?: 'linear' | 'exponential';
  max_delay?: number;
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  workflow_version: string;
  status: ExecutionStatus;
  inputs: Record<string, any>;
  outputs?: Record<string, any>;
  error?: string;
  started_at: Date;
  completed_at?: Date;
  duration?: number;
  current_step?: string;
  context: ExecutionContext;
  checkpoints: ExecutionCheckpoint[];
}

export interface ExecutionContext {
  variables: Record<string, any>;
  step_results: Record<string, StepResult>;
  metadata: Record<string, any>;
}

export interface StepResult {
  step_id: string;
  status: StepStatus;
  started_at: Date;
  completed_at?: Date;
  outputs?: Record<string, any>;
  error?: string;
  retry_count?: number;
}

export interface ExecutionCheckpoint {
  id: string;
  execution_id: string;
  step_id: string;
  context: ExecutionContext;
  created_at: Date;
}

export interface CreateWorkflowDto {
  name: string;
  description?: string;
  version?: string;
  steps: WorkflowStep[];
  triggers?: WorkflowTrigger[];
  inputs?: WorkflowInput[];
  outputs?: WorkflowOutput[];
  error_handler?: WorkflowStep;
  metadata?: Record<string, any>;
}

export interface UpdateWorkflowDto {
  name?: string;
  description?: string;
  status?: WorkflowStatus;
  steps?: WorkflowStep[];
  triggers?: WorkflowTrigger[];
  inputs?: WorkflowInput[];
  outputs?: WorkflowOutput[];
  error_handler?: WorkflowStep;
  metadata?: Record<string, any>;
}

export interface ExecuteWorkflowDto {
  workflow_id: string;
  inputs?: Record<string, any>;
  async?: boolean;
  metadata?: Record<string, any>;
}

export interface ScheduleWorkflowDto {
  workflow_id: string;
  schedule: {
    type: 'once' | 'recurring';
    cron?: string;
    at?: Date;
  };
  inputs?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface WorkflowEvent {
  type: 'created' | 'updated' | 'executed' | 'completed' | 'failed' | 'cancelled' | 'scheduled';
  workflow_id?: string;
  execution_id?: string;
  timestamp: Date;
  data?: Record<string, any>;
}