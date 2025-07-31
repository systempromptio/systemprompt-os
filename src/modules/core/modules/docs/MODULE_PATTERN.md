# Module Pattern Guide

This guide explains how to create new modules using the standardized `BaseModule` pattern with full Zod validation.

## Overview

All modules in the system extend the `BaseModule` abstract class, which provides:

- ✅ Automatic Zod validation of `IModule` interface implementation
- ✅ Standardized lifecycle management (initialize, start, stop)
- ✅ Built-in error handling and logging
- ✅ Export validation with Zod schemas
- ✅ Health check framework
- ✅ State management (initialized, started, status)

## Creating a New Module

### 1. Define Module Types and Schemas

First, create your module's TypeScript interfaces and Zod schemas:

```typescript
// types/index.ts
export interface IMyModuleExports {
  service: () => IMyService;
  // other exports...
}

export interface IMyService {
  doSomething(): Promise<void>;
  // service methods...
}
```

```typescript
// schemas/service.schemas.ts
import { z } from 'zod';
import { createModuleSchema } from '@/modules/core/modules/schemas/module.schemas';

// Service schema
export const MyServiceSchema = z.object({
  doSomething: z.function(),
  // other methods...
});

// Module exports schema
export const MyModuleExportsSchema = z.object({
  service: z.function().returns(MyServiceSchema)
});

// Full module schema
export const MyModuleSchema = createModuleSchema(MyModuleExportsSchema).extend({
  name: z.literal('mymodule'),
  type: z.literal(ModulesType.CORE),
  dependencies: z.array(z.string()).readonly().optional(),
});
```

### 2. Implement the Module

Create your module by extending `BaseModule`:

```typescript
// index.ts
import { BaseModule, ModulesType } from '@/modules/core/modules/types/index';
import { MyService } from './services/my.service';
import { LogSource } from '@/modules/core/logger/types/index';
import type { IMyModuleExports } from './types/index';
import { MyModuleSchema, MyModuleExportsSchema, MyServiceSchema } from './schemas/service.schemas';
import type { ZodSchema } from 'zod';

export class MyModule extends BaseModule<IMyModuleExports> {
  // Required module metadata
  public readonly name = 'mymodule' as const;
  public readonly type = ModulesType.CORE;
  public readonly version = '1.0.0';
  public readonly description = 'My module description';
  public readonly dependencies = ['logger', 'database'] as const;
  
  // Module-specific services
  private myService!: MyService;
  
  // Provide exports with validation
  get exports(): IMyModuleExports {
    return {
      service: (): MyService => {
        this.ensureInitialized();
        return this.validateService(
          this.myService,
          MyServiceSchema,
          'MyService'
        );
      },
    };
  }
  
  // Define export schema
  protected getExportsSchema(): ZodSchema<IMyModuleExports> {
    return MyModuleExportsSchema;
  }
  
  // Define module schema (optional - override for custom validation)
  protected override getModuleSchema(): ZodSchema<any> {
    return MyModuleSchema;
  }
  
  // Module-specific initialization
  protected async initializeModule(): Promise<void> {
    this.myService = MyService.getInstance();
    await this.myService.initialize();
  }
  
  // Module-specific start logic
  protected async startModule(): Promise<void> {
    // Add any start logic here
    await this.myService.start();
  }
  
  // Module-specific stop logic
  protected async stopModule(): Promise<void> {
    // Add any cleanup logic here
    await this.myService.stop();
  }
  
  // Configure log source
  protected override getLogSource(): LogSource {
    return LogSource.SYSTEM; // or your module's log source
  }
  
  // Optional: Custom health check
  protected override async moduleHealthCheck(): Promise<{ healthy: boolean; message?: string }> {
    const serviceHealthy = await this.myService.isHealthy();
    return {
      healthy: serviceHealthy,
      message: serviceHealthy ? 'Service operational' : 'Service unhealthy'
    };
  }
}

// Factory functions
export const createModule = (): MyModule => {
  return new MyModule();
};

export const initialize = async (): Promise<MyModule> => {
  const module = new MyModule();
  await module.initialize();
  return module;
};
```

## Key Features Provided by BaseModule

### 1. Automatic Validation

The base class automatically validates:
- `IModule` interface implementation
- Module-specific requirements
- Export structure
- Service instances

### 2. Lifecycle Management

```typescript
// Initialize with validation and error handling
await module.initialize();

// Start with comprehensive validation
await module.start();

// Stop with cleanup
await module.stop();

// Health checks
const health = await module.healthCheck();
```

### 3. Built-in Error Handling

All errors are:
- Logged with appropriate context
- Wrapped with descriptive messages
- Update module status to FAILED when appropriate

### 4. State Guards

Methods like `ensureInitialized()` and `ensureStarted()` prevent operations on uninitialized modules.

### 5. Service Validation

The `validateService()` method ensures services meet their Zod schema requirements before being returned.

## Benefits

1. **Consistency**: All modules follow the same pattern
2. **Type Safety**: Full TypeScript + Zod runtime validation
3. **Less Boilerplate**: Common functionality is in BaseModule
4. **Better Errors**: Detailed validation messages at runtime
5. **Maintainability**: Changes to common behavior only need BaseModule updates

## Migration Guide

To migrate an existing module:

1. Extend `BaseModule` instead of implementing `IModule` directly
2. Move initialization logic to `initializeModule()`
3. Move start logic to `startModule()`
4. Move stop logic to `stopModule()`
5. Remove validation methods (now handled by base class)
6. Define schemas for exports and services
7. Use `override` keyword for methods that override base implementations

## Example: Users Module

See `/src/modules/core/users/index.ts` for a complete example of a module using this pattern.

The Users module went from ~200 lines to ~140 lines while gaining:
- Automatic validation
- Standardized error handling
- Consistent lifecycle management
- Export validation with Zod