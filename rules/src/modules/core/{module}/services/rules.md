# Services Subfolder Rules

## Purpose
Services contain the business logic layer, orchestrating data operations, validation, and inter-module communication. They serve as the primary interface between modules and external consumers.

## Required Files

### {module-name}.service.ts (MANDATORY)
**MUST** be named exactly as the module name (e.g., `{module}.service.ts` for {module} module). This is the primary service that implements the main module interface.
**MUST** be located directly in the services directory (e.g., `/services/{module}.service.ts`), NOT inside a subfolder.

### Additional Services (OPTIONAL)
**MAY** include additional services named by their specific function:
- `{function-name}.service.ts` - Named after their specific purpose (e.g., `validation.service.ts`, `encryption.service.ts`, `parser.service.ts`)
- **MUST** follow the same singleton pattern and initialization requirements
- **SHOULD** be used by the main module service, not exported directly from the module

## Service Organization

### Main Module Service
The primary service (e.g., `{module}.service.ts`) serves as:
- **Module Interface Implementation** - Implements the auto-generated module service interface
- **Business Logic Coordinator** - Orchestrates operations across repositories and other services
- **External API** - The service exposed through the module's exports
- **Event Handler** - Manages inter-module communication

### Service File Structure
Services can be organized with support folders for complex services:

```
services/
├── {module}.service.ts           # Main module service (MANDATORY - at root level)
├── validation.service.ts         # Additional service (at root level)
├── {module}/                     # Optional support folder for {module}.service.ts
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
export class {Module}Service {
  private readonly validationService: ValidationService;
  private readonly encryptionService: EncryptionService;
  
  private constructor() {
    this.repository = {Module}Repository.getInstance();
    this.validationService = ValidationService.getInstance();
    this.encryptionService = EncryptionService.getInstance();
  }
  
  async create{Entity}(data: I{Entity}CreateData): Promise<I{Entity}> {
    // Use additional services for specific tasks
    await this.validationService.validateCreateData(data);
    const encryptedData = await this.encryptionService.encryptSensitiveFields(data);
    
    // Main business logic continues...
    return await this.repository.create{Entity}(encryptedData);
  }
}
```

## Service Implementation Pattern

### Required Structure
```typescript
import { randomUUID } from 'crypto';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { {Module}Repository } from '@/modules/core/{module}/repositories/{module}.repository';
import { EventBusService } from '@/modules/core/events/services/event-bus.service';
import {
  type I{Entity},
  type I{Entity}CreateData,
  type I{Entity}UpdateData
} from '@/modules/core/{module}/types/{module}.module.generated';
import type { I{Module}Service } from '@/modules/core/{module}/types/{module}.service.generated';
import { {Module}Status } from '@/modules/core/{module}/types/database.generated';

export class {Module}Service implements I{Module}Service {
  private static instance: {Module}Service;
  private readonly repository: {Module}Repository;
  private readonly eventBus: EventBusService;
  private logger?: ILogger;
  private initialized = false;

  private constructor() {
    this.repository = {Module}Repository.getInstance();
    this.eventBus = EventBusService.getInstance();
    this.setupEventHandlers();
  }

  static getInstance(): {Module}Service {
    {Module}Service.instance ||= new {Module}Service();
    return {Module}Service.instance;
  }

  setLogger(logger: ILogger): void {
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.repository.initialize();
    this.initialized = true;
    this.logger?.info(LogSource.{MODULE_CONSTANT}, '{Module}Service initialized');
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
- **MUST** implement the auto-generated service interface from `types/{module}.service.generated.ts` (main service only)
- **MUST** provide all methods defined in the interface (main service only)
- **MUST** match exact method signatures including parameter and return types
- **MAY** implement custom interfaces for additional services

### Dependency Injection
- **MUST** use `{Module}Repository.getInstance()` for data access (main service only)
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

export class {Module}Service {
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

export class {Module}Service {
  private readonly permissionsService: PermissionsService;
  
  private constructor() {
    this.permissionsService = PermissionsService.getInstance();
  }
  
  async create{Entity}(data: I{Entity}CreateData, userId: string): Promise<I{Entity}> {
    // Check permissions before creating
    const hasPermission = await this.permissionsService.checkPermission(
      userId, 
      '{module}:create'
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

export class {Module}Service {
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
          this.logger?.error(LogSource.{MODULE_CONSTANT}, 'Failed to handle user data request', { error });
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

### Dependency Best Practices

#### Constructor Injection Pattern
```typescript
export class {Module}Service {
  // Inject all dependencies in constructor
  private readonly repository: {Module}Repository;
  private readonly eventBus: EventBusService;
  private readonly permissionsService: PermissionsService;
  private logger?: ILogger;
  
  private constructor() {
    // All dependencies resolved at construction time
    this.repository = {Module}Repository.getInstance();
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
```typescript
// ❌ NEVER create circular dependencies
// users.service.ts imports auth.service.ts
// AND auth.service.ts imports users.service.ts

// ✅ Use events to break cycles
// users.service.ts emits USER_CREATED event
// auth.service.ts listens to USER_CREATED event
```

#### Optional Dependencies
```typescript
export class {Module}Service {
  private auditService?: AuditService;
  
  private constructor() {
    // Optional dependency - might not be available
    try {
      this.auditService = AuditService.getInstance();
    } catch {
      this.logger?.warn(LogSource.{MODULE_CONSTANT}, 'Audit service not available');
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
async create{Entity}(data: I{Entity}CreateData): Promise<I{Entity}> {
  await this.ensureInitialized();
  await this.validate{Entity}Data(data);

  const id = randomUUID();
  const now = new Date();

  this.logger?.info(LogSource.{MODULE_CONSTANT}, `Creating {entity}: ${data.name}`);

  const {entity} = await this.repository.create{Entity}({
    id,
    ...data,
    status: {Module}Status.ACTIVE,
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  });

  // Emit events for other modules
  this.eventBus.emit({Module}Events.{ENTITY}_CREATED, {
    {entity}Id: {entity}.id,
    timestamp: now
  });

  return {entity};
}
```

### Validation Methods
```typescript
private async validate{Entity}Data(data: I{Entity}CreateData): Promise<void> {
  // Business rule validation
  if (!data.name?.trim()) {
    throw new Error('{Entity} name is required');
  }

  // Uniqueness validation
  const existing = await this.repository.findByName(data.name);
  if (existing) {
    throw new Error(`{Entity} name already exists: ${data.name}`);
  }

  // Custom business rules...
}
```

### Event Handling
```typescript
private setupEventHandlers(): void {
  this.eventBus.on<{Entity}DataRequestEvent>(
    {Module}Events.{ENTITY}_DATA_REQUEST, 
    async (data: unknown) => {
      try {
        const event = data as {Entity}DataRequestEvent;
        const {entity} = await this.get{Entity}(event.{entity}Id);
        
        const response: {Entity}DataResponseEvent = {
          requestId: event.requestId,
          {entity}: {entity} ? { /* mapped data */ } : null
        };
        
        this.eventBus.emit({Module}Events.{ENTITY}_DATA_RESPONSE, response);
      } catch (error) {
        this.logger?.error(LogSource.{MODULE_CONSTANT}, 'Event handler error', { error });
        // Handle error response...
      }
    }
  );
}
```

## Type Safety Requirements

### Generated Types
- **MUST** use auto-generated interfaces from `types/{module}.module.generated.ts`
- **MUST** use database-generated types for status enums
- **MUST** import all required types at the top of the file
- **MUST** follow exact type signatures from generated interfaces

### Return Types
- **MUST** return domain interfaces (e.g., `I{Entity}`), not database rows
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
  throw new Error('Cannot deactivate {entity} with active relations');
}

// Not found errors
const {entity} = await this.repository.findById(id);
if (!{entity}) {
  throw new Error(`{Entity} not found: ${id}`);
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
this.logger?.info(LogSource.{MODULE_CONSTANT}, `Starting operation: ${operation}`);

// Success
this.logger?.info(LogSource.{MODULE_CONSTANT}, `Operation completed: ${operation}`);

// Errors
this.logger?.error(LogSource.{MODULE_CONSTANT}, 'Operation failed', {
  error: error instanceof Error ? error : new Error(String(error)),
  context: relevantData
});
```

### Log Sources
- **MUST** use module-specific LogSource (e.g., `LogSource.{MODULE_CONSTANT}`)
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