/**
 * Base error class for all database-related errors.
 */
export class DatabaseError extends Error {
  public override readonly name: string;
  public readonly code: string;
  public readonly statusCode: number;
  public override readonly cause?: Error;

  /**
   * Creates a new database error.
   * @param message - Error message.
   * @param code - Error code.
   * @param statusCode - HTTP status code.
   * @param cause - Original error cause.
   */
  public constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    cause?: Error,
  ) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
    this.statusCode = statusCode;
    if (cause !== undefined) {
      this.cause = cause;
    }
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Converts error to JSON representation.
   * @returns JSON representation of the error.
   */
  public toJson(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      cause: this.cause?.message,
    };
  }
}
