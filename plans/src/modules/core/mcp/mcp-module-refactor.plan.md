# MCP Module Refactor Plan

## Current State Analysis

The MCP module is currently trying to:
1. Directly handle tool execution (incorrect)
2. Mix management logic with execution logic
3. Not properly using the MCP SDK
4. Missing database integration for persistence

## Target Architecture

The MCP module should be:
- **Management Layer**: Handles contexts, servers, permissions, configuration
- **Database-Backed**: All configurations persisted in database
- **SDK Delegator**: Uses @modelcontextprotocol/sdk for ALL protocol operations
- **Permission-Aware**: Integrates with permissions module for access control

## Implementation Steps

### Phase 1: Database Schema (Priority: High)
Create database tables for MCP management:
- [ ] Create `mcp_contexts` table
- [ ] Create `mcp_servers` table  
- [ ] Create `mcp_permissions` table
- [ ] Create migration scripts

### Phase 2: Repository Layer (Priority: High)
Implement repository classes:
- [ ] MCPContextRepository
- [ ] MCPServerRepository
- [ ] MCPPermissionRepository

### Phase 3: Refactor Module Core (Priority: High)
Restructure the MCP module:
- [ ] Remove direct tool execution logic
- [ ] Implement context management methods
- [ ] Implement server registration methods
- [ ] Add SDK client factory methods

### Phase 4: SDK Integration (Priority: High)
Properly integrate the MCP SDK:
- [ ] Create SDK client wrapper
- [ ] Implement transport selection logic
- [ ] Handle connection lifecycle
- [ ] Delegate all protocol operations to SDK

### Phase 5: Permission Integration (Priority: Medium)
Add permission checks:
- [ ] Integrate with permissions module
- [ ] Add permission checks to all operations
- [ ] Implement audit logging

### Phase 6: HTTP Endpoint Support (Priority: High)
Enable HTTP access to MCP:
- [ ] Update MCP protocol handler in server
- [ ] Implement context-based routing
- [ ] Add session management
- [ ] Support tool execution via HTTP

## Key Differences from Current Implementation

### Current (Incorrect)
```typescript
// Module directly executes tools
private async handleExecuteCliTool(args: any): Promise<CallToolResult> {
  const { handleExecuteCli } = await import('@/server/mcp/core/handlers/tools/execute-cli');
  return handleExecuteCli(args, context);
}
```

### Target (Correct)
```typescript
// Module creates SDK client, SDK executes tools
private async executeToolViaSDK(serverId: string, toolName: string, args: any): Promise<CallToolResult> {
  const client = await this.getOrCreateClient(serverId);
  return await client.callTool(toolName, args);
}
```

## Database Schema Design

```sql
-- MCP Contexts: Logical groupings of capabilities
CREATE TABLE mcp_contexts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  server_id TEXT REFERENCES mcp_servers(id),
  capabilities JSON, -- {tools: [], resources: [], prompts: []}
  metadata JSON,
  is_active BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MCP Servers: Registered MCP server configurations  
CREATE TABLE mcp_servers (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK(type IN ('stdio', 'http', 'sse')),
  transport_config JSON NOT NULL, -- Transport-specific configuration
  is_active BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MCP Permissions: Fine-grained access control
CREATE TABLE mcp_permissions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  context_id TEXT NOT NULL REFERENCES mcp_contexts(id),
  principal_type TEXT NOT NULL CHECK(principal_type IN ('user', 'role')),
  principal_id TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK(resource_type IN ('tool', 'resource', 'prompt')),
  resource_name TEXT NOT NULL,
  allowed BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(context_id, principal_type, principal_id, resource_type, resource_name)
);
```

## Module Structure

```
src/modules/core/mcp/
├── index.ts                 # Module entry point
├── services/
│   ├── mcp.service.ts      # Main service (management)
│   └── sdk.service.ts      # SDK wrapper service
├── repositories/
│   ├── context.repository.ts
│   ├── server.repository.ts
│   └── permission.repository.ts
├── types/
│   ├── manual.ts           # Hand-written types
│   └── generated.ts        # Generated from schema
├── schema.sql              # Database schema
└── cli/                    # CLI commands
    ├── context/
    │   ├── create.ts
    │   ├── list.ts
    │   └── delete.ts
    └── server/
        ├── register.ts
        ├── list.ts
        └── unregister.ts
```

## Integration Points

### With Server MCP Protocol Handler
The server's MCP protocol handler will:
1. Receive HTTP requests at `/mcp`
2. Look up context based on `X-MCP-Context` header
3. Use MCP module to get SDK client for that context
4. Execute operations via SDK
5. Return results via HTTP

### With CLI
The CLI will use the MCP module to:
1. Register new MCP servers
2. Create/manage contexts
3. Test MCP connections
4. Execute tools (via SDK)

## Success Criteria

1. **Separation of Concerns**: Management logic separated from execution logic
2. **SDK Usage**: All protocol operations go through MCP SDK
3. **Persistence**: All configurations stored in database
4. **Permissions**: Access control enforced on all operations
5. **HTTP Access**: MCP available via HTTP endpoint at `/mcp`
6. **CLI Integration**: Full CLI support for MCP management

## Risks and Mitigations

### Risk: Breaking Changes
**Mitigation**: Implement in phases, maintain backward compatibility during transition

### Risk: SDK Learning Curve
**Mitigation**: Study SDK documentation, implement simple cases first

### Risk: Performance with Multiple Clients
**Mitigation**: Implement client pooling and connection reuse

### Risk: Security with Remote Servers
**Mitigation**: Implement proper auth, use encrypted transports, audit all operations

## Timeline Estimate

- Phase 1-2 (Database): 2 hours
- Phase 3-4 (Core Refactor): 4 hours
- Phase 5 (Permissions): 2 hours
- Phase 6 (HTTP): 2 hours
- Testing: 2 hours

Total: ~12 hours of focused work

## Next Steps

1. Create database schema
2. Generate types from schema
3. Implement repositories
4. Refactor module to use repositories
5. Integrate MCP SDK properly
6. Test with local MCP server
7. Enable HTTP access
8. Add CLI commands