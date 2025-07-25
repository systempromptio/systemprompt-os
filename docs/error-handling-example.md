# Error Handling Example

This document demonstrates how to refactor existing error handling code to use the new centralized error handling system.

## Before (Current Pattern)

```typescript
// src/server/external/rest/oauth2/register.ts
try {
  // ... operation
} catch (error) {
  logger.error(LogSource.AUTH, 'Client registration failed', {
    error,
    category: 'oauth2',
    action: 'client_register'
  });
  return res.status(500).json({
    error: 'servererror',
    error_description: 'An error occurred during client registration',
  });
}
```

## After (New Pattern)

```typescript
// Import the handleError function
import { handleError } from '@/modules/core/logger';

// Usage in oauth2/register.ts
try {
  // ... operation
} catch (error) {
  handleError('oauth2.register', error, {
    rethrow: false,  // Don't rethrow since we're handling the response
    metadata: {
      action: 'client_register'
    }
  });
  
  return res.status(500).json({
    error: 'servererror',
    error_description: 'An error occurred during client registration',
  });
}
```

## More Examples

### 1. Database Module Initialization

**Before:**
```typescript
// src/modules/core/database/index.ts
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  this.logger?.error(LogSource.DATABASE, 'Database module initialization failed', {
    category: 'initialization',
    error: error as Error
  });
  throw new Error(`Failed to initialize database module: ${errorMessage}`);
}
```

**After:**
```typescript
import { handleError, DatabaseError } from '@/modules/core/logger';

} catch (error) {
  handleError('database.initialize', error, {
    severity: 'error',
    category: 'DATABASE'
  });
  
  // Still throw a structured error for upstream handling
  throw new DatabaseError('Failed to initialize database module', {
    cause: error,
    operation: 'initialize'
  });
}
```

### 2. Authentication Flow

**Before:**
```typescript
try {
  const user = await userService.authenticate(credentials);
  // ...
} catch (error) {
  logger.error(LogSource.AUTH, 'Authentication failed', {
    error: error instanceof Error ? error.message : String(error),
    userId: credentials.username
  });
  throw error;
}
```

**After:**
```typescript
import { handleError, AuthenticationError } from '@/modules/core/logger';

try {
  const user = await userService.authenticate(credentials);
  // ...
} catch (error) {
  handleError('auth.login', error, {
    metadata: {
      username: credentials.username
    }
  });
  
  // Throw a properly typed error
  throw new AuthenticationError('Invalid credentials', {
    method: 'password'
  });
}
```

### 3. API Validation

**Before:**
```typescript
if (!isValid) {
  logger.warn(LogSource.API, 'Validation failed', {
    field: 'email',
    value: input.email
  });
  return res.status(400).json({ error: 'Invalid email format' });
}
```

**After:**
```typescript
import { handleError, ValidationError } from '@/modules/core/logger';

if (!isValid) {
  const error = new ValidationError('Invalid email format', {
    field: 'email',
    value: input.email
  });
  
  handleError('api.user.create', error, {
    rethrow: false,
    severity: 'warn'
  });
  
  return res.status(error.statusCode).json({ 
    error: error.message,
    field: error.metadata?.field 
  });
}
```

### 4. External Service Call

**Before:**
```typescript
try {
  const response = await fetch(apiUrl);
  // ...
} catch (error) {
  logger.error(LogSource.API, 'External API call failed', {
    service: 'payment-gateway',
    error: error as Error,
    endpoint: apiUrl
  });
  throw new Error('Payment service unavailable');
}
```

**After:**
```typescript
import { handleError, ExternalServiceError } from '@/modules/core/logger';

try {
  const response = await fetch(apiUrl);
  // ...
} catch (error) {
  handleError('payment.process', error, {
    metadata: {
      service: 'payment-gateway',
      endpoint: apiUrl
    }
  });
  
  throw new ExternalServiceError('Payment service unavailable', {
    service: 'payment-gateway',
    endpoint: apiUrl,
    cause: error
  });
}
```

## Benefits

1. **Consistency**: All errors are handled the same way
2. **Less Code**: Single line instead of multiple logger calls
3. **Type Safety**: `unknown` errors are properly handled
4. **Automatic Context**: Source tracking, timestamps, etc.
5. **Centralized Logic**: Error categorization, sanitization, and formatting in one place
6. **Better Monitoring**: Standardized error structure for dashboards and alerts

## Configuration

You can configure default error handling behavior:

```typescript
import { configureErrorHandling } from '@/modules/core/logger';

// Set global defaults
configureErrorHandling({
  logToDatabase: true,
  logToFile: true,
  notify: process.env.NODE_ENV === 'production',
  sanitizePatterns: [
    /password["\s]*[:=]["\s]*["']?[^"'\s,}]+/gi,
    /creditcard["\s]*[:=]["\s]*["']?[^"'\s,}]+/gi
  ]
});
```

## Async Error Handling

For async operations where you need to wait for error processing:

```typescript
try {
  await someAsyncOperation();
} catch (error) {
  await handleErrorAsync('module.operation', error);
  // Error has been fully processed and logged
}
```