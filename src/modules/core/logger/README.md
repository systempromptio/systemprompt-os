# Logger Module

The logger module provides centralized logging functionality for systemprompt-os. It's a core service module that runs as a singleton and provides logging capabilities to all other modules and components.

## Module Type

- **Type**: Service
- **Provides**: System-wide logging
- **Singleton**: Yes

## Features

- Multiple log levels: debug, info, warn, error
- Console and file output
- Configurable via environment variables
- Automatic log directory creation
- Separate error log file
- Access log for HTTP requests

## Configuration

The logger module is configured through environment variables:

```bash
STATE_DIR=/path/to/state     # Where to store log files
LOG_LEVEL=info              # Minimum log level (debug, info, warn, error)
LOG_MAX_SIZE=10m           # Maximum log file size before rotation
LOG_MAX_FILES=7            # Number of rotated files to keep
```

## Usage

### In Other Modules

```typescript
import { Logger } from '../logger/index.js';

export class MyModule {
  private logger: Logger;
  
  constructor(dependencies: { logger: Logger }) {
    this.logger = dependencies.logger;
  }
  
  doSomething() {
    this.logger.info('Starting operation');
    try {
      // ... do work
      this.logger.debug('Operation details', { data: 'value' });
    } catch (error) {
      this.logger.error('Operation failed', error);
    }
  }
}
```

### In Express Middleware

```typescript
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.access(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});
```

## Log Files

Log files are stored in `${STATE_DIR}/logs/`:

- `system.log` - All log messages (debug, info, warn, error)
- `error.log` - Error messages only
- `access.log` - HTTP access logs

## Log Format

```
[2024-01-15T10:30:45.123Z] [INFO] Starting server on port 3000
[2024-01-15T10:30:45.456Z] [ERROR] Failed to connect to database {"code":"ECONNREFUSED"}
[2024-01-15T10:30:46.789Z] [ACCESS] GET /health 200 15ms
```

## Log Levels

- **debug**: Detailed debugging information
- **info**: General informational messages
- **warn**: Warning messages for potentially problematic situations
- **error**: Error messages for failures

Only messages at or above the configured LOG_LEVEL are logged.

## Module Lifecycle

1. **Initialize**: Creates log directory if it doesn't exist
2. **Ready**: Immediately available for logging
3. **Shutdown**: Flushes any pending logs (if buffering is implemented)

## Future Enhancements

- [ ] Log rotation based on size and date
- [ ] Log buffering for better performance
- [ ] Remote log shipping (syslog, etc.)
- [ ] Structured logging (JSON format option)
- [ ] Log filtering and search capabilities
- [ ] Performance metrics logging