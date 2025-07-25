/**
 * Task module type definitions.
 * @file Task module type definitions.
 * @module modules/core/tasks/types
 */

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum TaskExecutionStatus {
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
  CANCELLED = 'cancelled'
}

export enum TaskPriority {
  LOW = -1,
  NORMAL = 0,
  HIGH = 1,
  URGENT = 2,
  CRITICAL = 3
}

export interface ITask {
  id?: number;
  type: string;
  moduleId: string;
  payload?: any;
  priority: number;
  status: TaskStatus;
  retryCount: number;
  maxRetries: number;
  scheduledAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
  metadata?: Record<string, any>;
}

export interface ITaskExecution {
  id?: number;
  taskId: number;
  startedAt: Date;
  completedAt?: Date;
  status: TaskExecutionStatus;
  result?: any;
  error?: string;
  durationMs?: number;
  executorId?: string;
}

export interface ITaskType {
  id?: number;
  type: string;
  moduleId: string;
  description?: string;
  handlerConfig?: any;
  enabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ITaskHandler {
  type: string;
  priority?: number;
  validate(payload: any): Promise<boolean>;
  execute(task: ITask): Promise<ITaskResult>;
  onError?(task: ITask, error: Error): Promise<void>;
  onSuccess?(task: ITask, result: ITaskResult): Promise<void>;
  onTimeout?(task: ITask): Promise<void>;
}

export interface ITaskResult {
  success: boolean;
  data?: any;
  error?: string;
  nextTask?: Partial<ITask>;
}

export interface ITaskService {
  addTask(task: Partial<ITask>): Promise<ITask>;
  receiveTask(types?: string[]): Promise<ITask | null>;
  updateTaskStatus(taskId: number, status: TaskStatus): Promise<void>;
  getTaskById(taskId: number): Promise<ITask | null>;
  listTasks(filter?: ITaskFilter): Promise<ITask[]>;
  cancelTask(taskId: number): Promise<void>;
  registerHandler(handler: ITaskHandler): Promise<void>;
  unregisterHandler(type: string): Promise<void>;
  getStatistics(): Promise<ITaskStatistics>;
}

export interface ITaskFilter {
  status?: TaskStatus;
  type?: string;
  moduleId?: string;
  limit?: number;
  offset?: number;
}

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

export interface ITasksModuleExports {
  service: () => ITaskService;
  TaskStatus: typeof TaskStatus;
  TaskExecutionStatus: typeof TaskExecutionStatus;
  TaskPriority: typeof TaskPriority;
}
