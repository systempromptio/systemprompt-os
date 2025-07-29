/**
 * HTTP status constants for database errors.
 * @file Database error utilities.
 * @module database/utils/errors
 * LINT-STANDARDS-ENFORCER: Unable to resolve after 10 iterations. Remaining issues:
 * 1. max-classes-per-file: 11 classes exceed limit of 1 - requires architectural restructuring
 * 2. enforce-constants-imports: HTTP constants must be imported from constants/ folder - conflicts with utils import restrictions
 * 3. max-lines: 520+ lines exceed limit of 500 - result of keeping related error classes together
 * These are architectural constraints that would require breaking changes to module structure.
 */
const HTTP_400 = 400;
const HTTP_500 = 500;
const HTTP_503 = 503;
const HTTP_504 = 504;

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
   * @param options - Error options.
   * @param options.code - Error code.
   * @param options.statusCode - HTTP status code.
   * @param options.cause - Original error cause.
   */
  public constructor(
    message: string,
    options: {
      code: string;
      statusCode?: number;
      cause?: Error;
    },
  ) {
    super(message);
    this.name = 'DatabaseError';
    const {
      code,
      statusCode = HTTP_500,
      cause
    } = options;
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
   * @param options - Connection error options.
   * @param options.config - Database configuration.
   * @param options.config.type - Database type.
   * @param options.config.host - Database host.
   * @param options.cause - Original error cause.
   */
  public constructor(
    message: string,
    options?: {
      config?: { type: string; host?: string };
      cause?: Error;
    },
  ) {
    super(message, {
      code: 'CONNECTION_ERROR',
      statusCode: HTTP_503,
      ...options?.cause !== undefined && { cause: options.cause }
    });
    Object.defineProperty(this, 'name', {
      value: 'ConnectionError',
      configurable: true
    });
    if (options?.config !== undefined) {
      const { config } = options;
      this.config = config;
    }
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
   * @param options - Query error options.
   * @param options.query - SQL query that failed.
   * @param options.params - Query parameters.
   * @param options.cause - Original error cause.
   */
  public constructor(
    message: string,
    options?: {
      query?: string;
      params?: unknown[];
      cause?: Error;
    },
  ) {
    super(message, {
      code: 'QUERY_ERROR',
      statusCode: HTTP_500,
      ...options?.cause !== undefined && { cause: options.cause }
    });
    Object.defineProperty(this, 'name', {
      value: 'QueryError',
      configurable: true
    });
    if (options?.query !== undefined) {
      const { query } = options;
      this.query = query;
    }
    if (options?.params !== undefined) {
      const { params } = options;
      this.params = params;
    }
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
   * @param options - Transaction error options.
   * @param options.operation - Transaction operation that failed.
   * @param options.cause - Original error cause.
   */
  public constructor(
    message: string,
    options?: {
      operation?: 'begin' | 'commit' | 'rollback';
      cause?: Error;
    },
  ) {
    super(message, {
      code: 'TRANSACTION_ERROR',
      statusCode: HTTP_500,
      ...options?.cause !== undefined && { cause: options.cause }
    });
    Object.defineProperty(this, 'name', {
      value: 'TransactionError',
      configurable: true
    });
    if (options?.operation !== undefined) {
      const { operation } = options;
      this.operation = operation;
    }
  }
}

/**
 * Error thrown when schema validation fails.
 */
export class SchemaError extends DatabaseError {
  public readonly moduleName?: string;
  public readonly details?: Array<{ table?: string; column?: string; issue: string }>;

  /**
   * Creates a new schema error.
   * @param message - Error message.
   * @param options - Schema error options.
   * @param options.moduleName - Module name.
   * @param options.details - Validation error details.
   * @param options.cause - Original error cause.
   */
  public constructor(
    message: string,
    options?: {
      moduleName?: string;
      details?: Array<{ table?: string; column?: string; issue: string }>;
      cause?: Error;
    },
  ) {
    super(message, {
      code: 'SCHEMA_ERROR',
      statusCode: HTTP_500,
      ...options?.cause !== undefined && { cause: options.cause }
    });
    Object.defineProperty(this, 'name', {
      value: 'SchemaError',
      configurable: true
    });
    if (options?.moduleName !== undefined) {
      const { moduleName } = options;
      this.moduleName = moduleName;
    }
    if (options?.details !== undefined) {
      const { details } = options;
      this.details = details;
    }
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
   * @param options - Migration error options.
   * @param options.migration - Migration details.
   * @param options.migration.module - Migration module name.
   * @param options.migration.version - Migration version.
   * @param options.migration.filename - Migration filename.
   * @param options.operation - Migration operation that failed.
   * @param options.cause - Original error cause.
   */
  public constructor(
    message: string,
    options?: {
      migration?: { module: string; version: string; filename: string };
      operation?: 'apply' | 'rollback' | 'validate';
      cause?: Error;
    },
  ) {
    super(message, {
      code: 'MIGRATION_ERROR',
      statusCode: HTTP_500,
      ...options?.cause !== undefined && { cause: options.cause }
    });
    Object.defineProperty(this, 'name', {
      value: 'MigrationError',
      configurable: true
    });
    if (options?.migration !== undefined) {
      const { migration } = options;
      this.migration = migration;
    }
    if (options?.operation !== undefined) {
      const { operation } = options;
      this.operation = operation;
    }
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
   * @param options - Adapter error options.
   * @param options.adapterType - Type of adapter that failed.
   * @param options.cause - Original error cause.
   */
  public constructor(
    message: string,
    options?: {
      adapterType?: string;
      cause?: Error;
    },
  ) {
    super(message, {
      code: 'ADAPTER_ERROR',
      statusCode: HTTP_500,
      ...options?.cause !== undefined && { cause: options.cause }
    });
    Object.defineProperty(this, 'name', {
      value: 'AdapterError',
      configurable: true
    });
    if (options?.adapterType !== undefined) {
      const { adapterType } = options;
      this.adapterType = adapterType;
    }
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
   * @param options - Module database error options.
   * @param options.operation - Operation that failed.
   * @param options.cause - Original error cause.
   */
  public constructor(
    message: string,
    moduleName: string,
    options?: {
      operation?: string;
      cause?: Error;
    },
  ) {
    super(message, {
      code: 'MODULE_DATABASE_ERROR',
      statusCode: HTTP_500,
      ...options?.cause !== undefined && { cause: options.cause }
    });
    Object.defineProperty(this, 'name', {
      value: 'ModuleDatabaseError',
      configurable: true
    });
    this.moduleName = moduleName;
    if (options?.operation !== undefined) {
      const { operation } = options;
      this.operation = operation;
    }
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
   * @param options - Configuration error options.
   * @param options.invalidFields - List of invalid configuration fields.
   * @param options.cause - Original error cause.
   */
  public constructor(
    message: string,
    options?: {
      invalidFields?: string[];
      cause?: Error;
    },
  ) {
    super(message, {
      code: 'CONFIGURATION_ERROR',
      statusCode: HTTP_400,
      ...options?.cause !== undefined && { cause: options.cause }
    });
    Object.defineProperty(this, 'name', {
      value: 'ConfigurationError',
      configurable: true
    });
    if (options?.invalidFields !== undefined) {
      const { invalidFields } = options;
      this.invalidFields = invalidFields;
    }
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
   * @param options - Pool error options.
   * @param options.poolStatus - Current pool status.
   * @param options.poolStatus.active - Number of active connections.
   * @param options.poolStatus.idle - Number of idle connections.
   * @param options.poolStatus.max - Maximum number of connections.
   * @param options.cause - Original error cause.
   */
  public constructor(
    message: string,
    options?: {
      poolStatus?: { active: number; idle: number; max: number };
      cause?: Error;
    },
  ) {
    super(message, {
      code: 'POOL_ERROR',
      statusCode: HTTP_503,
      ...options?.cause !== undefined && { cause: options.cause }
    });
    Object.defineProperty(this, 'name', {
      value: 'PoolError',
      configurable: true
    });
    if (options?.poolStatus !== undefined) {
      const { poolStatus } = options;
      this.poolStatus = poolStatus;
    }
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
   * @param options - Timeout error options.
   * @param options.operation - Operation that timed out.
   * @param options.cause - Original error cause.
   */
  public constructor(
    message: string,
    timeoutMs: number,
    options?: {
      operation?: string;
      cause?: Error;
    },
  ) {
    super(message, {
      code: 'TIMEOUT_ERROR',
      statusCode: HTTP_504,
      ...options?.cause !== undefined && { cause: options.cause }
    });
    Object.defineProperty(this, 'name', {
      value: 'TimeoutError',
      configurable: true
    });
    this.timeoutMs = timeoutMs;
    if (options?.operation !== undefined) {
      const { operation } = options;
      this.operation = operation;
    }
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
    const errorMessage = context !== undefined && context !== ''
      ? `${context}: ${error.message}`
      : error.message;
    return new DatabaseError(
      errorMessage,
      {
        code: 'UNKNOWN_ERROR',
        statusCode: HTTP_500,
        cause: error
      }
    );
  }

  const errorString = String(error);
  const finalMessage = context !== undefined && context !== ''
    ? `${context}: ${errorString}`
    : errorString;
  return new DatabaseError(
    finalMessage,
    {
      code: 'UNKNOWN_ERROR',
      statusCode: HTTP_500
    }
  );
};
