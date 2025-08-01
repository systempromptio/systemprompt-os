# HTTP Protocol Handler Rules

## Overview

The HTTP protocol handler manages all REST API endpoints, web routes, and HTTP-specific concerns like middleware, CORS, and cookies. It translates HTTP requests into events for modules.

## Responsibilities

1. **Express App Management**
   - Initialize and configure Express
   - Set up base middleware (body parser, CORS)
   - Handle static file serving

2. **Route Management**
   - Dynamic route registration
   - Route parameter extraction
   - Query string parsing

3. **HTTP-Specific Features**
   - Cookie handling
   - Session middleware
   - File uploads
   - Response compression

4. **Security Middleware**
   - CORS configuration
   - Security headers
   - Rate limiting
   - CSRF protection

## Structure

```typescript
export class HttpProtocol implements IProtocolHandler {
  private app: Express;
  private server: Server;
  private routes: Map<string, IHttpEndpoint>;
  
  async initialize(serverCore: IServerCore): Promise<void> {
    this.app = express();
    this.setupBaseMiddleware();
    this.listenForRegistrations(serverCore.eventBus);
  }
  
  async start(config: IHttpConfig): Promise<void> {
    this.server = this.app.listen(config.port);
  }
}
```

## Endpoint Registration

HTTP endpoints include additional HTTP-specific options:

```typescript
interface IHttpEndpoint extends IEndpointDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  middleware?: RequestHandler[];
  upload?: IUploadConfig;
  cache?: ICacheConfig;
  cors?: ICorsConfig;
}
```

### Registration Example
```typescript
// Module emits
eventBus.emit(ServerEvents.REGISTER_ENDPOINT, {
  protocol: 'http',
  method: 'POST',
  path: '/api/users',
  auth: { required: true, roles: ['admin'] },
  validation: {
    body: UserCreateSchema
  },
  handler: 'users.create'
});

// HTTP handler receives and creates route
this.app.post('/api/users', 
  this.authMiddleware(endpoint.auth),
  this.validationMiddleware(endpoint.validation),
  async (req, res) => {
    const result = await this.handleRequest(endpoint, req);
    res.json(result);
  }
);
```

## Middleware Pipeline

### Order of Middleware
1. Security headers
2. CORS
3. Body parsing
4. Cookie parsing
5. Session management
6. Authentication (if required)
7. Rate limiting (per endpoint)
8. Validation
9. Route handler
10. Error handling

### Standard Middleware
```typescript
private setupBaseMiddleware() {
  // Security
  this.app.use(helmet());
  
  // CORS
  this.app.use(cors(this.corsConfig));
  
  // Body parsing
  this.app.use(express.json({ limit: '10mb' }));
  this.app.use(express.urlencoded({ extended: true }));
  
  // Cookies
  this.app.use(cookieParser());
  
  // Request ID
  this.app.use(this.requestIdMiddleware());
}
```

## Request Handling

### Request Flow
1. Receive HTTP request
2. Apply middleware pipeline
3. Extract request data
4. Emit event to module
5. Wait for response
6. Format and send response

### Implementation
```typescript
private async handleRequest(
  endpoint: IHttpEndpoint,
  req: Request,
  res: Response
): Promise<void> {
  try {
    // Create common request format
    const request = {
      requestId: req.id,
      method: req.method,
      path: req.path,
      params: req.params,
      query: req.query,
      body: req.body,
      headers: req.headers,
      user: req.user,
      files: req.files
    };
    
    // Emit to module
    const response = await this.eventBus.emitAndWait(
      endpoint.handler,
      request,
      { timeout: endpoint.timeout || 30000 }
    );
    
    // Send response
    this.sendResponse(res, response);
  } catch (error) {
    this.handleError(res, error);
  }
}
```

## Response Handling

### Standard Response Format
```typescript
interface IHttpResponse {
  status?: number;
  headers?: Record<string, string>;
  body?: any;
  redirect?: string;
  stream?: Readable;
  file?: IFileResponse;
}
```

### Response Types
```typescript
private sendResponse(res: Response, response: IHttpResponse) {
  // Set headers
  if (response.headers) {
    Object.entries(response.headers).forEach(([key, value]) => {
      res.header(key, value);
    });
  }
  
  // Handle different response types
  if (response.redirect) {
    res.redirect(response.status || 302, response.redirect);
  } else if (response.stream) {
    response.stream.pipe(res);
  } else if (response.file) {
    res.sendFile(response.file.path, response.file.options);
  } else {
    res.status(response.status || 200).json(response.body);
  }
}
```

## Error Handling

### Error Response Format
```typescript
private handleError(res: Response, error: any) {
  const status = error.status || 500;
  const message = error.expose ? error.message : 'Internal Server Error';
  
  res.status(status).json({
    error: {
      message,
      code: error.code,
      timestamp: new Date().toISOString()
    }
  });
  
  // Log error
  this.eventBus.emit(ServerEvents.ERROR, {
    protocol: 'http',
    error,
    request: res.locals.request
  });
}
```

## Authentication Integration

Authentication is handled by emitting events to the auth module:

```typescript
private authMiddleware(config: IAuthConfig): RequestHandler {
  return async (req, res, next) => {
    if (!config.required) return next();
    
    try {
      const token = this.extractToken(req);
      
      const auth = await this.eventBus.emitAndWait(
        'auth.validate',
        { token, roles: config.roles },
        { timeout: 5000 }
      );
      
      req.user = auth.user;
      next();
    } catch (error) {
      res.status(401).json({ error: 'Unauthorized' });
    }
  };
}
```

## Special Routes

### Health Check
```typescript
// Automatically registered
this.app.get('/health', async (req, res) => {
  const health = await this.getHealth();
  res.status(health.healthy ? 200 : 503).json(health);
});
```

### OAuth Callbacks
```typescript
// OAuth routes are special - they need state management
this.app.get('/oauth/callback/:provider', async (req, res) => {
  const result = await this.eventBus.emitAndWait(
    'auth.oauth.callback',
    {
      provider: req.params.provider,
      code: req.query.code,
      state: req.query.state
    }
  );
  
  if (result.redirect) {
    res.redirect(result.redirect);
  } else {
    res.json(result);
  }
});
```

## Rules

1. **No Business Logic**
   - HTTP handler only handles HTTP concerns
   - All business logic in modules
   - No data validation beyond structure

2. **Event-Based Only**
   - Never import modules
   - All communication via events
   - Wait for responses with timeout

3. **Middleware Composition**
   - Each endpoint can add middleware
   - Middleware order is critical
   - Error middleware must be last

4. **Security First**
   - Always use security headers
   - Validate all inputs
   - Sanitize all outputs

5. **Performance**
   - Use compression for responses
   - Implement caching where specified
   - Stream large responses

## Testing

### Unit Tests
- Test middleware ordering
- Test request parsing
- Test response formatting
- Test error handling

### Integration Tests
- Test full request cycle
- Test authentication flow
- Test file uploads
- Test streaming responses