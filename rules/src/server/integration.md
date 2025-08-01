# Server-Module Integration Guide

## Overview

This document outlines how the server's event-driven architecture integrates with core modules that haven't been developed yet. It provides concrete examples and patterns for module developers to follow.

## Integration Architecture

### Event Flow Diagram
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   Server    │────▶│   Module    │
└─────────────┘     └─────────────┘     └─────────────┘
       │                    │                    │
       │ HTTP/MCP Request   │ Event Bus         │
       │                    │                    │
       └────────────────────┼────────────────────┘
                            │
                     ┌──────▼──────┐
                     │  Event Bus  │
                     └─────────────┘
```

## Module Registration Examples

### 1. Basic HTTP Endpoint Registration

**Git Module Example**:
```typescript
// modules/core/git/index.ts
export class GitModule extends BaseModule {
  async initialize(): Promise<void> {
    // Register HTTP endpoints
    this.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
      moduleId: 'git',
      endpoints: [
        {
          protocol: 'http',
          method: 'GET',
          path: '/api/git/status',
          handler: 'git.status',
          auth: { required: true },
          rateLimit: { window: 60000, max: 100 }
        },
        {
          protocol: 'http',
          method: 'POST',
          path: '/api/git/commit',
          handler: 'git.commit',
          auth: { required: true, roles: ['developer'] },
          validation: {
            body: {
              type: 'object',
              properties: {
                message: { type: 'string', minLength: 1 },
                files: { type: 'array', items: { type: 'string' } }
              },
              required: ['message', 'files']
            }
          }
        }
      ]
    });
    
    // Listen for handler events
    this.eventBus.on('git.status', this.handleStatus.bind(this));
    this.eventBus.on('git.commit', this.handleCommit.bind(this));
  }
  
  private async handleStatus(event: RequestEvent) {
    try {
      const status = await this.gitService.getStatus();
      this.eventBus.emit(`response.${event.requestId}`, {
        data: status
      });
    } catch (error) {
      this.eventBus.emit(`response.${event.requestId}`, {
        error: { code: 'GIT_ERROR', message: error.message }
      });
    }
  }
}
```

### 2. MCP Context Registration

**Terminal Module Example**:
```typescript
// modules/core/terminal/index.ts
export class TerminalModule extends BaseModule {
  async initialize(): Promise<void> {
    // Register MCP context
    this.eventBus.emit(ServerEvents.REGISTER_MCP_CONTEXT, {
      moduleId: 'terminal',
      context: 'terminal-access',
      capabilities: {
        tools: [
          {
            name: 'execute-command',
            description: 'Execute a shell command',
            inputSchema: {
              type: 'object',
              properties: {
                command: { type: 'string' },
                cwd: { type: 'string' }
              },
              required: ['command']
            }
          }
        ],
        resources: [
          {
            uri: 'terminal://history',
            name: 'Command History',
            description: 'Recent command history'
          }
        ]
      },
      metadata: {
        name: 'Terminal Access',
        version: '1.0.0',
        description: 'Secure terminal access via MCP'
      }
    });
    
    // Listen for MCP tool calls
    this.eventBus.on('mcp.terminal.tool.execute-command', this.executeCommand.bind(this));
    this.eventBus.on('mcp.terminal.resource.read', this.readResource.bind(this));
  }
}
```

### 3. WebSocket Subscription Registration

**Monitor Module Example**:
```typescript
// modules/core/monitor/index.ts
export class MonitorModule extends BaseModule {
  async initialize(): Promise<void> {
    // Register WebSocket subscriptions
    this.eventBus.emit(ServerEvents.REGISTER_WS_TOPICS, {
      moduleId: 'monitor',
      topics: [
        {
          name: 'monitor.cpu',
          description: 'CPU usage updates',
          auth: { required: true },
          schema: {
            type: 'object',
            properties: {
              usage: { type: 'number' },
              cores: { type: 'array' }
            }
          }
        },
        {
          name: 'monitor.logs',
          description: 'Real-time log streaming',
          auth: { required: true, roles: ['admin'] }
        }
      ]
    });
    
    // Start monitoring and broadcasting
    this.startMonitoring();
  }
  
  private startMonitoring() {
    setInterval(() => {
      const cpuData = this.getCpuUsage();
      this.eventBus.emit(ServerEvents.BROADCAST, {
        topic: 'monitor.cpu',
        data: cpuData
      });
    }, 5000);
  }
}
```

## Authentication Integration

### How Auth Module Integrates

```typescript
// modules/core/auth/index.ts
export class AuthModule extends BaseModule {
  async initialize(): Promise<void> {
    // Register auth validation handler
    this.eventBus.on('auth.validate', this.validateToken.bind(this));
    this.eventBus.on('auth.check.permission', this.checkPermission.bind(this));
    
    // Register OAuth endpoints
    this.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
      moduleId: 'auth',
      endpoints: [
        {
          protocol: 'http',
          method: 'GET',
          path: '/oauth/authorize',
          handler: 'auth.oauth.authorize',
          auth: { required: false } // Public endpoint
        },
        {
          protocol: 'http',
          method: 'GET',
          path: '/oauth/callback/:provider',
          handler: 'auth.oauth.callback',
          auth: { required: false }
        }
      ]
    });
  }
  
  private async validateToken(event: AuthValidateEvent) {
    try {
      const session = await this.sessionService.validate(event.token);
      this.eventBus.emit(`response.${event.requestId}`, {
        data: {
          user: session.user,
          session: session
        }
      });
    } catch (error) {
      this.eventBus.emit(`response.${event.requestId}`, {
        error: { code: 'UNAUTHORIZED', message: 'Invalid token' }
      });
    }
  }
}
```

## Complex Integration Patterns

### 1. Cross-Module Communication

When modules need to interact:

```typescript
// Task module needs user information
class TaskModule extends BaseModule {
  async createTask(event: RequestEvent) {
    const { userId, taskData } = event.body;
    
    // Request user info from users module
    const userResponse = await this.eventBus.emitAndWait(
      'users.get',
      { userId },
      { timeout: 5000 }
    );
    
    if (!userResponse.user) {
      throw new Error('User not found');
    }
    
    // Create task with user context
    const task = await this.taskService.create({
      ...taskData,
      assignedTo: userResponse.user
    });
    
    // Notify via broadcast
    this.eventBus.emit(ServerEvents.BROADCAST, {
      topic: 'tasks.created',
      data: task,
      filter: { userId } // Only broadcast to specific user
    });
  }
}
```

### 2. MCP Tool Chaining

Modules can expose tools that work together:

```typescript
// Git module tool
this.eventBus.on('mcp.git.tool.stage-files', async (event) => {
  const { files } = event.arguments;
  await this.gitService.stageFiles(files);
  
  // Return structured response for chaining
  return {
    content: [{
      type: 'text',
      text: `Staged ${files.length} files`
    }],
    metadata: {
      staged_files: files,
      ready_to_commit: true
    }
  };
});

// Terminal module can use git results
this.eventBus.on('mcp.terminal.tool.commit-staged', async (event) => {
  // Can access metadata from previous tool
  const { message } = event.arguments;
  const result = await this.execute(`git commit -m "${message}"`);
  
  return {
    content: [{
      type: 'text',
      text: result.stdout
    }]
  };
});
```

### 3. Resource Aggregation

Multiple modules contributing to a single resource:

```typescript
// System module exposes aggregated status
this.eventBus.on('mcp.system.resource.read', async (event) => {
  if (event.path === '/status') {
    // Gather status from all modules
    const statuses = await Promise.all([
      this.eventBus.emitAndWait('git.get-status', {}, { timeout: 1000 }),
      this.eventBus.emitAndWait('terminal.get-status', {}, { timeout: 1000 }),
      this.eventBus.emitAndWait('monitor.get-status', {}, { timeout: 1000 })
    ]);
    
    return {
      mimeType: 'application/json',
      content: JSON.stringify({
        modules: statuses,
        timestamp: new Date().toISOString()
      })
    };
  }
});
```

## Error Handling Patterns

### Structured Error Responses

```typescript
interface ModuleError {
  code: string;           // MODULE_SPECIFIC_ERROR
  message: string;        // Human-readable message
  details?: any;          // Additional error context
  recoverable?: boolean;  // Can retry?
}

// Example implementation
private async handleRequest(event: RequestEvent) {
  try {
    // ... module logic
  } catch (error) {
    if (error instanceof ValidationError) {
      this.emitError(event.requestId, {
        code: 'VALIDATION_ERROR',
        message: error.message,
        details: error.validationErrors,
        recoverable: false
      });
    } else if (error instanceof NetworkError) {
      this.emitError(event.requestId, {
        code: 'NETWORK_ERROR',
        message: 'Failed to connect to service',
        recoverable: true
      });
    } else {
      this.emitError(event.requestId, {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        recoverable: false
      });
    }
  }
}
```

## Testing Module Integration

### Integration Test Example

```typescript
// tests/integration/server/git-module.integration.test.ts
describe('Git Module Server Integration', () => {
  let server: ServerCore;
  let gitModule: GitModule;
  
  beforeAll(async () => {
    // Start server with test configuration
    server = new ServerCore({ port: 0 }); // Random port
    await server.start();
    
    // Initialize git module
    gitModule = new GitModule();
    await gitModule.initialize();
  });
  
  test('HTTP endpoint registration', async () => {
    // Verify endpoints are registered
    const endpoints = server.getRegisteredEndpoints();
    expect(endpoints).toContainEqual(
      expect.objectContaining({
        path: '/api/git/status',
        method: 'GET'
      })
    );
  });
  
  test('MCP context registration', async () => {
    // Verify MCP context
    const contexts = server.getMcpContexts();
    expect(contexts).toContain('git-tools');
  });
  
  test('End-to-end request flow', async () => {
    // Make actual HTTP request
    const response = await fetch(`http://localhost:${server.port}/api/git/status`, {
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('branch');
  });
});
```

## Best Practices

### 1. Event Naming Convention
```
{module}.{action}                    // Module-specific events
mcp.{module}.{type}.{action}        // MCP-specific events
response.{requestId}                // Response events
error.{requestId}                   // Error events
```

### 2. Timeout Handling
```typescript
// Always use timeouts for cross-module communication
const response = await this.eventBus.emitAndWait(
  'other.module.action',
  data,
  { 
    timeout: 5000, // 5 seconds
    retries: 3     // Retry on timeout
  }
);
```

### 3. Resource Cleanup
```typescript
class MyModule extends BaseModule {
  private listeners: Array<() => void> = [];
  
  async initialize() {
    // Track all listeners
    const removeListener = this.eventBus.on('event', handler);
    this.listeners.push(removeListener);
  }
  
  async shutdown() {
    // Clean up all listeners
    this.listeners.forEach(remove => remove());
    this.listeners = [];
  }
}
```

### 4. Health Checks
```typescript
// Modules should expose health status
this.eventBus.on(`${this.name}.health`, async (event) => {
  const health = await this.checkHealth();
  this.eventBus.emit(`response.${event.requestId}`, {
    data: {
      healthy: health.isHealthy,
      version: this.version,
      uptime: this.getUptime(),
      metrics: health.metrics
    }
  });
});
```

## Module Development Checklist

- [ ] Extend BaseModule class
- [ ] Register all endpoints in initialize()
- [ ] Use event bus for all external communication
- [ ] Implement proper error handling
- [ ] Add request validation
- [ ] Include rate limiting config
- [ ] Define authentication requirements
- [ ] Clean up resources in shutdown()
- [ ] Write integration tests
- [ ] Document API endpoints
- [ ] Follow naming conventions
- [ ] Implement health checks