# Custom MCP Servers in SystemPrompt

This guide explains how to add custom MCP (Model Context Protocol) servers to SystemPrompt OS.

## Overview

SystemPrompt OS supports loading custom MCP servers from the `server/mcp/custom/` directory. These servers are automatically discovered and registered at startup, making them available alongside the core MCP server.

## Architecture

### Directory Structure

```
srcnew/
├── server/
│   └── mcp/
│       ├── core/           # Core MCP server (built-in)
│       ├── custom/         # Custom MCP servers (user-provided)
│       │   ├── example-github-mcp/
│       │   └── your-custom-server/
│       ├── index.ts        # MCP setup and initialization
│       ├── registry.ts     # Server registry
│       └── custom-loader.ts # Custom server loader
```

### Loading Process

1. **Discovery**: On startup, the `CustomMCPLoader` scans the `server/mcp/custom/` directory
2. **Loading**: Each subdirectory is treated as a potential MCP server
3. **Validation**: The loader validates that each server exports required methods
4. **Registration**: Valid servers are registered with the `MCPServerRegistry`
5. **Routing**: HTTP routes are created for each registered server

## Creating a Custom MCP Server

### 1. Basic Structure

Create a new directory in `server/mcp/custom/` with your server name:

```bash
mkdir server/mcp/custom/my-custom-server
```

### 2. Server Implementation

Create an `index.js` file that exports a default class:

```javascript
// server/mcp/custom/my-custom-server/index.js

export default class MyCustomMCPServer {
  constructor() {
    this.name = 'My Custom MCP Server';
    this.version = '1.0.0';
    this.sessions = new Map();
  }

  // Required: Handle MCP protocol requests
  async handleRequest(req, res) {
    const { method, params, id } = req.body;

    switch (method) {
      case 'initialize':
        // Handle initialization
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '0.1.0',
            capabilities: {
              tools: true,
              resources: true,
            },
            serverInfo: {
              name: this.name,
              version: this.version,
            },
          },
        });
        break;

      case 'tools/list':
        // Return available tools
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            tools: [
              {
                name: 'my_tool',
                description: 'My custom tool',
                inputSchema: {
                  type: 'object',
                  properties: {
                    input: { type: 'string' },
                  },
                  required: ['input'],
                },
              },
            ],
          },
        });
        break;

      case 'tools/call':
        // Handle tool execution
        const result = await this.executeTool(params);
        res.json({ jsonrpc: '2.0', id, result });
        break;

      default:
        res.json({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: 'Method not found' },
        });
    }
  }

  // Required: Return active session count
  getActiveSessionCount() {
    return this.sessions.size;
  }

  // Required: Clean up resources
  shutdown() {
    this.sessions.clear();
    console.log(`${this.name} shutting down`);
  }

  // Helper method for tool execution
  async executeTool(params) {
    const { name, arguments: args } = params;
    
    if (name === 'my_tool') {
      return {
        content: [{
          type: 'text',
          text: `Processed: ${args.input}`,
        }],
      };
    }
    
    throw new Error(`Unknown tool: ${name}`);
  }
}
```

### 3. Package Configuration (Optional)

Create a `package.json` if your server has dependencies or uses a different entry point:

```json
{
  "name": "my-custom-mcp-server",
  "version": "1.0.0",
  "main": "index.js",
  "type": "module",
  "dependencies": {
    "axios": "^1.6.0"
  }
}
```

### 4. Documentation

Add a `README.md` to document your server:

```markdown
# My Custom MCP Server

Description of what your server does.

## Tools

- `my_tool` - Description of the tool

## Resources

- `custom://resource` - Description of the resource

## Usage

The server is available at `/mcp/my-custom-server`.
```

## Required Methods

Every custom MCP server must implement these methods:

### `handleRequest(req, res)`
- Handles incoming MCP protocol requests
- Must parse `req.body` for method, params, and id
- Must send JSON-RPC 2.0 responses via `res.json()`

### `getActiveSessionCount()`
- Returns the number of active sessions
- Used for monitoring and status reporting

### `shutdown()`
- Called when the server is shutting down
- Should clean up resources and connections

## MCP Protocol Implementation

### Initialize Method

```javascript
case 'initialize':
  res.json({
    jsonrpc: '2.0',
    id,
    result: {
      protocolVersion: '0.1.0',
      capabilities: {
        tools: true,      // Server provides tools
        resources: true,  // Server provides resources
        prompts: true,    // Server provides prompts
      },
      serverInfo: {
        name: this.name,
        version: this.version,
      },
    },
  });
  break;
```

### Tools

Implement `tools/list` to expose available tools:

```javascript
case 'tools/list':
  res.json({
    jsonrpc: '2.0',
    id,
    result: {
      tools: [
        {
          name: 'tool_name',
          description: 'What this tool does',
          inputSchema: {
            type: 'object',
            properties: {
              param1: { type: 'string', description: 'Parameter description' },
            },
            required: ['param1'],
          },
        },
      ],
    },
  });
  break;
```

Implement `tools/call` to execute tools:

```javascript
case 'tools/call':
  const { name, arguments: args } = params;
  
  // Execute the tool based on name
  const result = await this.executeTool(name, args);
  
  res.json({
    jsonrpc: '2.0',
    id,
    result: {
      content: [{
        type: 'text',
        text: result,
      }],
    },
  });
  break;
```

### Resources

Implement `resources/list` and `resources/read` for data access:

```javascript
case 'resources/list':
  res.json({
    jsonrpc: '2.0',
    id,
    result: {
      resources: [
        {
          uri: 'custom://data/item',
          name: 'Data Item',
          description: 'Description of the resource',
          mimeType: 'application/json',
        },
      ],
    },
  });
  break;

case 'resources/read':
  const { uri } = params;
  const data = await this.readResource(uri);
  
  res.json({
    jsonrpc: '2.0',
    id,
    result: {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(data),
      }],
    },
  });
  break;
```

## Testing Your Server

### 1. Manual Testing

Start the SystemPrompt server:
```bash
npm run dev
```

Check if your server is loaded:
```bash
curl http://localhost:3000/mcp/status
```

Test your server directly:
```bash
curl -X POST http://localhost:3000/mcp/my-custom-server \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'
```

### 2. Integration Testing

Create a test file:

```javascript
// tests/integration/my-custom-server.test.js
import { describe, it, expect } from 'vitest';
import axios from 'axios';

describe('My Custom MCP Server', () => {
  const serverUrl = 'http://localhost:3000/mcp/my-custom-server';

  it('should list tools', async () => {
    const response = await axios.post(serverUrl, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    });

    expect(response.data.result.tools).toBeDefined();
    expect(response.data.result.tools).toHaveLength(1);
    expect(response.data.result.tools[0].name).toBe('my_tool');
  });
});
```

## Real-World Example: GitHub MCP Server

See the `server/mcp/custom/example-github-mcp/` directory for a complete example that includes:

- Multiple tools (search repos, get repo info, create issues)
- Resources (user profile, repositories)
- Session management
- Error handling
- Documentation

## Best Practices

1. **Error Handling**: Always return proper JSON-RPC errors
2. **Validation**: Validate input parameters
3. **Documentation**: Include clear documentation and examples
4. **Testing**: Write tests for your server
5. **Security**: Validate and sanitize all inputs
6. **Performance**: Handle concurrent requests efficiently
7. **Logging**: Use appropriate logging for debugging

## Troubleshooting

### Server Not Loading

1. Check the server directory exists in `server/mcp/custom/`
2. Verify `index.js` exports a default class
3. Check for syntax errors in your code
4. Look at console logs during startup

### Method Not Working

1. Ensure you're handling the correct method name
2. Check JSON-RPC response format
3. Verify required fields in responses
4. Test with a simple MCP client

## Advanced Topics

### Using TypeScript

You can write your server in TypeScript:

1. Add `tsconfig.json` to your server directory
2. Compile to JavaScript before running
3. Point `package.json` main to the compiled file

### External Dependencies

If your server needs npm packages:

1. Create a `package.json` in your server directory
2. Run `npm install` in that directory
3. The loader will respect the package.json entry point

### Authentication

For servers requiring authentication:

```javascript
async handleRequest(req, res) {
  // Check for auth token
  const authToken = req.headers.authorization;
  
  if (!authToken && method !== 'initialize') {
    res.json({
      jsonrpc: '2.0',
      id,
      error: { code: -32001, message: 'Authentication required' },
    });
    return;
  }
  
  // Continue with normal handling...
}
```

## Conclusion

Custom MCP servers extend SystemPrompt's capabilities by providing domain-specific tools and resources. The automatic discovery and loading system makes it easy to add new servers without modifying core code.