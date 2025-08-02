# MCP Module Rules

## Overview

The MCP (Model Context Protocol) module is a **management layer** that provides configuration, persistence, and permission management for MCP contexts. All MCP servers are HTTP streamable servers differentiated by contexts and permissions. The module acts as a wrapper around the @modelcontextprotocol/sdk, handling all administrative aspects while delegating actual protocol execution to the SDK.

## Core Responsibilities

### 1. MCP Context Management
- Create, read, update, delete MCP contexts
- Each context represents a specific capability boundary
- Store context configurations in the database
- Manage context metadata (name, description, capabilities)
- Track context usage and statistics

### 2. Context-Based Server Access
- All servers are HTTP streamable servers
- Contexts define what capabilities are exposed
- Permissions control who can access each context
- No distinction between "local" and "remote" - all are HTTP accessible

### 3. Permission Management
- Control access to MCP contexts
- Define which tools/resources/prompts are available per context
- Integrate with the permissions module for role-based access
- Audit context usage and tool execution
- Enforce security policies at the context level

### 4. Configuration Management
- Store MCP context configurations in the database
- Manage environment variables per context
- Handle authentication per context
- Support multiple contexts with different capability sets

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    MCP Module                           │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │           Context Management Layer               │  │
│  │  - Context CRUD operations                      │  │
│  │  - Context capability definition                │  │
│  │  - Permission enforcement per context           │  │
│  │  - Context-based routing                        │  │
│  └──────────────────────────────────────────────────┘  │
│                         │                               │
│                         ▼                               │
│  ┌──────────────────────────────────────────────────┐  │
│  │           Database Integration                   │  │
│  │  - MCPContextRepository                         │  │
│  │  - MCPPermissionRepository                      │  │
│  │  - Context configuration storage                │  │
│  └──────────────────────────────────────────────────┘  │
│                         │                               │
│                         ▼                               │
│  ┌──────────────────────────────────────────────────┐  │
│  │        MCP SDK Integration                      │  │
│  │  - Uses @modelcontextprotocol/sdk for:         │  │
│  │    • HTTP streamable server creation            │  │
│  │    • Protocol communication                     │  │
│  │    • Tool execution within context bounds       │  │
│  │    • Resource access with permissions           │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Database Schema

### mcp_contexts
```sql
CREATE TABLE mcp_contexts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  capabilities JSON NOT NULL, -- {tools: [], resources: [], prompts: []} - defines what this context exposes
  permissions JSON NOT NULL,  -- {roles: [], users: []} - who can access this context
  environment JSON,           -- Environment variables for this context
  metadata JSON,              -- Additional context metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### mcp_permissions
```sql
CREATE TABLE mcp_permissions (
  id TEXT PRIMARY KEY,
  context_id TEXT REFERENCES mcp_contexts(id),
  principal_type TEXT NOT NULL CHECK(principal_type IN ('user', 'role')),
  principal_id TEXT NOT NULL,
  capability_type TEXT NOT NULL CHECK(capability_type IN ('tool', 'resource', 'prompt')),
  capability_name TEXT NOT NULL,
  allowed BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(context_id, principal_type, principal_id, capability_type, capability_name)
);
```

## Module Exports

```typescript
interface IMCPModuleExports {
  // Context management
  contexts: {
    create(name: string, config: ContextConfig): Promise<MCPContext>;
    get(id: string): Promise<MCPContext | null>;
    getByName(name: string): Promise<MCPContext | null>;
    list(): Promise<MCPContext[]>;
    update(id: string, config: Partial<ContextConfig>): Promise<MCPContext>;
    delete(id: string): Promise<void>;
    
    // Check if a user/role can access a context
    canAccess(contextId: string, userId: string, roleIds: string[]): Promise<boolean>;
  };
  
  // Permission management
  permissions: {
    grant(contextId: string, principalType: 'user' | 'role', principalId: string, capability: Capability): Promise<void>;
    revoke(contextId: string, principalType: 'user' | 'role', principalId: string, capability: Capability): Promise<void>;
    check(contextId: string, userId: string, roleIds: string[], action: string): Promise<boolean>;
    listForContext(contextId: string): Promise<Permission[]>;
  };
  
  // SDK access (for protocol operations via HTTP streamable servers)
  sdk: {
    // Create HTTP streamable server for a context
    createServer(contextId: string): Promise<Server>;
    // Get or create client for a context
    getClient(contextId: string): Promise<Client>;
    // All actual protocol operations go through the SDK
  };
}
```

## Critical Rules

### 1. Separation of Concerns
- **Management**: The MCP module handles all administrative tasks
- **Execution**: The MCP SDK handles all protocol operations
- **Storage**: The database module handles all persistence
- **Never** implement protocol logic in the MCP module itself

### 2. SDK Usage
```typescript
// CORRECT: Use SDK for protocol operations via context
const client = await mcpModule.sdk.getClient(contextId);
const result = await client.callTool(toolName, args);

// WRONG: Implementing protocol logic in the module
const result = await mcpModule.executeTool(toolName, args);
```

### 3. Database Integration
- All configurations MUST be persisted in the database
- Use repository pattern for all database operations
- Never store sensitive data (like API keys) in plain text
- Use transactions for multi-step operations

### 4. Permission Checks
- Every MCP operation must check permissions first
- Integrate with the permissions module for role-based access
- Log all permission checks and operations for auditing
- Fail closed (deny by default)

### 5. Event-Driven Communication
- Emit events for all significant operations
- Listen for system events (shutdown, reload, etc.)
- Never block on long-running operations
- Use async/await for all SDK operations

## Implementation Pattern

```typescript
export class MCPModule extends BaseModule<IMCPModuleExports> {
  private contextRepo!: MCPContextRepository;
  private permissionRepo!: MCPPermissionRepository;
  private sdkClients: Map<string, Client> = new Map();
  private sdkServers: Map<string, Server> = new Map();
  
  protected async initializeModule(): Promise<void> {
    // Initialize repositories
    this.contextRepo = new MCPContextRepository(this.dependencies.database);
    this.permissionRepo = new MCPPermissionRepository(this.dependencies.database);
    
    // Register event listeners
    this.setupEventListeners();
  }
  
  private async createHTTPStreamableServer(contextId: string): Promise<Server> {
    // Get context from database
    const context = await this.contextRepo.get(contextId);
    if (!context) throw new Error(`Context ${contextId} not found`);
    
    // Create HTTP streamable server using MCP SDK
    const transport = new SSEServerTransport('/mcp/' + context.name, {
      headers: {
        'X-MCP-Context': context.name
      }
    });
    
    const server = new Server(
      {
        name: context.name,
        version: '1.0.0'
      },
      {
        transport,
        capabilities: context.capabilities
      }
    );
    
    // Register handlers based on context capabilities
    this.registerContextHandlers(server, context);
    
    await server.start();
    return server;
  }
  
  private async getOrCreateClient(contextId: string): Promise<Client> {
    if (this.sdkClients.has(contextId)) {
      return this.sdkClients.get(contextId)!;
    }
    
    const context = await this.contextRepo.get(contextId);
    if (!context) throw new Error(`Context ${contextId} not found`);
    
    // All clients connect via HTTP streamable transport
    const transport = new SSEClientTransport(
      new URL(`/mcp/${context.name}`, 'http://localhost:3000')
    );
    
    const client = new Client(
      { name: `client-${context.name}` },
      { transport }
    );
    
    await client.connect();
    this.sdkClients.set(contextId, client);
    return client;
  }
}
```

## Testing Requirements

### Unit Tests
- Test context CRUD operations
- Test server registration/unregistration
- Test permission checks
- Mock the MCP SDK for isolated testing

### Integration Tests
- Test with real MCP SDK
- Test database persistence
- Test permission integration
- Test event handling

### E2E Tests
- Test full MCP server lifecycle
- Test tool execution through SDK
- Test resource access through SDK
- Test multi-context scenarios

## Common Pitfalls to Avoid

1. **DO NOT** implement MCP protocol logic - use the SDK
2. **DO NOT** store SDK client instances in the database
3. **DO NOT** bypass permission checks for "convenience"
4. **DO NOT** hardcode server configurations
5. **DO NOT** mix management logic with protocol logic
6. **DO NOT** create circular dependencies with other modules

## Relationship with Other Modules

### Database Module
- The MCP module depends on the database module for persistence
- Uses repository pattern for all database operations
- Follows database module's transaction patterns

### Permissions Module
- Integrates with permissions module for access control
- Uses permissions module's role/user abstractions
- Delegates authorization decisions to permissions module

### Config Module
- May use config module for default settings
- Allows config overrides for MCP servers
- Stores sensitive configs securely

### Server Protocols
- The MCP protocol handler in the server uses this module
- Provides MCP capabilities to HTTP/WebSocket endpoints
- Handles context routing and session management

## Example Usage

```typescript
// Create a context with specific capabilities
const context = await mcpModule.contexts.create('cli-context', {
  description: 'SystemPrompt CLI execution context',
  capabilities: {
    tools: ['execute-cli', 'check-status'],
    resources: ['system:*'],
    prompts: []
  },
  permissions: {
    roles: ['admin'],
    users: []
  },
  environment: {
    NODE_ENV: 'production'
  }
});

// Grant additional permissions
await mcpModule.permissions.grant(
  context.id, 
  'role',
  'developer', 
  {
    type: 'tool',
    name: 'execute-cli'
  }
);

// Check if user can access context
const canAccess = await mcpModule.contexts.canAccess(
  context.id,
  userId,
  userRoles
);

// Use the SDK to execute operations
if (canAccess) {
  const client = await mcpModule.sdk.getClient(context.id);
  const tools = await client.listTools();
  const result = await client.callTool('execute-cli', {
    module: 'database',
    command: 'status'
  });
}
```

## Migration Strategy

1. Create database schema for MCP tables
2. Implement repository classes
3. Implement context management
4. Implement server registration
5. Integrate MCP SDK for execution
6. Add permission checks
7. Add event handling
8. Write comprehensive tests