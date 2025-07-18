# Module System

The systemprompt-os module system provides a flexible, extensible architecture for organizing functionality into self-contained modules.

## Module Types

### 1. Service Modules
Service modules provide core functionality that other modules depend on. They are initialized once and remain available throughout the system lifecycle.

**Examples:**
- `logger` - System-wide logging service
- `scheduler` - Task scheduling service
- `event-bus` - Inter-module communication

**Interface:**
```typescript
interface ServiceModule<T> extends Module {
  type: 'service';
  getService(): T;
}
```

### 2. Daemon Modules
Daemon modules are long-running background processes that perform continuous tasks.

**Examples:**
- `heartbeat` - System health monitoring
- `metrics-collector` - Performance metrics collection
- `garbage-collector` - Cleanup tasks

**Interface:**
```typescript
interface DaemonModule extends Module {
  type: 'daemon';
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
}
```

### 3. Plugin Modules
Plugin modules extend system capabilities and are loaded on-demand.

**Examples:**
- `memory-redis` - Redis memory provider
- `auth-oauth2` - OAuth2 authentication
- `storage-s3` - S3 storage backend

**Interface:**
```typescript
interface PluginModule extends Module {
  type: 'plugin';
  provides: string | string[];
  requires?: string[];
  load(): Promise<void>;
  unload?(): Promise<void>;
}
```

## Module Structure

Each module follows this directory structure:

```
module-name/
├── module.yaml      # Module configuration
├── index.ts        # Main module implementation
├── types.ts        # TypeScript types (optional)
├── cli/            # CLI commands (optional)
│   └── command.ts
├── tests/          # Module tests
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── README.md       # Module documentation
```

## Module Configuration (module.yaml)

```yaml
name: module-name
type: service|daemon|plugin
version: 1.0.0
description: Brief description of the module
singleton: true  # For service modules
provides: auth   # For plugin modules
requires:        # Dependencies
  - logger
  - config
config:          # Module-specific configuration
  key: value
cli:             # CLI commands
  commands:
    - name: status
      description: Show module status
```

## Creating a Module

### 1. Service Module Example

```typescript
// modules/custom/my-service/index.ts
import { ServiceModule } from '../../../src/interfaces/service.js';

export class MyServiceModule implements ServiceModule<MyService> {
  public readonly name = 'my-service';
  public readonly type = 'service' as const;
  public readonly version = '1.0.0';
  public readonly description = 'My custom service';

  async initialize(): Promise<void> {
    // Initialize service
  }

  async shutdown(): Promise<void> {
    // Cleanup
  }

  getService(): MyService {
    return {
      doSomething: () => { /* ... */ }
    };
  }
}
```

### 2. Daemon Module Example

```typescript
// modules/custom/my-daemon/index.ts
import { DaemonModule } from '../../../src/interfaces/daemon.js';

export class MyDaemonModule implements DaemonModule {
  public readonly name = 'my-daemon';
  public readonly type = 'daemon' as const;
  public readonly version = '1.0.0';
  public readonly description = 'My background daemon';
  
  private running = false;

  async initialize(): Promise<void> {
    // Setup daemon
  }

  async start(): Promise<void> {
    this.running = true;
    // Start background task
  }

  async stop(): Promise<void> {
    this.running = false;
    // Stop background task
  }

  isRunning(): boolean {
    return this.running;
  }

  async shutdown(): Promise<void> {
    await this.stop();
  }
}
```

## Module Registry

The module registry manages all loaded modules:

```typescript
import { ModuleRegistry } from './registry.js';

const registry = new ModuleRegistry();

// Register modules
registry.register(new LoggerModule(config));
registry.register(new HeartbeatModule(config));

// Initialize all modules
await registry.initializeAll();

// Get a specific module
const logger = registry.get('logger');

// Get all modules of a type
const daemons = registry.getByType('daemon');

// Shutdown all modules
await registry.shutdownAll();
```

## Module Dependencies

Modules can declare dependencies on other modules:

```yaml
# module.yaml
requires:
  - logger
  - config
  - scheduler
```

The module system ensures dependencies are initialized before dependent modules.

## Module CLI Commands

Modules can provide CLI commands by including a `cli/` directory:

```typescript
// modules/my-module/cli/status.ts
export const statusCommand = {
  name: 'status',
  description: 'Show module status',
  execute: async () => {
    // Command implementation
  }
};
```

Commands are namespaced by module: `systemprompt my-module:status`

## Best Practices

1. **Single Responsibility**: Each module should have one clear purpose
2. **Configuration**: Use module.yaml for all configuration
3. **Interfaces**: Depend on interfaces, not implementations
4. **Error Handling**: Gracefully handle initialization and shutdown errors
5. **Testing**: Include comprehensive tests in the module directory
6. **Documentation**: Always include a README.md with usage examples

## Core Modules

The following core modules are included:

- **logger**: System-wide logging with file and console output
- **heartbeat**: System health monitoring daemon
- **scheduler**: Task scheduling service (planned)
- **oauth2**: OAuth2 authentication provider (planned)