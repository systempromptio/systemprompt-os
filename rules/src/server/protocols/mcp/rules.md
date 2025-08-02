# MCP Protocol Handler Rules

## Overview

The MCP (Model Context Protocol) handler provides HTTP access to MCP contexts. All MCP servers are HTTP streamable servers, differentiated only by contexts and permissions. The handler routes requests to appropriate contexts based on the `X-MCP-Context` header.

## Core Responsibilities

1. **Context-Based Routing**
   - Route requests to appropriate context based on header
   - Validate context permissions before processing
   - Handle multi-context scenarios

2. **Session Management**
   - Create and track MCP sessions per context
   - Session timeout and cleanup
   - Context-aware session handling

3. **Request Processing**
   - Forward MCP requests to the MCP module
   - MCP module uses SDK to handle actual execution
   - Format responses according to MCP protocol

4. **HTTP Streamable Server**
   - All contexts exposed via HTTP/SSE
   - Support for streaming responses
   - Handle long-running operations

## Architecture

```typescript
export class McpProtocol implements IProtocolHandler {
  private contexts: Map<string, McpContext>;
  private sessions: Map<string, IMcpSession>;
  
  async initialize(serverCore: IServerCore): Promise<void> {
    // Get available contexts from MCP module
    await this.loadContexts();
    // Set up HTTP endpoints
    this.registerEndpoints(serverCore.eventBus);
  }
  
  async handleRequest(req: Request): Promise<Response> {
    const contextName = req.headers['x-mcp-context'];
    const context = await this.mcpModule.contexts.getByName(contextName);
    
    if (!context) {
      return new Response('Context not found', { status: 404 });
    }
    
    // Check permissions
    const canAccess = await this.mcpModule.contexts.canAccess(
      context.id,
      req.user?.id,
      req.user?.roles
    );
    
    if (!canAccess) {
      return new Response('Unauthorized', { status: 403 });
    }
    
    // Forward to MCP module's SDK
    const client = await this.mcpModule.sdk.getClient(context.id);
    return await this.processWithSDK(client, req);
  }
}
```

## Context Registration

Contexts are created via the MCP module, not directly registered:

```typescript
// Context creation via MCP module
const context = await mcpModule.contexts.create('git-tools', {
  description: 'Git operations context',
  capabilities: {
    tools: ['git-commit', 'git-status', 'git-log'],
    resources: ['git://status', 'git://log'],
    prompts: []
  },
  permissions: {
    roles: ['developer', 'admin'],
    users: []
  },
  environment: {
    GIT_AUTHOR_NAME: 'SystemPrompt',
    GIT_AUTHOR_EMAIL: 'system@prompt.io'
  }
});
```

The MCP protocol handler then:
1. Loads available contexts from MCP module
2. Exposes each context at `/mcp` with header routing
3. Enforces permissions per context
4. Uses MCP SDK for actual protocol operations

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