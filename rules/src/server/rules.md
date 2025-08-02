# Server Architecture Rules

## Overview

The server provides a lean, extensible platform for serving multiple protocols (HTTP REST, MCP, WebSocket) while maintaining clean separation of concerns and enabling modules to expose their functionality through various endpoints. The server is designed to be deployed behind a reverse proxy (nginx) or through a cloudflared tunnel for secure external access.

## Core Principles

1. **Protocol Agnostic**: Server core doesn't know about specific protocols
2. **Module Independence**: Server doesn't import or know about specific modules
3. **Event-Driven**: All module communication happens through events
4. **Plugin Architecture**: Modules register capabilities, don't hardcode
5. **Focused Responsibility**: Server focuses on serving, modules handle business logic
6. **Testable**: Each layer independently testable

## Architecture Layers

### 1. Server Core Layer
```
src/server/
├── core/
│   ├── server.ts              # Main server class
│   ├── types/
│   │   ├── server.types.ts    # Core server interfaces
│   │   └── registry.types.ts  # Service registry types
│   └── services/
│       ├── registry.service.ts # Service registry
│       └── events.service.ts   # Server event bus
```

**Responsibilities**:
- Lifecycle management (start, stop, restart)
- Service registry for protocols
- Event bus for server events
- Graceful shutdown

See detailed rules: [Core Rules](./core/rules.md)

### 2. Protocol Handlers Layer
```
src/server/
├── protocols/
│   ├── http/              # HTTP REST API endpoints
│   ├── mcp/               # MCP protocol servers
│   └── websocket/         # Future: WebSocket support
```

**Responsibilities**:
- Protocol-specific handling
- Request/response translation
- Session management per protocol

See detailed rules: [Protocol Rules](./protocols/rules.md)

### 3. Module Integration Layer
```
src/server/
├── integration/
│   ├── module-bridge.ts        # Bridge between server and modules
│   ├── endpoint-registry.ts    # Dynamic endpoint registration
│   └── types/
│       └── integration.types.ts
```

**Responsibilities**:
- Dynamic endpoint registration
- Request routing to modules
- Response handling
- Auth/rate limit integration

See detailed rules: [Integration Rules](./integration/rules.md)

## Note on Security and Monitoring

Security features (authentication, authorization, sessions) are handled by the **auth module**, not the server. The server integrates with auth via events.

Monitoring features (health checks, metrics, logging) can be implemented as a separate **monitoring module** that listens to server events.

## Module Integration Pattern

### 1. Module Registration

Modules register their server capabilities during bootstrap:

```typescript
// In module's index.ts
export class MyModule extends BaseModule {
  async initialize(): Promise<void> {
    // Register HTTP endpoints
    this.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
      moduleId: this.name,
      endpoints: [
        {
          protocol: 'http',
          method: 'GET',
          path: '/api/my-module/items',
          auth: { required: true, roles: ['user'] },
          rateLimit: { window: 60000, max: 100 },
          handler: 'listItems' // Event name to emit
        }
      ]
    });
    
    // Register MCP tools
    this.eventBus.emit(ServerEvents.REGISTER_MCP_TOOLS, {
      moduleId: this.name,
      tools: [
        {
          name: 'my-module:list',
          description: 'List items',
          schema: { /* ... */ },
          handler: 'mcpListItems' // Event name to emit
        }
      ]
    });
  }
}
```

### 2. Request Handling

Server handles requests by emitting events to modules:

```typescript
// In HTTP protocol handler
async handleRequest(req: Request, res: Response) {
  const endpoint = this.endpointRegistry.match(req.path, req.method);
  
  if (!endpoint) {
    return res.status(404).json({ error: 'Not found' });
  }
  
  // Check auth, rate limits, etc.
  
  // Emit event to module
  const result = await this.eventBus.emitAndWait(
    endpoint.handler,
    {
      requestId: generateId(),
      params: req.params,
      query: req.query,
      body: req.body,
      user: req.user
    },
    { timeout: 30000 }
  );
  
  res.json(result);
}
```

### 3. Module Response

Modules listen for their handler events:

```typescript
// In module
this.eventBus.on('listItems', async (event: RequestEvent) => {
  try {
    const items = await this.service.listItems(event.query);
    this.eventBus.emit(ServerEvents.REQUEST_RESPONSE, {
      requestId: event.requestId,
      data: items
    });
  } catch (error) {
    this.eventBus.emit(ServerEvents.REQUEST_ERROR, {
      requestId: event.requestId,
      error: error.message
    });
  }
});
```

## File Structure

```
src/server/
├── index.ts                    # Main server export
├── core/                       # Core server functionality
│   ├── server.ts
│   ├── types/
│   └── services/
├── protocols/                  # Protocol handlers
│   ├── http/
│   ├── mcp/
│   └── websocket/
├── integration/                # Module integration
│   ├── module-bridge.ts
│   └── endpoint-registry.ts
└── types/                      # Shared types
    └── index.ts
```

## Implementation Rules

### 1. No Direct Module Imports
- ❌ NEVER: `import { AuthModule } from '@/modules/core/auth'`
- ✅ ALWAYS: Use event bus for module communication
- ✅ ALWAYS: Access modules through the module registry

### 2. Protocol Handlers
- MUST implement `IProtocolHandler` interface
- MUST register with server core during initialization
- MUST handle their own protocol-specific concerns
- MUST translate protocol-specific requests to common format

### 3. Endpoint Registration
- Endpoints MUST be registered dynamically
- Registration MUST include auth requirements
- Registration MUST include rate limit config
- Registration MUST specify handler event name

### 4. Event Communication
- All module communication MUST use events
- Request events MUST include unique requestId
- Response events MUST include the requestId
- Events MUST have timeout handling

### 5. Error Handling
- All errors MUST be caught and logged
- Protocol handlers MUST translate errors appropriately
- Errors MUST NOT leak internal details
- Graceful degradation for non-critical failures

### 6. Configuration
- Server configuration in `/config/server.yaml`
- Protocol-specific config in protocol subdirectories
- Environment variables override config files
- Validation required for all configuration

## Testing Requirements

### Unit Tests
- Each service independently testable
- Mock event bus for isolated testing
- Protocol handlers testable without modules

### Integration Tests
- Full server startup and shutdown
- Module registration flow
- End-to-end request handling
- Protocol interoperability

### Performance Tests
- Concurrent request handling
- Memory usage under load
- Event bus performance
- Session management scalability

## Anti-Patterns to Avoid

1. **Direct Module Access**: Never import modules directly
2. **Hardcoded Routes**: All routes must be dynamically registered
3. **Protocol Coupling**: Core server shouldn't know about protocols
4. **Synchronous Module Calls**: Always use async events
5. **Global State**: Use dependency injection instead
6. **Mixed Concerns**: Keep protocol, security, and business logic separate
7. **Tight Coupling**: Modules shouldn't know about server internals

## Migration Strategy

1. **Phase 1**: Create new server core with event bus
2. **Phase 2**: Implement protocol handlers
3. **Phase 3**: Create module bridge and registration
4. **Phase 4**: Migrate existing endpoints incrementally
5. **Phase 5**: Remove old server code

## OAuth Flow Integration

OAuth flows are handled through a combination of:
1. HTTP protocol handler for web endpoints
2. Auth module providing OAuth logic via events
3. Session management in auth module
4. Server just routes requests

Example flow:
1. HTTP handler receives `/oauth/authorize` request
2. Emits `AUTH.OAUTH_AUTHORIZE` event to auth module
3. Auth module validates and returns redirect URL
4. HTTP handler performs redirect
5. Callback handled similarly with event communication

## MCP Server Architecture

### Single Entry Point, Multiple Contexts

The MCP protocol handler exposes a single `/mcp` endpoint that serves multiple module contexts:

```typescript
// Client connects to different contexts via headers or path
POST /mcp (Header: X-MCP-Context: git-tools)
POST /mcp (Header: X-MCP-Context: terminal-access)
POST /mcp (Header: X-MCP-Context: system-monitor)
```

### Module MCP Registration

Each module can register MCP servers with specific contexts:

```typescript
// Module registers its MCP context
this.eventBus.emit(ServerEvents.REGISTER_MCP_CONTEXT, {
  moduleId: 'git-tools',
  context: 'git-tools',
  capabilities: {
    tools: [...],
    resources: [...],
    prompts: [...]
  },
  metadata: {
    name: 'Git Tools MCP Server',
    description: 'Git operations via MCP',
    version: '1.0.0'
  }
});
```

### Context Routing

The MCP handler routes requests based on context:

```typescript
class McpProtocol {
  private contexts: Map<string, McpContext>;
  
  async handleRequest(req: Request) {
    const context = req.headers['x-mcp-context'] || 'default';
    const mcpContext = this.contexts.get(context);
    
    if (!mcpContext) {
      throw new Error(`Unknown MCP context: ${context}`);
    }
    
    // Route to appropriate module
    return this.routeToModule(mcpContext, req);
  }
}
```

### Multi-Context Benefits

1. **Isolation**: Each context has its own capability boundary
2. **Security**: Permissions control who can access each context
3. **Scalability**: All contexts served via HTTP streamable servers
4. **Discovery**: Clients can list available contexts
5. **Flexibility**: Contexts define what tools/resources are exposed

## Performance Considerations

1. **Event Bus**: Use efficient event emitter with backpressure
2. **Session Storage**: Handled by auth module
3. **Rate Limiting**: Configurable per endpoint
4. **Caching**: Response caching for idempotent endpoints
5. **Connection Pooling**: Reuse connections for protocols
6. **Graceful Shutdown**: Drain connections before stopping

## Deployment Architecture

### Cloudflared Tunnel Deployment

For secure external access without exposing ports:

```yaml
# cloudflared config
tunnel: systemprompt-os
credentials-file: /etc/cloudflared/creds.json
ingress:
  - hostname: api.systemprompt.example.com
    service: http://localhost:3000
    originRequest:
      httpHostHeader: "api.systemprompt.example.com"
      noTLSVerify: true
  - service: http_status:404
```

### Nginx Reverse Proxy

For traditional deployment with SSL termination:

```nginx
server {
    listen 443 ssl http2;
    server_name api.systemprompt.example.com;
    
    # SSL configuration
    ssl_certificate /etc/ssl/certs/cert.pem;
    ssl_certificate_key /etc/ssl/private/key.pem;
    
    # Proxy to SystemPrompt OS
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # WebSocket support
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Docker Deployment

The server must support containerized deployment:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci --production
EXPOSE 3000
CMD ["npm", "start"]
```

## Testing Requirements

### Integration Tests
- **Location**: `/var/www/html/systemprompt-os/tests/integration/server/`
- **Required Coverage**: 90%+
- **Test Categories**:
  - Protocol handler integration
  - Module registration flow
  - Event-based communication
  - Multi-context MCP routing
  - Authentication flow

### E2E Tests with Cloudflared
- **Location**: `/var/www/html/systemprompt-os/tests/e2e/docker/01-server-external.e2e.test.ts`
- **Requirements**:
  - Deploy server in Docker container
  - Establish cloudflared tunnel
  - Test external access
  - Verify SSL/TLS handling
  - Test all protocols through tunnel
  - Load testing through tunnel

### Test Implementation Rules

1. **Mock-Free Integration Tests**
   - Use real event bus
   - Test actual module registration
   - Verify end-to-end flows

2. **Docker-Based E2E Tests**
   ```typescript
   describe('Server External Access E2E', () => {
     let container: Docker.Container;
     let tunnelUrl: string;
     
     beforeAll(async () => {
       // Start server container
       container = await startServerContainer();
       
       // Establish cloudflared tunnel
       tunnelUrl = await establishTunnel(container);
     });
     
     test('HTTP endpoints accessible via tunnel', async () => {
       const response = await fetch(`${tunnelUrl}/health`);
       expect(response.status).toBe(200);
     });
     
     test('MCP server accessible via tunnel', async () => {
       const client = new McpClient(tunnelUrl);
       await client.connect();
       const tools = await client.listTools();
       expect(tools).toHaveLength(greaterThan(0));
     });
   });
   ```

3. **Performance Testing**
   - Test under load through tunnel
   - Measure latency impact
   - Verify connection stability

## Future Extensibility

The architecture supports future additions:
- GraphQL protocol handler
- gRPC protocol handler  
- Server-sent events
- WebRTC signaling
- Custom protocols
- Horizontal scaling with Redis
- Multi-region deployment
- Edge computing support