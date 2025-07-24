# Server Infrastructure

HTTP server layer implementing the Model Context Protocol (MCP) specification, providing WebSocket-based communication, session management, and middleware for the SystemPrompt Coding Agent.

## Overview

This directory contains the core server infrastructure that:
- Hosts the MCP protocol over HTTP/WebSocket
- Manages per-session server instances
- Provides middleware for security and performance
- Handles configuration and environment setup

## Architecture

```
┌─────────────────┐
│   MCP Client    │
│  (WebSocket)    │
└────────┬────────┘
         │
┌────────▼────────┐
│  Express Server │
├─────────────────┤
│ • Rate Limiting │
│ • CORS          │
│ • Size Limits   │
│ • Validation    │
└────────┬────────┘
         │
┌────────▼────────┐
│   MCP Handler   │
│   (mcp.ts)      │
├─────────────────┤
│ • Session Mgmt  │
│ • Server Factory│
│ • Transport     │
└────────┬────────┘
         │
┌────────▼────────┐
│  MCP SDK Server │
│  (per session)  │
└─────────────────┘
```

## Core Components

### 🌐 `mcp.ts`
Main MCP protocol handler implementing session-based server management.

#### Key Features:
- **Per-Session Servers**: Each client gets isolated server instance
- **StreamableHTTPServerTransport**: WebSocket-based communication
- **Handler Registration**: Routes MCP methods to handlers
- **Session Lifecycle**: Creation, management, cleanup

#### Implementation:
```typescript
// Session storage
const sessions = new Map<string, SessionInfo>();

// Create session
export async function handleMCPRequest(req, res) {
  const sessionId = generateSessionId();
  
  // Create new server instance
  const server = new Server(serverConfig, serverCapabilities);
  const transport = new StreamableHTTPServerTransport();
  
  // Register handlers
  server.setRequestHandler(ListToolsRequestSchema, handleListTools);
  server.setRequestHandler(CallToolRequestSchema, handleToolCall);
  // ... more handlers
  
  // Store session
  sessions.set(sessionId, { server, transport });
  
  // Handle request
  await transport.handleRequest(req, res);
}
```

### ⚙️ `config.ts`
Server configuration and environment management.

#### Configuration Options:
```typescript
export const config = {
  // Server settings
  port: process.env.PORT || 3000,
  host: process.env.HOST || '0.0.0.0',
  
  // Security
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*'],
  jwtSecret: process.env.JWT_SECRET,
  
  // Rate limiting
  rateLimitWindow: 60000, // 1 minute
  rateLimitMax: 100,      // requests per window
  
  // Request handling
  requestSizeLimit: '10mb',
  sessionTimeout: 1800000, // 30 minutes
  
  // Features
  enableMetrics: process.env.ENABLE_METRICS === 'true',
  enableHealthCheck: true
};
```

### 🛡️ `middleware.ts`
Express middleware for security and performance.

#### Middleware Stack:

##### Rate Limiting
```typescript
export const rateLimitMiddleware = rateLimit({
  windowMs: config.rateLimitWindow,
  max: config.rateLimitMax,
  message: 'Too many requests',
  standardHeaders: true,
  legacyHeaders: false
});
```

##### Protocol Version Validation
```typescript
export function validateProtocolVersion(req, res, next) {
  const version = req.headers['mcp-version'];
  if (version && !SUPPORTED_VERSIONS.includes(version)) {
    return res.status(400).json({
      error: 'Unsupported protocol version'
    });
  }
  next();
}
```

##### Request Size Limiting
```typescript
export const requestSizeLimit = express.json({
  limit: config.requestSizeLimit,
  strict: true,
  type: 'application/json'
});
```

##### CORS Configuration
```typescript
export const corsMiddleware = cors({
  origin: config.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'MCP-Version']
});
```

### 📝 `types.ts`
TypeScript type definitions for server components.

```typescript
// Session information
export interface SessionInfo {
  server: Server;
  transport: StreamableHTTPServerTransport;
  createdAt: number;
  lastActivity: number;
  metadata?: Record<string, unknown>;
}

// Server configuration
export interface ServerConfig {
  port: number;
  host: string;
  corsOrigins: string[];
  // ... more config
}

// Request context
export interface RequestContext {
  sessionId: string;
  clientId?: string;
  timestamp: number;
}
```

## Session Management

### Session Creation
1. Client connects to `/mcp` endpoint
2. New session ID generated
3. Server instance created
4. Transport configured
5. Handlers registered

### Session Lifecycle
- **Creation**: On first connection
- **Activity Tracking**: Updates on each request
- **Timeout**: After 30 minutes inactivity
- **Cleanup**: Removes server instance

### Session Isolation
Each session has:
- Dedicated Server instance
- Isolated state
- Separate handler context
- Independent lifecycle

## Request Flow

### Initial Connection
```
1. Client → POST /mcp
2. Middleware validation
3. Session creation
4. Server instantiation
5. WebSocket upgrade
6. Ready for commands
```

### Command Execution
```
1. Client → MCP command
2. Transport receives
3. Server routes to handler
4. Handler executes
5. Response sent
6. Session updated
```

## Security Features

### Input Validation
- Protocol version checking
- Request size limits
- JSON schema validation
- Parameter sanitization

### Rate Limiting
- Per-IP rate limiting
- Configurable windows
- Bypass for health checks
- Custom error responses

### CORS Protection
- Configurable origins
- Credential support
- Preflight handling
- Header restrictions

## Performance Optimizations

### Connection Pooling
- Reuse HTTP connections
- WebSocket keep-alive
- Efficient serialization

### Resource Management
- Session timeout
- Memory limits
- Graceful shutdown
- Cleanup routines

## Health Monitoring

### Health Check Endpoint
```typescript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    sessions: sessions.size,
    memory: process.memoryUsage()
  });
});
```

### Metrics Collection
- Request counts
- Response times
- Error rates
- Session metrics

## Error Handling

### Error Types
1. **Protocol Errors**: Invalid MCP format
2. **Session Errors**: Invalid/expired sessions
3. **Handler Errors**: Tool execution failures
4. **Transport Errors**: Connection issues

### Error Responses
```typescript
{
  jsonrpc: "2.0",
  error: {
    code: -32600,
    message: "Invalid Request",
    data: { details: "..." }
  },
  id: null
}
```

## Configuration

### Environment Variables
```bash
# Server
PORT=3000
HOST=0.0.0.0

# Security
CORS_ORIGINS=http://localhost:3000,https://app.example.com
JWT_SECRET=your-secret-key

# Performance
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100
REQUEST_SIZE_LIMIT=10mb

# Features
ENABLE_METRICS=true
SESSION_TIMEOUT=1800000
```

### Dynamic Configuration
Some settings can be changed at runtime:
- Rate limits
- CORS origins
- Session timeouts
- Feature flags

## Extending the Server

### Adding Middleware
```typescript
// middleware/custom.ts
export function customMiddleware(req, res, next) {
  // Custom logic
  next();
}

// Apply in mcp.ts
app.use('/mcp', customMiddleware);
```

### Custom Handlers
```typescript
// Register new handler
server.setRequestHandler(
  CustomRequestSchema,
  async (request) => {
    // Handle custom request
    return { result: 'success' };
  }
);
```

### Session Extensions
```typescript
// Add session metadata
interface ExtendedSessionInfo extends SessionInfo {
  userId?: string;
  permissions?: string[];
}
```

## Best Practices

1. **Session Management**
   - Clean up inactive sessions
   - Limit sessions per IP
   - Monitor session growth

2. **Error Handling**
   - Log all errors with context
   - Return meaningful error messages
   - Don't expose internals

3. **Performance**
   - Use streaming for large responses
   - Implement caching where appropriate
   - Monitor resource usage

4. **Security**
   - Validate all inputs
   - Use rate limiting
   - Keep dependencies updated

## Testing

### Unit Tests
```typescript
describe('MCP Server', () => {
  it('should create new session', async () => {
    const response = await request(app)
      .post('/mcp')
      .expect(200);
    
    expect(response.body.sessionId).toBeDefined();
  });
});
```

### Integration Tests
- Test full request flow
- Verify session isolation
- Check error handling
- Validate middleware

## Monitoring

Key metrics to track:
- Active sessions
- Request rate
- Error rate
- Response times
- Memory usage

## Future Enhancements

- WebSocket ping/pong
- Session persistence
- Horizontal scaling
- Request queuing
- Advanced rate limiting

This server infrastructure provides a robust, secure, and scalable foundation for the MCP protocol implementation.