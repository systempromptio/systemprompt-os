# Module Architecture Guide

SystemPrompt OS uses a two-tier module architecture to ensure proper initialization order and dependency management.

## Module Types

### 1. Self-Contained Core Modules (`/src/modules/core/`)

These are fundamental modules that bootstrap the system. They can only depend on other core modules and use a singleton pattern.

**Location**: `/src/modules/core/[logger|database|cli]`

**Characteristics**:
- ✅ Use singleton pattern with `getInstance()` method
- ✅ Export simple `initialize()` method
- ✅ Can ONLY depend on other core modules (not extension modules)
- ✅ Do NOT use TypeDI decorators (@Service, @Inject)
- ✅ Can be initialized directly without dependency injection
- ✅ Must have `bootstrap: true` in module.yaml
- ✅ Dependencies are resolved through direct imports, not injection

**Example Structure**:
```typescript
// /src/modules/core/logger/services/logger.service.ts
export class LoggerService {
  private static instance: LoggerService;
  
  private constructor() {} // Private constructor
  
  static getInstance(): LoggerService {
    this.instance ??= new LoggerService();
    return this.instance;
  }
  
  initialize(config: LoggerConfig): void {
    // Direct initialization
  }
}

// /src/modules/core/logger/index.ts
export function initialize(config: LoggerConfig): void {
  const logger = LoggerService.getInstance();
  logger.initialize(config);
}

// /src/modules/core/database/services/database.service.ts
import { LoggerService } from '@/modules/core/logger'; // Core modules can import other core modules

export class DatabaseService {
  private static instance: DatabaseService;
  private logger: LoggerService;
  
  private constructor() {
    this.logger = LoggerService.getInstance(); // Direct usage, not injection
  }
  
  static getInstance(): DatabaseService {
    this.instance ??= new DatabaseService();
    return this.instance;
  }
}
```

### 2. Extension Modules (`/src/modules/extension/`)

These are modules that extend the core functionality and can depend on core modules and each other through dependency injection.

**Location**: `/src/modules/extension/[config|auth|mcp|permissions|webhooks|...]`

**Characteristics**:
- ✅ Use TypeDI decorators (@Service, @Inject)
- ✅ Use constructor injection pattern
- ✅ Can depend on core modules and other extension modules
- ✅ Must NOT implement singleton pattern
- ✅ Must NOT have `bootstrap: true` in module.yaml
- ✅ Registered with TypeDI container during bootstrap

**Example Structure**:
```typescript
// /src/modules/extension/config/services/config.service.ts
import { Service, Inject } from 'typedi';
import { LOGGER_TOKEN } from '@/modules/core/logger';
import { DATABASE_TOKEN } from '@/modules/core/database';

@Service()
export class ConfigService {
  constructor(
    @Inject(LOGGER_TOKEN) private logger: ILogger,
    @Inject(DATABASE_TOKEN) private database: IDatabase
  ) {
    // Dependencies injected via constructor
  }
}

// /src/modules/extension/config/index.ts
import { Service, Inject } from 'typedi';

@Service('ConfigModule')
export class ConfigModule implements IModule {
  constructor(
    @Inject(LOGGER_TOKEN) private logger: ILogger,
    @Inject(DATABASE_TOKEN) private database: IDatabase
  ) {}
  
  async initialize(): Promise<void> {
    // Module initialization
  }
}
```

## Bootstrap Sequence

1. **Phase 1: Core Module Initialization**
   ```typescript
   // Initialize core modules in order
   await initializeLogger(config);
   await initializeDatabase(config);
   await initializeCLI(config);
   ```

2. **Phase 2: Register Core Services with TypeDI**
   ```typescript
   // Register core services for injection
   Container.set(LOGGER_TOKEN, LoggerService.getInstance());
   Container.set(DATABASE_TOKEN, DatabaseService.getInstance());
   Container.set(CLI_TOKEN, CLIService.getInstance());
   ```

3. **Phase 3: Initialize Extension Modules**
   ```typescript
   // TypeDI handles dependency injection
   const configModule = Container.get(ConfigModule);
   await configModule.initialize();
   ```

## Folder Structure

```
/src/modules/
├── core/                    # Self-contained bootstrap modules
│   ├── logger/             # Zero dependencies
│   │   ├── index.ts        # Exports initialize() function
│   │   ├── services/       # Singleton service
│   │   ├── types/          # Type definitions
│   │   └── module.yaml     # bootstrap: true
│   ├── database/           # Zero dependencies
│   │   └── ...
│   └── cli/                # Zero dependencies
│       └── ...
│
└── extension/              # TypeDI managed modules
    ├── config/            # Depends on logger, database
    │   ├── index.ts       # @Service decorated class
    │   ├── services/      # @Service decorated services
    │   ├── types/         # Type definitions
    │   └── module.yaml    # No bootstrap property
    ├── auth/              # Depends on config, database, logger
    │   └── ...
    ├── mcp/               # Depends on multiple modules
    │   └── ...
    └── ...
```

## Linting Rules

The following ESLint rules enforce this architecture:

1. **`enforce-core-module-pattern`**: Ensures core modules have zero dependencies and use singleton pattern
2. **`enforce-extension-module-pattern`**: Ensures extension modules use constructor injection
3. **`enforce-module-location`**: Ensures modules are in the correct folder based on their type
4. **`enforce-module-yaml-bootstrap`**: Ensures only core modules have `bootstrap: true`

## Key Principles

1. **Limited Dependencies for Core**: Core modules can only depend on other core modules, never extension modules
2. **Constructor Injection for Extension**: All dependencies must be injected via constructor
3. **Clear Initialization Order**: Core modules first (respecting their dependencies), then extension modules
4. **Type Safety**: Use tokens for dependency injection to maintain type safety
5. **Testability**: Both patterns support easy unit testing with mocks
6. **Direct Access in Core**: Core modules use getInstance() to access other core modules, not dependency injection

## Migration Guide

To convert a module from extension to core:
1. Move from `/src/modules/extension/` to `/src/modules/core/`
2. Remove all @Service and @Inject decorators
3. Implement singleton pattern with getInstance()
4. Remove all module dependencies
5. Add `bootstrap: true` to module.yaml
6. Export initialize() function

To convert a module from core to extension:
1. Move from `/src/modules/core/` to `/src/modules/extension/`
2. Remove singleton pattern
3. Add @Service decorator
4. Add constructor with @Inject decorators for dependencies
5. Remove `bootstrap: true` from module.yaml
6. Remove initialize() export