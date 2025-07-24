# SystemPrompt OS Architecture Guidelines

## Module Structure Standards

### Directory Structure
Every module MUST follow this structure:

```
modules/core/[module-name]/
├── index.ts           # Module entry point and IModule implementation
├── module.yaml        # Module metadata
├── types.ts           # Type definitions (single file for simple modules)
├── services/          # Service implementations
├── repositories/      # Data access layer
├── cli/              # CLI commands
├── database/         # Database schemas and migrations
└── utils/            # Module-specific utilities
```

### Type Definitions
- **Simple modules**: Use a single `types.ts` file
- **Complex modules**: May use a `types/` directory with `index.ts` that re-exports all types
- **Never mix both patterns**

### Import Rules
1. Always use `.js` extensions for relative imports in TypeScript files
2. Use path aliases (`@/modules/...`) for cross-module imports
3. Export types from module's main `index.ts` for external consumption

### Example Module

```typescript
// modules/core/example/types.ts
export interface ExampleConfig {
  enabled: boolean;
}

export interface IExampleService {
  doSomething(): Promise<void>;
}

// modules/core/example/index.ts
import { Service, Inject } from 'typedi';
import { IModule, ModuleStatus } from '@/modules/core/modules/types.js';
import { ExampleService } from './services/example.service.js';

// Re-export types for external use
export * from './types.js';

@Service()
export class ExampleModule implements IModule {
  // Implementation
}

export default ExampleModule;
```

## Build System

### TypeScript Configuration
- Use `"module": "Node16"` and `"moduleResolution": "Node16"` for proper ESM support
- Always include `.js` extensions in imports
- Use `tsconfig.node.json` for Node.js-specific settings

### Build Process
- Single build tool (esbuild) instead of multiple tools
- No post-processing scripts needed
- Automatic handling of path aliases and extensions

## Dependency Injection

All modules use TypeDI with constructor injection:

```typescript
@Service()
export class MyModule implements IModule {
  constructor(
    @Inject(TYPES.Logger) private logger: ILogger,
    @Inject(TYPES.Database) private db: IDatabaseService
  ) {}
  
  async initialize(): Promise<void> {
    // No parameters - dependencies injected via constructor
  }
}
```

## Export Patterns

### Module Exports
```typescript
// Export the class for TypeDI
export default ModuleClass;

// Export types for external use
export * from './types.js';

// Export services if needed externally
export { ServiceClass } from './services/service.js';
```

### Never Do This
```typescript
// Don't export instances
export default new ModuleClass(); // ❌

// Don't use context parameters
async initialize(context: any): Promise<void> { // ❌
```