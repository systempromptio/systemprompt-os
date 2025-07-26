/**
 * Task service implementation.
 * @file Task service implementation.
 * @module modules/core/tasks/services
 */

import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import type { DatabaseService } from '@/modules/core/database/services/database.service';
import { TaskRepository } from '@/modules/core/tasks/repositories/task.repository';
import {
  type ITask,
  type ITaskFilter,
  type ITaskHandler,
  type ITaskService,
  type ITaskStatistics,
  TaskExecutionStatus,
  TaskStatus
} from '@/modules/core/tasks/types/index';

/**
 * Task service implementation providing task management capabilities.
 * Handles task creation, execution, status updates, and statistics.
 */
export class TaskService implements ITaskService {
  private static instance: TaskService | null = null;
  private readonly handlers: Map<string, ITaskHandler> = new Map();
  private logger!: ILogger;
  private taskRepository!: TaskRepository;
  private initialized = false;

  /**
   * Private constructor for singleton pattern.
   * Singleton pattern requires empty constructor.
   * All initialization is done in the initialize method.
   */
  private constructor() {}

  /**
   * Gets the singleton instance of TaskService.
   * @returns The TaskService instance.
   */
  public static getInstance(): TaskService {
    TaskService.instance ??= new TaskService();
    return TaskService.instance;
  }

  /**
   * Initializes the TaskService with required dependencies.
   * @param logger - Logger instance for service logging.
   * @param database - Database service for data persistence.
   * @throws {Error} If already initialized.
   */
  public initialize(logger: ILogger, database: DatabaseService): void {
    if (this.initialized) {
      throw new Error('TaskService already initialized');
    }

    this.logger = logger;
    this.taskRepository = new TaskRepository(database);
    this.initialized = true;

    this.logger.info(LogSource.MODULES, 'TaskService initialized');
  }

  /**
   * Adds a new task to the queue.
   * @param task - Partial task object with required fields.
   * @returns Promise resolving to the created task.
   * @throws {Error} If service not initialized or task creation fails.
   */
  public async addTask(task: Partial<ITask>): Promise<ITask> {
    this.ensureInitialized();
    this.validateTaskInput(task);

    const newTask = await this.taskRepository.create(task);
    this.logger.info(
      LogSource.MODULES,
      `Task added: ${String(newTask.id)} (${newTask.type})`
    );
    return newTask;
  }

  /**
   * Receives the next available task from the queue.
   * @param types - Optional array of task types to filter by.
   * @returns Promise resolving to the next task or null if none available.
   * @throws {Error} If service not initialized.
   */
  public async receiveTask(types?: string[]): Promise<ITask | null> {
    this.ensureInitialized();

    const task = await this.taskRepository.findNextAvailable(types);
    if (task === null) {
      return null;
    }

    const { id: taskId } = task;
    if (taskId == null) {
      throw new Error('Task ID is required for marking in progress');
    }
    await this.markTaskInProgress(taskId);
    const updatedTask = {
      ...task,
      status: TaskStatus.IN_PROGRESS
    };

    this.logger.info(
      LogSource.MODULES,
      `Task received: ${String(updatedTask.id)} (${updatedTask.type})`
    );
    return updatedTask;
  }

  /**
   * Updates the status of a specific task.
   * @param taskId - ID of the task to update.
   * @param status - New status for the task.
   * @throws {Error} If service not initialized.
   */
  public async updateTaskStatus(taskId: number, status: TaskStatus): Promise<void> {
    this.ensureInitialized();

    await this.taskRepository.updateStatus(taskId, status);

    if (this.isTerminalStatus(status)) {
      const executionStatus = this.mapTaskStatusToExecutionStatus(status);
      await this.taskRepository.updateExecution(taskId, executionStatus);
    }

    this.logger.info(
      LogSource.MODULES,
      `Task ${String(taskId)} status updated to ${status}`
    );
  }

  /**
   * Retrieves a task by its ID.
   * @param taskId - ID of the task to retrieve.
   * @returns Promise resolving to the task or null if not found.
   * @throws {Error} If service not initialized.
   */
  public async getTaskById(taskId: number): Promise<ITask | null> {
    this.ensureInitialized();
    return await this.taskRepository.findById(taskId);
  }

  /**
   * Lists tasks based on optional filter criteria.
   * @param filter - Optional filter criteria for tasks.
   * @returns Promise resolving to array of filtered tasks.
   * @throws {Error} If service not initialized.
   */
  public async listTasks(filter?: ITaskFilter): Promise<ITask[]> {
    this.ensureInitialized();
    return await this.taskRepository.findWithFilter(filter);
  }

  /**
   * Cancels a task by updating its status to cancelled.
   * @param taskId - ID of the task to cancel.
   */
  public async cancelTask(taskId: number): Promise<void> {
    await this.updateTaskStatus(taskId, TaskStatus.CANCELLED);
  }

  /**
   * Registers a task handler for a specific task type.
   * @param handler - Task handler to register.
   * @throws {Error} If service not initialized or handler already registered.
   */
  public async registerHandler(handler: ITaskHandler): Promise<void> {
    this.ensureInitialized();

    if (this.handlers.has(handler.type)) {
      throw new Error(`Handler for task type '${handler.type}' already registered`);
    }

    this.handlers.set(handler.type, handler);
    await this.taskRepository.registerTaskType(
      handler.type,
      'unknown',
      `Handler for ${handler.type}`
    );

    this.logger.info(LogSource.MODULES, `Task handler registered: ${handler.type}`);
  }

  /**
   * Unregisters a task handler for a specific task type.
   * @param type - Task type to unregister handler for.
   * @throws {Error} If service not initialized.
   */
  public async unregisterHandler(type: string): Promise<void> {
    this.ensureInitialized();
    this.handlers.delete(type);
    await this.taskRepository.disableTaskType(type);
    this.logger.info(LogSource.MODULES, `Task handler unregistered: ${type}`);
  }

  /**
   * Retrieves task statistics including counts by status and type.
   * @returns Promise resolving to task statistics.
   * @throws {Error} If service not initialized.
   */
  public async getStatistics(): Promise<ITaskStatistics> {
    this.ensureInitialized();
    return await this.taskRepository.getStatistics();
  }

  /**
   * Gets a copy of all registered task handlers.
   * @returns Map of task type to handler.
   */
  public getHandlers(): Map<string, ITaskHandler> {
    return new Map(this.handlers);
  }

  /**
   * Ensures the service is initialized.
   * @throws {Error} If service not initialized.
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('TaskService not initialized');
    }
  }

  /**
   * Validates task input parameters.
   * @param task - Task to validate.
   * @throws {Error} If validation fails.
   */
  private validateTaskInput(task: Partial<ITask>): void {
    if (task.type === null || task.type === undefined) {
      throw new Error('Task type is required');
    }
    if (task.moduleId === null || task.moduleId === undefined) {
      throw new Error('Task moduleId is required');
    }
  }

  /**
   * Marks a task as in progress and creates execution record.
   * @param taskId - Task ID to mark.
   * @returns Promise that resolves when marking is complete.
   */
  private async markTaskInProgress(taskId: number): Promise<void> {
    await this.taskRepository.updateStatus(taskId, TaskStatus.IN_PROGRESS);
    await this.taskRepository.createExecution(taskId, TaskExecutionStatus.RUNNING);
  }

  /**
   * Checks if a task status is terminal.
   * @param status - Task status to check.
   * @returns True if status is terminal.
   */
  private isTerminalStatus(status: TaskStatus): boolean {
    return [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED].includes(status);
  }

  /**
   * Maps task status to execution status.
   * @param status - Task status.
   * @returns Corresponding execution status.
   * @throws {Error} If status cannot be mapped to execution status.
   */
  private mapTaskStatusToExecutionStatus(status: TaskStatus): TaskExecutionStatus {
    switch (status) {
      case TaskStatus.COMPLETED:
        return TaskExecutionStatus.SUCCESS;
      case TaskStatus.FAILED:
        return TaskExecutionStatus.FAILED;
      case TaskStatus.CANCELLED:
        return TaskExecutionStatus.CANCELLED;
      case TaskStatus.PENDING:
      case TaskStatus.IN_PROGRESS:
        throw new Error(`Cannot map non-terminal status: ${status}`);
    }
  }
}
