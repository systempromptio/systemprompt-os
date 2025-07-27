/**
 * Bootstrap-specific error class.
 */
export class BootstrapError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'BootstrapError';
    Object.setPrototypeOf(this, BootstrapError.prototype);
  }
}
