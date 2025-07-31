# {Module} Module Rules

## Required Files Structure

Every module in this directory MUST have the following exact structure:

### Root Level (Required)
- `index.ts` - Module entry point extending BaseModule with full Zod validation
- `module.yaml` - Module configuration with metadata, CLI commands, and exports

### Required Directories
- `cli/` - CLI command implementations
  - `index.ts` - CLI exports
  - Individual command files (create.ts, delete.ts, get.ts, list.ts, status.ts, update.ts)
- `database/` - Database schema and migrations
  - `schema.sql` - Database schema definition
- `repositories/` - Data access layer
  - `{service-name}.repository.ts` - Repository implementation
- `services/` - Business logic layer
  - `{module-name}.service.ts` - Service implementation
- `types/` - Type definitions and schemas
  - `*.generated.ts` - **AUTO-GENERATED** domain interfaces and module exports
  - `database.generated.ts` - **AUTO-GENERATED** from schema.sql via type-guard-generator
  - `*.manual.ts` - Manual types (ONLY when auto-generation is insufficient - requires justification)

## Module Implementation Requirements

### index.ts Structure
- Must extend `BaseModule<I{Module}ModuleExports>`
- Must implement lazy-loaded exports pattern
- Must include proper Zod validation using generated schemas
- Must handle initialization and dependency injection

### module.yaml Structure
- Must include: name, type, version, description, author
- Must specify dependencies array
- Must define CLI commands with proper options
- Must specify exports array

## Testing Requirements

Every module MUST have a corresponding integration test:
- Location: `/tests/integration/modules/core/{module}/{module}.integration.test.ts`
- Must test all exported services and CLI commands
- Must validate proper module initialization and cleanup

## Type Generation Requirements

**CRITICAL**: All types MUST be auto-generated using `/src/modules/core/dev/services/type-guard-generator.service.ts`

### Auto-Generated Files (DO NOT EDIT MANUALLY):
- `database.generated.ts` - Generated from `schema.sql` database schema
- `{module}.module.generated.ts` - Generated domain interfaces and module exports from service methods
- `{module}.service.generated.ts` - Generated service validation schemas from TypeScript AST

### Generation Process:
1. **Database types** → Generated from `database/schema.sql`
2. **Domain interfaces** → Generated from service implementation analysis
3. **Service schemas** → Generated from TypeScript AST analysis of service methods

### Manual Types (HIGHLY RESTRICTED):
- Must use `.manual.ts` suffix (e.g., `custom.manual.ts`)
- Requires written justification in comments explaining why auto-generation is insufficient
- Should be rare exceptions only

### Generation Command:
```bash
# Generate all types for a module
npx tsx src/modules/core/dev/cli/generate-types.ts {module-name}
```

## Code Quality Standards

- All services must be singletons with proper initialization
- All types must be generated and validated with Zod schemas
- Repository pattern must be used for data access
- CLI commands must follow consistent option patterns
- Proper error handling and logging throughout

## Dependencies

Modules may only depend on other core modules as specified in module.yaml dependencies array.

## Inter-Module Dependency Patterns

### Module Declaration Dependencies
**MUST** declare dependencies in `module.yaml`:
```yaml
dependencies:
  - logger
  - database
  - events
```

### Import Patterns for Other Modules

#### Core Module Services (PREFERRED)
```typescript
// Import core module services directly
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { EventBusService } from '@/modules/core/events/services/event-bus.service';

// Use singleton instances
const logger = LoggerService.getInstance();
const database = DatabaseService.getInstance();
const eventBus = EventBusService.getInstance();
```

#### Module Interface Pattern (TYPE-SAFE)
```typescript
// Import module getter functions for type safety
import { getLoggerModule } from '@/modules/core/logger';
import { getDatabaseModule } from '@/modules/core/database';

// Access services through module interface
const loggerModule = getLoggerModule();
const logger = loggerModule.exports.service();

const databaseModule = getDatabaseModule();
const database = databaseModule.exports.service();
```

#### Event-Based Communication (LOOSELY COUPLED)
```typescript
// Import event types for inter-module communication
import { EventBusService } from '@/modules/core/events/services/event-bus.service';
import { 
  UserDataRequestEvent, 
  UserDataResponseEvent,
  UserEvents 
} from '@/modules/core/events/types/index';

// Communicate via events instead of direct service calls
const eventBus = EventBusService.getInstance();

// Request data from another module
eventBus.emit(UserEvents.USER_DATA_REQUEST, {
  requestId: 'req-123',
  userId: 'user-456'
});

// Listen for responses
eventBus.on<UserDataResponseEvent>(UserEvents.USER_DATA_RESPONSE, (event) => {
  if (event.requestId === 'req-123') {
    // Handle user data
  }
});
```

### Anti-Patterns (FORBIDDEN)

#### Direct Module Imports
```typescript
// ❌ NEVER import modules directly
import { usersModule } from '@/modules/core/users';
import { authModule } from '@/modules/core/auth';
```

#### Circular Dependencies
```typescript
// ❌ NEVER create circular dependencies
// users module importing auth AND auth module importing users
```

#### Private Implementation Access
```typescript
// ❌ NEVER access private module internals
import { UsersRepository } from '@/modules/core/users/repositories/users.repository';
import { validateUserData } from '@/modules/core/users/utils/validators';
```

### Dependency Guidelines

#### When to Use Direct Service Imports
- **Core Infrastructure** - Logger, Database, Events (always available)
- **Stable APIs** - Well-established service interfaces
- **Performance Critical** - Direct calls needed for performance

#### When to Use Event Communication
- **Loose Coupling** - Modules should not be tightly coupled
- **Optional Dependencies** - Module might not be available
- **Async Operations** - Non-blocking inter-module communication
- **Fan-out Patterns** - One event, multiple handlers

#### When to Use Module Interface Pattern
- **Type Safety** - Need compile-time type checking
- **Dynamic Loading** - Modules loaded at runtime
- **Testing** - Need to mock entire modules