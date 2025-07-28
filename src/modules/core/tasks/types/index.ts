/**
 * Task status enum representing the lifecycle states of a task.
 */
export enum TaskStatusEnum {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  STOPPED = 'stopped'
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
  instructions?: unknown;
  priority: number;
  status: TaskStatusEnum;
  retryCount: number;
  maxExecutions: number;
  maxTime?: number;
  result?: string;
  error?: string;
  progress?: number;
  assignedAgentId?: string;
  scheduledAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  completedAt?: Date;
  createdBy?: string;
  metadata?: Record<string, unknown>;
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
  updateTask(taskId: number, updates: Partial<ITask>): Promise<ITask>;
  getTaskById(taskId: number): Promise<ITask | null>;
  listTasks(filter?: ITaskFilter): Promise<ITask[]>;
  cancelTask(taskId: number): Promise<void>;
  registerHandler(handler: ITaskHandler): Promise<void>;
  unregisterHandler(type: string): Promise<void>;
  getStatistics(): Promise<ITaskStatistics>;
  assignTaskToAgent(taskId: number, agentId: string): Promise<void>;
  unassignTask(taskId: number): Promise<void>;
  getTasksByAgent(agentId: string): Promise<ITask[]>;
  getTasksByStatus(status: TaskStatusEnum): Promise<ITask[]>;
  updateTaskProgress(taskId: number, progress: number): Promise<void>;
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
 * Database row interface for tasks.
 */
export interface ITaskRow {
  id: number;
  type: string;
  module_id: string;
  instructions: string | null;
  priority: number;
  status: string;
  retry_count: number;
  max_executions: number;
  max_time: number | null;
  result: string | null;
  error: string | null;
  progress: number | null;
  assigned_agent_id: string | null;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  created_by: string | null;
  metadata: string | null;
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
