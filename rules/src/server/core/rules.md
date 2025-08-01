# Server Core Rules

## Overview

The server core provides the fundamental server functionality - lifecycle management, protocol registration, and event-based communication. It knows nothing about specific protocols or modules.

## Responsibilities

1. **Server Lifecycle**
   - Start/stop/restart server
   - Graceful shutdown with connection draining
   - Signal handling (SIGTERM, SIGINT)
   - Health status reporting

2. **Protocol Registry**
   - Register/unregister protocol handlers
   - Protocol handler lifecycle management
   - Protocol configuration management

3. **Event Bus**
   - Server-wide event communication
   - Request/response pattern with timeouts
   - Event logging and debugging

4. **Base Configuration**
   - Port configuration
   - Environment management
   - Base middleware pipeline

## Core Components

### ServerCore Class
```typescript
export class ServerCore {
  private protocols: Map<string, IProtocolHandler>;
  private eventBus: ServerEventBus;
  private status: ServerStatus;
  
  async start(): Promise<void>;
  async stop(): Promise<void>;
  async restart(): Promise<void>;
  
  registerProtocol(protocol: IProtocolHandler): void;
  unregisterProtocol(name: string): void;
}
```

### Protocol Handler Interface
```typescript
interface IProtocolHandler {
  readonly name: string;
  readonly version: string;
  
  initialize(server: IServerCore): Promise<void>;
  start(config: IProtocolConfig): Promise<void>;
  stop(): Promise<void>;
  health(): Promise<HealthStatus>;
}
```

### Server Event Bus
```typescript
export class ServerEventBus {
  emit(event: string, data: any): void;
  on(event: string, handler: EventHandler): void;
  once(event: string, handler: EventHandler): void;
  
  // Request/response pattern
  emitAndWait<T>(event: string, data: any, options?: {
    timeout?: number;
  }): Promise<T>;
}
```

## Usage Patterns

### Server Initialization
```typescript
const server = new ServerCore({
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development'
});

// Register protocols
server.registerProtocol(new HttpProtocol());
server.registerProtocol(new McpProtocol());

// Start server
await server.start();
```

### Event Communication
```typescript
// Emit event to modules
server.eventBus.emit(ServerEvents.ENDPOINT_REQUEST, {
  requestId: '123',
  endpoint: '/api/users',
  method: 'GET',
  params: {}
});

// Wait for response
const response = await server.eventBus.emitAndWait(
  'module.users.list',
  { requestId: '123' },
  { timeout: 30000 }
);
```

## Rules

1. **No Protocol Knowledge**
   - Core must not import protocol-specific code
   - Core must not know about HTTP, MCP, etc.
   - All protocol interaction through interfaces

2. **No Module Knowledge**
   - Core must not import any modules
   - Core must not know about module structure
   - All module interaction through events

3. **Event-Based Only**
   - All communication via event bus
   - No direct function calls to protocols
   - No synchronous operations

4. **Lifecycle Management**
   - Protocols start in registration order
   - Protocols stop in reverse order
   - Graceful shutdown with timeout

5. **Error Handling**
   - All errors must be caught and logged
   - Failed protocol doesn't crash server
   - Graceful degradation

## Anti-Patterns

❌ **Direct Protocol Access**
```typescript
// WRONG
import { HttpProtocol } from '../protocols/http';
const http = new HttpProtocol();
```

❌ **Module Imports**
```typescript
// WRONG
import { AuthModule } from '@/modules/core/auth';
```

❌ **Synchronous Operations**
```typescript
// WRONG
const result = this.handleRequest(request);
```

## Correct Patterns

✅ **Protocol Registration**
```typescript
// RIGHT
server.registerProtocol(protocol);
```

✅ **Event-Based Communication**
```typescript
// RIGHT
const result = await server.eventBus.emitAndWait('request', data);
```

✅ **Interface-Based Design**
```typescript
// RIGHT
protocols.forEach((protocol: IProtocolHandler) => {
  protocol.start(config);
});
```

## Testing

1. **Unit Tests**
   - Test server lifecycle
   - Test protocol registration
   - Test event bus

2. **Integration Tests**
   - Test with mock protocols
   - Test graceful shutdown
   - Test error scenarios

## Files

### Required Files
- `server.ts` - Main ServerCore class
- `types/server.types.ts` - Core interfaces
- `types/events.types.ts` - Event definitions
- `services/registry.service.ts` - Protocol registry
- `services/events.service.ts` - Event bus implementation

### Configuration
- Server config loaded from environment
- No hardcoded values
- Validation on startup