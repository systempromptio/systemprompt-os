/**
 * Status check error.
 * Custom error class for status check failures.
 * @file Status check error class definition.
 * @module handlers/tools/types/status-check-error
 */
export class StatusCheckError extends Error {
  /**
   * Creates a status check error.
   * @param message - Error message.
   * @param details - Additional error details.
   */
  constructor(
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "StatusCheckError";
  }
}
