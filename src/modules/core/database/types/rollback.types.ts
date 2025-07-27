/**
 * Interface for rollback execution results.
 */
export interface IRollbackResult {
  successful: number;
  failed: number;
  hasFailures: boolean;
}
