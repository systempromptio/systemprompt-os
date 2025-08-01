/**
 * Task service implementation.
 * @file Task service implementation.
 * @module modules/core/tasks/services
 */

import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { TaskRepository } from '@/modules/core/tasks/repositories/task.repository';
import { type ITaskRow, TaskStatus } from '@/modules/core/tasks/types/database.generated';
import {
  type ITaskFilter,
  type ITaskHandler,
  type ITaskStatistics
} from '@/modules/core/tasks/types/manual';
import {
  type ITask,
  type ITaskUpdateData
} from '@/modules/core/tasks/types/tasks.module.generated';
import type { ITasksService } from '@/modules/core/tasks/types/tasks.service.generated';
import { EventBusService } from '@/modules/core/events/services/event-bus.service';
import { EventNames } from '@/modules/core/events/types/index';
import { getModuleRegistry } from '@/modules/loader';

/**
 * Task service implementation providing task management capabilities.
 * Handles task creation, execution, status updates, and statistics.
 */
export class TaskService implements ITasksService {
  private static instance: TaskService | null = null;
  private readonly handlers: Map<string, ITaskHandler> = new Map();
  private logger!: ILogger;
  private taskRepository!: TaskRepository;
  private eventBus!: EventBusService;
  private initialized = false;

  /**
   * Private constructor for singleton pattern.
   * Singleton pattern requires empty constructor.
   * All initialization is done in the initialize method.
   */
  private constructor() {
    this.handlers = new Map();
    this.initialized = false;
  }

  /**
   * Gets the singleton instance of TaskService.
   * @returns The TaskService instance.
   */
  public static getInstance(): TaskService {
    TaskService.instance ??= new TaskService();
    return TaskService.instance;
  }

  /**
   * Initialize the task service.
   * @throws Error if database module not found.
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    this.logger = LoggerService.getInstance();

    const registry = getModuleRegistry();
    const databaseModule = registry.get('DATABASE');
    if (databaseModule === null || databaseModule === undefined) {
      throw new Error('Database module not found');
    }

    const moduleWithExports = databaseModule as {
      exports: { service: () => unknown };
    };
    const databaseService = moduleWithExports.exports.service();

    this.taskRepository = new TaskRepository(databaseService);
    this.eventBus = EventBusService.getInstance();
    this.initialized = true;

    this.logger.info(LogSource.TASKS, 'Task service initialized');
  }

  /**
   * Add a new task to the queue.
   * @param task - Task data to add.
   * @returns Promise resolving to the created task.
   */
  async addTask(task: unknown): Promise<ITask> {
    this.ensureInitialized();

    const taskData = this.buildTaskData(task);
    const createdTask = await this.taskRepository.create(taskData);

    const { id, type } = createdTask;
    const taskId = String(id);
    this.logger.info(LogSource.TASKS, `Task created: ${taskId} (${type})`);

    this.eventBus.emit(EventNames.TASK_CREATED, { task: createdTask });

    return createdTask;
  }

  /**
   * Receive a task for processing.
   * @param types - Optional task types to filter by.
   * @returns Promise resolving to next available task or null.
   */
  async receiveTask(types?: string[]): Promise<ITask | null> {
    this.ensureInitialized();

    const task = await this.taskRepository.findNextAvailable(types);

    if (task !== null) {
      await this.updateTaskStatus(task.id, TaskStatus.ASSIGNED);
      const { id, type } = task;
      const taskId = String(id);
      this.logger.info(LogSource.TASKS, `Task assigned: ${taskId} (${type})`);
    }

    return task;
  }

  /**
   * Update task status.
   * @param taskId - Task ID to update.
   * @param status - New status.
   * @returns Promise that resolves when update is complete.
   */
  async updateTaskStatus(taskId: number, status: unknown): Promise<void> {
    this.ensureInitialized();

    const validTaskStatuses = Object.values(TaskStatus);
    const statusValue = status as TaskStatus;
    if (!validTaskStatuses.includes(statusValue)) {
      throw new Error(`Invalid task status: ${String(status)}`);
    }

    await this.taskRepository.updateStatus(taskId, statusValue);

    const taskIdStr = String(taskId);
    const statusStr = String(status);
    this.logger.info(LogSource.TASKS, `Task ${taskIdStr} status updated to ${statusStr}`);

    this.eventBus.emit(EventNames.TASK_STATUS_CHANGED, {
 taskId,
status
});
  }

  /**
   * Update task with partial data.
   * @param taskId - Task ID to update.
   * @param updates - Partial task data to update.
   * @returns Promise resolving to the updated task.
   */
  async updateTask(taskId: number, updates: Partial<ITaskUpdateData>): Promise<ITask> {
    this.ensureInitialized();

    const updateData = this.buildUpdateData(updates);
    const updatedTask = await this.taskRepository.update(taskId, updateData);

    const taskIdStr = String(taskId);
    this.logger.info(LogSource.TASKS, `Task ${taskIdStr} updated`);

    this.eventBus.emit(EventNames.TASK_UPDATED, { task: updatedTask });

    return updatedTask;
  }

  /**
   * Get task by ID.
   * @param taskId - Task ID to retrieve.
   * @returns Promise resolving to task or null.
   */
  async getTaskById(taskId: number): Promise<ITask | null> {
    this.ensureInitialized();
    return await this.taskRepository.findById(taskId);
  }

  /**
   * List tasks with optional filtering.
   * @param filter - Optional filter criteria.
   * @returns Promise resolving to array of tasks.
   */
  async listTasks(filter?: ITaskFilter): Promise<ITask[]> {
    this.ensureInitialized();
    return await this.taskRepository.findWithFilter(filter);
  }

  /**
   * Cancel a task.
   * @param taskId - Task ID to cancel.
   * @returns Promise that resolves when task is cancelled.
   */
  async cancelTask(taskId: number): Promise<void> {
    this.ensureInitialized();

    await this.updateTaskStatus(taskId, TaskStatus.CANCELLED);

    this.eventBus.emit(EventNames.TASK_CANCELLED, { taskId });
  }

  /**
   * Register a task handler.
   * @param handler - Task handler to register.
   * @returns Promise that resolves when handler is registered.
   */
  registerHandler(handler: ITaskHandler): void {
    this.ensureInitialized();

    this.handlers.set(handler.type, handler);

    this.logger.info(LogSource.TASKS, `Handler registered for task type: ${handler.type}`);
  }

  /**
   * Unregister a task handler.
   * @param type - Task type to unregister handler for.
   * @returns Promise that resolves when handler is unregistered.
   */
  unregisterHandler(type: string): void {
    this.ensureInitialized();

    this.handlers.delete(type);

    this.logger.info(LogSource.TASKS, `Handler unregistered for task type: ${type}`);
  }

  /**
   * Get task statistics.
   * @returns Promise resolving to task statistics.
   */
  async getStatistics(): Promise<ITaskStatistics> {
    this.ensureInitialized();
    return await this.taskRepository.getStatistics();
  }

  /**
   * Assign task to an agent.
   * @param taskId - Task ID to assign.
   * @param agentId - Agent ID to assign to.
   * @returns Promise that resolves when assignment is complete.
   */
  async assignTaskToAgent(taskId: number, agentId: string): Promise<void> {
    this.ensureInitialized();

    await this.taskRepository.update(taskId, {
      assigned_agent_id: agentId,
      status: TaskStatus.ASSIGNED
    });

    const taskIdStr = String(taskId);
    this.logger.info(LogSource.TASKS, `Task ${taskIdStr} assigned to agent ${agentId}`);

    this.eventBus.emit(EventNames.TASK_ASSIGNED, {
 taskId,
agentId
});
  }

  /**
   * Unassign task from agent.
   * @param taskId - Task ID to unassign.
   * @returns Promise that resolves when unassignment is complete.
   */
  async unassignTask(taskId: number): Promise<void> {
    this.ensureInitialized();

    await this.taskRepository.update(taskId, {
      assigned_agent_id: null,
      status: TaskStatus.PENDING
    });

    const taskIdStr = String(taskId);
    this.logger.info(LogSource.TASKS, `Task ${taskIdStr} unassigned`);
  }

  /**
   * Get tasks assigned to an agent.
   * @param agentId - Agent ID to get tasks for.
   * @returns Promise resolving to array of tasks.
   */
  async getTasksByAgent(agentId: string): Promise<ITask[]> {
    this.ensureInitialized();
    return await this.taskRepository.findByAgent(agentId);
  }

  /**
   * Get tasks by status.
   * @param status - Task status to filter by.
   * @returns Promise resolving to array of tasks.
   */
  async getTasksByStatus(status: TaskStatus): Promise<ITask[]> {
    this.ensureInitialized();
    return await this.taskRepository.findByStatus(status);
  }

  /**
   * Update task progress.
   * @param taskId - Task ID to update progress for.
   * @param progress - Progress value (0-100).
   * @returns Promise that resolves when progress is updated.
   */
  async updateTaskProgress(taskId: number, progress: number): Promise<void> {
    this.ensureInitialized();

    if (progress < 0 || progress > 100) {
      throw new Error('Progress must be between 0 and 100');
    }

    await this.taskRepository.update(taskId, { progress });

    const taskIdStr = String(taskId);
    const progressStr = String(progress);
    this.logger.info(LogSource.TASKS, `Task ${taskIdStr} progress updated to ${progressStr}%`);
  }

  /**
   * Get metadata for a task.
   * @param taskId - Task ID.
   * @returns Promise resolving to metadata key-value pairs.
   */
  async getTaskMetadata(taskId: number): Promise<Record<string, string>> {
    this.ensureInitialized();
    return await this.taskRepository.getMetadata(taskId);
  }

  /**
   * Set metadata for a task.
   * @param taskId - Task ID.
   * @param key - Metadata key.
   * @param value - Metadata value.
   * @returns Promise that resolves when metadata is set.
   */
  async setTaskMetadata(taskId: number, key: string, value: string): Promise<void> {
    this.ensureInitialized();
    await this.taskRepository.setMetadata(taskId, key, value);
    const taskIdStr = String(taskId);
    this.logger.debug(LogSource.TASKS, `Metadata set for task ${taskIdStr}: ${key}`);
  }

  /**
   * Build task data for repository creation.
   * @param task - Task data to process.
   * @returns Processed task data for repository.
   */
  private buildTaskData(task: unknown): Partial<ITaskRow> {
    const taskObj = task as Record<string, unknown>;
    const {
      type,
      module_id,
      instructions,
      priority,
      status,
      max_executions
    } = taskObj;

    return {
      ...type !== undefined && { type: type as string },
      ...module_id !== undefined && { module_id: module_id as string },
      ...instructions !== undefined && { instructions: instructions as string | null },
      ...priority !== undefined && { priority: priority as number | null },
      ...status !== undefined && { status: status as TaskStatus | null },
      ...max_executions !== undefined && { max_executions: max_executions as number | null }
    };
  }

  /**
   * Build update data for repository update.
   * @param updates - Update data to process.
   * @returns Processed update data for repository.
   */
  private buildUpdateData(updates: Partial<ITaskUpdateData>): Partial<ITaskRow> {
    const {
      instructions,
      priority,
      status,
      progress,
      result,
      error
    } = updates;

    return {
      ...instructions !== undefined && { instructions },
      ...priority !== undefined && { priority },
      ...status !== undefined && { status: status as TaskStatus | null },
      ...progress !== undefined && { progress },
      ...result !== undefined && { result },
      ...error !== undefined && { error }
    };
  }

  /**
   * Ensure service is initialized.
   * @throws Error if service not initialized.
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('TaskService not initialized. Call initialize() first.');
    }
  }
}
