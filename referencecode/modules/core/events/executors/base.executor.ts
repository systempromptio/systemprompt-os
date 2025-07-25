import type {
  IEventExecutor,
  Event,
  EventExecution,
  ExecutionResult,
  ExecutorCapabilities,
  RetryPolicy,
} from '../types/index.js';

/**
 * Base abstract class for event executors
 */
export abstract class BaseEventExecutor implements IEventExecutor {
  abstract type: string;

  /**
   * Execute an event
   */
  abstract execute(event: Event, execution: EventExecution): Promise<ExecutionResult>;

  /**
   * Validate executor configuration
   * @param config Configuration to validate
   * @returns True if valid
   */
  async validateConfig(config: Record<string, unknown>): Promise<boolean> {
    // Default implementation accepts all configs
    void config; // Explicitly mark as intentionally unused
    return true;
  }

  /**
   * Get executor capabilities
   */
  abstract getCapabilities(): ExecutorCapabilities;

  /**
   * Helper method to create a success result
   * @param data Optional result data
   * @returns Success result
   */
  protected success(data?: Record<string, unknown>): ExecutionResult {
    const result: ExecutionResult = {
      success: true,
    };
    if (data !== undefined) {
      result.data = data;
    }
    return result;
  }

  /**
   * Helper method to create a failure result
   */
  protected failure(error: string, shouldRetry = false, nextRetryDelay?: number): ExecutionResult {
    const result: ExecutionResult = {
      success: false,
      error,
      shouldRetry,
    };
    if (nextRetryDelay !== undefined) {
      result.nextRetryDelay = nextRetryDelay;
    }
    return result;
  }

  /**
   * Calculate retry delay based on retry policy
   * @param retryCount Current retry attempt number
   * @param retryPolicy Optional retry policy configuration
   * @returns Delay in milliseconds
   */
  protected calculateRetryDelay(retryCount: number, retryPolicy?: RetryPolicy): number {
    if (!retryPolicy) {
      return 1000; // Default 1 second
    }

    const { strategy, initial_delay_ms, max_delay_ms, multiplier } = retryPolicy;
    let delay = initial_delay_ms || 1000;

    switch (strategy) {
    case 'exponential':
      delay = delay * Math.pow(multiplier || 2, retryCount);
      break;
    case 'linear':
      delay = delay * (retryCount + 1);
      break;
    case 'fixed':
      // Use initial delay
      break;
    }

    if (max_delay_ms) {
      delay = Math.min(delay, max_delay_ms);
    }

    return delay;
  }
}