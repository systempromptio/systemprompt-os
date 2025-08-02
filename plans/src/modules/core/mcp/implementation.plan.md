# MCP Module Implementation Plan

## Objective
Create a fully functional MCP module that:
1. Manages MCP contexts (servers) with full CRUD operations
2. Stores MCP SDK-compatible tools, prompts, and resources in the database
3. Handles permissions and authentication via MCP SDK
4. Serves actual MCP servers using saved configurations

## Database Schema

```sql
-- MCP Contexts (Servers)
CREATE TABLE mcp_contexts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  version TEXT DEFAULT '1.0.0',
  -- Server configuration
  server_config JSON NOT NULL, -- Full MCP Server configuration
  -- Authentication configuration (for MCP SDK middleware)
  auth_config JSON, -- {type: 'bearer' | 'client', config: {...}}
  -- Metadata
  is_active BOOLEAN DEFAULT 1,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MCP Tools (SDK-compatible)
CREATE TABLE mcp_tools (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  context_id TEXT NOT NULL REFERENCES mcp_contexts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  input_schema JSON NOT NULL, -- JSON Schema for tool input
  annotations JSON, -- Additional tool metadata
  -- Permissions
  required_permission TEXT, -- Permission needed to use this tool
  required_role TEXT, -- Role needed to use this tool
  -- Handler configuration
  handler_type TEXT NOT NULL, -- 'function' | 'http' | 'command'
  handler_config JSON NOT NULL, -- Configuration for the handler
  -- Metadata
  is_active BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(context_id, name)
);

-- MCP Resources (SDK-compatible)
CREATE TABLE mcp_resources (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  context_id TEXT NOT NULL REFERENCES mcp_contexts(id) ON DELETE CASCADE,
  uri TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  mime_type TEXT DEFAULT 'text/plain',
  annotations JSON, -- Additional resource metadata
  -- Resource content or handler
  content_type TEXT NOT NULL, -- 'static' | 'dynamic'
  content JSON, -- Static content or handler configuration
  -- Permissions
  required_permission TEXT,
  required_role TEXT,
  -- Metadata
  is_active BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(context_id, uri)
);

-- MCP Prompts (SDK-compatible)
CREATE TABLE mcp_prompts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  context_id TEXT NOT NULL REFERENCES mcp_contexts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  arguments JSON, -- Array of argument definitions
  annotations JSON, -- Additional prompt metadata
  -- Prompt template
  template TEXT NOT NULL,
  -- Permissions
  required_permission TEXT,
  required_role TEXT,
  -- Metadata
  is_active BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(context_id, name)
);

-- MCP Context Permissions
CREATE TABLE mcp_context_permissions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  context_id TEXT NOT NULL REFERENCES mcp_contexts(id) ON DELETE CASCADE,
  principal_type TEXT NOT NULL CHECK(principal_type IN ('user', 'role')),
  principal_id TEXT NOT NULL,
  permission TEXT NOT NULL, -- 'read', 'write', 'execute', 'manage'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(context_id, principal_type, principal_id, permission)
);
```

## Module Structure

```typescript
// Main module exports
interface IMCPModuleExports {
  // Context (Server) management
  contexts: {
    create(data: CreateContextDto): Promise<MCPContext>;
    update(id: string, data: UpdateContextDto): Promise<MCPContext>;
    delete(id: string): Promise<void>;
    get(id: string): Promise<MCPContext | null>;
    getByName(name: string): Promise<MCPContext | null>;
    list(filters?: ContextFilters): Promise<MCPContext[]>;
  };
  
  // Tools management
  tools: {
    create(contextId: string, tool: CreateToolDto): Promise<MCPTool>;
    update(id: string, tool: UpdateToolDto): Promise<MCPTool>;
    delete(id: string): Promise<void>;
    list(contextId: string): Promise<MCPTool[]>;
    execute(contextId: string, toolName: string, args: any): Promise<CallToolResult>;
  };
  
  // Resources management
  resources: {
    create(contextId: string, resource: CreateResourceDto): Promise<MCPResource>;
    update(id: string, resource: UpdateResourceDto): Promise<MCPResource>;
    delete(id: string): Promise<void>;
    list(contextId: string): Promise<MCPResource[]>;
    read(contextId: string, uri: string): Promise<any>;
  };
  
  // Prompts management
  prompts: {
    create(contextId: string, prompt: CreatePromptDto): Promise<MCPPrompt>;
    update(id: string, prompt: UpdatePromptDto): Promise<MCPPrompt>;
    delete(id: string): Promise<void>;
    list(contextId: string): Promise<MCPPrompt[]>;
    get(contextId: string, name: string, args?: any): Promise<any>;
  };
  
  // Server creation (using MCP SDK)
  server: {
    create(contextId: string): Promise<Server>;
    getOrCreate(contextId: string): Promise<Server>;
  };
  
  // Permissions
  permissions: {
    grant(contextId: string, principalType: string, principalId: string, permission: string): Promise<void>;
    revoke(contextId: string, principalType: string, principalId: string, permission: string): Promise<void>;
    check(contextId: string, userId: string, roleIds: string[], permission: string): Promise<boolean>;
  };
}
```

## Implementation Steps

### Step 1: Create Database Schema
- Create schema.sql with all tables
- Add indexes for performance
- Generate TypeScript types

### Step 2: Create Repositories
- MCPContextRepository
- MCPToolRepository
- MCPResourceRepository
- MCPPromptRepository
- MCPPermissionRepository

### Step 3: Create Services
- MCPContextService (CRUD for contexts)
- MCPToolService (CRUD for tools + execution)
- MCPResourceService (CRUD for resources + reading)
- MCPPromptService (CRUD for prompts + getting)
- MCPServerService (Creates MCP SDK servers from configs)

### Step 4: Implement MCP SDK Integration
- Create server factory that builds MCP SDK servers from stored configs
- Implement tool handlers that execute based on handler_config
- Implement resource handlers for dynamic resources
- Add authentication middleware based on auth_config

### Step 5: Module Implementation
- Wire up all services
- Add event emissions for context changes
- Integrate with permissions module
- Add CLI commands for management

## Key Implementation Details

### Tool Execution
```typescript
// Tool handler based on handler_type
async executeToolHandler(tool: MCPTool, args: any): Promise<CallToolResult> {
  switch (tool.handler_type) {
    case 'function':
      // Execute a local function
      const handler = this.toolHandlers.get(tool.handler_config.function);
      return await handler(args);
      
    case 'http':
      // Make HTTP request
      const response = await fetch(tool.handler_config.url, {
        method: tool.handler_config.method || 'POST',
        body: JSON.stringify(args),
        headers: tool.handler_config.headers
      });
      return await response.json();
      
    case 'command':
      // Execute system command
      const result = await exec(tool.handler_config.command, args);
      return { content: [{ type: 'text', text: result }] };
  }
}
```

### Server Creation with MCP SDK
```typescript
async createMCPServer(context: MCPContext): Promise<Server> {
  // Load tools, resources, prompts from database
  const tools = await this.toolRepo.listByContext(context.id);
  const resources = await this.resourceRepo.listByContext(context.id);
  const prompts = await this.promptRepo.listByContext(context.id);
  
  // Create server with MCP SDK
  const server = new Server({
    name: context.name,
    version: context.version
  });
  
  // Register tool handlers
  for (const tool of tools) {
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: tools.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.input_schema
      }))
    }));
    
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === tool.name) {
        return await this.executeToolHandler(tool, request.params.arguments);
      }
    });
  }
  
  // Register resource handlers
  // Register prompt handlers
  
  // Add authentication if configured
  if (context.auth_config) {
    server.use(createAuthMiddleware(context.auth_config));
  }
  
  return server;
}
```

## Success Criteria

1. ✅ Full CRUD operations for contexts, tools, resources, prompts
2. ✅ All data persisted in database with proper schemas
3. ✅ MCP SDK-compatible types for all entities
4. ✅ Working MCP server creation from stored configurations
5. ✅ Tool execution with permission checks
6. ✅ Authentication middleware integration
7. ✅ Event emission for system integration
8. ✅ CLI commands for management