# Utils Subfolder Rules

## Purpose
Utility functions provide reusable helper functions, constants, and pure functions specific to the module. Utils should contain stateless, side-effect-free functions that support the module's business logic.

## File Organization

### Recommended File Structure
```
utils/
├── constants.ts          # Module-specific constants
├── validators.ts         # Validation helper functions
├── formatters.ts         # Data formatting utilities
├── transformers.ts       # Data transformation utilities
├── helpers.ts           # General helper functions
└── types.utils.ts       # Type utility functions
```

## Implementation Guidelines

### Pure Functions Only
All utility functions **MUST** be:
- **Pure functions** - same input always produces same output
- **Side-effect free** - no external state modification
- **Stateless** - no internal state management
- **Synchronous** - no async operations (use services for async work)

### Function Signature Patterns
```typescript
// Good: Pure function with clear input/output
export const format{Entity}Name = (name: string): string => {
  return name.trim().toLowerCase();
};

// Good: Validation function returning boolean
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
  return emailRegex.test(email);
};

// Good: Data transformation
export const {entity}ToDisplayName = ({entity}: I{Entity}): string => {
  return {entity}.displayName || {entity}.name || {entity}.id;
};

// Bad: Side effects (belongs in services)
export const create{Entity}AuditLog = ({entity}: I{Entity}): void => {
  logger.info('{Entity} created', { {entity}Id: {entity}.id }); // ❌ Side effect
};
```

## Common Utility Categories

### Constants
```typescript
// constants.ts
export const {MODULE_CONSTANT}_VALIDATION = {
  MIN_NAME_LENGTH: 3,
  MAX_NAME_LENGTH: 50,
  ALLOWED_CHARS: /^[a-zA-Z0-9_-]+$/u,
} as const;

export const {MODULE_CONSTANT}_DEFAULTS = {
  STATUS: 'active',
  CREATED_BY: 'system',
} as const;
```

### Validators
```typescript
// validators.ts
import type { I{Entity}, I{Entity}CreateData } from '../types/{module}.module.generated';
import { {MODULE_CONSTANT}_VALIDATION } from './constants';

export const isValid{Entity}Name = (name: string): boolean => {
  return name.length >= {MODULE_CONSTANT}_VALIDATION.MIN_NAME_LENGTH
    && name.length <= {MODULE_CONSTANT}_VALIDATION.MAX_NAME_LENGTH
    && {MODULE_CONSTANT}_VALIDATION.ALLOWED_CHARS.test(name);
};

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
  return emailRegex.test(email);
};

export const validate{Entity}CreateData = (data: I{Entity}CreateData): string[] => {
  const errors: string[] = [];
  
  if (!isValid{Entity}Name(data.name)) {
    errors.push('Invalid {entity} name format');
  }
  
  if (data.email && !isValidEmail(data.email)) {
    errors.push('Invalid email format');
  }
  
  return errors;
};
```

### Formatters
```typescript
// formatters.ts
import type { I{Entity} } from '../types/{module}.module.generated';

export const formatDisplayName = ({entity}: I{Entity}): string => {
  if ({entity}.displayName?.trim()) {
    return {entity}.displayName.trim();
  }
  return {entity}.name;
};

export const format{Entity}Summary = ({entity}: I{Entity}): string => {
  return `${formatDisplayName({entity})} (${entity}.id})`;
};

export const format{Entity}Status = (status: string): string => {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
};
```

### Transformers
```typescript
// transformers.ts
import type { I{Entity}, I{Module}Row } from '../types/{module}.module.generated';

export const dbRowTo{Entity} = (row: I{Module}Row): I{Entity} => {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
};

export const {entity}ToUpdateData = ({entity}: Partial<I{Entity}>) => {
  return {
    name: {entity}.name,
    display_name: {entity}.displayName,
    status: {entity}.status
  };
};
```

### Helpers
```typescript
// helpers.ts
export const generateUniqueName = (baseName: string, existingNames: string[]): string => {
  let name = baseName;
  let counter = 1;

  while (existingNames.includes(name)) {
    name = `${baseName}${counter}`;
    counter++;
  }

  return name;
};

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

export const compare{Entity}s = (a: I{Entity}, b: I{Entity}): number => {
  return a.name.localeCompare(b.name);
};
```

## Type Utilities

### Type Guards
```typescript
// types.utils.ts
import type { I{Entity} } from '../types/{module}.module.generated';

export const is{Entity} = (obj: unknown): obj is I{Entity} => {
  return typeof obj === 'object'
    && obj !== null
    && 'id' in obj
    && 'name' in obj
    && typeof (obj as I{Entity}).id === 'string'
    && typeof (obj as I{Entity}).name === 'string';
};

export const hasRequired{Entity}Fields = (obj: Partial<I{Entity}>): obj is Pick<I{Entity}, 'name'> => {
  return Boolean(obj.name?.trim());
};
```

## Import Patterns

### Type Imports
```typescript
// Always use type imports for interfaces
import type { I{Entity}, I{Entity}CreateData } from '../types/{module}.module.generated';
import type { I{Module}Row } from '../types/database.generated';
```

### Constant Imports
```typescript
// Import constants from local utils
import { {MODULE_CONSTANT}_VALIDATION, {MODULE_CONSTANT}_DEFAULTS } from './constants';

// Import external constants
import { LogSource } from '@/modules/core/logger/types/index';
```

## Export Patterns

### Named Exports (Preferred)
```typescript
// Individual named exports
export const isValidEmail = (email: string): boolean => { /* ... */ };
export const format{Entity}Name = (name: string): string => { /* ... */ };
export const {MODULE_CONSTANT}_DEFAULTS = { /* ... */ } as const;
```

### Grouped Exports
```typescript
// Group related utilities
export const validators = {
  isValidEmail,
  isValid{Entity}Name,
  validate{Entity}CreateData
} as const;

export const formatters = {
  formatDisplayName,
  format{Entity}Summary,
  format{Entity}Status
} as const;
```

## Testing Guidelines

### Unit Test Requirements
All utility functions **MUST** have unit tests:
```typescript
// validators.spec.ts
import { isValidEmail, isValid{Entity}Name } from '../validators';

describe('validators', () => {
  describe('isValidEmail', () => {
    it('should return true for valid email', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
    });

    it('should return false for invalid email', () => {
      expect(isValidEmail('invalid-email')).toBe(false);
    });
  });
});
```

### Test Coverage
- **100% line coverage** required for utility functions
- **Test edge cases** and boundary conditions
- **Test invalid inputs** and error conditions

## Performance Considerations

### Memoization (When Appropriate)
```typescript
// For expensive pure computations
const memoized = new Map<string, string>();

export const expensiveTransform = (input: string): string => {
  if (memoized.has(input)) {
    return memoized.get(input)!;
  }
  
  const result = performExpensiveOperation(input);
  memoized.set(input, result);
  return result;
};
```

### Avoid Object Creation in Loops
```typescript
// Good: Reuse objects where possible
export const format{Entity}s = ({entity}s: I{Entity}[]): string[] => {
  return {entity}s.map(formatDisplayName);
};

// Bad: Creating objects in loops unnecessarily
const badFormat{Entity}s = ({entity}s: I{Entity}[]): object[] => {
  return {entity}s.map({entity} => ({ formatted: formatDisplayName({entity}) })); // ❌ Unnecessary object creation
};
```

## Forbidden Patterns

**NEVER**:
- Perform database operations (use repositories)
- Make HTTP requests (use services)
- Access external APIs (use services)
- Maintain internal state
- Use global variables
- Perform logging (return results, let callers log)
- Throw exceptions for business logic (return error indicators)
- Import services or repositories
- Perform async operations

## Integration with Module

Utilities are used by:
- **Services** - for data validation and transformation
- **Repositories** - for data formatting
- **CLI commands** - for input validation and output formatting
- **Tests** - for test data generation and validation

Utils provide the **foundation layer** of reusable, testable functions that support all other module components while maintaining strict separation of concerns.