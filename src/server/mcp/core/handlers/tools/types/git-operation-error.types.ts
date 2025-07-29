/**
 * Git operation error.
 * Custom error class for git operation failures.
 * @file Git operation error class definition.
 * @module handlers/tools/types/git-operation-error
 */
export class GitOperationError extends Error {
  /**
   * Creates a git operation error.
   * @param operation - Git operation that failed.
   * @param details - Additional error details.
   */
  constructor(
    operation: string,
    public readonly details?: unknown,
  ) {
    super(`Git operation failed: ${operation}`);
    this.name = "GitOperationError";
  }
}
