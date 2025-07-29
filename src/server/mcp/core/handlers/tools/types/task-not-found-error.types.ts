/**
 * Task not found error.
 * Custom error class for missing task scenarios.
 * @file Task not found error class definition.
 * @module handlers/tools/types/task-not-found-error
 */
export class TaskNotFoundError extends Error {
  /**
   * Creates a task not found error.
   * @param taskId - ID of the task that was not found.
   */
  constructor(taskId: string) {
    super(`Task not found: ${taskId}`);
    this.name = "TaskNotFoundError";
  }
}
