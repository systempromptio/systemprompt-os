/**
 * Task service implementation.
 * @file Task service implementation.
 * @module modules/core/tasks/services
 */

import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import type { TaskRepository } from '@/modules/core/tasks/repositories/task.repository';
import {
  type ITaskFilter,
  type ITaskHandler,
  type ITaskRow,
  type ITaskService,
  type ITaskStatistics,
  TaskStatus
} from '@/modules/core/tasks/types/index';
import { EventBusService } from '@/modules/core/events/services/event-bus.service';
import { EventNames } from '@/modules/core/events/types/index';

/**
 * Task service implementation providing task management capabilities.
 * Handles task creation, execution, status updates, and statistics.
 */
export class TaskService implements ITaskService {
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
   * Initialize the task service with dependencies.
   * @param logger - Logger instance.
   * @param taskRepository - Task repository instance.
   */
  public initialize(logger: ILogger, taskRepository: TaskRepository): void {
    if (this.initialized) {
      return;
    }

    this.logger = logger;
    this.taskRepository = taskRepository;
    this.eventBus = EventBusService.getInstance();
    this.initialized = true;

    this.logger.info(LogSource.TASKS, 'Task service initialized');
  }

  /**
   * Add a new task to the queue.
   * @param task - Task data to add.
   * @returns Promise resolving to the created task.
   */
  async addTask(task: Partial<ITaskRow>): Promise<ITaskRow> {
    this.ensureInitialized();

    const createdTask = await this.taskRepository.create(task);

    this.logger.info(LogSource.TASKS, `Task created: ${createdTask.id} (${createdTask.type})`);

    await this.eventBus.emit(EventNames.TASK_CREATED, { task: createdTask });

    return createdTask;
  }

  /**
   * Receive a task for processing.
   * @param types - Optional task types to filter by.
   * @returns Promise resolving to next available task or null.
   */
  async receiveTask(types?: string[]): Promise<ITaskRow | null> {
    this.ensureInitialized();

    const task = await this.taskRepository.findNextAvailable(types);

    if (task) {
      await this.updateTaskStatus(task.id, TaskStatus.ASSIGNED);
      this.logger.info(LogSource.TASKS, `Task assigned: ${task.id} (${task.type})`);
    }

    return task;
  }

  /**
   * Update task status.
   * @param taskId - Task ID to update.
   * @param status - New status.
   * @returns Promise that resolves when update is complete.
   */
  async updateTaskStatus(taskId: number, status: TaskStatus): Promise<void> {
    this.ensureInitialized();

    await this.taskRepository.updateStatus(taskId, status);

    this.logger.info(LogSource.TASKS, `Task ${taskId} status updated to ${status}`);

    await this.eventBus.emit(EventNames.TASK_STATUS_CHANGED, {
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
  async updateTask(taskId: number, updates: Partial<ITaskRow>): Promise<ITaskRow> {
    this.ensureInitialized();

    const updatedTask = await this.taskRepository.update(taskId, updates);

    this.logger.info(LogSource.TASKS, `Task ${taskId} updated`);

    await this.eventBus.emit(EventNames.TASK_UPDATED, { task: updatedTask });

    return updatedTask;
  }

  /**
   * Get task by ID.
   * @param taskId - Task ID to retrieve.
   * @returns Promise resolving to task or null.
   */
  async getTaskById(taskId: number): Promise<ITaskRow | null> {
    this.ensureInitialized();
    return await this.taskRepository.findById(taskId);
  }

  /**
   * List tasks with optional filtering.
   * @param filter - Optional filter criteria.
   * @returns Promise resolving to array of tasks.
   */
  async listTasks(filter?: ITaskFilter): Promise<ITaskRow[]> {
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

    await this.eventBus.emit(EventNames.TASK_CANCELLED, { taskId });
  }

  /**
   * Register a task handler.
   * @param handler - Task handler to register.
   * @returns Promise that resolves when handler is registered.
   */
  async registerHandler(handler: ITaskHandler): Promise<void> {
    this.ensureInitialized();

    this.handlers.set(handler.type, handler);

    this.logger.info(LogSource.TASKS, `Handler registered for task type: ${handler.type}`);
  }

  /**
   * Unregister a task handler.
   * @param type - Task type to unregister handler for.
   * @returns Promise that resolves when handler is unregistered.
   */
  async unregisterHandler(type: string): Promise<void> {
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

    this.logger.info(LogSource.TASKS, `Task ${taskId} assigned to agent ${agentId}`);

    await this.eventBus.emit(EventNames.TASK_ASSIGNED, {
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

    this.logger.info(LogSource.TASKS, `Task ${taskId} unassigned`);
  }

  /**
   * Get tasks assigned to an agent.
   * @param agentId - Agent ID to get tasks for.
   * @returns Promise resolving to array of tasks.
   */
  async getTasksByAgent(agentId: string): Promise<ITaskRow[]> {
    this.ensureInitialized();
    return await this.taskRepository.findByAgent(agentId);
  }

  /**
   * Get tasks by status.
   * @param status - Task status to filter by.
   * @returns Promise resolving to array of tasks.
   */
  async getTasksByStatus(status: TaskStatus): Promise<ITaskRow[]> {
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

    this.logger.info(LogSource.TASKS, `Task ${taskId} progress updated to ${progress}%`);
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
    this.logger.debug(LogSource.TASKS, `Metadata set for task ${taskId}: ${key}`);
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
