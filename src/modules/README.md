# Module Pattern Guide

This document defines the standard pattern that ALL modules in SystemPrompt OS must follow to ensure consistency, type safety, and maintainability.

## Module Structure

Every module's `index.ts` file must follow this exact pattern:

```typescript
/**
 * {Description of what the module does}
 * @file {ModuleName} module entry point.
 * @module modules/core/{moduleName}
 */

import type { IModule } from '@/modules/core/modules/types/index';
import { ModuleStatusEnum } from '@/modules/core/modules/types/index';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
// Import your services and types here
import { {ServiceName}Service } from '@/modules/core/{moduleName}/services/{serviceName}.service';
import type { I{ServiceName}Service } from '@/modules/core/{moduleName}/types/index';

/**
 * Strongly typed exports interface for {ModuleName} module.
 */
export interface I{ModuleName}ModuleExports {
  readonly service: () => I{ServiceName}Service;
  // Add other exports here following the same pattern
  // Examples:
  // readonly getAllItems: () => Promise<Item[]>;
  // readonly getItem: (id: string) => Promise<Item | null>;
  // readonly createItem: (data: CreateItemDto) => Promise<Item>;
}

/**
 * {ModuleName} module implementation.
 */
export class {ModuleName}Module implements IModule<I{ModuleName}ModuleExports> {
  public readonly name = '{moduleName}';
  public readonly type = 'service' as const;
  public readonly version = '1.0.0';
  public readonly description = '{Detailed description of module purpose}';
  public readonly dependencies = ['logger', 'database']; // Add actual dependencies
  public status: ModuleStatusEnum = ModuleStatusEnum.STOPPED;
  private {serviceName}Service!: I{ServiceName}Service;
  private logger!: ILogger;
  private initialized = false;
  private started = false;

  get exports(): I{ModuleName}ModuleExports {
    return {
      service: () => this.getService(),
      // Implement other exports here
      // Examples:
      // getAllItems: async () => await this.{serviceName}Service.getAllItems(),
      // getItem: async (id: string) => await this.{serviceName}Service.getItem(id),
      // createItem: async (data: CreateItemDto) => await this.{serviceName}Service.createItem(data),
    };
  }

  /**
   * Initialize the {moduleName} module.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('{ModuleName} module already initialized');
    }

    this.logger = LoggerService.getInstance();
    
    try {
      // Initialize your service(s) here
      this.{serviceName}Service = {ServiceName}Service.getInstance();
      await this.{serviceName}Service.initialize();
      
      this.initialized = true;
      this.logger.info(LogSource.{MODULE_NAME}, '{ModuleName} module initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize {moduleName} module: ${errorMessage}`);
    }
  }

  /**
   * Start the {moduleName} module.
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      throw new Error('{ModuleName} module not initialized');
    }

    if (this.started) {
      throw new Error('{ModuleName} module already started');
    }

    this.status = ModuleStatusEnum.RUNNING;
    this.started = true;
    this.logger.info(LogSource.{MODULE_NAME}, '{ModuleName} module started');
  }

  /**
   * Stop the {moduleName} module.
   */
  async stop(): Promise<void> {
    if (this.started) {
      this.status = ModuleStatusEnum.STOPPED;
      this.started = false;
      this.logger.info(LogSource.{MODULE_NAME}, '{ModuleName} module stopped');
    }
  }

  /**
   * Health check for the {moduleName} module.
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.initialized) {
      return {
        healthy: false,
        message: '{ModuleName} module not initialized'
      };
    }
    if (!this.started) {
      return {
        healthy: false,
        message: '{ModuleName} module not started'
      };
    }
    return {
      healthy: true,
      message: '{ModuleName} module is healthy'
    };
  }

  /**
   * Get the {serviceName} service.
   */
  private getService(): I{ServiceName}Service {
    if (!this.initialized) {
      throw new Error('{ModuleName} module not initialized');
    }
    return this.{serviceName}Service;
  }
}

/**
 * Factory function for creating the module.
 */
export function createModule(): {ModuleName}Module {
  return new {ModuleName}Module();
}

/**
 * Initialize function for core module pattern.
 */
export async function initialize(): Promise<{ModuleName}Module> {
  const {moduleName}Module = new {ModuleName}Module();
  await {moduleName}Module.initialize();
  return {moduleName}Module;
}

/**
 * Gets the {ModuleName} module with type safety and validation.
 * @returns The {ModuleName} module with guaranteed typed exports.
 * @throws {Error} If {ModuleName} module is not available or missing required exports.
 */
export function get{ModuleName}Module(): IModule<I{ModuleName}ModuleExports> {
  // Use dynamic imports to avoid circular dependencies
  const { getModuleLoader } = require('@/modules/loader');
  const { ModuleName } = require('@/modules/types/index');
  
  const moduleLoader = getModuleLoader();
  const {moduleName}Module = moduleLoader.getModule(ModuleName.{MODULE_NAME});
  
  // Validate the module has expected structure
  if (!{moduleName}Module.exports?.service || typeof {moduleName}Module.exports.service !== 'function') {
    throw new Error('{ModuleName} module missing required service export');
  }
  
  // Add validation for other required exports here
  // Example:
  // if (!{moduleName}Module.exports?.getAllItems || typeof {moduleName}Module.exports.getAllItems !== 'function') {
  //   throw new Error('{ModuleName} module missing required getAllItems export');
  // }
  
  return {moduleName}Module as IModule<I{ModuleName}ModuleExports>;
}

// Re-export types and enums for convenience
export * from '@/modules/core/{moduleName}/types/index';
```

## Naming Conventions

Replace the placeholders with actual values following these conventions:

- `{ModuleName}` - PascalCase module name (e.g., `Database`, `Logger`, `Auth`)
- `{moduleName}` - camelCase module name (e.g., `database`, `logger`, `auth`)
- `{MODULE_NAME}` - UPPER_CASE module name for enums (e.g., `DATABASE`, `LOGGER`, `AUTH`)
- `{ServiceName}` - PascalCase service name (e.g., `Database`, `Logger`, `Auth`)
- `{serviceName}` - camelCase service name (e.g., `database`, `logger`, `auth`)

## Key Requirements

1. **Typed Exports Interface**: Must define `I{ModuleName}ModuleExports` interface
2. **Module Class**: Must implement `IModule<I{ModuleName}ModuleExports>` (with generic type)
3. **Status Management**: Must use `ModuleStatusEnum` for status
4. **Initialization Guards**: Must check `initialized` and `started` flags
5. **Error Handling**: Must provide descriptive error messages
6. **Logging**: Must log lifecycle events using appropriate `LogSource`
7. **Factory Function**: Must export `createModule()` function
8. **Initialize Function**: Must export `initialize()` function for bootstrap
9. **Getter Function**: Must export `get{ModuleName}Module()` with validation
10. **Type Re-exports**: Should re-export module types for convenience

## Validation in Getter

The getter function MUST validate all required exports. This ensures type safety at runtime:

```typescript
// Basic validation for service
if (!moduleInstance.exports?.service || typeof moduleInstance.exports.service !== 'function') {
  throw new Error('Module missing required service export');
}

// Add validation for each export
if (!moduleInstance.exports?.methodName || typeof moduleInstance.exports.methodName !== 'function') {
  throw new Error('Module missing required methodName export');
}
```

## Benefits

1. **Type Safety**: Full IntelliSense and compile-time checking
2. **Consistency**: Same pattern across all modules
3. **Runtime Safety**: Validation ensures modules are properly loaded
4. **No Defensive Code**: Consumers can trust the module is available
5. **Clear Errors**: Descriptive errors when modules are misconfigured
6. **Easy Discovery**: Developers know exactly where to find module capabilities

## Example Usage

```typescript
// In a handler or service
import { getDatabaseModule } from '@/modules/core/database/index';

export async function handleRequest(): Promise<Result> {
  // No need to check if module exists - getter throws if not available
  const databaseModule = getDatabaseModule();
  
  // Full type safety - TypeScript knows all available methods
  const result = await databaseModule.exports.service().query('SELECT * FROM users');
  
  return result;
}
```

## Migration Guide

When updating existing modules:

1. Add the typed exports interface
2. Update the class to implement `IModule<T>` with the interface
3. Add the getter function with validation
4. Update status to use `ModuleStatusEnum`
5. Ensure all lifecycle methods follow the pattern
6. Add proper error messages
7. Update imports in consumers to use the getter