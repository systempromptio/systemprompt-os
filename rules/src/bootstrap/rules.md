# Bootstrap Rules

## Overview

The bootstrap system is responsible for initializing SystemPrompt OS in a deterministic, ordered manner. It manages module lifecycle, dependency resolution, and sequential initialization.

## Core Principles

1. **Deterministic Order**: Modules must load in a predictable order based on dependencies
2. **Simple Sequential Loading**: Load modules one by one in dependency order
3. **Fail Fast**: Critical module failures stop bootstrap immediately
4. **Clean Shutdown**: All modules must cleanly release resources on shutdown
5. **Configuration from Source**: Use module.yaml files, no hardcoded lists

## Bootstrap Process

### Simple Sequential Steps
```
LOGGER → MODULES_MODULE → DELEGATE_TO_MODULES_SERVICE → READY
```

### Step Definitions

1. **LOGGER**: Initialize logger module first using `createLoggerModuleForBootstrap()`
2. **MODULES_MODULE**: Initialize the modules module which manages all other modules
3. **DELEGATE_TO_MODULES_SERVICE**: Use modules module services to handle all subsequent module loading
4. **READY**: System fully operational, `isReady = true`

### Architectural Components

The bootstrap leverages the modules module's comprehensive service architecture:

- **CoreModuleLoaderService**: Handles loading and initialization of core system modules
- **ModuleRegistryService**: Manages registration and lifecycle of all loaded modules
- **ModuleLoaderService**: General module loading with dependency management
- **ModulesModuleService**: Orchestrates all module operations

This design eliminates duplication and ensures all module management logic is centralized in the modules module.

## Module Lifecycle

### Module Compatibility Requirements

All modules MUST follow the lifecycle requirements defined in `/var/www/html/systemprompt-os/rules/src/modules/core/{module}/rules.md`:
- Extend `BaseModule` class for consistent lifecycle management
- Implement required lifecycle methods for critical modules
- Maintain correct status transitions
- Declare dependencies in module.yaml

### Required Interface
```typescript
interface IModule<TExports = unknown> {
  // Identity
  readonly name: string;
  readonly version: string;
  readonly type: ModulesType;
  readonly dependencies?: readonly string[];
  
  // State
  status: ModulesStatus;
  readonly exports: TExports;
  
  // Lifecycle methods
  initialize(): Promise<void>;    // Required: one-time setup
  start?(): Promise<void>;        // Optional: begin operations (REQUIRED for critical modules)
  stop?(): Promise<void>;         // Optional: cleanup resources
  health?(): Promise<HealthStatus>; // Optional: health check
}
```

### Module Types and Bootstrap Behavior

#### Critical Modules
Modules marked as `critical: true` in module.yaml:
- **MUST** implement `start()` method
- **MUST** start successfully or bootstrap fails
- **SHOULD** have fast initialization (< 500ms)
- **SHOULD** implement comprehensive health checks

Examples: logger, database, events, auth, cli, modules

#### Non-Critical Modules
Modules marked as `critical: false`:
- **MAY** implement `start()` method
- **MAY** fail without stopping bootstrap
- **SHOULD** log errors clearly on failure
- **SHOULD** implement basic health checks

Examples: config, permissions, users, agents, system, tasks

### Lifecycle Sequence
1. **Construction**: Module instance created
2. **Initialize**: Setup resources (DB, connections)
3. **Start**: Begin active operations (for critical modules)
4. **Running**: Normal operations with periodic health checks
5. **Stop**: Graceful shutdown
6. **Terminated**: All resources released

### Bootstrap Integration

The bootstrap system MUST:
1. Read module.yaml for dependencies and metadata
2. Load modules in correct dependency order
3. Call initialize() and start() methods if they exist
4. Log what's happening clearly
5. Fail immediately on critical module errors

## Module Discovery

### Core Modules
- Auto-discovered from `/src/modules/core/*`
- Each subdirectory with `index.ts` and `module.yaml` is a module
- Dependencies resolved from module.yaml files
- No hardcoded module lists

### Extension Modules
- Optional directories: `/injectable`, `/extensions`
- Discovered only if directories exist
- No warnings for missing optional paths
- Loaded after all core modules

## File Structure

```
src/bootstrap.ts           # Minimal Bootstrap class that delegates to modules services
src/bootstrap/
   shutdown-helper.ts      # Clean module shutdown logic
```

Note: Module scanning and dependency resolution are handled by the modules module services,
eliminating the need for duplicate helpers in bootstrap.

## Implementation Rules

### 1. Module Loading
- Use dynamic imports with proper error boundaries
- Validate module exports match `IModule` interface
- Track initialization state to prevent double-init
- Log all lifecycle transitions for debugging

### 2. Dependency Resolution
- Read dependency graph from module.yaml files
- Detect circular dependencies and fail fast
- Load modules in topological order
- No parallel loading complexity

### 3. Error Handling
- Critical modules failing stops bootstrap immediately
- Non-critical modules log errors but continue
- All errors include module context
- No timeouts or complex retry logic

### 4. Configuration
- Read module.yaml files for all configuration
- No external config files needed
- Environment variables can override module settings
- Simple validation in module.yaml schema

### 5. Shutdown Procedure
```typescript
async shutdown(): Promise<void> {
  const logger = LoggerService.getInstance();
  logger.info(LogSource.BOOTSTRAP, 'Shutting down system');
  await shutdownAllModules(this.modules, logger);
  this.modules.clear();
  this.isReady = false;
  logger.info(LogSource.BOOTSTRAP, 'Shutdown complete');
}
```

## Anti-Patterns to Avoid

1. **Hardcoded Module Lists**: Use module.yaml discovery
2. **Complex Event Systems**: Just log what's happening
3. **Over-abstraction**: Keep it simple and direct
4. **Silent Failures**: Always log errors clearly
5. **Feature Flags**: No migration code or legacy support
6. **Unnecessary Phases**: Sequential loading is sufficient

## Testing Requirements

1. **Unit Tests**: Each component independently testable
2. **Integration Tests**: Full bootstrap sequence
3. **Failure Tests**: Graceful handling of module failures
4. **Cleanup Tests**: Verify resource release

## Implementation Requirements

### Must Have
1. **Minimal Bootstrap**: Bootstrap only handles initial system startup (logger + modules module)
2. **Leverage Module Services**: Use existing CoreModuleLoaderService and ModuleRegistryService
3. **Clear Logging**: Log each step of bootstrap process  
4. **Fail Fast**: Stop immediately on critical module failures
5. **Clean Interface**: Simple Bootstrap class with minimal API
6. **No Duplication**: Don't duplicate module management logic that exists in modules services

### Must Not Have
1. **Event Systems**: No event emitters or complex observability
2. **Multiple Phases**: Just sequential loading with simple boolean tracking
3. **Complex JSDoc**: Keep comments minimal and focused
4. **Verbose Logging**: Use simple log messages without category objects
5. **Over-Engineering**: Keep it simple and maintainable

## Bootstrap Implementation Example

```typescript
export class Bootstrap {
  private readonly options: IBootstrapOptions;
  private modulesService?: IModulesModuleExports;
  private isReady = false;

  constructor(options: IBootstrapOptions = {}) {
    this.options = options;
  }

  async bootstrap(): Promise<Map<string, IModule>> {
    try {
      // 1. LOGGER - Initialize logger first (before modules service is available)
      const loggerModule = await createLoggerModuleForBootstrap();
      const logger = LoggerService.getInstance();
      logger.info(LogSource.BOOTSTRAP, 'Starting bootstrap process');

      // 2. MODULES_MODULE - Initialize the modules module manually
      const modulesModule = await this.initializeModulesModule();
      this.modulesService = modulesModule.exports;
      
      // 3. DELEGATE_TO_MODULES_SERVICE - Let modules service handle everything else
      logger.info(LogSource.BOOTSTRAP, 'Delegating to modules service for core module loading');
      
      // Get the module registry from modules service
      const moduleRegistry = ModuleRegistryService.getInstance();
      
      // Register our pre-loaded modules
      moduleRegistry.register(loggerModule);
      moduleRegistry.register(modulesModule);
      
      // Use modules service to scan and load remaining core modules
      const scanner = this.modulesService.service();
      const coreModules = await scanner.scanForModules({ 
        path: './src/modules/core',
        type: 'core' 
      });
      
      // Load modules through the modules service
      for (const moduleInfo of coreModules) {
        if (moduleInfo.name !== 'logger' && moduleInfo.name !== 'modules') {
          await moduleRegistry.loadAndInitialize(moduleInfo);
        }
      }

      // 4. READY - System operational
      this.isReady = true;
      const loadedModules = moduleRegistry.getAllModules();
      logger.info(LogSource.BOOTSTRAP, \`Bootstrap completed - \${loadedModules.size} modules loaded\`);
      return loadedModules;
    } catch (error) {
      this.handleBootstrapError(error);
      throw error;
    }
  }

  private async initializeModulesModule(): Promise<IModule> {
    // Manual initialization of modules module since it manages all others
    const modulePath = './src/modules/core/modules/index.ts';
    const moduleImport = await import(modulePath);
    const moduleInstance = moduleImport.createModule();
    await moduleInstance.initialize();
    await moduleInstance.start?.();
    return moduleInstance;
  }

  private handleBootstrapError(error: unknown): void {
    try {
      LoggerService.getInstance().error(LogSource.BOOTSTRAP, 'Bootstrap failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    } catch {
      console.error('Bootstrap failed:', error);
    }
  }
}
```

## Module Development Guidelines

When creating new modules:

1. Follow module rules at `/var/www/html/systemprompt-os/rules/src/modules/core/{module}/rules.md`
2. Extend `BaseModule` class for consistent lifecycle
3. Implement all lifecycle methods (required for critical modules)
4. Declare dependencies explicitly in module.yaml
5. Handle initialization failures gracefully
6. Clean up all resources in `stop()`
7. Provide health check implementation
8. Export module factory function
9. Keep it simple and maintainable