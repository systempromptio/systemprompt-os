# MCP Protocol Handler Rules

## Overview

The MCP (Model Context Protocol) handler enables modules to expose tools, resources, and prompts via the MCP protocol. It manages MCP server instances, sessions, and translates between MCP requests and module events.

## Core Responsibilities

1. **MCP Server Management**
   - Create MCP server instances per module
   - Manage server lifecycle
   - Handle server registration/unregistration

2. **Session Management**
   - Create and track MCP sessions
   - Session timeout and cleanup
   - Session-to-module mapping

3. **Request Routing**
   - Route MCP requests to appropriate modules
   - Handle tool calls, resource reads, prompt requests
   - Manage response formatting

4. **Protocol Translation**
   - Convert MCP requests to module events
   - Format module responses as MCP responses
   - Handle streaming responses

## Architecture

```typescript
export class McpProtocol implements IProtocolHandler {
  private servers: Map<string, IMcpServerInstance>;
  private sessions: Map<string, IMcpSession>;
  private transport: StreamableHTTPServerTransport;
  
  async initialize(serverCore: IServerCore): Promise<void> {
    this.listenForMcpRegistrations(serverCore.eventBus);
    this.setupTransport();
  }
}
```

## MCP Server Registration

Modules register their MCP capabilities:

```typescript
interface IMcpRegistration {
  moduleId: string;
  capabilities: {
    tools?: IMcpTool[];
    resources?: IMcpResource[];
    prompts?: IMcpPrompt[];
    resourceTemplates?: IMcpResourceTemplate[];
  };
  metadata: {
    name: string;
    version: string;
    description: string;
  };
}
```

### Registration Example
```typescript
// Module emits registration
eventBus.emit(ServerEvents.REGISTER_MCP_SERVER, {
  moduleId: 'git-tools',
  capabilities: {
    tools: [
      {
        name: 'git-commit',
        description: 'Create a git commit',
        inputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            files: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    ],
    resources: [
      {
        uri: 'git://status',
        name: 'Git Status',
        description: 'Current git repository status'
      }
    ]
  },
  metadata: {
    name: 'Git Tools',
    version: '1.0.0',
    description: 'Git operations via MCP'
  }
});
```

## Request Handling

### Tool Calls
```typescript
private async handleToolCall(request: CallToolRequest, session: IMcpSession) {
  // Extract module and tool from name (format: "module:tool")
  const [moduleId, toolName] = request.params.name.split(':');
  
  // Emit to module
  const result = await this.eventBus.emitAndWait(
    `mcp.${moduleId}.tool.${toolName}`,
    {
      sessionId: session.id,
      tool: toolName,
      arguments: request.params.arguments,
      user: session.user
    },
    { timeout: 60000 } // Tools may take longer
  );
  
  return {
    content: [
      {
        type: 'text',
        text: result.output
      }
    ]
  };
}
```

### Resource Reading
```typescript
private async handleResourceRead(request: ReadResourceRequest, session: IMcpSession) {
  const uri = new URL(request.params.uri);
  const moduleId = uri.protocol.slice(0, -1); // Remove trailing ':'
  
  const result = await this.eventBus.emitAndWait(
    `mcp.${moduleId}.resource.read`,
    {
      sessionId: session.id,
      path: uri.pathname,
      query: Object.fromEntries(uri.searchParams),
      user: session.user
    }
  );
  
  return {
    contents: [
      {
        uri: request.params.uri,
        mimeType: result.mimeType || 'text/plain',
        text: result.content
      }
    ]
  };
}
```

## Session Management

### Session Lifecycle
```typescript
interface IMcpSession {
  id: string;
  serverId: string;
  user?: IUser;
  createdAt: Date;
  lastAccessed: Date;
  metadata: Record<string, any>;
}

private async createSession(serverId: string): Promise<IMcpSession> {
  const session: IMcpSession = {
    id: generateSessionId(),
    serverId,
    createdAt: new Date(),
    lastAccessed: new Date(),
    metadata: {}
  };
  
  this.sessions.set(session.id, session);
  
  // Emit session created event
  this.eventBus.emit(ServerEvents.MCP_SESSION_CREATED, {
    sessionId: session.id,
    serverId
  });
  
  return session;
}
```

### Session Cleanup
```typescript
private startSessionCleanup() {
  setInterval(() => {
    const now = Date.now();
    const timeout = 30 * 60 * 1000; // 30 minutes
    
    for (const [id, session] of this.sessions) {
      if (now - session.lastAccessed.getTime() > timeout) {
        this.closeSession(id);
      }
    }
  }, 60000); // Check every minute
}
```

## Multi-Module MCP Servers

The MCP protocol handler can expose multiple module servers:

```typescript
// Single MCP endpoint serves all registered modules
this.app.post('/mcp', async (req, res) => {
  const { method } = req.body;
  
  switch (method) {
    case 'initialize':
      // Return capabilities from ALL registered modules
      return this.handleInitialize(req, res);
      
    case 'tools/list':
      // Aggregate tools from all modules
      return this.handleListTools(req, res);
      
    case 'tools/call':
      // Route to appropriate module
      return this.handleToolCall(req, res);
  }
});
```

### Capability Aggregation
```typescript
private getAggregatedCapabilities(): ServerCapabilities {
  const capabilities: ServerCapabilities = {};
  
  for (const [moduleId, server] of this.servers) {
    // Merge tools with module prefix
    if (server.capabilities.tools) {
      capabilities.tools = {
        ...capabilities.tools,
        ...this.prefixTools(moduleId, server.capabilities.tools)
      };
    }
    
    // Merge resources
    if (server.capabilities.resources) {
      capabilities.resources = {
        ...capabilities.resources,
        subscribe: true
      };
    }
  }
  
  return capabilities;
}
```

## Authentication

MCP sessions can be authenticated:

```typescript
private async authenticateSession(token?: string): Promise<IUser | undefined> {
  if (!token) return undefined;
  
  try {
    const auth = await this.eventBus.emitAndWait(
      'auth.validate',
      { token },
      { timeout: 5000 }
    );
    
    return auth.user;
  } catch {
    return undefined;
  }
}
```

## Error Handling

MCP errors must follow the JSON-RPC format:

```typescript
private formatError(error: any): JsonRpcError {
  return {
    code: error.code || -32603,
    message: error.message || 'Internal error',
    data: error.data
  };
}

private sendError(res: Response, error: any, id: any) {
  res.json({
    jsonrpc: '2.0',
    error: this.formatError(error),
    id
  });
}
```

## Rules

1. **Module Isolation**
   - Each module's MCP server is isolated
   - No shared state between modules
   - Tools namespaced by module ID

2. **Event-Based Communication**
   - All module interaction via events
   - Never import modules directly
   - Use timeout for all requests

3. **Session Safety**
   - Sessions are ephemeral
   - Clean up inactive sessions
   - Don't store sensitive data

4. **Protocol Compliance**
   - Follow MCP specification exactly
   - Validate all inputs/outputs
   - Handle all required methods

5. **Performance**
   - Stream large responses
   - Implement request queuing
   - Cache capability lists

## Testing

### Unit Tests
- Test request parsing
- Test response formatting
- Test session management
- Test error handling

### Integration Tests
- Test tool execution
- Test resource reading
- Test multi-module aggregation
- Test authentication flow

### Protocol Compliance Tests
- Validate against MCP spec
- Test with MCP clients
- Test edge cases