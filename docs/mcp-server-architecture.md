# MCP Server Architecture

This document describes the Model Context Protocol (MCP) server architecture in SystemPrompt OS.

## Overview

SystemPrompt OS supports two types of MCP servers:

1. **Local Embedded Servers** - Express handlers that run in-process
2. **Remote Servers** - External servers accessed via HTTP/HTTPS proxy

## Architecture Components

### 1. Type System (`src/server/mcp/types.ts`)

Provides strong TypeScript types for the entire MCP system:

- `MCPServerType` - Enum for server types (LOCAL, REMOTE)
- `LocalMCPServer` - Interface for embedded servers
- `RemoteMCPServer` - Interface for remote servers
- `MCPServerStatus` - Server status information
- `MCPRequestContext` - Request context with authentication

### 2. Server Registry (`src/server/mcp/registry.ts`)

Central registry that manages all MCP servers:

- Registers both local and remote servers
- Sets up Express routes automatically
- Creates proxy handlers for remote servers
- Provides server status and monitoring
- Handles server shutdown gracefully

### 3. Custom Loader (`src/server/mcp/custom-loader.ts`)

Discovers and loads custom MCP servers:

- Scans `server/mcp/custom/` directory
- Loads local servers from Node.js modules
- Loads remote server configurations from JSON
- Validates server implementations
- Handles errors gracefully

### 4. Core Server (`src/server/mcp/core/server.ts`)

Built-in MCP server with basic functionality:

- Echo and Add tools
- System info and status resources
- Example prompts
- Session management

## Directory Structure

```
server/mcp/
├── core/              # Core MCP server
│   └── server.ts     # Core server implementation
├── custom/           # Custom MCP servers
│   ├── my-local-server/     # Local server example
│   │   ├── package.json
│   │   └── build/index.js
│   └── remote-servers.json  # Remote server configs
├── index.ts          # MCP setup
├── registry.ts       # Server registry
├── custom-loader.ts  # Custom server loader
└── types.ts         # TypeScript types
```

## Local Embedded Servers

Local servers export a function that creates an Express handler:

```typescript
// my-local-server/index.js
export function createMCPHandler() {
  return async (req, res) => {
    // Handle MCP protocol requests
  };
}

export const CONFIG = {
  SERVER_NAME: 'My Local Server',
  SERVER_VERSION: '1.0.0',
  SERVER_DESCRIPTION: 'Description of my server'
};
```

### Integration

The custom loader:
1. Discovers server directories
2. Imports the module
3. Validates exports
4. Registers with the registry
5. Registry creates route at `/mcp/{server-id}`

## Remote Servers

Remote servers are configured in `remote-servers.json`:

```json
[
  {
    "name": "GitHub MCP Server",
    "url": "https://api.githubcopilot.com/mcp/",
    "auth": {
      "type": "bearer",
      "token": "${GITHUB_TOKEN}"
    },
    "timeout": 30000,
    "headers": {
      "X-Client": "systemprompt-os"
    }
  }
]
```

### Proxy Handler

The registry creates a proxy handler that:
1. Adds authentication headers
2. Forwards requests to remote URL
3. Handles timeouts
4. Returns errors in JSON-RPC format
5. Streams responses back to client

## Usage

### Accessing Servers

Once registered, servers are accessible at:
- Core server: `/mcp` and `/mcp/core`
- Local servers: `/mcp/{server-id}`
- Remote servers: `/mcp/{server-id}`

### Status Endpoint

Get status of all servers:
```
GET /mcp/status
```

Response:
```json
{
  "servers": {
    "core": {
      "id": "core",
      "name": "systemprompt-os-core",
      "status": "running",
      "version": "0.1.0",
      "type": "local",
      "transport": "http",
      "sessions": 2
    },
    "github-mcp-server": {
      "id": "github-mcp-server",
      "name": "GitHub MCP Server",
      "status": "running",
      "version": "1.0.0",
      "type": "remote",
      "transport": "http",
      "url": "https://api.githubcopilot.com/mcp/"
    }
  }
}
```

## Adding Custom Servers

### Local Server

1. Create directory in `server/mcp/custom/`
2. Add `package.json` with metadata
3. Build TypeScript to JavaScript
4. Export `createMCPHandler` function
5. Restart SystemPrompt OS

### Remote Server

1. Edit `server/mcp/custom/remote-servers.json`
2. Add server configuration
3. Include authentication if required
4. Restart SystemPrompt OS

## Best Practices

1. **Type Safety**: Use TypeScript for local servers
2. **Error Handling**: Return proper JSON-RPC errors
3. **Documentation**: Include README in server directory
4. **Testing**: Test servers before deployment
5. **Security**: Validate all inputs and outputs
6. **Performance**: Implement efficient session management

## Example: SystemPrompt MCP Template

The `systemprompt-mcp-template` in the custom directory is a complete example:

- Written in TypeScript
- Implements all MCP methods
- Includes session management
- Has comprehensive documentation
- Follows best practices

Build and test:
```bash
cd server/mcp/custom/systemprompt-mcp-template
npm install
npm run build
```

## Troubleshooting

### Server Not Loading

1. Check console logs during startup
2. Verify module exports `createMCPHandler`
3. Ensure build output exists
4. Check for syntax errors

### Remote Server Errors

1. Verify URL is accessible
2. Check authentication credentials
3. Test with curl or Postman
4. Review proxy error logs

### Type Errors

1. Ensure using latest types from `types.ts`
2. Check TypeScript version compatibility
3. Run `npm run build` to catch errors

## Future Enhancements

- Health checks for remote servers
- Dynamic server loading without restart
- WebSocket support for streaming
- OAuth2 flow for remote servers
- Server-specific configuration UI