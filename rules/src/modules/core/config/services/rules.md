# Services Subfolder Rules

## Purpose
Services contain the business logic layer, orchestrating data operations, validation, and inter-module communication. They serve as the primary interface between modules and external consumers.

## Required Files

### config.service.ts (MANDATORY)
**MUST** be named exactly as the module name (e.g., `config.service.ts` for config module). This is the primary service that implements the main module interface.
**MUST** be located directly in the services directory (e.g., `/services/config.service.ts`), NOT inside a subfolder.

### Additional Services (OPTIONAL)
**MAY** include additional services named by their specific function:
- `providers.service.ts` - Named after their specific purpose (provider management, validation, etc.)
- **MUST** follow the same singleton pattern and initialization requirements
- **SHOULD** be used by the main module service, not exported directly from the module

## Service Organization

### Main Module Service
The primary service (e.g., `config.service.ts`) serves as:
- **Module Interface Implementation** - Implements the auto-generated module service interface
- **Business Logic Coordinator** - Orchestrates operations across repositories and other services
- **External API** - The service exposed through the module's exports
- **Event Handler** - Manages inter-module communication

### Service File Structure
Services can be organized with support folders for complex services:

```
services/
├── config.service.ts           # Main module service (MANDATORY - at root level)
├── providers.service.ts        # Additional service (at root level)
├── config/                     # Optional support folder for config.service.ts
│   ├── helpers.ts
│   ├── validators.ts
│   └── types.ts
├── providers/                  # Optional support folder for providers.service.ts
│   ├── rules.ts
│   └── schemas.ts
├── encryption.service.ts       # Encryption/decryption operations  
├── parser.service.ts          # Data parsing and transformation
└── cache.service.ts           # Module-specific caching logic
```

**IMPORTANT**: All service files (`*.service.ts`) MUST be at the root of the services directory, NOT inside subfolders. Subfolders are only for organizing support files.

## Service Implementation Pattern

### Required Structure
```typescript
import { randomUUID } from 'crypto';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { ConfigRepository } from '@/modules/core/config/repositories/config.repository';
import { EventBusService } from '@/modules/core/events/services/event-bus.service';
import {
  type IConfig,
  type IConfigCreateData,
  type IConfigUpdateData
} from '@/modules/core/config/types/config.module.generated';
import type { IConfigService } from '@/modules/core/config/types/config.service.generated';
import { ConfigType } from '@/modules/core/config/types/database.generated';

export class ConfigService implements IConfigService {
  private static instance: ConfigService;
  private readonly repository: ConfigRepository;
  private readonly eventBus: EventBusService;
  private logger?: ILogger;
  private initialized = false;

  private constructor() {
    this.repository = ConfigRepository.getInstance();
    this.eventBus = EventBusService.getInstance();
    this.setupEventHandlers();
  }

  static getInstance(): ConfigService {
    ConfigService.instance ||= new ConfigService();
    return ConfigService.instance;
  }

  setLogger(logger: ILogger): void {
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.repository.initialize();
    this.initialized = true;
    this.logger?.info(LogSource.CONFIG, 'ConfigService initialized');
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
- **MUST** implement the auto-generated service interface from `types/config.service.generated.ts` (main service only)
- **MUST** provide all methods defined in the interface (main service only)
- **MUST** match exact method signatures including parameter and return types
- **MAY** implement custom interfaces for additional services

### Dependency Injection
- **MUST** use `ConfigRepository.getInstance()` for data access (main service only)
- **SHOULD** use `EventBusService.getInstance()` for inter-module communication
- **MAY** use other module services via `{Service}Service.getInstance()`
- **MUST** inject dependencies in constructor, not in methods
- **MUST** call `repository.initialize()` during service initialization (main service only)

## Business Logic Patterns

### CRUD Operations
```typescript
async setConfig(key: string, value: string, type?: string): Promise<IConfig> {
  await this.ensureInitialized();
  await this.validateConfigData({ key, value, type });

  const id = randomUUID();
  const now = new Date();

  this.logger?.info(LogSource.CONFIG, `Setting config: ${key}`);

  const config = await this.repository.setConfig({
    id,
    key,
    value,
    type: type || 'string',
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  });

  // Emit events for other modules
  this.eventBus.emit('config:updated', {
    key: config.key,
    value: config.value,
    timestamp: now
  });

  return config;
}

async getConfig(key: string): Promise<IConfig | null> {
  await this.ensureInitialized();
  return await this.repository.getConfig(key);
}

async deleteConfig(key: string): Promise<void> {
  await this.ensureInitialized();
  
  const existing = await this.repository.getConfig(key);
  if (!existing) {
    throw new Error(`Config key not found: ${key}`);
  }

  await this.repository.deleteConfig(key);
  
  this.eventBus.emit('config:deleted', {
    key,
    timestamp: new Date()
  });
}
```

### Validation Methods
```typescript
private async validateConfigData(data: { key: string; value: string; type?: string }): Promise<void> {
  // Business rule validation
  if (!data.key?.trim()) {
    throw new Error('Config key is required');
  }

  if (!data.value?.trim()) {
    throw new Error('Config value is required');
  }

  // Type validation
  if (data.type && !['string', 'number', 'boolean', 'json'].includes(data.type)) {
    throw new Error(`Invalid config type: ${data.type}`);
  }

  // Value format validation based on type
  if (data.type === 'number' && isNaN(Number(data.value))) {
    throw new Error('Value must be a valid number for number type');
  }

  if (data.type === 'boolean' && !['true', 'false'].includes(data.value.toLowerCase())) {
    throw new Error('Value must be true or false for boolean type');
  }

  if (data.type === 'json') {
    try {
      JSON.parse(data.value);
    } catch {
      throw new Error('Value must be valid JSON for json type');
    }
  }
}
```

## Type Safety Requirements

### Generated Types
- **MUST** use auto-generated interfaces from `types/config.module.generated.ts`
- **MUST** use database-generated types for status enums
- **MUST** import all required types at the top of the file
- **MUST** follow exact type signatures from generated interfaces

### Return Types
- **MUST** return domain interfaces (e.g., `IConfig`), not database rows
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
if (!isValidConfigKey(key)) {
  throw new Error(`Invalid config key format: ${key}`);
}

// Business rule violations
if (isProtectedKey(key) && !hasAdminPermission) {
  throw new Error('Cannot modify protected configuration key');
}

// Not found errors
const config = await this.repository.getConfig(key);
if (!config) {
  throw new Error(`Config key not found: ${key}`);
}
```

## Event System Integration

### Event Emission
- **MUST** emit events for significant business operations (set, delete, update)
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
this.logger?.info(LogSource.CONFIG, `Starting operation: ${operation}`);

// Success
this.logger?.info(LogSource.CONFIG, `Operation completed: ${operation}`);

// Errors
this.logger?.error(LogSource.CONFIG, 'Operation failed', {
  error: error instanceof Error ? error : new Error(String(error)),
  context: relevantData
});
```

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