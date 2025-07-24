# Logger Module

## Overview

The Logger module provides a comprehensive, system-wide logging service for SystemPrompt OS. It supports multiple output targets (console and file), configurable log levels, and structured logging with proper error handling.

## Features

- **Multiple Output Targets**: Log to console, file, or both
- **Configurable Log Levels**: debug, info, warn, error
- **Structured Logging**: Support for context objects and metadata
- **File Management**: Automatic log directory creation and log rotation support
- **Error Handling**: Graceful degradation with fallback to console
- **Singleton Pattern**: Ensures single logger instance across the system
- **TypeScript Support**: Full type safety with no `any` types
- **High Performance**: Efficient handling of high-volume logging
- **Thread-Safe**: Handles concurrent log operations safely

## Installation

The logger module is a core module and is automatically available in SystemPrompt OS.

## Configuration

```yaml
# module.yaml
name: logger
type: core
version: 1.0.0
config:
  stateDir: ${STATE_DIR}
  logLevel: ${LOG_LEVEL:-info}
  maxSize: ${LOG_MAX_SIZE:-10MB}
  maxFiles: ${LOG_MAX_FILES:-5}
  outputs:
    - console
    - file
  files:
    system: system.log
    error: error.log
    access: access.log
```

### Configuration Options

- **stateDir**: Base directory for log files (logs will be in `${stateDir}/logs`)
- **logLevel**: Minimum log level to output (debug, info, warn, error)
- **maxSize**: Maximum size per log file (for future rotation support)
- **maxFiles**: Maximum number of rotated files to keep
- **outputs**: Array of output targets (['console', 'file'])
- **files**: Log file names for different log types

## Usage

### Module Integration

```typescript
import { LoggerModule } from '@/modules/core/logger';
import { ModuleContext } from '@/modules/types';

// Initialize the module
const loggerModule = new LoggerModule();
await loggerModule.initialize({
  config: {
    stateDir: '/var/app/state',
    logLevel: 'info',
    outputs: ['console', 'file'],
    // ... other config
  }
});

// Start the module
await loggerModule.start();

// Get the logger service
const logger = loggerModule.getService();
```

### Basic Logging

```typescript
// Log at different levels
logger.debug('Debug information', { userId: '123' });
logger.info('User logged in', { userId: '123', action: 'login' });
logger.warn('API rate limit approaching', { remaining: 10 });
logger.error('Database connection failed', { error: err });

// Custom log level
logger.addLog('CUSTOM', 'Custom log message');

// Access logs (HTTP requests)
logger.access('GET /api/users 200 15ms');
```

### Structured Logging

```typescript
// Log with context object
logger.info('Order processed', {
  orderId: '12345',
  userId: 'user-123',
  amount: 99.99,
  items: ['item1', 'item2'],
  timestamp: new Date().toISOString()
});

// Error logging with stack trace
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', {
    error: error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : error,
    context: getCurrentContext()
  });
}
```

### Log Management

```typescript
// Retrieve logs
const allLogs = await logger.getLogs();
const systemLogs = await logger.getLogs('system.log');
const errorLogs = await logger.getLogs('error.log');

// Clear logs
await logger.clearLogs(); // Clear all logs
await logger.clearLogs('system.log'); // Clear specific log file
```

### Direct Service Usage

```typescript
import { LoggerService } from '@/modules/core/logger/services/logger.service';

// Get singleton instance
const logger = LoggerService.getInstance();

// Initialize with config
await logger.initialize({
  stateDir: '/var/app/state',
  logLevel: 'debug',
  // ... other config
});

// Use the logger
logger.info('Direct service usage');
```

## Architecture

### Module Structure

```
logger/
├── module.yaml           # Module manifest
├── index.ts             # Module entry point (implements ModuleInterface)
├── README.md            # This documentation
├── services/            # Business logic
│   └── logger.service.ts # Singleton logger service
├── types/               # TypeScript definitions
│   └── index.ts        # All type exports
├── utils/               # Utility functions
│   └── errors.ts       # Custom error classes
├── repositories/        # Data access (empty for logger)
└── tests/               # Test suites
    ├── unit/           # Unit tests
    └── integration/    # Integration tests
```

### Design Patterns

1. **Singleton Pattern**: LoggerService ensures single instance
2. **Factory Pattern**: createModule function for module creation
3. **Error Handling**: Custom error classes with proper inheritance
4. **Dependency Injection**: Module receives configuration via context

### Error Handling

The module defines custom error classes for different failure scenarios:

- `LoggerError`: Base error class
- `LoggerInitializationError`: Initialization failures
- `LoggerFileWriteError`: File write failures
- `LoggerFileReadError`: File read failures
- `InvalidLogLevelError`: Invalid log level configuration
- `LoggerDirectoryError`: Directory creation/access failures

## API Reference

### LoggerModule

```typescript
class LoggerModule implements ModuleInterface {
  name: string = 'logger';
  type: 'core' = 'core';
  version: string = '1.0.0';
  
  initialize(context: ModuleContext): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; message?: string }>;
  getService(): Logger;
  exports: any;
}
```

### Logger Interface

```typescript
interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  addLog(level: string, message: string, ...args: unknown[]): void;
  clearLogs(logFile?: string): Promise<void>;
  getLogs(logFile?: string): Promise<string[]>;
}
```

### Configuration Types

```typescript
interface LoggerConfig {
  stateDir: string;
  logLevel: LogLevelName;
  maxSize: string;
  maxFiles: number;
  outputs: LogOutput[];
  files: LogFiles;
}

type LogLevelName = 'debug' | 'info' | 'warn' | 'error';
type LogOutput = 'console' | 'file';
```

## Testing

### Running Tests

```bash
# Run all tests
npm test src/modules/core/logger

# Run unit tests only
npm test src/modules/core/logger/tests/unit

# Run integration tests only
npm test src/modules/core/logger/tests/integration

# Run with coverage
npm test -- --coverage src/modules/core/logger
```

### Test Coverage

The module maintains >90% test coverage with comprehensive unit and integration tests:

- Unit tests for LoggerService, LoggerModule, and error classes
- Integration tests for file operations and module lifecycle
- Performance tests for high-volume logging
- Concurrent operation tests

## Performance Considerations

1. **Synchronous File Writes**: Uses synchronous writes for reliability
2. **Efficient Formatting**: Minimal overhead in message formatting
3. **Level Checking**: Early return for disabled log levels
4. **Console Fallback**: Graceful degradation on file write failures

## Best Practices

1. **Use Structured Logging**
   ```typescript
   // Good
   logger.info('User action', { userId, action, timestamp });
   
   // Less useful
   logger.info(`User ${userId} performed ${action} at ${timestamp}`);
   ```

2. **Include Context**
   ```typescript
   logger.error('Operation failed', {
     error,
     requestId: req.id,
     userId: req.user?.id,
     path: req.path
   });
   ```

3. **Choose Appropriate Levels**
   - `debug`: Detailed debugging information
   - `info`: General informational messages
   - `warn`: Warning conditions that might need attention
   - `error`: Error conditions requiring immediate attention

4. **Handle Sensitive Data**
   ```typescript
   // Don't log sensitive information
   logger.info('User login', { 
     userId: user.id,
     email: user.email
     // NOT password or tokens!
   });
   ```

## Troubleshooting

### Common Issues

1. **Logger not initialized error**
   - Ensure module is initialized before use
   - Check that configuration is provided

2. **No log output**
   - Verify log level allows the message type
   - Check outputs configuration includes desired target
   - Ensure log directory has write permissions

3. **File write errors**
   - Check disk space availability
   - Verify directory permissions
   - Look for console error fallback messages

## Dependencies

- Node.js built-in modules: `fs`, `path`
- No external npm dependencies

## Development

### Adding New Features

1. Update types in `types/index.ts`
2. Implement in `services/logger.service.ts`
3. Update module interface if needed
4. Add comprehensive tests
5. Update this documentation

### Contribution Guidelines

1. Maintain >90% test coverage
2. No `any` types - use `unknown` or proper types
3. Follow singleton pattern for service
4. Use custom error classes for failures
5. Document all public APIs with JSDoc

## License

Part of SystemPrompt OS - see main project license