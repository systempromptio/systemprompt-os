/**
 * Validation error with field information.
 * Custom error class for validation failures with field information.
 * @file Validation error class definition.
 * @module handlers/tools/types/validation-error
 */
export class ValidationError extends Error {
  /**
   * Creates a validation error.
   * @param message - Error message.
   * @param field - Field that failed validation.
   * @param value - Value that failed validation.
   */
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}
