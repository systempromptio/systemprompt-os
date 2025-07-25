import { ErrorHandlingService } from '@/modules/core/logger/services/error-handling.service';
import type { IErrorHandlingOptions } from '@/modules/core/logger/types/error-handling.types';

/**
 * Main error handling function - the simplified interface for error processing.
 * Usage:.
 * ```typescript
 * try {
 * await someOperation();
 * } catch (e) {
 * handleError('module.operation', e);
 * }
 * ```
 * @param source - The source of the error (e.g., 'auth.login', 'database.query').
 * @param error - The error that was caught.
 * @param options - Optional configuration for error handling.
 */
export function handleError(
  source: string,
  error: unknown,
  options?: Partial<IErrorHandlingOptions>
): void {
  const errorService = ErrorHandlingService.getInstance();

  errorService.processError(source, error, options).catch(processingError => {
    console.error('Error processing failed:', {
      originalError: error,
      processingError,
      source
    });
  });
}

/**
 * Async version of handleError that waits for error processing to complete.
 * Usage:.
 * ```typescript
 * try {
 * await someOperation();
 * } catch (e) {
 * await handleErrorAsync('module.operation', e);
 * }
 * ```
 * @param source - The source of the error.
 * @param error - The error that was caught.
 * @param options - Optional configuration for error handling.
 * @returns Promise that resolves when error processing is complete.
 */
export async function handleErrorAsync(
  source: string,
  error: unknown,
  options?: Partial<IErrorHandlingOptions>
): Promise<void> {
  const errorService = ErrorHandlingService.getInstance();

  try {
    await errorService.processError(source, error, options);
  } catch (processingError) {
    console.error('Error processing failed:', {
      originalError: error,
      processingError,
      source
    });

    if (options?.rethrow !== false) {
      throw error;
    }
  }
}

/**
 * Configure global error handling behavior.
 * @param config - Configuration options.
 */
export function configureErrorHandling(config: Partial<IErrorHandlingOptions>): void {
  const errorService = ErrorHandlingService.getInstance();
  errorService.configure({ defaultOptions: config });
}
