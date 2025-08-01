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
export const formatConfigKey = (key: string): string => {
  return key.trim().toLowerCase();
};

// Good: Validation function returning boolean
export const isValidConfigKey = (key: string): boolean => {
  const keyRegex = /^[a-zA-Z0-9_.-]+$/u;
  return keyRegex.test(key);
};

// Good: Data transformation
export const configToDisplayName = (config: IConfig): string => {
  return config.description || config.key;
};

// Bad: Side effects (belongs in services)
export const createConfigAuditLog = (config: IConfig): void => {
  logger.info('Config created', { configId: config.id }); // ❌ Side effect
};
```

## Common Utility Categories

### Constants
```typescript
// constants.ts
export const CONFIG_VALIDATION = {
  MIN_KEY_LENGTH: 1,
  MAX_KEY_LENGTH: 100,
  MAX_VALUE_LENGTH: 10000,
  ALLOWED_KEY_CHARS: /^[a-zA-Z0-9_.-]+$/u,
  RESERVED_KEYS: ['system', 'admin', 'root'],
} as const;

export const CONFIG_DEFAULTS = {
  TYPE: 'string',
  DESCRIPTION: '',
} as const;

export const CONFIG_TYPES = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  JSON: 'json',
} as const;
```

### Validators
```typescript
// validators.ts
import type { IConfig, IConfigCreateData } from '../types/config.module.generated';
import { CONFIG_VALIDATION } from './constants';

export const isValidConfigKey = (key: string): boolean => {
  return key.length >= CONFIG_VALIDATION.MIN_KEY_LENGTH
    && key.length <= CONFIG_VALIDATION.MAX_KEY_LENGTH
    && CONFIG_VALIDATION.ALLOWED_KEY_CHARS.test(key)
    && !CONFIG_VALIDATION.RESERVED_KEYS.includes(key.toLowerCase());
};

export const isValidConfigValue = (value: string, type: string): boolean => {
  if (value.length > CONFIG_VALIDATION.MAX_VALUE_LENGTH) {
    return false;
  }

  switch (type) {
    case 'number':
      return !isNaN(Number(value)) && isFinite(Number(value));
    case 'boolean':
      return ['true', 'false'].includes(value.toLowerCase());
    case 'json':
      try {
        JSON.parse(value);
        return true;
      } catch {
        return false;
      }
    case 'string':
    default:
      return true;
  }
};

export const validateConfigCreateData = (data: IConfigCreateData): string[] => {
  const errors: string[] = [];
  
  if (!isValidConfigKey(data.key)) {
    errors.push('Invalid config key format');
  }
  
  if (!isValidConfigValue(data.value, data.type || 'string')) {
    errors.push('Invalid config value for specified type');
  }
  
  return errors;
};
```

### Formatters
```typescript
// formatters.ts
import type { IConfig } from '../types/config.module.generated';

export const formatConfigDisplayName = (config: IConfig): string => {
  if (config.description?.trim()) {
    return `${config.key} (${config.description.trim()})`;
  }
  return config.key;
};

export const formatConfigValue = (config: IConfig): string => {
  switch (config.type) {
    case 'boolean':
      return config.value === 'true' ? '✓' : '✗';
    case 'json':
      try {
        return JSON.stringify(JSON.parse(config.value), null, 2);
      } catch {
        return config.value;
      }
    case 'number':
      return Number(config.value).toLocaleString();
    default:
      return config.value;
  }
};

export const formatConfigType = (type: string): string => {
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
};
```

### Transformers
```typescript
// transformers.ts
import type { IConfig, IConfigRow } from '../types/config.module.generated';

export const dbRowToConfig = (row: IConfigRow): IConfig => {
  return {
    id: row.id,
    key: row.key,
    value: row.value,
    type: row.type,
    description: row.description,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
};

export const configToUpdateData = (config: Partial<IConfig>) => {
  return {
    value: config.value,
    type: config.type,
    description: config.description
  };
};

export const parseConfigValue = (value: string, type: string): unknown => {
  switch (type) {
    case 'number':
      return Number(value);
    case 'boolean':
      return value.toLowerCase() === 'true';
    case 'json':
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    default:
      return value;
  }
};
```

### Helpers
```typescript
// helpers.ts
export const generateUniqueConfigKey = (baseKey: string, existingKeys: string[]): string => {
  let key = baseKey;
  let counter = 1;

  while (existingKeys.includes(key)) {
    key = `${baseKey}_${counter}`;
    counter++;
  }

  return key;
};

export const sanitizeConfigKey = (key: string): string => {
  return key.trim()
    .toLowerCase()
    .replace(/[^a-zA-Z0-9_.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');
};

export const compareConfigs = (a: IConfig, b: IConfig): number => {
  return a.key.localeCompare(b.key);
};

export const filterConfigsByPrefix = (configs: IConfig[], prefix: string): IConfig[] => {
  return configs.filter(config => 
    config.key.toLowerCase().startsWith(prefix.toLowerCase())
  );
};
```

## Type Utilities

### Type Guards
```typescript
// types.utils.ts
import type { IConfig } from '../types/config.module.generated';

export const isConfig = (obj: unknown): obj is IConfig => {
  return typeof obj === 'object'
    && obj !== null
    && 'id' in obj
    && 'key' in obj
    && 'value' in obj
    && typeof (obj as IConfig).id === 'string'
    && typeof (obj as IConfig).key === 'string'
    && typeof (obj as IConfig).value === 'string';
};

export const hasRequiredConfigFields = (obj: Partial<IConfig>): obj is Pick<IConfig, 'key' | 'value'> => {
  return Boolean(obj.key?.trim() && obj.value !== undefined);
};
```

## Import Patterns

### Type Imports
```typescript
// Always use type imports for interfaces
import type { IConfig, IConfigCreateData } from '../types/config.module.generated';
import type { IConfigRow } from '../types/database.generated';
```

### Constant Imports
```typescript
// Import constants from local utils
import { CONFIG_VALIDATION, CONFIG_DEFAULTS } from './constants';

// Import external constants
import { LogSource } from '@/modules/core/logger/types/index';
```

## Export Patterns

### Named Exports (Preferred)
```typescript
// Individual named exports
export const isValidConfigKey = (key: string): boolean => { /* ... */ };
export const formatConfigValue = (config: IConfig): string => { /* ... */ };
export const CONFIG_DEFAULTS = { /* ... */ } as const;
```

### Grouped Exports
```typescript
// Group related utilities
export const validators = {
  isValidConfigKey,
  isValidConfigValue,
  validateConfigCreateData
} as const;

export const formatters = {
  formatConfigDisplayName,
  formatConfigValue,
  formatConfigType
} as const;
```

## Testing Guidelines

### Unit Test Requirements
All utility functions **MUST** have unit tests:
```typescript
// validators.spec.ts
import { isValidConfigKey, isValidConfigValue } from '../validators';

describe('validators', () => {
  describe('isValidConfigKey', () => {
    it('should return true for valid key', () => {
      expect(isValidConfigKey('api.url')).toBe(true);
    });

    it('should return false for invalid key', () => {
      expect(isValidConfigKey('invalid key')).toBe(false);
    });
  });
});
```

### Test Coverage
- **100% line coverage** required for utility functions
- **Test edge cases** and boundary conditions
- **Test invalid inputs** and error conditions

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