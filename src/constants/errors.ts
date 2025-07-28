/**
 * Bootstrap-specific error class.
 */
export class BootstrapError extends Error {
  /**
   * Creates a new BootstrapError instance.
   * @param message - The error message.
   * @param code - Optional error code for categorization.
   */
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'BootstrapError';
    Object.setPrototypeOf(this, BootstrapError.prototype);
  }
}
