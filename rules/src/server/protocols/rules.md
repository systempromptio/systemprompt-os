# Protocol Handlers Rules

## Overview

Protocol handlers translate between specific protocols (HTTP, MCP, WebSocket) and the server's event-based architecture. Each protocol handler is responsible for its own concerns while communicating with modules via events.

## Protocol Handler Responsibilities

1. **Protocol-Specific Logic**
   - Handle protocol handshake/negotiation
   - Manage protocol-specific sessions
   - Format requests/responses per protocol

2. **Request Translation**
   - Convert protocol requests to common format
   - Emit events to appropriate modules
   - Handle timeouts and errors

3. **Module Communication**
   - Listen for module registration events
   - Forward requests to modules via events
   - Return responses in protocol format

## Common Protocol Interface

All protocol handlers must implement:

```typescript
interface IProtocolHandler {
  readonly name: string;
  readonly version: string;
  
  // Lifecycle
  initialize(server: IServerCore): Promise<void>;
  start(config: IProtocolConfig): Promise<void>;
  stop(): Promise<void>;
  health(): Promise<HealthStatus>;
  
  // Endpoint management
  registerEndpoint(endpoint: IEndpointDefinition): void;
  unregisterEndpoint(path: string): void;
  
  // Metrics
  getMetrics(): IProtocolMetrics;
}
```

## HTTP Protocol Rules

See [HTTP Protocol Rules](./http/rules.md)

## MCP Protocol Rules  

See [MCP Protocol Rules](./mcp/rules.md)

## WebSocket Protocol Rules

See [WebSocket Protocol Rules](./websocket/rules.md)

## Common Patterns

### Endpoint Registration
```typescript
// Module emits registration
eventBus.emit(ServerEvents.REGISTER_ENDPOINT, {
  protocol: 'http',
  method: 'GET',
  path: '/api/users',
  auth: { required: true },
  handler: 'users.list'
});

// Protocol handler receives
eventBus.on(ServerEvents.REGISTER_ENDPOINT, (endpoint) => {
  if (endpoint.protocol === this.name) {
    this.registerEndpoint(endpoint);
  }
});
```

### Request Handling
```typescript
// Protocol receives request
async handleRequest(protocolRequest: any) {
  // 1. Parse and validate
  const parsed = this.parseRequest(protocolRequest);
  
  // 2. Convert to common format
  const commonRequest = {
    requestId: generateId(),
    endpoint: parsed.endpoint,
    params: parsed.params,
    auth: parsed.auth
  };
  
  // 3. Emit to module
  const response = await this.eventBus.emitAndWait(
    parsed.handler,
    commonRequest,
    { timeout: 30000 }
  );
  
  // 4. Format response
  return this.formatResponse(response);
}
```

### Error Handling
```typescript
// Standardized error format
interface IProtocolError {
  code: string;
  message: string;
  details?: any;
}

// Protocol-specific formatting
formatError(error: IProtocolError): any {
  switch (this.name) {
    case 'http':
      return { status: 500, body: { error } };
    case 'mcp':
      return { jsonrpc: '2.0', error };
    default:
      return error;
  }
}
```

## Rules

1. **Protocol Independence**
   - Each protocol handler is independent
   - No shared state between protocols
   - Protocol handlers don't know about each other

2. **Event-Based Module Communication**
   - Never import modules directly
   - All module interaction via events
   - Use request/response pattern

3. **Session Management**
   - Each protocol manages its own sessions
   - Sessions can be linked via auth tokens
   - Clean up sessions on disconnect

4. **Error Isolation**
   - Protocol errors don't affect other protocols
   - Always provide protocol-appropriate errors
   - Log errors with protocol context

5. **Performance**
   - Implement connection pooling where appropriate
   - Use streaming for large responses
   - Implement backpressure handling

## Anti-Patterns

❌ **Direct Module Access**
```typescript
// WRONG
import { UsersModule } from '@/modules/core/users';
const users = await UsersModule.getUsers();
```

❌ **Shared State**
```typescript
// WRONG
class HttpProtocol {
  static sessions = new Map(); // Shared across instances
}
```

❌ **Blocking Operations**
```typescript
// WRONG
const result = fs.readFileSync(path); // Blocks event loop
```

## Testing

1. **Unit Tests**
   - Test request parsing
   - Test response formatting
   - Test error handling

2. **Integration Tests**
   - Test with mock event bus
   - Test endpoint registration
   - Test full request cycle

3. **Protocol Tests**
   - Test protocol compliance
   - Test edge cases
   - Test performance