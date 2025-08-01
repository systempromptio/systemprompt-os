# Services Subfolder Rules

## Purpose
Services contain the business logic layer, orchestrating data operations, validation, and inter-module communication. They serve as the primary interface between modules and external consumers.

## Required Files

### database.service.ts (MANDATORY)
**MUST** be named exactly as the module name (e.g., `database.service.ts` for database module). This is the primary service that implements the main module interface.
**MUST** be located directly in the services directory (e.g., `/services/database.service.ts`), NOT inside a subfolder.

### Additional Services (OPTIONAL)
**MAY** include additional services named by their specific function:
- `{function-name}.service.ts` - Named after their specific purpose (e.g., `validation.service.ts`, `encryption.service.ts`, `parser.service.ts`)
- **MUST** follow the same singleton pattern and initialization requirements
- **SHOULD** be used by the main module service, not exported directly from the module

## Service Organization

### Main Module Service
The primary service (e.g., `database.service.ts`) serves as:
- **Module Interface Implementation** - Implements the auto-generated module service interface
- **Business Logic Coordinator** - Orchestrates operations across repositories and other services
- **External API** - The service exposed through the module's exports
- **Event Handler** - Manages inter-module communication

### Service File Structure
Services can be organized with support folders for complex services:

```
services/
├── database.service.ts           # Main module service (MANDATORY - at root level)
├── validation.service.ts         # Additional service (at root level)
├── database/                     # Optional support folder for database.service.ts
│   ├── helpers.ts
│   ├── validators.ts
│   └── types.ts
├── validation/                   # Optional support folder for validation.service.ts
│   ├── rules.ts
│   └── schemas.ts
├── encryption.service.ts         # Encryption/decryption operations  
├── parser.service.ts            # Data parsing and transformation
├── notification.service.ts      # Internal notification handling
└── cache.service.ts             # Module-specific caching logic
```

**IMPORTANT**: All service files (`*.service.ts`) MUST be at the root of the services directory, NOT inside subfolders. Subfolders are only for organizing support files.

### Service Interaction Pattern
```typescript
// Main module service coordinates other services
export class DatabaseService {
  private readonly validationService: ValidationService;
  private readonly encryptionService: EncryptionService;
  
  private constructor() {
    this.repository = DatabaseRepository.getInstance();
    this.validationService = ValidationService.getInstance();
    this.encryptionService = EncryptionService.getInstance();
  }
  
  async createDatabase(data: IDatabaseCreateData): Promise<IDatabase> {
    // Use additional services for specific tasks
    await this.validationService.validateCreateData(data);
    const encryptedData = await this.encryptionService.encryptSensitiveFields(data);
    
    // Main business logic continues...
    return await this.repository.createDatabase(encryptedData);
  }
}
```

## Service Implementation Pattern

### Required Structure
```typescript
import { randomUUID } from 'crypto';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { DatabaseRepository } from '@/modules/core/database/repositories/database.repository';
import { EventBusService } from '@/modules/core/events/services/event-bus.service';
import {
  type IDatabase,
  type IDatabaseCreateData,
  type IDatabaseUpdateData
} from '@/modules/core/database/types/database.module.generated';
import type { IDatabaseService } from '@/modules/core/database/types/database.service.generated';
import { DatabaseStatus } from '@/modules/core/database/types/database.generated';

export class DatabaseService implements IDatabaseService {
  private static instance: DatabaseService;
  private readonly repository: DatabaseRepository;
  private readonly eventBus: EventBusService;
  private logger?: ILogger;
  private initialized = false;

  private constructor() {
    this.repository = DatabaseRepository.getInstance();
    this.eventBus = EventBusService.getInstance();
    this.setupEventHandlers();
  }

  static getInstance(): DatabaseService {
    DatabaseService.instance ||= new DatabaseService();
    return DatabaseService.instance;
  }

  setLogger(logger: ILogger): void {
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.repository.initialize();
    this.initialized = true;
    this.logger?.info(LogSource.DATABASE, 'DatabaseService initialized');
  }

  // Business logic methods...
  
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}
```

## Required Implementation Details

### Singleton Pattern
- **MUST** use singleton pattern with `getInstance()`
- **MUST** have private constructor
- **MUST** implement `initialize()` method with idempotent behavior
- **MUST** implement `setLogger(logger: ILogger)` method

### Interface Implementation
- **MUST** implement the auto-generated service interface from `types/database.service.generated.ts` (main service only)
- **MUST** provide all methods defined in the interface (main service only)
- **MUST** match exact method signatures including parameter and return types
- **MAY** implement custom interfaces for additional services

### Dependency Injection
- **MUST** use `DatabaseRepository.getInstance()` for data access (main service only)
- **SHOULD** use `EventBusService.getInstance()` for inter-module communication
- **MAY** use other module services via `{Service}Service.getInstance()`
- **MUST** inject dependencies in constructor, not in methods
- **MUST** call `repository.initialize()` during service initialization (main service only)

## Inter-Module Dependencies in Services

### Core Infrastructure Dependencies (ALWAYS ALLOWED)
```typescript
// These are always safe to import directly
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import { EventBusService } from '@/modules/core/events/services/event-bus.service';

export class DatabaseService {
  private readonly eventBus: EventBusService;
  private logger?: ILogger;
  
  private constructor() {
    this.eventBus = EventBusService.getInstance();
  }
  
  setLogger(logger: ILogger): void {
    this.logger = logger;
  }
}
```

### Other Module Dependencies (USE WITH CAUTION)

#### Direct Service Access (HIGH COUPLING)
```typescript
// Only for stable, well-established modules
import { PermissionsService } from '@/modules/core/permissions/services/permissions.service';
import { ConfigService } from '@/modules/core/config/services/config.service';

export class DatabaseService {
  private readonly permissionsService: PermissionsService;
  
  private constructor() {
    this.permissionsService = PermissionsService.getInstance();
  }
  
  async createDatabase(data: IDatabaseCreateData, userId: string): Promise<IDatabase> {
    // Check permissions before creating
    const hasPermission = await this.permissionsService.checkPermission(
      userId, 
      'database:create'
    );
    if (!hasPermission) {
      throw new Error('Insufficient permissions');
    }
    
    // Continue with creation...
  }
}
```

#### Event-Based Communication (LOOSE COUPLING - PREFERRED)
```typescript
import { EventBusService } from '@/modules/core/events/services/event-bus.service';
import {
  UserDataRequestEvent,
  UserDataResponseEvent,
  UserEvents
} from '@/modules/core/events/types/index';

export class DatabaseService {
  private setupEventHandlers(): void {
    // Listen for user data requests
    this.eventBus.on<UserDataRequestEvent>(
      UserEvents.USER_DATA_REQUEST,
      async (event) => {
        try {
          const user = await this.getUserData(event.userId);
          const response: UserDataResponseEvent = {
            requestId: event.requestId,
            user: user ? {
              id: user.id,
              username: user.username,
              email: user.email
            } : null
          };
          this.eventBus.emit(UserEvents.USER_DATA_RESPONSE, response);
        } catch (error) {
          this.logger?.error(LogSource.DATABASE, 'Failed to handle user data request', { error });
        }
      }
    );
  }
  
  async requestUserData(userId: string): Promise<UserData | null> {
    return new Promise((resolve) => {
      const requestId = randomUUID();
      
      // Set up one-time listener for response
      const responseHandler = (event: UserDataResponseEvent) => {
        if (event.requestId === requestId) {
          this.eventBus.off(UserEvents.USER_DATA_RESPONSE, responseHandler);
          resolve(event.user);
        }
      };
      
      this.eventBus.on(UserEvents.USER_DATA_RESPONSE, responseHandler);
      
      // Send request
      this.eventBus.emit(UserEvents.USER_DATA_REQUEST, {
        requestId,
        userId
      });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        this.eventBus.off(UserEvents.USER_DATA_RESPONSE, responseHandler);
        resolve(null);
      }, 5000);
    });
  }
}
```

### Circular Dependency Resolution Hierarchy

**PREFERRED ORDER** (use the highest applicable option):

1. **Constructor Injection** (Best - follows dependency injection pattern)
   ```typescript
   private constructor() {
     this.someService = SomeService.getInstance();
   }
   ```

2. **Event-Based Communication** (Good - loose coupling, async-friendly)
   ```typescript
   this.eventBus.emit(SomeEvents.REQUEST, data);
   ```

3. **Lazy Import Pattern** (Last Resort - only for bootstrap circular dependencies)
   ```typescript
   const { SomeService } = await import('@/path/to/some.service');
   await SomeService.getInstance().doWork();
   ```

**DECISION MATRIX**:
- **Use Constructor Injection** when no circular dependency exists
- **Use Events** when loose coupling is appropriate and async is acceptable
- **Use Lazy Import** ONLY when:
  - Constructor injection would create bootstrap circular dependency
  - Events are not appropriate (need synchronous completion)
  - Service is only needed in specific method execution contexts

### Dependency Best Practices

#### Constructor Injection Pattern
```typescript
export class DatabaseService {
  // Inject all dependencies in constructor
  private readonly repository: DatabaseRepository;
  private readonly eventBus: EventBusService;
  private readonly permissionsService: PermissionsService;
  private logger?: ILogger;
  
  private constructor() {
    // All dependencies resolved at construction time
    this.repository = DatabaseRepository.getInstance();
    this.eventBus = EventBusService.getInstance();
    this.permissionsService = PermissionsService.getInstance();
  }
  
  // Never resolve dependencies in methods
  async someMethod(): Promise<void> {
    // ❌ NEVER do this
    // const service = SomeService.getInstance();
    
    // ✅ Use injected dependencies
    await this.permissionsService.checkPermission();
  }
}
```

#### Circular Dependency Prevention

**Primary Rule**: Use event-based communication to break circular dependencies.

```typescript
// ❌ NEVER create circular dependencies
// users.service.ts imports auth.service.ts
// AND auth.service.ts imports users.service.ts

// ✅ Use events to break cycles
// users.service.ts emits USER_CREATED event
// auth.service.ts listens to USER_CREATED event
```

#### Lazy Import Pattern for Bootstrap Circular Dependencies

**WHEN TO USE**: Only when a service is needed during CLI/bootstrap execution but would create a circular dependency during module loading.

**CRITERIA FOR LAZY IMPORTS**:
1. Service is NOT needed during constructor/initialization
2. Service is only needed during specific method execution
3. Direct import would create circular dependency during bootstrap
4. Method execution must complete before process exits (requires `await`)

**PATTERN**:
```typescript
// ✅ Lazy import pattern for bootstrap-safe dependencies
async someMethod(): Promise<void> {
  // Import only when needed, not at module load time
  const { SomeService } = await import('@/path/to/some.service');
  const service = SomeService.getInstance();
  
  // Use service synchronously - MUST await completion
  await service.doWork();
}
```

**EXAMPLE USAGE** (CLI commands that need reporting):
```typescript
// CLI command execution
async executeLintCheck(context: ICLIContext): Promise<void> {
  // ... main command logic ...
  
  // Lazy import to avoid bootstrap circular dependency
  const { ReportWriterService } = await import('@/modules/core/dev/services/report-writer.service');
  const reportWriter = ReportWriterService.getInstance();
  
  // MUST await - report must complete before CLI exits
  await reportWriter.writeReport(report);
}
```

**WHEN NOT TO USE LAZY IMPORTS**:
- ❌ In service constructors (breaks dependency injection)
- ❌ For core infrastructure services (logger, database, events)
- ❌ When service is needed for initialization
- ❌ In high-frequency method calls (performance impact)
- ❌ When event-based communication is possible and appropriate

#### Optional Dependencies
```typescript
export class DatabaseService {
  private auditService?: AuditService;
  
  private constructor() {
    // Optional dependency - might not be available
    try {
      this.auditService = AuditService.getInstance();
    } catch {
      this.logger?.warn(LogSource.DATABASE, 'Audit service not available');
    }
  }
  
  private audit(action: string, data: any): void {
    // Only audit if service is available
    this.auditService?.logAction(action, data);
  }
}
```

### Initialization
- **MUST** track initialization state with private `initialized` boolean
- **MUST** implement idempotent `initialize()` method
- **MUST** call `ensureInitialized()` before any business operations
- **MUST** initialize repository during service initialization

## Business Logic Patterns

### CRUD Operations
```typescript
async createDatabase(data: IDatabaseCreateData): Promise<IDatabase> {
  await this.ensureInitialized();
  await this.validateDatabaseData(data);

  const id = randomUUID();
  const now = new Date();

  this.logger?.info(LogSource.DATABASE, `Creating database: ${data.name}`);

  const database = await this.repository.createDatabase({
    id,
    ...data,
    status: DatabaseStatus.ACTIVE,
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  });

  // Emit events for other modules
  this.eventBus.emit(DatabaseEvents.{ENTITY}_CREATED, {
    databaseId: database.id,
    timestamp: now
  });

  return database;
}
```

### Validation Methods
```typescript
private async validateDatabaseData(data: IDatabaseCreateData): Promise<void> {
  // Business rule validation
  if (!data.name?.trim()) {
    throw new Error('Database name is required');
  }

  // Uniqueness validation
  const existing = await this.repository.findByName(data.name);
  if (existing) {
    throw new Error(`Database name already exists: ${data.name}`);
  }

  // Custom business rules...
}
```

### Event Handling
```typescript
private setupEventHandlers(): void {
  this.eventBus.on<DatabaseDataRequestEvent>(
    DatabaseEvents.{ENTITY}_DATA_REQUEST, 
    async (data: unknown) => {
      try {
        const event = data as DatabaseDataRequestEvent;
        const database = await this.getDatabase(event.databaseId);
        
        const response: DatabaseDataResponseEvent = {
          requestId: event.requestId,
          database: database ? { /* mapped data */ } : null
        };
        
        this.eventBus.emit(DatabaseEvents.{ENTITY}_DATA_RESPONSE, response);
      } catch (error) {
        this.logger?.error(LogSource.DATABASE, 'Event handler error', { error });
        // Handle error response...
      }
    }
  );
}
```

## Type Safety Requirements

### Generated Types
- **MUST** use auto-generated interfaces from `types/database.module.generated.ts`
- **MUST** use database-generated types for status enums
- **MUST** import all required types at the top of the file
- **MUST** follow exact type signatures from generated interfaces

### Return Types
- **MUST** return domain interfaces (e.g., `IDatabase`), not database rows
- **MUST** use `Promise<Type>` for all async operations
- **MUST** use proper union types for nullable returns (`Type | null`)

### Parameter Types
- **MUST** use create/update data interfaces for input validation
- **MUST** use string types for IDs
- **MUST** validate all input parameters

## Error Handling

### Business Logic Errors
```typescript
// Validation errors
if (!isValidEmail(data.email)) {
  throw new Error(`Invalid email format: ${data.email}`);
}

// Business rule violations
if (data.status === 'inactive' && hasActiveRelations) {
  throw new Error('Cannot deactivate database with active relations');
}

// Not found errors
const database = await this.repository.findById(id);
if (!database) {
  throw new Error(`Database not found: ${id}`);
}
```

### Error Context
- **MUST** provide meaningful error messages with context
- **SHOULD** include relevant data in error messages
- **MUST** let repository errors bubble up
- **SHOULD** log errors before throwing when appropriate

## Event System Integration

### Event Emission
- **MUST** emit events for significant business operations (create, update, delete)
- **SHOULD** include relevant data and timestamps in events
- **MUST** use event constants from event types

### Event Handling
- **MUST** handle inter-module communication via events
- **SHOULD** validate event data before processing
- **MUST** handle event processing errors gracefully
- **SHOULD** provide response events for request/response patterns

## Logging

### Required Logging
```typescript
// Operation start
this.logger?.info(LogSource.DATABASE, `Starting operation: ${operation}`);

// Success
this.logger?.info(LogSource.DATABASE, `Operation completed: ${operation}`);

// Errors
this.logger?.error(LogSource.DATABASE, 'Operation failed', {
  error: error instanceof Error ? error : new Error(String(error)),
  context: relevantData
});
```

### Log Sources
- **MUST** use module-specific LogSource (e.g., `LogSource.DATABASE`)
- **MUST** include operation context in log messages
- **SHOULD** use appropriate log levels (info, error, debug)

## Forbidden Patterns

**NEVER**:
- Access database directly (always use repository)
- Handle HTTP requests/responses (belongs in controllers)
- Perform file I/O operations directly
- Create instances of other services (use getInstance)
- Implement caching logic (use dedicated caching services)
- Include UI-specific logic
- Return database row types directly (use domain interfaces)

Services serve as the **primary business logic layer**, coordinating between repositories, handling validation, and managing inter-module communication through events.