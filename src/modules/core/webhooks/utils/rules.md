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
export const formatWebhookName = (name: string): string => {
  return name.trim().toLowerCase();
};

// Good: Validation function returning boolean
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
  return emailRegex.test(email);
};

// Good: Data transformation
export const webhookToDisplayName = (webhook: IWebhook): string => {
  return webhook.displayName || webhook.name || webhook.id;
};

// Bad: Side effects (belongs in services)
export const createWebhookAuditLog = (webhook: IWebhook): void => {
  logger.info('Webhook created', { webhookId: webhook.id }); // ❌ Side effect
};
```

## Common Utility Categories

### Constants
```typescript
// constants.ts
export const WEBHOOKS_VALIDATION = {
  MIN_NAME_LENGTH: 3,
  MAX_NAME_LENGTH: 50,
  ALLOWED_CHARS: /^[a-zA-Z0-9_-]+$/u,
} as const;

export const WEBHOOKS_DEFAULTS = {
  STATUS: 'active',
  CREATED_BY: 'system',
} as const;
```

### Validators
```typescript
// validators.ts
import type { IWebhook, IWebhookCreateData } from '../types/webhooks.module.generated';
import { WEBHOOKS_VALIDATION } from './constants';

export const isValidWebhookName = (name: string): boolean => {
  return name.length >= WEBHOOKS_VALIDATION.MIN_NAME_LENGTH
    && name.length <= WEBHOOKS_VALIDATION.MAX_NAME_LENGTH
    && WEBHOOKS_VALIDATION.ALLOWED_CHARS.test(name);
};

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
  return emailRegex.test(email);
};

export const validateWebhookCreateData = (data: IWebhookCreateData): string[] => {
  const errors: string[] = [];
  
  if (!isValidWebhookName(data.name)) {
    errors.push('Invalid webhook name format');
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
import type { IWebhook } from '../types/webhooks.module.generated';

export const formatDisplayName = (webhook: IWebhook): string => {
  if (webhook.displayName?.trim()) {
    return webhook.displayName.trim();
  }
  return webhook.name;
};

export const formatWebhookSummary = (webhook: IWebhook): string => {
  return `${formatDisplayName(webhook)} ($webhook.id})`;
};

export const formatWebhookStatus = (status: string): string => {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
};
```

### Transformers
```typescript
// transformers.ts
import type { IWebhook, IWebhooksRow } from '../types/webhooks.module.generated';

export const dbRowToWebhook = (row: IWebhooksRow): IWebhook => {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
};

export const webhookToUpdateData = (webhook: Partial<IWebhook>) => {
  return {
    name: webhook.name,
    display_name: webhook.displayName,
    status: webhook.status
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

export const compareWebhooks = (a: IWebhook, b: IWebhook): number => {
  return a.name.localeCompare(b.name);
};
```

## Type Utilities

### Type Guards
```typescript
// types.utils.ts
import type { IWebhook } from '../types/webhooks.module.generated';

export const isWebhook = (obj: unknown): obj is IWebhook => {
  return typeof obj === 'object'
    && obj !== null
    && 'id' in obj
    && 'name' in obj
    && typeof (obj as IWebhook).id === 'string'
    && typeof (obj as IWebhook).name === 'string';
};

export const hasRequiredWebhookFields = (obj: Partial<IWebhook>): obj is Pick<IWebhook, 'name'> => {
  return Boolean(obj.name?.trim());
};
```

## Import Patterns

### Type Imports
```typescript
// Always use type imports for interfaces
import type { IWebhook, IWebhookCreateData } from '../types/webhooks.module.generated';
import type { IWebhooksRow } from '../types/database.generated';
```

### Constant Imports
```typescript
// Import constants from local utils
import { WEBHOOKS_VALIDATION, WEBHOOKS_DEFAULTS } from './constants';

// Import external constants
import { LogSource } from '@/modules/core/logger/types/index';
```

## Export Patterns

### Named Exports (Preferred)
```typescript
// Individual named exports
export const isValidEmail = (email: string): boolean => { /* ... */ };
export const formatWebhookName = (name: string): string => { /* ... */ };
export const WEBHOOKS_DEFAULTS = { /* ... */ } as const;
```

### Grouped Exports
```typescript
// Group related utilities
export const validators = {
  isValidEmail,
  isValidWebhookName,
  validateWebhookCreateData
} as const;

export const formatters = {
  formatDisplayName,
  formatWebhookSummary,
  formatWebhookStatus
} as const;
```

## Testing Guidelines

### Unit Test Requirements
All utility functions **MUST** have unit tests:
```typescript
// validators.spec.ts
import { isValidEmail, isValidWebhookName } from '../validators';

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
export const formatWebhooks = (webhooks: IWebhook[]): string[] => {
  return webhooks.map(formatDisplayName);
};

// Bad: Creating objects in loops unnecessarily
const badFormatWebhooks = (webhooks: IWebhook[]): object[] => {
  return webhooks.map(webhook => ({ formatted: formatDisplayName(webhook) })); // ❌ Unnecessary object creation
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