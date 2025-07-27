/**
 * Task status enum representing the lifecycle states of a task.
 */
export enum TaskStatusEnum {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * Task execution status enum representing the runtime states of task execution.
 */
export enum TaskExecutionStatusEnum {
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
  CANCELLED = 'cancelled'
}

/**
 * Task priority enum representing the urgency levels for task execution.
 */
export enum TaskPriorityEnum {
  LOW = -1,
  NORMAL = 0,
  HIGH = 1,
  URGENT = 2,
  CRITICAL = 3
}

/**
 * Represents a task in the system with all its properties and metadata.
 */
export interface ITask {
  id?: number;
  type: string;
  moduleId: string;
  payload?: unknown;
  priority: number;
  status: TaskStatusEnum;
  retryCount: number;
  maxRetries: number;
  scheduledAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Represents a single execution instance of a task.
 */
export interface ITaskExecution {
  id?: number;
  taskId: number;
  startedAt: Date;
  completedAt?: Date;
  status: TaskExecutionStatusEnum;
  result?: unknown;
  error?: string;
  durationMs?: number;
  executorId?: string;
}

/**
 * Represents a task type configuration in the system.
 */
export interface ITaskType {
  id?: number;
  type: string;
  moduleId: string;
  description?: string;
  handlerConfig?: unknown;
  enabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Defines the contract for task handlers that process specific task types.
 */
export interface ITaskHandler {
  type: string;
  priority?: number;
  validate(payload: unknown): Promise<boolean>;
  execute(task: ITask): Promise<ITaskResult>;
  onError?(task: ITask, error: Error): Promise<void>;
  onSuccess?(task: ITask, result: ITaskResult): Promise<void>;
  onTimeout?(task: ITask): Promise<void>;
}

/**
 * Represents the result of a task execution.
 */
export interface ITaskResult {
  success: boolean;
  resultData?: unknown;
  error?: string;
  nextTask?: Partial<ITask>;
}

/**
 * Service interface for managing tasks in the system.
 */
export interface ITaskService {
  addTask(task: Partial<ITask>): Promise<ITask>;
  receiveTask(types?: string[]): Promise<ITask | null>;
  updateTaskStatus(taskId: number, status: TaskStatusEnum): Promise<void>;
  getTaskById(taskId: number): Promise<ITask | null>;
  listTasks(filter?: ITaskFilter): Promise<ITask[]>;
  cancelTask(taskId: number): Promise<void>;
  registerHandler(handler: ITaskHandler): Promise<void>;
  unregisterHandler(type: string): Promise<void>;
  getStatistics(): Promise<ITaskStatistics>;
}

/**
 * Filter criteria for querying tasks.
 */
export interface ITaskFilter {
  status?: TaskStatusEnum;
  type?: string;
  moduleId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Statistics about tasks in the system.
 */
export interface ITaskStatistics {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  failed: number;
  cancelled: number;
  averageExecutionTime?: number;
  tasksByType: Record<string, number>;
}

/**
 * Module exports for the tasks module.
 */
export interface ITasksModuleExports {
  service: () => ITaskService;
  TaskStatus: typeof TaskStatusEnum;
  TaskExecutionStatus: typeof TaskExecutionStatusEnum;
  TaskPriority: typeof TaskPriorityEnum;
}

/**
 * Represents an error report for lint or typecheck tasks.
 */
export interface IErrorReport {
  id: string;
  path: string;
  errors: number;
  type: 'lint' | 'typecheck';
  timestamp: string;
}

// Export aliases for backward compatibility
export const TaskStatus = TaskStatusEnum;
export const TaskExecutionStatus = TaskExecutionStatusEnum;
export const TaskPriority = TaskPriorityEnum;
