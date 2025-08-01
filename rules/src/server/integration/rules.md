# Server Integration Rules

## Overview

The integration layer bridges the gap between the server's protocol handlers and the modules. It enables modules to dynamically register endpoints, handles request routing, and manages the bidirectional event flow.

## Core Components

### 1. Module Bridge
Listens for module registration events and coordinates with protocol handlers.

### 2. Endpoint Registry
Maintains a dynamic registry of all endpoints across all protocols.

### 3. Request Router
Routes incoming requests to the appropriate module via events.

### 4. Response Handler
Formats module responses for protocol handlers.

## Module Bridge

```typescript
export class ModuleBridge {
  private endpointRegistry: EndpointRegistry;
  private eventBus: IEventBus;
  
  constructor(eventBus: IEventBus) {
    this.eventBus = eventBus;
    this.endpointRegistry = new EndpointRegistry();
    this.setupListeners();
  }
  
  private setupListeners() {
    // Listen for module endpoint registrations
    this.eventBus.on(ServerEvents.REGISTER_ENDPOINT, (event) => {
      this.registerEndpoint(event);
    });
    
    // Listen for MCP server registrations
    this.eventBus.on(ServerEvents.REGISTER_MCP_SERVER, (event) => {
      this.registerMcpServer(event);
    });
  }
}
```

## Endpoint Registration

### Endpoint Definition
```typescript
interface IEndpointDefinition {
  // Identity
  moduleId: string;
  endpointId: string;
  
  // Protocol info
  protocol: 'http' | 'mcp' | 'websocket';
  
  // HTTP-specific
  method?: HttpMethod;
  path?: string;
  
  // MCP-specific
  toolName?: string;
  resourceUri?: string;
  
  // Common
  handler: string;        // Event name to emit
  auth?: IAuthConfig;
  rateLimit?: IRateLimitConfig;
  validation?: IValidationConfig;
  timeout?: number;
}
```

### Registration Flow
```typescript
// 1. Module emits registration during initialization
await this.eventBus.emit(ServerEvents.REGISTER_ENDPOINT, {
  moduleId: 'users',
  endpointId: 'list-users',
  protocol: 'http',
  method: 'GET',
  path: '/api/users',
  handler: 'users.list',
  auth: { required: true },
  rateLimit: { window: 60000, max: 100 }
});

// 2. Module bridge receives and registers
private registerEndpoint(definition: IEndpointDefinition) {
  // Validate definition
  this.validateEndpoint(definition);
  
  // Store in registry
  this.endpointRegistry.register(definition);
  
  // Notify protocol handler
  this.eventBus.emit(`${definition.protocol}.endpoint.register`, definition);
}

// 3. Protocol handler creates actual endpoint
eventBus.on('http.endpoint.register', (definition) => {
  this.createHttpRoute(definition);
});
```

## Request Routing

### Request Flow
```typescript
export class RequestRouter {
  async routeRequest(
    endpoint: IEndpointDefinition,
    request: ICommonRequest
  ): Promise<any> {
    const requestId = generateRequestId();
    
    // Create module request event
    const moduleRequest = {
      requestId,
      moduleId: endpoint.moduleId,
      endpointId: endpoint.endpointId,
      ...request
    };
    
    // Setup response promise
    const responsePromise = this.waitForResponse(requestId, endpoint.timeout);
    
    // Emit request to module
    await this.eventBus.emit(endpoint.handler, moduleRequest);
    
    // Wait for response
    return responsePromise;
  }
  
  private waitForResponse(requestId: string, timeout = 30000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.eventBus.off(responseEvent);
        reject(new Error('Request timeout'));
      }, timeout);
      
      const responseEvent = `response.${requestId}`;
      
      this.eventBus.once(responseEvent, (response) => {
        clearTimeout(timer);
        
        if (response.error) {
          reject(response.error);
        } else {
          resolve(response.data);
        }
      });
    });
  }
}
```

### Module Response Pattern
```typescript
// Module handles request
this.eventBus.on('users.list', async (request) => {
  try {
    // Process request
    const users = await this.userService.listUsers(request.query);
    
    // Emit response
    this.eventBus.emit(`response.${request.requestId}`, {
      data: users
    });
  } catch (error) {
    // Emit error
    this.eventBus.emit(`response.${request.requestId}`, {
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message
      }
    });
  }
});
```

## Endpoint Registry

```typescript
export class EndpointRegistry {
  private endpoints: Map<string, IEndpointDefinition> = new Map();
  private pathIndex: Map<string, string> = new Map(); // For HTTP routing
  
  register(definition: IEndpointDefinition) {
    const key = this.generateKey(definition);
    
    if (this.endpoints.has(key)) {
      throw new Error(`Endpoint already registered: ${key}`);
    }
    
    this.endpoints.set(key, definition);
    
    // Index for fast HTTP lookups
    if (definition.protocol === 'http' && definition.path) {
      const pathKey = `${definition.method}:${definition.path}`;
      this.pathIndex.set(pathKey, key);
    }
  }
  
  findByPath(method: string, path: string): IEndpointDefinition | undefined {
    const pathKey = `${method}:${path}`;
    const endpointKey = this.pathIndex.get(pathKey);
    
    return endpointKey ? this.endpoints.get(endpointKey) : undefined;
  }
  
  findByModule(moduleId: string): IEndpointDefinition[] {
    return Array.from(this.endpoints.values())
      .filter(ep => ep.moduleId === moduleId);
  }
  
  unregisterModule(moduleId: string) {
    const moduleEndpoints = this.findByModule(moduleId);
    
    moduleEndpoints.forEach(endpoint => {
      const key = this.generateKey(endpoint);
      this.endpoints.delete(key);
      
      // Remove from indices
      if (endpoint.path) {
        const pathKey = `${endpoint.method}:${endpoint.path}`;
        this.pathIndex.delete(pathKey);
      }
    });
  }
}
```

## Authentication Integration

```typescript
export class AuthIntegration {
  async checkAuth(
    authConfig: IAuthConfig,
    request: ICommonRequest
  ): Promise<IAuthResult> {
    if (!authConfig.required) {
      return { authenticated: false };
    }
    
    const token = this.extractToken(request);
    
    if (!token) {
      throw new Error('No authentication token provided');
    }
    
    // Validate via auth module
    const result = await this.eventBus.emitAndWait(
      'auth.validate',
      { 
        token,
        roles: authConfig.roles,
        permissions: authConfig.permissions
      },
      { timeout: 5000 }
    );
    
    return {
      authenticated: true,
      user: result.user,
      session: result.session
    };
  }
}
```

## Rate Limiting Integration

```typescript
export class RateLimitIntegration {
  private limiters: Map<string, IRateLimiter> = new Map();
  
  async checkRateLimit(
    config: IRateLimitConfig,
    request: ICommonRequest
  ): Promise<void> {
    const key = this.generateKey(config, request);
    
    let limiter = this.limiters.get(key);
    if (!limiter) {
      limiter = this.createLimiter(config);
      this.limiters.set(key, limiter);
    }
    
    const allowed = await limiter.consume(request.user?.id || request.ip);
    
    if (!allowed) {
      throw new RateLimitError('Rate limit exceeded', {
        window: config.window,
        max: config.max,
        retryAfter: limiter.getResetTime()
      });
    }
  }
}
```

## Error Handling

```typescript
export class IntegrationErrorHandler {
  handleError(error: any, context: IErrorContext): IErrorResponse {
    // Log error
    this.eventBus.emit(ServerEvents.ERROR, {
      error,
      context,
      timestamp: new Date()
    });
    
    // Format for protocol
    return {
      code: this.getErrorCode(error),
      message: this.getErrorMessage(error),
      details: this.getErrorDetails(error, context),
      expose: this.shouldExposeError(error)
    };
  }
  
  private shouldExposeError(error: any): boolean {
    // Only expose client errors
    return error.status >= 400 && error.status < 500;
  }
}
```

## Rules

1. **No Direct Module Access**
   - Never import modules
   - All communication via events
   - Maintain loose coupling

2. **Registration Validation**
   - Validate all endpoint definitions
   - Check for conflicts
   - Ensure required fields

3. **Request Isolation**
   - Each request gets unique ID
   - Timeouts prevent hanging
   - Errors isolated per request

4. **Performance**
   - Efficient endpoint lookup
   - Request/response correlation
   - Cleanup stale handlers

5. **Security**
   - Validate all inputs
   - Check authentication first
   - Apply rate limits early

## Testing

### Unit Tests
- Endpoint registration
- Request routing
- Response handling
- Error scenarios

### Integration Tests
- Full request flow
- Module registration
- Auth integration
- Rate limiting

### Performance Tests
- Many endpoints
- Concurrent requests
- Memory usage
- Lookup speed