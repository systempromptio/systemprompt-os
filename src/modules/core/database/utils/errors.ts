/**
 * Base error class for all database-related errors.
 */
export class DatabaseError extends Error {
  constructor(
    override message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public override readonly cause?: Error,
  ) {
    super(message);
    this.name = 'DatabaseError';
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      cause: this.cause?.message,
    };
  }
}

/**
 * Error thrown when database connection fails.
 */
export class ConnectionError extends DatabaseError {
  constructor(
    message: string,
    public readonly config?: { type: string; host?: string },
    cause?: Error,
  ) {
    super(message, 'CONNECTION_ERROR', 503, cause);
    this.name = 'ConnectionError';
  }
}

/**
 * Error thrown when a query fails to execute.
 */
export class QueryError extends DatabaseError {
  constructor(
    override message: string,
    public readonly query?: string,
    public readonly params?: any[],
    override cause?: Error,
  ) {
    super(message, 'QUERY_ERROR', 500, cause);
    this.name = 'QueryError';
  }
}

/**
 * Error thrown when a transaction fails.
 */
export class TransactionError extends DatabaseError {
  constructor(
    override message: string,
    public readonly operation?: 'begin' | 'commit' | 'rollback',
    override cause?: Error,
  ) {
    super(message, 'TRANSACTION_ERROR', 500, cause);
    this.name = 'TransactionError';
  }
}

/**
 * Error thrown when schema validation fails.
 */
export class SchemaError extends DatabaseError {
  constructor(
    override message: string,
    public readonly module?: string,
    public readonly details?: Array<{ table?: string; column?: string; issue: string }>,
    override cause?: Error,
  ) {
    super(message, 'SCHEMA_ERROR', 500, cause);
    this.name = 'SchemaError';
  }
}

/**
 * Error thrown when migration fails.
 */
export class MigrationError extends DatabaseError {
  constructor(
    override message: string,
    public readonly migration?: { module: string; version: string; filename: string },
    public readonly operation?: 'apply' | 'rollback' | 'validate',
    override cause?: Error,
  ) {
    super(message, 'MIGRATION_ERROR', 500, cause);
    this.name = 'MigrationError';
  }
}

/**
 * Error thrown when database adapter is not found or fails to load.
 */
export class AdapterError extends DatabaseError {
  constructor(
    override message: string,
    public readonly adapterType?: string,
    override cause?: Error,
  ) {
    super(message, 'ADAPTER_ERROR', 500, cause);
    this.name = 'AdapterError';
  }
}

/**
 * Error thrown when module database operations fail.
 */
export class ModuleDatabaseError extends DatabaseError {
  constructor(
    override message: string,
    public readonly moduleName: string,
    public readonly operation?: string,
    override cause?: Error,
  ) {
    super(message, 'MODULE_DATABASE_ERROR', 500, cause);
    this.name = 'ModuleDatabaseError';
  }
}

/**
 * Error thrown when database configuration is invalid.
 */
export class ConfigurationError extends DatabaseError {
  constructor(
    override message: string,
    public readonly invalidFields?: string[],
    override cause?: Error,
  ) {
    super(message, 'CONFIGURATION_ERROR', 400, cause);
    this.name = 'ConfigurationError';
  }
}

/**
 * Error thrown when database pool operations fail.
 */
export class PoolError extends DatabaseError {
  constructor(
    override message: string,
    public readonly poolStatus?: { active: number; idle: number; max: number },
    override cause?: Error,
  ) {
    super(message, 'POOL_ERROR', 503, cause);
    this.name = 'PoolError';
  }
}

/**
 * Error thrown when database timeout occurs.
 */
export class TimeoutError extends DatabaseError {
  constructor(
    override message: string,
    public readonly timeoutMs: number,
    public readonly operation?: string,
    override cause?: Error,
  ) {
    super(message, 'TIMEOUT_ERROR', 504, cause);
    this.name = 'TimeoutError';
  }
}

/**
 * Type guard to check if error is a DatabaseError.
 * @param error
 */
export function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof DatabaseError;
}

/**
 * Type guard to check if error is a specific database error type.
 * @param error
 * @param errorClass
 */
export function isSpecificDatabaseError<T extends DatabaseError>(
  error: unknown,
  errorClass: new (...args: any[]) => T,
): error is T {
  return error instanceof errorClass;
}

/**
 * Utility to wrap unknown errors into DatabaseError.
 * @param error
 * @param context
 */
export function wrapError(error: unknown, context?: string): DatabaseError {
  if (isDatabaseError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new DatabaseError(
      context ? `${context}: ${error.message}` : error.message,
      'UNKNOWN_ERROR',
      500,
      error,
    );
  }

  return new DatabaseError(
    context ? `${context}: ${String(error)}` : String(error),
    'UNKNOWNerror',
    500,
  );
}
