# SystemPrompt OS Module System Documentation

## Overview

SystemPrompt OS uses a modular architecture where functionality is organized into discrete, self-contained modules. Each module provides specific capabilities to the system and can be independently configured, enabled, or disabled.

## Module Structure

### Directory Structure

Every module follows this standardized directory structure:

```
module-name/
├── module.yaml           # Module manifest (REQUIRED)
├── index.ts             # Module entry point (REQUIRED)
├── README.md            # Module documentation
├── cli/                 # CLI commands
│   └── *.ts            # Command implementations
├── database/            # Database schemas
│   ├── init.sql        # Initial schema
│   ├── schema.sql      # Full schema definition
│   └── migrations/     # Migration scripts
├── services/            # Business logic
│   └── *.service.ts    # Service classes
├── repositories/        # Data access layer
│   └── *.repository.ts # Repository classes
├── types/               # TypeScript definitions
│   └── *.ts            # Type definitions
├── tools/               # Tool definitions
│   └── *.tool.ts       # Tool implementations
├── providers/           # Provider implementations
│   └── *.ts            # Provider classes
└── utils/               # Module utilities
    └── *.ts            # Utility functions
```

### Module Interface

All modules MUST implement the following interface:

```typescript
export interface ModuleInterface {
  name: string;      // Unique module identifier
  version: string;   // Semantic version (e.g., "1.0.0")
  type: 'service' | 'daemon' | 'plugin' | 'core' | 'extension';
  
  // Lifecycle methods
  initialize(context: ModuleContext): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; message?: string }>;
  
  // Optional exports
  exports?: any;
}

interface ModuleContext {
  config?: any;      // Module-specific configuration
  logger?: Logger;   // Logger instance
}
```

## Module Manifest (module.yaml)

Every module MUST have a `module.yaml` file with the following structure:

### Required Fields

```yaml
name: string          # Module identifier (lowercase, no spaces)
type: string          # One of: service, daemon, plugin
version: string       # Semantic version
description: string   # Brief description
author: string        # Module author
```

### Optional Fields

```yaml
dependencies:         # Array of module names this module depends on
  - logger
  - database

config:               # Module configuration with defaults
  key: value
  path: ${ENV_VAR:-default}  # Environment variable substitution

cli:                  # CLI command definitions
  commands:
    - name: string
      description: string
      options:
        - name: string
          alias: string
          type: string|boolean|number
          description: string
          required: boolean
          default: any
          choices: [...]
      subcommands: [...]
      positionals: [...]

apis:                 # API endpoints exposed by module
  - name: string
    description: string

exports:              # What this module exports
  - services
  - adapters
  - types

singleton: boolean    # Whether module should be singleton
enabled: boolean      # Whether module is enabled by default
```

## Module Types

### 1. Service Modules
- Provide functionality to other modules
- Run when requested
- Examples: auth, database, config

### 2. Daemon Modules
- Run continuously in background
- Monitor system state
- Examples: heartbeat

### 3. Plugin Modules
- Extend system functionality
- Optional enhancements
- Examples: custom providers

### 4. Core Modules
- Essential system functionality
- Cannot be disabled
- Examples: logger, cli

### 5. Extension Modules
- Third-party extensions
- Dynamic loading
- Examples: custom tools

## Implementation Patterns

### 1. Class-Based Implementation

```typescript
export class MyModule implements ModuleInterface {
  name = 'mymodule';
  version = '1.0.0';
  type: 'service' = 'service';
  
  private config: any;
  private logger?: Logger;
  
  async initialize(context: ModuleContext): Promise<void> {
    this.config = context.config || {};
    this.logger = context.logger;
    // Setup module
  }
  
  async start(): Promise<void> {
    // Start services
  }
  
  async stop(): Promise<void> {
    // Cleanup
  }
  
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    return { healthy: true };
  }
}
```

### 2. Function-Based Implementation

```typescript
export const name = 'mymodule';
export const version = '1.0.0';
export const type = 'service';

export async function initialize(context: ModuleContext): Promise<void> {
  // Setup
}

export async function start(): Promise<void> {
  // Start
}

export async function stop(): Promise<void> {
  // Stop
}

export async function healthCheck(): Promise<{ healthy: boolean; message?: string }> {
  return { healthy: true };
}
```

## Module Loading

Modules are loaded by the ModuleLoader in this order:

1. Read `modules.json` configuration
2. Load core modules in dependency order:
   - logger (first, if enabled)
   - database (before auth)
   - heartbeat
   - auth
   - prompts
   - resources
   - tools
3. Initialize all modules with context
4. Start daemon modules if configured

## CLI Integration

### Command Structure

CLI commands follow this pattern:

```typescript
import { CLICommand, CLIContext } from '../../../types';

export const command: CLICommand = {
  name: 'mycommand',
  description: 'Command description',
  options: [
    {
      name: 'option',
      alias: 'o',
      type: 'string',
      description: 'Option description',
      required: false,
      default: 'value'
    }
  ],
  async execute(context: CLIContext): Promise<void> {
    try {
      // Command implementation
      console.log('Command executed');
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  }
};
```

### Command Discovery

Commands are discovered from `module.yaml` and mapped as `module:command`.

## Database Integration

### Schema Management

Modules requiring database access should:

1. Define schema in `database/schema.sql`
2. Provide initialization in `database/init.sql`
3. Add migrations in `database/migrations/`
4. Use repository pattern for data access

### Database Adapter

```typescript
import { createModuleAdapter } from '../../database/adapters/module-adapter';

const db = await createModuleAdapter('mymodule');
const result = await db.query('SELECT * FROM table WHERE id = ?', [id]);
```

## Service Architecture

### Service Pattern

```typescript
export class MyService {
  private static instance: MyService;
  
  static getInstance(): MyService {
    if (!this.instance) {
      this.instance = new MyService();
    }
    return this.instance;
  }
  
  // Service methods
}
```

### Repository Pattern

```typescript
export class MyRepository {
  constructor(private db: ModuleDatabaseAdapter) {}
  
  async findById(id: string): Promise<MyEntity> {
    const result = await this.db.query(
      'SELECT * FROM entities WHERE id = ?',
      [id]
    );
    return result[0];
  }
}
```

## Configuration

### Module Configuration

Modules receive configuration through:

1. Global `modules.json` file
2. Module-specific config section
3. Environment variables with `${VAR:-default}` syntax
4. Runtime configuration updates

### Configuration Access

```typescript
class MyModule {
  private config: MyModuleConfig;
  
  async initialize(context: ModuleContext): Promise<void> {
    this.config = {
      ...DEFAULT_CONFIG,
      ...context.config
    };
  }
}
```

## Best Practices

### 1. Module Independence
- Minimize dependencies
- Use dependency injection
- Avoid circular dependencies

### 2. Error Handling
- Always implement try-catch in critical paths
- Return meaningful error messages
- Use health checks for monitoring

### 3. Type Safety
- Define TypeScript interfaces for all data structures
- Use strict typing for module exports
- Validate inputs and outputs

### 4. Testing
- Unit test services and utilities
- Integration test CLI commands
- Mock external dependencies

### 5. Documentation
- Include README.md with usage examples
- Document all CLI commands
- Provide configuration examples

## Module Development Workflow

1. **Create Module Structure**
   ```bash
   mkdir -p src/modules/core/mymodule/{cli,services,types,database}
   ```

2. **Define module.yaml**
   ```yaml
   name: mymodule
   type: service
   version: 1.0.0
   description: My module description
   author: Your Name
   dependencies:
     - logger
     - database
   ```

3. **Implement Module Interface**
   Create `index.ts` implementing ModuleInterface

4. **Add CLI Commands**
   Create command files in `cli/` directory

5. **Define Types**
   Add TypeScript definitions in `types/`

6. **Implement Services**
   Create service classes in `services/`

7. **Test Module**
   Write tests for all components

8. **Document Module**
   Create comprehensive README.md

## Module Registry

The ModuleRegistry manages all loaded modules:

```typescript
class ModuleRegistry {
  register(module: ModuleInterface): void
  get(name: string): ModuleInterface | undefined
  getAll(): ModuleInterface[]
  has(name: string): boolean
  initializeAll(context: any): Promise<void>
  shutdownAll(): Promise<void>
}
```

## Enforcement Recommendations

To strictly enforce the module system:

### 1. Schema Validation
Implement JSON Schema validation for module.yaml files to ensure all required fields and correct types.

### 2. TypeScript Strict Mode
Enable strict TypeScript checking for all module code with a dedicated tsconfig.

### 3. Linting Rules
Create ESLint rules to enforce:
- Module interface implementation
- Directory structure
- Naming conventions
- Import restrictions

### 4. Module Template
Provide a module generator CLI command:
```bash
systemprompt module:create --name mymodule --type service
```

### 5. CI/CD Checks
Add automated checks in CI pipeline:
- Validate module.yaml structure
- Check interface implementation
- Verify directory structure
- Run module tests

### 6. Module Certification
Implement a certification process:
- Automated validation
- Security review
- Performance benchmarks
- Documentation completeness

### 7. Runtime Validation
Add runtime checks in ModuleLoader:
- Validate module exports match interface
- Check dependency availability
- Verify configuration schema
- Monitor resource usage

## Conclusion

The SystemPrompt OS module system provides a flexible yet structured approach to extending system functionality. By following these guidelines and patterns, developers can create maintainable, testable, and interoperable modules that integrate seamlessly with the core system.