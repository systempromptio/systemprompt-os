# MCP Server Implementation

This document describes the Model Context Protocol (MCP) server implementation in systemprompt-os.

## Overview

The MCP server provides a standardized interface for tools, resources, and prompts that can be consumed by AI assistants and other clients.

## Architecture

The MCP server is implemented with the following components:

1. **Core Server** (`src/server/mcp/core/server.ts`):
   - Implements the MCP protocol using the official SDK
   - Manages sessions and handles requests
   - Provides default tools, resources, and prompts

2. **Registry** (`src/server/mcp/registry.ts`):
   - Manages multiple MCP server instances
   - Sets up HTTP routes for each server
   - Provides server status information

3. **Integration** (`src/server/mcp/index.ts`):
   - Initializes the MCP server registry
   - Registers the core server
   - Sets up Express routes

## Default Capabilities

### Tools

1. **echo** - Echo back a message
   - Input: `{ message: string }`
   - Output: Text response with echoed message

2. **add** - Add two numbers
   - Input: `{ a: number, b: number }`
   - Output: Text response with sum

### Resources

1. **system://info** - Basic system information
   - Returns: JSON with server name, version, sessionId, timestamp

2. **system://status** - Current system status
   - Returns: JSON with status, session count, uptime

### Prompts

1. **greeting** - Generate a greeting message
   - Arguments: `{ name: string }`
   - Returns: User message for greeting

2. **code_review** - Generate a code review template
   - Arguments: `{ language: string, focus?: string }`
   - Returns: User message for code review

## API Endpoints

- `POST /mcp` - Core MCP server endpoint
- `POST /mcp/core` - Alternative endpoint for core server
- `GET /mcp/status` - Server status information

## Session Management

The MCP server implements session management with:
- Automatic session creation on first request
- Session ID tracking via headers (`mcp-session-id` or `x-session-id`)
- Session timeout after 1 hour of inactivity
- Automatic cleanup of old sessions every 5 minutes

## Docker Deployment

### Building and Running

```bash
# Build the Docker image
npm run docker:mcp:build

# Start the container
npm run docker:mcp:up

# Stop the container
npm run docker:mcp:down

# Run E2E tests with Docker
npm run docker:mcp:test
```

### Docker Compose Configuration

The `docker-compose.mcp.yml` file configures:
- Node.js 20 Alpine base image
- Port 3000 exposed
- Health check endpoint
- Production environment settings

## Testing

### E2E Test

The E2E test (`test/e2e/mcp-server.test.ts`) verifies:
- Docker container startup and health
- Server status endpoint
- Tool listing and execution
- Resource listing and reading
- Prompt listing and retrieval
- Multiple concurrent sessions

### Running Tests

```bash
# Run only MCP E2E test
npm run test:e2e -- test/e2e/mcp-server.test.ts

# Run with Docker
npm run docker:mcp:test
```

## Extending the Server

To add new capabilities:

1. **Add Tools**: Update the tool handlers in `createServer()`
2. **Add Resources**: Update the resource handlers
3. **Add Prompts**: Update the prompt handlers

Example:

```typescript
// Add a new tool
server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: [
    // ... existing tools
    {
      name: 'my_tool',
      description: 'My custom tool',
      inputSchema: {
        type: 'object',
        properties: {
          param: { type: 'string' }
        }
      }
    }
  ]
}));

// Handle the tool call
server.setRequestHandler(CallToolRequestSchema, (request) => {
  if (request.params.name === 'my_tool') {
    return {
      content: [{
        type: 'text',
        text: `Result: ${request.params.arguments?.param}`
      }]
    };
  }
  // ... handle other tools
});
```

## Security Considerations

- Sessions are isolated from each other
- No authentication is currently implemented
- Input validation should be added for production use
- Rate limiting can be configured if needed

## Future Enhancements

- Add authentication mechanisms
- Implement more sophisticated tools
- Add database-backed resources
- Support for streaming responses
- WebSocket transport option