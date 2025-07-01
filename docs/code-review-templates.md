# Code Review Templates

## 🎨 JSDoc Templates by File Type

### Type Definition Files

```typescript
/**
 * @fileoverview Type definitions for [component name]
 * @module types/[module-name]
 * @since 1.0.0
 */

/**
 * Represents a [what it represents]
 * @interface
 * @since 1.0.0
 * @example
 * ```typescript
 * const example: TypeName = {
 *   field: 'value'
 * };
 * ```
 */
export interface TypeName {
  /**
   * Description of what this field represents
   * @since 1.0.0
   */
  readonly field: string;
}

/**
 * Type guard to check if a value is TypeName
 * @param {unknown} value - The value to check
 * @returns {value is TypeName} True if value matches TypeName structure
 * @since 1.0.0
 */
export function isTypeName(value: unknown): value is TypeName {
  return (
    typeof value === 'object' &&
    value !== null &&
    'field' in value &&
    typeof (value as any).field === 'string'
  );
}
```

### Service Classes

```typescript
/**
 * @fileoverview Service for managing [what it manages]
 * @module services/[service-name]
 * @since 1.0.0
 */

/**
 * Manages [what it manages] with [key features]
 * 
 * @class
 * @singleton
 * @extends {EventEmitter}
 * @fires ServiceName#event:name - When something happens
 * @since 1.0.0
 * @example
 * ```typescript
 * const service = ServiceName.getInstance();
 * service.on('event:name', (data) => {
 *   console.log('Event received:', data);
 * });
 * ```
 */
export class ServiceName extends EventEmitter {
  private static instance: ServiceName;

  /**
   * Private constructor enforces singleton pattern
   * @private
   * @since 1.0.0
   */
  private constructor() {
    super();
  }

  /**
   * Gets the singleton instance of ServiceName
   * @returns {ServiceName} The singleton instance
   * @since 1.0.0
   */
  static getInstance(): ServiceName {
    if (!ServiceName.instance) {
      ServiceName.instance = new ServiceName();
    }
    return ServiceName.instance;
  }

  /**
   * Brief description of what this method does
   * @param {ParamType} paramName - What this parameter represents
   * @returns {Promise<ReturnType>} What is returned and when
   * @throws {SpecificError} When this specific error occurs
   * @fires ServiceName#event:name
   * @since 1.0.0
   * @example
   * ```typescript
   * const result = await service.methodName(param);
   * ```
   */
  async methodName(paramName: ParamType): Promise<ReturnType> {
    // Implementation
  }
}
```

### Handler Functions

```typescript
/**
 * @fileoverview Handler for [what it handles]
 * @module handlers/[handler-name]
 * @since 1.0.0
 */

/**
 * Handles [specific operation] requests
 * 
 * @param {RequestType} request - The incoming request
 * @param {ContextType} context - Request context with auth and session info
 * @returns {Promise<ResponseType>} Formatted response with success/error status
 * @throws {ValidationError} When request validation fails
 * @throws {NotFoundError} When requested resource doesn't exist
 * @since 1.0.0
 * @example
 * ```typescript
 * const response = await handleOperation(request, context);
 * if (response.status === 'success') {
 *   // Handle success
 * }
 * ```
 */
export async function handleOperation(
  request: RequestType,
  context: ContextType
): Promise<ResponseType> {
  // Implementation
}
```

### Utility Functions

```typescript
/**
 * @fileoverview Utility functions for [what they do]
 * @module utils/[util-name]
 * @since 1.0.0
 */

/**
 * Performs [specific operation] on [what it operates on]
 * 
 * @param {InputType} input - What this input represents
 * @param {OptionsType} [options] - Optional configuration
 * @returns {OutputType} What is returned
 * @pure
 * @since 1.0.0
 * @example
 * ```typescript
 * const result = utilityFunction(input, { option: true });
 * // result = expected output
 * ```
 */
export function utilityFunction(
  input: InputType,
  options?: OptionsType
): OutputType {
  // Pure implementation - no side effects
}
```

### Constants

```typescript
/**
 * @fileoverview Constants for [what they configure]
 * @module constants/[constant-name]
 * @since 1.0.0
 */

/**
 * Configuration for [what it configures]
 * @constant
 * @since 1.0.0
 */
export const CONFIG_NAME = {
  /**
   * Description of what this value controls
   * @default 'default-value'
   */
  SETTING_NAME: 'value',
} as const;

/**
 * Enum of valid [what these are valid for]
 * @enum {string}
 * @readonly
 * @since 1.0.0
 */
export enum EnumName {
  /** Description of when to use this value */
  VALUE_ONE = 'value-one',
  /** Description of when to use this value */
  VALUE_TWO = 'value-two',
}
```

## 🔍 Code Quality Patterns

### Error Handling Pattern

```typescript
/**
 * Custom error for [when this error occurs]
 * @class
 * @extends {Error}
 * @since 1.0.0
 */
export class SpecificError extends Error {
  /**
   * Creates a new SpecificError
   * @param {string} message - Error message
   * @param {string} [code] - Error code for programmatic handling
   * @param {unknown} [cause] - The underlying cause of the error
   */
  constructor(
    message: string,
    public readonly code?: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'SpecificError';
  }
}

// Usage in function
try {
  // Operation that might fail
} catch (error) {
  logger.error('Operation failed', { error, context });
  throw new SpecificError(
    'Human-readable error message',
    'ERROR_CODE',
    error
  );
}
```

### Logger Usage Pattern

```typescript
import { logger } from '../utils/logger.js';

// Instead of console.log
logger.debug('Detailed debug information', { 
  component: 'ComponentName',
  operation: 'operationName',
  data: relevantData 
});

logger.info('Important state change', { 
  before: oldState,
  after: newState 
});

logger.warn('Potentially problematic situation', {
  issue: 'description',
  impact: 'potential impact',
  suggestion: 'what to do'
});

logger.error('Operation failed', {
  error: error.message,
  stack: error.stack,
  context: relevantContext
});
```

### Type Safety Pattern

```typescript
// Branded types for IDs
export type TaskId = string & { readonly __brand: 'TaskId' };
export type SessionId = string & { readonly __brand: 'SessionId' };

export function createTaskId(id: string): TaskId {
  // Validation
  if (!isValidTaskId(id)) {
    throw new ValidationError('Invalid task ID format');
  }
  return id as TaskId;
}

// Discriminated unions
export type Result<T> = 
  | { success: true; data: T }
  | { success: false; error: ErrorInfo };

// Exhaustive checking
function handleResult(result: Result<Data>): string {
  switch (result.success) {
    case true:
      return processData(result.data);
    case false:
      return handleError(result.error);
    default:
      // This ensures all cases are handled
      const _exhaustive: never = result;
      throw new Error('Unhandled result case');
  }
}
```

### Async Pattern

```typescript
/**
 * Performs async operation with proper error handling
 * @param {InputType} input - Input data
 * @returns {Promise<Result<OutputType>>} Success with data or error
 * @since 1.0.0
 */
export async function asyncOperation(
  input: InputType
): Promise<Result<OutputType>> {
  try {
    // Validate input first
    const validation = validateInput(input);
    if (!validation.valid) {
      return {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: validation.error,
        },
      };
    }

    // Perform operation
    const result = await performOperation(input);
    
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    logger.error('Async operation failed', { error, input });
    
    return {
      success: false,
      error: {
        code: 'OPERATION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        cause: error,
      },
    };
  }
}
```

## 📝 Review Checklist Template

For each file review, use this checklist:

```markdown
## File: `src/path/to/file.ts`

### Documentation
- [ ] File-level JSDoc with @fileoverview
- [ ] All exports have complete JSDoc
- [ ] JSDoc includes @since tags
- [ ] Examples provided where helpful
- [ ] Complex logic has inline comments

### Code Quality
- [ ] No console.log/console.error
- [ ] No commented-out code
- [ ] No TODO/FIXME/HACK comments
- [ ] No magic numbers/strings
- [ ] Consistent naming conventions

### Type Safety
- [ ] No `any` without justification
- [ ] Proper type imports/exports
- [ ] Type guards where needed
- [ ] Branded types for IDs
- [ ] Discriminated unions used

### Error Handling
- [ ] All errors properly typed
- [ ] Async functions have try/catch
- [ ] Errors logged appropriately
- [ ] User-friendly error messages

### Best Practices
- [ ] DRY principle applied
- [ ] SOLID principles followed
- [ ] Functions are testable
- [ ] Side effects isolated
- [ ] Security considered

### Notes
- Specific improvements made:
- Patterns applied:
- Further improvements suggested:
```

## 🎯 Common Replacements

| Before | After |
|--------|-------|
| `console.log(...)` | `logger.debug(...)` |
| `console.error(...)` | `logger.error(...)` |
| `any` | Specific type or generic |
| `// TODO: ...` | Implement or remove |
| `'magic-string'` | `CONSTANT_NAME` |
| `catch (e)` | `catch (error)` |
| Missing JSDoc | Complete JSDoc |
| `throw new Error()` | `throw new SpecificError()` |
| Inline complex logic | Extracted function with docs |