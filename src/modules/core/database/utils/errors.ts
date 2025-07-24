/**
 * Database error utilities.
 * @file Database error utilities.
 * @module database/utils/errors
 */

import {
  HTTP_400,
  HTTP_500,
  HTTP_503,
  HTTP_504
} from '@/modules/core/database/constants/index.js';

/**
 * Base error class for all database-related errors.
 */
export class DatabaseError extends Error {
  public readonly name: string;
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
    statusCode: number = HTTP_500,
    cause?: Error,
  ) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
    this.statusCode = statusCode;
    this.cause = cause;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Converts error to JSON representation.
   * @returns JSON representation of the error.
   */
  public toJSON(): Record<string, unknown> {
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
  public readonly config?: { type: string; host?: string };

  /**
   * Creates a new connection error.
   * @param message - Error message.
   * @param config - Database configuration.
   * @param config.type
   * @param cause - Original error cause.
   * @param config.host
   */
  public constructor(
    message: string,
    config?: { type: string; host?: string },
    cause?: Error,
  ) {
    super(message, 'CONNECTION_ERROR', HTTP_503, cause);
    this.name = 'ConnectionError';
    this.config = config;
  }
}

/**
 * Error thrown when a query fails to execute.
 */
export class QueryError extends DatabaseError {
  public readonly query?: string;
  public readonly params?: unknown[];

  /**
   * Creates a new query error.
   * @param message - Error message.
   * @param query - SQL query that failed.
   * @param params - Query parameters.
   * @param cause - Original error cause.
   */
  public constructor(
    message: string,
    query?: string,
    params?: unknown[],
    cause?: Error,
  ) {
    super(message, 'QUERY_ERROR', HTTP_500, cause);
    this.name = 'QueryError';
    this.query = query;
    this.params = params;
  }
}

/**
 * Error thrown when a transaction fails.
 */
export class TransactionError extends DatabaseError {
  public readonly operation?: 'begin' | 'commit' | 'rollback';

  /**
   * Creates a new transaction error.
   * @param message - Error message.
   * @param operation - Transaction operation that failed.
   * @param cause - Original error cause.
   */
  public constructor(
    message: string,
    operation?: 'begin' | 'commit' | 'rollback',
    cause?: Error,
  ) {
    super(message, 'TRANSACTION_ERROR', HTTP_500, cause);
    this.name = 'TransactionError';
    this.operation = operation;
  }
}

/**
 * Error thrown when schema validation fails.
 */
export class SchemaError extends DatabaseError {
  public readonly module?: string;
  public readonly details?: Array<{ table?: string; column?: string; issue: string }>;

  /**
   * Creates a new schema error.
   * @param message - Error message.
   * @param module - Module name.
   * @param details - Validation error details.
   * @param cause - Original error cause.
   */
  public constructor(
    message: string,
    module?: string,
    details?: Array<{ table?: string; column?: string; issue: string }>,
    cause?: Error,
  ) {
    super(message, 'SCHEMA_ERROR', HTTP_500, cause);
    this.name = 'SchemaError';
    this.module = module;
    this.details = details;
  }
}

/**
 * Error thrown when migration fails.
 */
export class MigrationError extends DatabaseError {
  public readonly migration?: { module: string; version: string; filename: string };
  public readonly operation?: 'apply' | 'rollback' | 'validate';

  /**
   * Creates a new migration error.
   * @param message - Error message.
   * @param migration - Migration details.
   * @param migration.module
   * @param operation - Migration operation that failed.
   * @param migration.version
   * @param cause - Original error cause.
   * @param migration.filename
   */
  public constructor(
    message: string,
    migration?: { module: string; version: string; filename: string },
    operation?: 'apply' | 'rollback' | 'validate',
    cause?: Error,
  ) {
    super(message, 'MIGRATION_ERROR', HTTP_500, cause);
    this.name = 'MigrationError';
    this.migration = migration;
    this.operation = operation;
  }
}

/**
 * Error thrown when database adapter is not found or fails to load.
 */
export class AdapterError extends DatabaseError {
  public readonly adapterType?: string;

  /**
   * Creates a new adapter error.
   * @param message - Error message.
   * @param adapterType - Type of adapter that failed.
   * @param cause - Original error cause.
   */
  public constructor(
    message: string,
    adapterType?: string,
    cause?: Error,
  ) {
    super(message, 'ADAPTER_ERROR', HTTP_500, cause);
    this.name = 'AdapterError';
    this.adapterType = adapterType;
  }
}

/**
 * Error thrown when module database operations fail.
 */
export class ModuleDatabaseError extends DatabaseError {
  public readonly moduleName: string;
  public readonly operation?: string;

  /**
   * Creates a new module database error.
   * @param message - Error message.
   * @param moduleName - Name of the module.
   * @param operation - Operation that failed.
   * @param cause - Original error cause.
   */
  public constructor(
    message: string,
    moduleName: string,
    operation?: string,
    cause?: Error,
  ) {
    super(message, 'MODULE_DATABASE_ERROR', HTTP_500, cause);
    this.name = 'ModuleDatabaseError';
    this.moduleName = moduleName;
    this.operation = operation;
  }
}

/**
 * Error thrown when database configuration is invalid.
 */
export class ConfigurationError extends DatabaseError {
  public readonly invalidFields?: string[];

  /**
   * Creates a new configuration error.
   * @param message - Error message.
   * @param invalidFields - List of invalid configuration fields.
   * @param cause - Original error cause.
   */
  public constructor(
    message: string,
    invalidFields?: string[],
    cause?: Error,
  ) {
    super(message, 'CONFIGURATION_ERROR', HTTP_400, cause);
    this.name = 'ConfigurationError';
    this.invalidFields = invalidFields;
  }
}

/**
 * Error thrown when database pool operations fail.
 */
export class PoolError extends DatabaseError {
  public readonly poolStatus?: { active: number; idle: number; max: number };

  /**
   * Creates a new pool error.
   * @param message - Error message.
   * @param poolStatus - Current pool status.
   * @param poolStatus.active
   * @param cause - Original error cause.
   * @param poolStatus.idle
   * @param poolStatus.max
   */
  public constructor(
    message: string,
    poolStatus?: { active: number; idle: number; max: number },
    cause?: Error,
  ) {
    super(message, 'POOL_ERROR', HTTP_503, cause);
    this.name = 'PoolError';
    this.poolStatus = poolStatus;
  }
}

/**
 * Error thrown when database timeout occurs.
 */
export class TimeoutError extends DatabaseError {
  public readonly timeoutMs: number;
  public readonly operation?: string;

  /**
   * Creates a new timeout error.
   * @param message - Error message.
   * @param timeoutMs - Timeout duration in milliseconds.
   * @param operation - Operation that timed out.
   * @param cause - Original error cause.
   */
  public constructor(
    message: string,
    timeoutMs: number,
    operation?: string,
    cause?: Error,
  ) {
    super(message, 'TIMEOUT_ERROR', HTTP_504, cause);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
    this.operation = operation;
  }
}

/**
 * Type guard to check if error is a DatabaseError.
 * @param error - The error to check.
 * @returns True if error is a DatabaseError.
 */
export const isDatabaseError = (error: unknown): error is DatabaseError => {
  return error instanceof DatabaseError;
};

/**
 * Type guard to check if error is a specific database error type.
 * @param error - The error to check.
 * @param errorClass - The error class to check against.
 * @returns True if error is instance of the specific error class.
 */
export const isSpecificDatabaseError = <T extends DatabaseError>(
  error: unknown,
  errorClass: new (...args: unknown[]) => T,
): error is T => {
  return error instanceof errorClass;
};

/**
 * Utility to wrap unknown errors into DatabaseError.
 * @param error - The error to wrap.
 * @param context - Additional context for the error.
 * @returns A DatabaseError instance.
 */
export const wrapError = (error: unknown, context?: string): DatabaseError => {
  if (isDatabaseError(error)) {
    return error;
  }

  if (error instanceof Error) {
    const message = context !== undefined ? `${context}: ${error.message}` : error.message;
    return new DatabaseError(
      message,
      'UNKNOWN_ERROR',
      HTTP_500,
      error,
    );
  }

  const errorString = String(error);
  const message = context !== undefined ? `${context}: ${errorString}` : errorString;
  return new DatabaseError(
    message,
    'UNKNOWN_ERROR',
    HTTP_500,
  );
};
