# Logger Module

## Overview

The Logger module provides a comprehensive, system-wide logging service and error handling system for SystemPrompt OS. It features two distinct but complementary systems:

1. **Logging System**: Records application events, debugging information, and audit trails
2. **Error Handling System**: Provides consistent error processing, categorization, and reporting

These systems are intentionally decoupled - you can use logging without error handling and vice versa.

## Features

### Logging Features
- **Multiple Output Targets**: Log to console, file, and database
- **Configurable Log Levels**: debug, info, warn, error
- **Structured Logging**: Support for context objects and metadata with LogSource and LogCategory enums
- **File Management**: Automatic log directory creation and log rotation support
- **Database Persistence**: Important logs (warn/error) stored in database
- **High Performance**: Efficient handling of high-volume logging
- **Thread-Safe**: Handles concurrent log operations safely

### Error Handling Features
- **Centralized Error Processing**: Single-line error handling with `handleError()`
- **Automatic Categorization**: Intelligent error type detection
- **Typed Error Classes**: Structured errors for common scenarios
- **Sensitive Data Sanitization**: Automatic removal of passwords, tokens, etc.
- **Error Deduplication**: Track and count similar errors
- **Flexible Configuration**: Customizable behavior per error

## Installation

The logger module is a core module and is automatically available in SystemPrompt OS.

## Table of Contents

- [Architecture](#architecture)
- [Logging System](#logging-system)
  - [Basic Usage](#basic-usage)
  - [Log Levels and Sources](#log-levels-and-sources)
  - [Structured Logging](#structured-logging)
- [Error Handling System](#error-handling-system)
  - [Quick Start](#quick-start)
  - [Error Classes](#error-classes)
  - [Advanced Usage](#advanced-usage)
- [Configuration](#configuration)
- [Best Practices](#best-practices)
- [API Reference](#api-reference)

## Architecture

The Logger module is designed with separation of concerns:

```
logger/
├── services/
│   ├── logger.service.ts          # Core logging functionality
│   └── error-handling.service.ts  # Error processing (uses logger internally)
├── types/
│   ├── index.ts                   # Core logging types and enums
│   └── error-handling.types.ts    # Error-specific types
├── errors/                        # Standardized error classes
│   ├── application-error.ts       # Base error class
│   ├── validation-error.ts        # 400 errors
│   ├── authentication-error.ts    # 401 errors
│   ├── authorization-error.ts     # 403 errors
│   ├── database-error.ts          # 500 errors
│   └── ...                        # Other error types
├── utils/
│   ├── handle-error.ts           # Simple error handling interface
│   └── errors.ts                 # Logger-specific errors
└── cli/                          # CLI commands for log management

```

### Key Design Principles

1. **Decoupled Systems**: Logging and error handling are separate concerns
2. **Type Safety**: Full TypeScript support with enums instead of strings
3. **Singleton Pattern**: Single instances for consistent behavior
4. **Graceful Degradation**: Fallback mechanisms for failures

## Logging System

### Basic Usage

```typescript
import { LoggerService, LogSource } from '@/modules/core/logger';

// Get logger instance
const logger = LoggerService.getInstance();

// Simple logging
logger.info(LogSource.API, 'User logged in successfully');
logger.warn(LogSource.DATABASE, 'Connection pool running low');
logger.error(LogSource.AUTH, 'Failed to validate token');
logger.debug(LogSource.SYSTEM, 'Cache miss for key: user_123');
```

### Log Levels and Sources

#### Log Levels (LogLevelName)
- `debug`: Detailed debugging information
- `info`: General informational messages
- `warn`: Warning conditions needing attention
- `error`: Error conditions requiring immediate attention

#### Log Sources (LogSource enum)
```typescript
export enum LogSource {
  BOOTSTRAP = 'bootstrap',
  CLI = 'cli',
  DATABASE = 'database',
  LOGGER = 'logger',
  AUTH = 'auth',
  MCP = 'mcp',
  SERVER = 'server',
  MODULES = 'modules',
  API = 'api',
  ACCESS = 'access',
  SCHEDULER = 'scheduler',
  SYSTEM = 'system',
  WEBHOOK = 'webhook',
  WORKFLOW = 'workflow',
  // ... and more
}
```

### Structured Logging

Use the `LogArgs` interface for rich, searchable logs:

```typescript
logger.info(LogSource.API, 'Order processed', {
  category: LogCategory.USER_ACTION,
  userId: 'user_123',
  requestId: 'req_456',
  action: 'order.create',
  duration: 245,
  data: {
    orderId: 'order_789',
    amount: 99.99,
    currency: 'USD'
  },
  persistToDb: true  // Force database persistence
});
```

#### Log Categories (LogCategory enum)
```typescript
export enum LogCategory {
  INITIALIZATION = 'init',
  AUTHENTICATION = 'auth',
  DATABASE = 'db',
  API = 'api',
  SECURITY = 'security',
  PERFORMANCE = 'perf',
  ERROR = 'error',
  SYSTEM = 'system',
  USER_ACTION = 'user',
  MODULE_LOAD = 'module',
  CONFIGURATION = 'config',
  HEALTH_CHECK = 'health'
}
```

## Error Handling System

### Quick Start

Transform complex error handling into a single line:

```typescript
import { handleError } from '@/modules/core/logger';

// Before: Manual error handling
try {
  await riskyOperation();
} catch (error) {
  logger.error(LogSource.MODULE, 'Operation failed', {
    error: error instanceof Error ? error.message : String(error),
    // manual context...
  });
  throw error;
}

// After: Centralized error handling
try {
  await riskyOperation();
} catch (e) {
  handleError('module.operation', e);
}
```

The error handling system automatically:
- Categorizes the error based on content
- Determines appropriate severity level
- Logs with full context and stack trace
- Sanitizes sensitive information
- Tracks error occurrences
- Rethrows if configured (default: true)

### Error Classes

Use typed errors for better error handling and automatic HTTP status codes:

```typescript
import { 
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  DatabaseError,
  ExternalServiceError,
  BusinessLogicError,
  ConfigurationError
} from '@/modules/core/logger';

// Validation errors (400)
throw new ValidationError('Invalid email format', {
  field: 'email',
  value: 'not-an-email',
  constraints: ['Must be a valid email address']
});

// Authentication errors (401)
throw new AuthenticationError('Invalid credentials', {
  method: 'password'
});

// Authorization errors (403)
throw new AuthorizationError('Insufficient permissions', {
  resource: 'orders',
  action: 'delete',
  requiredPermissions: ['orders.delete']
});

// Database errors (500)
throw new DatabaseError('Query failed', {
  operation: 'SELECT',
  table: 'users',
  cause: originalError
});

// External service errors (502)
throw new ExternalServiceError('Payment gateway timeout', {
  service: 'stripe',
  endpoint: '/charges',
  statusCode: 504
});

// Business logic errors (422)
throw new BusinessLogicError('Insufficient inventory', {
  rule: 'inventory-check',
  entity: 'product'
});

// Configuration errors (500)
throw new ConfigurationError('Missing API key', {
  configKey: 'STRIPE_API_KEY'
});
```

### Advanced Usage

#### Customizing Error Handling

```typescript
handleError('payment.process', error, {
  severity: 'error',              // Override auto-detected severity
  category: 'EXTERNAL_SERVICE',   // Override auto-detected category
  rethrow: false,                 // Don't rethrow (for response handling)
  logToDatabase: true,            // Force database logging
  logSource: LogSource.API,       // Specify log source
  metadata: {                     // Additional context
    customerId: 'cust_123',
    amount: 99.99,
    paymentMethod: 'card'
  }
});
```

#### Async Error Handling

When you need to ensure error processing completes:

```typescript
try {
  await riskyAsyncOperation();
} catch (e) {
  await handleErrorAsync('module.asyncOp', e);
  // Error fully processed before continuing
}
```

#### Global Error Configuration

```typescript
import { configureErrorHandling } from '@/modules/core/logger';

configureErrorHandling({
  logToDatabase: true,
  logToFile: true,
  notify: process.env.NODE_ENV === 'production',
  maxMessageLength: 2000,
  sanitizePatterns: [
    /apikey["\s]*[:=]["\s]*["']?[^"'\s,}]+/gi,
    /creditcard["\s]*[:=]["\s]*["']?[^"'\s,}]+/gi
  ]
});
```

## Configuration

### Logger Configuration

```yaml
# module.yaml
name: logger
type: core
version: 1.0.0
config:
  stateDir: ${STATE_DIR}
  logLevel: ${LOG_LEVEL:-info}
  mode: ${LOGGER_MODE:-server}
  maxSize: ${LOG_MAX_SIZE:-10m}
  maxFiles: ${LOG_MAX_FILES:-5}
  outputs:
    - console
    - file
    - database
  files:
    system: system.log
    error: error.log
    access: access.log
  database:
    enabled: true
    tableName: system_logs
```

### Configuration Options

- **stateDir**: Base directory for log files
- **logLevel**: Minimum log level (debug, info, warn, error)
- **mode**: Logger mode (console, cli, server)
- **maxSize**: Maximum size per log file
- **maxFiles**: Maximum number of rotated files
- **outputs**: Array of output targets
- **files**: Log file names by type
- **database**: Database logging configuration

## Best Practices

### 1. Use Appropriate Log Levels

```typescript
// Debug: Detailed diagnostic information
logger.debug(LogSource.CACHE, 'Cache lookup', { key: 'user_123', hit: false });

// Info: General application flow
logger.info(LogSource.API, 'User registered', { userId: 'user_123' });

// Warn: Potentially harmful situations
logger.warn(LogSource.DATABASE, 'Slow query detected', { duration: 5000 });

// Error: Serious problems requiring attention
logger.error(LogSource.SYSTEM, 'Out of memory', { available: 100 });
```

### 2. Use Structured Logging

```typescript
// ❌ Bad: Unstructured string concatenation
logger.info(LogSource.API, `User ${userId} performed ${action} on ${resource}`);

// ✅ Good: Structured data with enums
logger.info(LogSource.API, 'User action performed', {
  userId,
  action,
  resource,
  category: LogCategory.USER_ACTION
});
```

### 3. Handle Errors Consistently

```typescript
// ❌ Bad: Manual error logging
try {
  await operation();
} catch (error) {
  logger.error(LogSource.MODULE, 'Operation failed', {
    error: error instanceof Error ? error.message : String(error),
    // manual context...
  });
  throw error;
}

// ✅ Good: Centralized error handling
try {
  await operation();
} catch (error) {
  handleError('module.operation', error);
}
```

### 4. Use Typed Errors

```typescript
// ❌ Bad: Generic errors
throw new Error('Invalid input');

// ✅ Good: Specific error types with metadata
throw new ValidationError('Email format invalid', {
  field: 'email',
  value: input.email,
  constraints: ['Must be valid email format']
});
```

### 5. Include Relevant Context

```typescript
// Always include relevant context for debugging
logger.info(LogSource.API, 'Order processed', {
  orderId: order.id,
  userId: user.id,
  requestId: req.id,
  duration: Date.now() - startTime,
  category: LogCategory.USER_ACTION
});
```

### 6. Separate Logging and Error Handling Concerns

The systems are intentionally decoupled:

```typescript
// Just logging (no error)
logger.info(LogSource.API, 'Cache cleared', { 
  size: 1024,
  category: LogCategory.SYSTEM 
});

// Just error handling (includes logging automatically)
handleError('cache.clear', error);

// Both (when you need custom logging + error handling)
logger.info(LogSource.API, 'Starting cache clear');
try {
  await clearCache();
  logger.info(LogSource.API, 'Cache cleared successfully');
} catch (error) {
  handleError('cache.clear', error);
}
```

### 7. Use Enums, Not Strings

```typescript
// ❌ Bad: String literals
logger.info('api', 'User action', { category: 'user' });

// ✅ Good: Type-safe enums
logger.info(LogSource.API, 'User action', { 
  category: LogCategory.USER_ACTION 
});
```

## API Reference

### Logging API

#### ILogger Interface

```typescript
interface ILogger {
  debug(source: LogSource, message: string, args?: LogArgs): void;
  info(source: LogSource, message: string, args?: LogArgs): void;
  warn(source: LogSource, message: string, args?: LogArgs): void;
  error(source: LogSource, message: string, args?: LogArgs): void;
  log(level: LogLevelName, source: LogSource, message: string, args?: LogArgs): void;
  access(message: string): void;
  clearLogs(logFile?: string): Promise<void>;
  getLogs(logFile?: string): Promise<string[]>;
  setDatabaseService?(databaseService: any): void;
}
```

#### LogArgs Interface

```typescript
interface LogArgs {
  category?: LogCategory | string;
  persistToDb?: boolean;
  sessionId?: string;
  userId?: string;
  requestId?: string;
  module?: string;
  action?: string;
  error?: Error | string;
  duration?: number;
  status?: string | number;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}
```

### Error Handling API

#### Main Functions

```typescript
// Synchronous error handling (non-blocking)
function handleError(
  source: string,
  error: unknown,
  options?: Partial<IErrorHandlingOptions>
): void;

// Asynchronous error handling (blocking)
async function handleErrorAsync(
  source: string,
  error: unknown,
  options?: Partial<IErrorHandlingOptions>
): Promise<void>;

// Configure global error handling
function configureErrorHandling(
  config: Partial<IErrorHandlingOptions>
): void;
```

#### IErrorHandlingOptions Interface

```typescript
interface IErrorHandlingOptions {
  rethrow?: boolean;              // Default: true
  severity?: ErrorSeverity;       // Override auto-detection
  category?: ErrorCategory;       // Override auto-detection
  metadata?: Record<string, unknown>;
  logToDatabase?: boolean;        // Default: true
  logToConsole?: boolean;         // Default: true
  logToFile?: boolean;            // Default: true
  message?: string;               // Custom error message
  notify?: boolean;               // Send notifications
  logSource?: LogSource;          // Override source
  logCategory?: LogCategory;      // Override category
}
```

#### Error Classes

All error classes extend `ApplicationError`:

```typescript
abstract class ApplicationError extends Error {
  readonly code?: string;
  readonly statusCode?: number;
  readonly category: ErrorCategory;
  readonly logCategory: LogCategory;
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;
}
```

## CLI Commands

The logger module provides CLI commands for log management:

```bash
# View logs
systemprompt-os logger:show --level error --limit 100

# Clear logs
systemprompt-os logger:clear --type system

# View logs with specific source
systemprompt-os logger:show --source auth --level warn

# Export logs
systemprompt-os logger:show --format json > logs.json
```

## Migration Guide

To migrate existing code to use centralized error handling:

### Step 1: Replace Manual Error Logging

```typescript
// Old pattern
try {
  await operation();
} catch (error) {
  logger.error(LogSource.MODULE, 'Operation failed', {
    error: error instanceof Error ? error.message : String(error)
  });
  throw error;
}

// New pattern
import { handleError } from '@/modules/core/logger';

try {
  await operation();
} catch (error) {
  handleError('module.operation', error);
}
```

### Step 2: Use Typed Errors

```typescript
// Old pattern
throw new Error('User not found');

// New pattern
import { BusinessLogicError } from '@/modules/core/logger';

throw new BusinessLogicError('User not found', {
  entity: 'user',
  rule: 'existence-check'
});
```

### Step 3: Leverage Error Metadata

```typescript
// Old pattern
if (!isValid) {
  throw new Error('Invalid input');
}

// New pattern
import { ValidationError } from '@/modules/core/logger';

if (!isValid) {
  throw new ValidationError('Invalid input', {
    field: 'email',
    value: input.email,
    constraints: ['Must be valid email']
  });
}
```

## Troubleshooting

### Common Issues

1. **Type Error: "unknown" is not assignable**
   - This is expected! Use `handleError()` to process unknown errors
   - The error handling system safely processes `unknown` types

2. **Errors not logging to database**
   - Check that database service is set: `logger.setDatabaseService(dbService)`
   - Verify `persistToDb: true` in options
   - Only warn/error levels persist by default

3. **Missing error context**
   - Pass metadata in options: `handleError('source', error, { metadata: {...} })`
   - Use structured error classes for automatic context

4. **Sensitive data in logs**
   - Configure sanitization patterns in `configureErrorHandling()`
   - Error handler automatically sanitizes common patterns

## Performance Considerations

### Logging Performance
- Synchronous console/file writes for reliability
- Database writes are async and batched
- Early return for disabled log levels
- Minimal formatting overhead

### Error Handling Performance
- Async processing doesn't block main thread
- Error deduplication reduces redundant processing
- Fingerprinting for efficient error grouping
- Configurable limits for message/stack length

## Summary

The Logger module provides a complete solution for application logging and error handling:

- **Logging**: Type-safe, structured logging with multiple outputs
- **Error Handling**: Centralized, consistent error processing
- **Decoupled Design**: Use either or both systems as needed
- **Type Safety**: Full TypeScript support with enums
- **Production Ready**: Sanitization, deduplication, and monitoring

For more examples, see [error-handling-example.md](../../../docs/error-handling-example.md).