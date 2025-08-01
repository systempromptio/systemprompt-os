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
export const formatModuleName = (name: string): string => {
  return name.trim().toLowerCase();
};

// Good: Validation function returning boolean
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
  return emailRegex.test(email);
};

// Good: Data transformation
export const moduleToDisplayName = (module: IModule): string => {
  return module.displayName || module.name || module.id;
};

// Bad: Side effects (belongs in services)
export const createModuleAuditLog = (module: IModule): void => {
  logger.info('Module created', { moduleId: module.id }); // ❌ Side effect
};
```

## Common Utility Categories

### Constants
```typescript
// constants.ts
export const MODULES_VALIDATION = {
  MIN_NAME_LENGTH: 3,
  MAX_NAME_LENGTH: 50,
  ALLOWED_CHARS: /^[a-zA-Z0-9_-]+$/u,
} as const;

export const MODULES_DEFAULTS = {
  STATUS: 'active',
  CREATED_BY: 'system',
} as const;
```

### Validators
```typescript
// validators.ts
import type { IModule, IModuleCreateData } from '../types/modules.module.generated';
import { MODULES_VALIDATION } from './constants';

export const isValidModuleName = (name: string): boolean => {
  return name.length >= MODULES_VALIDATION.MIN_NAME_LENGTH
    && name.length <= MODULES_VALIDATION.MAX_NAME_LENGTH
    && MODULES_VALIDATION.ALLOWED_CHARS.test(name);
};

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
  return emailRegex.test(email);
};

export const validateModuleCreateData = (data: IModuleCreateData): string[] => {
  const errors: string[] = [];
  
  if (!isValidModuleName(data.name)) {
    errors.push('Invalid module name format');
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
import type { IModule } from '../types/modules.module.generated';

export const formatDisplayName = (module: IModule): string => {
  if (module.displayName?.trim()) {
    return module.displayName.trim();
  }
  return module.name;
};

export const formatModuleSummary = (module: IModule): string => {
  return `${formatDisplayName(module)} ($module.id})`;
};

export const formatModuleStatus = (status: string): string => {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
};
```

### Transformers
```typescript
// transformers.ts
import type { IModule, IModulesRow } from '../types/modules.module.generated';

export const dbRowToModule = (row: IModulesRow): IModule => {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
};

export const moduleToUpdateData = (module: Partial<IModule>) => {
  return {
    name: module.name,
    display_name: module.displayName,
    status: module.status
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

export const compareModules = (a: IModule, b: IModule): number => {
  return a.name.localeCompare(b.name);
};
```

## Type Utilities

### Type Guards
```typescript
// types.utils.ts
import type { IModule } from '../types/modules.module.generated';

export const isModule = (obj: unknown): obj is IModule => {
  return typeof obj === 'object'
    && obj !== null
    && 'id' in obj
    && 'name' in obj
    && typeof (obj as IModule).id === 'string'
    && typeof (obj as IModule).name === 'string';
};

export const hasRequiredModuleFields = (obj: Partial<IModule>): obj is Pick<IModule, 'name'> => {
  return Boolean(obj.name?.trim());
};
```

## Import Patterns

### Type Imports
```typescript
// Always use type imports for interfaces
import type { IModule, IModuleCreateData } from '../types/modules.module.generated';
import type { IModulesRow } from '../types/database.generated';
```

### Constant Imports
```typescript
// Import constants from local utils
import { MODULES_VALIDATION, MODULES_DEFAULTS } from './constants';

// Import external constants
import { LogSource } from '@/modules/core/logger/types/index';
```

## Export Patterns

### Named Exports (Preferred)
```typescript
// Individual named exports
export const isValidEmail = (email: string): boolean => { /* ... */ };
export const formatModuleName = (name: string): string => { /* ... */ };
export const MODULES_DEFAULTS = { /* ... */ } as const;
```

### Grouped Exports
```typescript
// Group related utilities
export const validators = {
  isValidEmail,
  isValidModuleName,
  validateModuleCreateData
} as const;

export const formatters = {
  formatDisplayName,
  formatModuleSummary,
  formatModuleStatus
} as const;
```

## Testing Guidelines

### Unit Test Requirements
All utility functions **MUST** have unit tests:
```typescript
// validators.spec.ts
import { isValidEmail, isValidModuleName } from '../validators';

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
export const formatModules = (modules: IModule[]): string[] => {
  return modules.map(formatDisplayName);
};

// Bad: Creating objects in loops unnecessarily
const badFormatModules = (modules: IModule[]): object[] => {
  return modules.map(module => ({ formatted: formatDisplayName(module) })); // ❌ Unnecessary object creation
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