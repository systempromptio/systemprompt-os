/**
 * Executor type enumeration.
 */
export const enum ExecutorTypeEnum {
  TASK = 'task',
  PROCESS = 'process',
  WORKFLOW = 'workflow'
}

/**
 * Executor status enumeration.
 */
export const enum ExecutorStatusEnum {
  IDLE = 'idle',
  RUNNING = 'running',
  STOPPED = 'stopped',
  ERROR = 'error'
}

/**
 * Executor run status enumeration.
 */
export const enum ExecutorRunStatusEnum {
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILURE = 'failure',
  CANCELLED = 'cancelled'
}

/**
 * Executor configuration.
 */
export interface IExecutorConfig {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * Executor entity.
 */
export interface IExecutor {
  id: string;
  name: string;
  type: ExecutorTypeEnum;
  status: ExecutorStatusEnum;
  config?: IExecutorConfig;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Executor run entity.
 */
export interface IExecutorRun {
  id: number;
  executorId: string;
  status: ExecutorRunStatusEnum;
  startedAt: Date;
  completedAt?: Date;
  output?: unknown;
  error?: string;
}

/**
 * Executor service interface.
 */
export interface IExecutorService {
  createExecutor(
    name: string,
    type: ExecutorTypeEnum,
    config?: IExecutorConfig
  ): Promise<IExecutor>;
  getExecutor(id: string): Promise<IExecutor | null>;
  listExecutors(): Promise<IExecutor[]>;
  startExecutor(id: string): Promise<IExecutorRun>;
  stopExecutor(id: string): Promise<void>;
  getExecutorStatus(id: string): Promise<ExecutorStatusEnum>;
}
