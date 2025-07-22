# SystemPrompt OS Module Development Rules

## Overview

This document provides comprehensive rules and guidelines for developing modules in SystemPrompt OS. All modules MUST strictly adhere to these standards to ensure consistency, maintainability, security, and quality across the system.

## 1. Module Structure Requirements

### 1.1 Directory Structure (MANDATORY)

Every module MUST follow this exact directory structure:

```
module-name/
├── module.yaml           # Module manifest (REQUIRED)
├── index.ts             # Module entry point (REQUIRED)
├── README.md            # Module documentation (REQUIRED)
├── cli/                 # CLI commands
│   └── *.ts            # Command implementations
├── database/            # Database schemas
│   ├── init.sql        # Initial schema
│   ├── schema.sql      # Full schema definition
│   └── migrations/     # Migration scripts (YYYY-MM-DD-description.sql)
├── services/            # Business logic
│   └── *.service.ts    # Service classes
├── repositories/        # Data access layer
│   └── *.repository.ts # Repository classes
├── types/               # TypeScript definitions
│   └── index.ts        # Type exports
├── tools/               # Tool definitions (if applicable)
│   └── *.tool.ts       # Tool implementations
├── providers/           # Provider implementations (if applicable)
│   └── *.provider.ts   # Provider classes
├── utils/               # Module utilities
│   └── *.ts            # Utility functions
└── tests/               # Module tests
    ├── unit/           # Unit tests
    └── integration/    # Integration tests
```

### 1.2 Module Manifest (module.yaml)

Every module MUST have a valid `module.yaml` with ALL required fields:

```yaml
# REQUIRED FIELDS
name: string              # Module identifier (lowercase, kebab-case, no spaces)
type: string              # One of: service, daemon, plugin, core, extension
version: string           # Semantic version (e.g., "1.0.0")
description: string       # Brief description (max 200 chars)
author: string            # Module author (name <email>)

# OPTIONAL FIELDS
dependencies:             # Array of module names this module depends on
  - logger               # Logger is usually required
  - database             # If using database

config:                   # Module configuration with defaults
  key: value
  path: ${ENV_VAR:-default}

cli:                      # CLI command definitions
  commands:
    - name: string
      description: string
      options: []
      subcommands: []
      positionals: []

exports:                  # What this module exports
  - services
  - types
  - utils

singleton: boolean        # Whether module should be singleton (default: false)
enabled: boolean          # Whether module is enabled by default (default: true)
```

## 2. Module Interface Implementation

### 2.1 Required Interface (MANDATORY)

ALL modules MUST implement this exact interface:

```typescript
export interface ModuleInterface {
  name: string;           // Must match module.yaml name
  version: string;        // Must match module.yaml version
  type: 'service' | 'daemon' | 'plugin' | 'core' | 'extension';
  
  // Lifecycle methods - ALL REQUIRED
  initialize(context: ModuleContext): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; message?: string }>;
  
  // Optional exports
  exports?: any;
}

interface ModuleContext {
  config?: any;           // Module-specific configuration
  logger?: Logger;        // Logger instance
}
```

### 2.2 Implementation Example

```typescript
import { ModuleInterface, ModuleContext } from '@/modules/types';
import { Logger } from '@/modules/core/logger/types';

export class MyModule implements ModuleInterface {
  name = 'my-module';     // MUST match module.yaml
  version = '1.0.0';      // MUST match module.yaml
  type: 'service' = 'service';
  
  private config: any;
  private logger?: Logger;
  private initialized = false;
  
  async initialize(context: ModuleContext): Promise<void> {
    if (this.initialized) {
      throw new Error(`Module ${this.name} already initialized`);
    }
    
    this.config = context.config || {};
    this.logger = context.logger;
    
    // Perform initialization
    this.logger?.info(`Initializing module ${this.name}`);
    
    this.initialized = true;
  }
  
  async start(): Promise<void> {
    if (!this.initialized) {
      throw new Error(`Module ${this.name} not initialized`);
    }
    
    this.logger?.info(`Starting module ${this.name}`);
    // Start services
  }
  
  async stop(): Promise<void> {
    this.logger?.info(`Stopping module ${this.name}`);
    // Cleanup resources
  }
  
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    // Perform health checks
    return { 
      healthy: true, 
      message: `Module ${this.name} is healthy` 
    };
  }
  
  // Optional exports
  get exports() {
    return {
      services: {
        myService: MyService.getInstance()
      }
    };
  }
}

// Export default instance
export default new MyModule();
```

## 3. Import Convention Rules

### 3.1 Import Path Requirements (MANDATORY)

All modules MUST use absolute imports with the `@` prefix. Relative imports are PROHIBITED.

```typescript
// ❌ WRONG - Never use relative imports
import { SomeType } from '../../../types';
import { Logger } from '../logger/types';
import { Database } from './database';

// ✅ CORRECT - Always use @ imports
import { SomeType } from '@/modules/types';
import { Logger } from '@/modules/core/logger/types';
import { Database } from '@/modules/core/database';
```

### 3.2 Import Organization

Imports MUST be organized in this order:
1. Node.js built-in modules
2. External npm packages
3. Internal @ imports (sorted alphabetically)
4. Module-specific imports

```typescript
// 1. Node.js built-ins
import fs from 'fs';
import path from 'path';

// 2. External packages
import express from 'express';
import { z } from 'zod';

// 3. Internal @ imports
import { ModuleInterface } from '@/modules/types';
import { createModuleAdapter } from '@/modules/core/database/adapters/module-adapter';
import { Logger } from '@/modules/core/logger/types';

// 4. Module-specific imports
import { MyService } from './services/my.service';
import { MyRepository } from './repositories/my.repository';
```

## 4. Database Integration Rules

### 4.1 Database Adapter Usage (MANDATORY for database modules)

Modules MUST use the standardized database adapter:

```typescript
import { createModuleAdapter } from '@/modules/core/database/adapters/module-adapter';
import { ModuleDatabaseAdapter } from '@/modules/core/database/types';

class MyRepository {
  private db: ModuleDatabaseAdapter;
  
  async initialize(): Promise<void> {
    this.db = await createModuleAdapter('my-module');
  }
  
  async findById(id: string): Promise<any> {
    const result = await this.db.query(
      'SELECT * FROM my_table WHERE id = ?',
      [id]
    );
    return result[0];
  }
}
```

### 4.2 Schema Requirements

Database schemas MUST follow these rules:

1. **schema.sql**: Complete schema definition
2. **init.sql**: Initial data/setup
3. **migrations/**: Named as `YYYY-MM-DD-description.sql`

Example schema.sql:
```sql
-- Module: my-module
-- Version: 1.0.0
-- Description: Schema for my-module

CREATE TABLE IF NOT EXISTS my_module_entities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_my_module_entities_name ON my_module_entities(name);
```

### 4.3 Repository Pattern (MANDATORY)

Use repository pattern for ALL database access:

```typescript
export class EntityRepository {
  constructor(private db: ModuleDatabaseAdapter) {}
  
  async create(entity: Entity): Promise<Entity> {
    // Implementation
  }
  
  async findById(id: string): Promise<Entity | null> {
    // Implementation
  }
  
  async update(id: string, updates: Partial<Entity>): Promise<Entity> {
    // Implementation
  }
  
  async delete(id: string): Promise<void> {
    // Implementation
  }
}
```

## 4. TypeScript Standards

### 4.1 Strict TypeScript Rules (MANDATORY)

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### 4.2 Type Definition Rules

1. **NO `any` types** - Use proper types or `unknown`
2. **Define interfaces** for all data structures
3. **Export types** from `types/index.ts`
4. **Use generics** where appropriate
5. **Document complex types** with JSDoc

Example:
```typescript
// types/index.ts

/**
 * Entity representing a user in the system
 */
export interface User {
  id: string;
  email: string;
  name: string;
  roles: Role[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
}

export type Permission = 'read' | 'write' | 'delete' | 'admin';

// NO any types!
// Bad: function process(data: any): any
// Good: function process<T>(data: T): ProcessResult<T>
```

## 5. Service Architecture Rules

### 5.1 Service Pattern (MANDATORY)

Services MUST follow singleton pattern:

```typescript
export class MyService {
  private static instance: MyService;
  private initialized = false;
  
  private constructor() {}
  
  static getInstance(): MyService {
    if (!this.instance) {
      this.instance = new MyService();
    }
    return this.instance;
  }
  
  async initialize(config: ServiceConfig): Promise<void> {
    if (this.initialized) {
      throw new Error('Service already initialized');
    }
    // Initialize service
    this.initialized = true;
  }
  
  // Service methods with proper error handling
  async performAction(input: Input): Promise<Output> {
    if (!this.initialized) {
      throw new Error('Service not initialized');
    }
    
    try {
      // Implementation
    } catch (error) {
      this.logger?.error('Action failed', { error, input });
      throw new ServiceError('Action failed', error);
    }
  }
}
```

### 5.2 Dependency Injection

Use constructor injection for dependencies:

```typescript
export class UserService {
  constructor(
    private readonly repository: UserRepository,
    private readonly logger: Logger,
    private readonly config: UserServiceConfig
  ) {}
  
  // Service methods
}
```

## 6. CLI Command Standards

### 6.1 Command Structure (MANDATORY)

Commands MUST follow this pattern:

```typescript
import { CLICommand, CLIContext } from '@/modules/types';

export const command: CLICommand = {
  name: 'action',  // Will be called as module:action
  description: 'Brief description (max 80 chars)',
  options: [
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format',
      required: false,
      default: 'table',
      choices: ['json', 'yaml', 'table']
    }
  ],
  async execute(context: CLIContext): Promise<void> {
    try {
      // Validate inputs
      // Perform action
      // Format output
      console.log(result);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  }
};
```

### 6.2 Command Naming Rules

1. Use kebab-case for command names
2. Follow pattern: `module:action` or `module:subdomain:action`
3. Use standard action verbs: list, get, create, update, delete, enable, disable, start, stop, status
4. Be consistent with similar commands in other modules

## 7. Error Handling Standards

### 7.1 Custom Error Classes (MANDATORY)

Define module-specific error classes:

```typescript
export class ModuleError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ModuleError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends ModuleError {
  constructor(message: string, cause?: Error) {
    super(message, 'VALIDATION_ERROR', 400, cause);
    this.name = 'ValidationError';
  }
}
```

### 7.2 Error Handling Pattern

```typescript
async function handleRequest(): Promise<Result> {
  try {
    // Validate input
    if (!isValid(input)) {
      throw new ValidationError('Invalid input');
    }
    
    // Perform operation
    const result = await operation();
    return result;
    
  } catch (error) {
    // Log error with context
    logger.error('Operation failed', {
      error,
      input,
      context: getCurrentContext()
    });
    
    // Re-throw or handle appropriately
    if (error instanceof ModuleError) {
      throw error;
    }
    
    throw new ModuleError(
      'Operation failed',
      'OPERATION_FAILED',
      500,
      error as Error
    );
  }
}
```

## 8. Logging Standards

### 8.1 Logger Usage (MANDATORY)

All modules MUST use the centralized logger:

```typescript
// Correct log levels
logger.debug('Detailed debug information', { data });
logger.info('Normal operation', { action: 'created', id });
logger.warn('Warning condition', { issue: 'deprecated' });
logger.error('Error occurred', { error, context });

// Structured logging with context
logger.info('User action', {
  module: this.name,
  action: 'login',
  userId: user.id,
  timestamp: new Date().toISOString()
});
```

### 8.2 Log Level Guidelines

- **DEBUG**: Detailed information for debugging
- **INFO**: General informational messages
- **WARN**: Warning conditions that might need attention
- **ERROR**: Error conditions that need immediate attention

## 9. Testing Requirements

### 9.1 Test Coverage (MANDATORY: >90%)

All modules MUST achieve:
- Minimum 90% code coverage
- 100% coverage for critical paths
- Unit tests for all services and utilities
- Integration tests for CLI commands
- End-to-end tests for complex workflows

### 9.2 Test Structure

```typescript
// tests/unit/services/my-service.spec.ts
describe('MyService', () => {
  let service: MyService;
  let mockRepository: jest.Mocked<MyRepository>;
  
  beforeEach(() => {
    mockRepository = createMockRepository();
    service = new MyService(mockRepository);
  });
  
  describe('performAction', () => {
    it('should perform action successfully', async () => {
      // Arrange
      const input = { id: '123' };
      const expected = { id: '123', result: 'success' };
      mockRepository.findById.mockResolvedValue(expected);
      
      // Act
      const result = await service.performAction(input);
      
      // Assert
      expect(result).toEqual(expected);
      expect(mockRepository.findById).toHaveBeenCalledWith('123');
    });
    
    it('should handle errors gracefully', async () => {
      // Test error scenarios
    });
  });
});
```

## 10. Security Standards

### 10.1 Security Requirements

1. **Input Validation**: Validate ALL inputs
2. **SQL Injection**: Use parameterized queries ONLY
3. **Authentication**: Verify permissions for sensitive operations
4. **Secrets**: NEVER hardcode secrets or log sensitive data
5. **Dependencies**: Keep dependencies updated and audited

### 10.2 Security Patterns

```typescript
// Input validation
function validateInput(input: unknown): ValidInput {
  if (!isValidInput(input)) {
    throw new ValidationError('Invalid input format');
  }
  return input as ValidInput;
}

// Permission checking
async function checkPermission(user: User, action: string): Promise<void> {
  if (!hasPermission(user, action)) {
    throw new ForbiddenError(`User lacks permission for ${action}`);
  }
}

// Secure database queries
async function getUser(id: string): Promise<User> {
  // Always use parameterized queries
  const result = await db.query(
    'SELECT * FROM users WHERE id = ? AND deleted_at IS NULL',
    [id]  // Parameters prevent SQL injection
  );
  return result[0];
}
```

## 11. Performance Standards

### 11.1 Performance Requirements

1. **Module initialization**: < 100ms
2. **Health check response**: < 50ms
3. **Database queries**: Use indexes and pagination
4. **Memory usage**: Monitor and limit memory consumption
5. **Async operations**: Use proper async/await patterns

### 11.2 Performance Patterns

```typescript
// Pagination for large datasets
async function listEntities(options: ListOptions): Promise<PaginatedResult> {
  const { page = 1, limit = 20, sort = 'created_at' } = options;
  const offset = (page - 1) * limit;
  
  const [items, total] = await Promise.all([
    db.query(
      `SELECT * FROM entities ORDER BY ${sort} LIMIT ? OFFSET ?`,
      [limit, offset]
    ),
    db.query('SELECT COUNT(*) as total FROM entities')
  ]);
  
  return {
    items,
    total: total[0].total,
    page,
    limit,
    pages: Math.ceil(total[0].total / limit)
  };
}

// Caching for expensive operations
class CachedService {
  private cache = new Map<string, CacheEntry>();
  
  async getData(key: string): Promise<Data> {
    const cached = this.cache.get(key);
    if (cached && !isExpired(cached)) {
      return cached.data;
    }
    
    const data = await this.fetchData(key);
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    return data;
  }
}
```

## 12. Documentation Standards

### 12.1 README.md Requirements (MANDATORY)

Every module MUST have a comprehensive README.md:

```markdown
# Module Name

## Overview
Brief description of what this module does.

## Features
- Feature 1
- Feature 2

## Installation
\`\`\`bash
# Installation steps
\`\`\`

## Configuration
\`\`\`yaml
# Example configuration
\`\`\`

## Usage

### CLI Commands
\`\`\`bash
# Command examples
systemprompt module:command --option value
\`\`\`

### API Usage
\`\`\`typescript
// Code examples
\`\`\`

## Architecture
Description of module architecture and design decisions.

## Dependencies
- List of dependencies and why they're needed

## Development
### Testing
\`\`\`bash
npm test
\`\`\`

### Building
\`\`\`bash
npm run build
\`\`\`

## License
[License information]
```

### 12.2 Code Documentation

Use JSDoc for all public APIs:

```typescript
/**
 * Service for managing user accounts
 * @example
 * const userService = UserService.getInstance();
 * const user = await userService.createUser({ email: 'test@example.com' });
 */
export class UserService {
  /**
   * Creates a new user account
   * @param data - User creation data
   * @returns The created user
   * @throws {ValidationError} If data is invalid
   * @throws {ConflictError} If user already exists
   */
  async createUser(data: CreateUserData): Promise<User> {
    // Implementation
  }
}
```

## 13. Module Lifecycle Management

### 13.1 Initialization Order

1. Validate module manifest
2. Check dependencies
3. Initialize with context
4. Register with module registry
5. Start if daemon type

### 13.2 Shutdown Sequence

1. Stop accepting new requests
2. Complete in-flight operations
3. Close database connections
4. Release resources
5. Log shutdown complete

## 14. Validation and Enforcement

### 14.1 Pre-commit Validation

All modules MUST pass validation before commit:

```bash
# Run validation
systemprompt extension:validate my-module

# Validation checks:
✓ Module structure correct
✓ module.yaml valid
✓ TypeScript compilation successful
✓ ESLint rules pass
✓ Tests pass with >90% coverage
✓ No security vulnerabilities
✓ Documentation complete
```

### 14.2 CI/CD Pipeline Checks

1. Automated validation on PR
2. Security scanning
3. Performance benchmarking
4. Integration testing
5. Documentation generation

## 15. Common Pitfalls to Avoid

### 15.1 Module Development Anti-patterns

1. ❌ Using `any` type
2. ❌ Direct database access without adapter
3. ❌ Hardcoded configuration values
4. ❌ Missing error handling
5. ❌ Synchronous blocking operations
6. ❌ Circular dependencies
7. ❌ Global state modification
8. ❌ Missing health checks
9. ❌ Inadequate logging
10. ❌ Poor test coverage

### 15.2 Best Practices Checklist

- ✅ Use TypeScript strict mode
- ✅ Implement all required interface methods
- ✅ Use dependency injection
- ✅ Follow repository pattern for data access
- ✅ Implement comprehensive error handling
- ✅ Use structured logging
- ✅ Write comprehensive tests (>90% coverage)
- ✅ Document all public APIs
- ✅ Validate all inputs
- ✅ Handle graceful shutdown

## 16. Module Certification Process

### 16.1 Certification Requirements

To be certified, a module must:

1. **Pass structural validation** - Correct files and directories
2. **Implement required interface** - All methods present and functional
3. **Pass TypeScript compilation** - No type errors with strict mode
4. **Pass linting** - No ESLint violations
5. **Achieve test coverage** - Minimum 90% coverage
6. **Pass security audit** - No known vulnerabilities
7. **Meet performance benchmarks** - Within acceptable limits
8. **Have complete documentation** - README and API docs
9. **Handle errors properly** - Graceful error handling
10. **Integrate with core systems** - Logger, database, config

### 16.2 Certification Levels

- **Bronze**: Meets basic requirements (1-5)
- **Silver**: Meets all requirements (1-8)
- **Gold**: Exceeds requirements with exemplary implementation (1-10)

## Conclusion

These rules ensure that all SystemPrompt OS modules maintain the highest standards of quality, security, and maintainability. Strict adherence to these guidelines is mandatory for all module developers. Modules that do not meet these standards will be rejected during the review process and will not be integrated into the system.

For questions or clarifications, refer to the example modules in the core system or contact the SystemPrompt OS maintainers.