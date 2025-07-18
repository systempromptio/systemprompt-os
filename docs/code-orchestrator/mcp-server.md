# MCP Server

## Overview

The MCP (Model Context Protocol) Server is the core component that implements the protocol specification, handling client requests and managing sessions. It runs inside a Docker container and provides a standardized HTTP/SSE interface for AI assistants to interact with the system.

## Purpose

The MCP Server serves several critical functions:

1. **Protocol Implementation**: Full implementation of the Model Context Protocol specification
2. **Session Management**: Handles multiple concurrent client sessions with isolation
3. **Request Routing**: Routes protocol requests to appropriate handlers
4. **State Management**: Maintains session state and task persistence
5. **Real-time Communication**: Supports Server-Sent Events (SSE) for streaming responses

## Architecture

```
Client (MCP)          Docker Container               Host Machine
┌─────────┐          ┌─────────────────┐          ┌─────────────┐
│ Claude  │  HTTP/   │   MCP Server    │   TCP    │   Daemon    │
│ Desktop │ ──SSE──> │ ┌─────────────┐ │ ──────>  │             │
│   App   │          │ │  Sessions   │ │  :9876   │  AI Agents  │
└─────────┘          │ │  Handlers   │ │          └─────────────┘
                     │ │  Transport  │ │
                     │ └─────────────┘ │
                     └─────────────────┘
```

## Core Components

### 1. Express Server (`server.ts`)

The main HTTP server that:
- Configures CORS for cross-origin requests
- Sets up routing for MCP and utility endpoints
- Handles graceful shutdowns
- Initializes the MCP handler

```typescript
// Key endpoints
/mcp      - Main MCP protocol endpoint
/health   - Health check endpoint
/         - Service metadata
```

### 2. MCP Handler (`server/mcp.ts`)

The protocol implementation that:
- Creates per-session server instances
- Manages session lifecycle
- Routes requests to handlers
- Implements session cleanup

### 3. Session Management

Each client connection gets:
- Unique session ID
- Dedicated Server instance
- Isolated StreamableHTTPServerTransport
- Session timeout handling (1 hour)

## Protocol Features

### Supported Operations

1. **Tools**
   - `list_tools` - List available tools
   - `call_tool` - Execute a tool

2. **Prompts**
   - `list_prompts` - List prompt templates
   - `get_prompt` - Retrieve specific prompt

3. **Resources**
   - `list_resources` - List available resources
   - `read_resource` - Read resource content

4. **Resource Templates**
   - `list_resource_templates` - List dynamic resource templates

5. **Roots**
   - `list_roots` - List filesystem roots

### Server Capabilities

```typescript
{
  experimental: {
    "mcp-send-sse": {},  // Server-sent events
  },
  tools: {},             // Tool execution
  resources: {},         // Resource management
  prompts: {},          // Prompt templates
  roots: {              // Root listing
    listChanged: true
  }
}
```

## Request Flow

### 1. Session Initialization

```
Client → POST /mcp (no session ID)
         ↓
Server creates new session
         ↓
Returns session ID in headers
         ↓
Client uses session ID for subsequent requests
```

### 2. Request Processing

```typescript
// Client sends request with session ID
POST /mcp
Headers: {
  "mcp-session-id": "session_123...",
  "Content-Type": "application/json"
}

// Server routes to session's transport
sessionInfo.transport.handleRequest(req, res)

// Response via JSON or SSE
```

### 3. Streaming Responses

For long-running operations:
```
Client → Request tool execution
         ↓
Server → SSE stream begins
         ↓
Multiple events streamed
         ↓
Final completion event
```

## Middleware Stack

The server applies several middleware layers:

1. **Rate Limiting**: 100 requests/minute per IP
2. **Protocol Validation**: Ensures correct MCP version
3. **Request Size Limit**: 10MB maximum
4. **CORS**: Allows cross-origin requests

## Error Handling

Standard JSON-RPC error codes:
- `-32600`: Invalid Request
- `-32601`: Method not found
- `-32602`: Invalid params
- `-32603`: Internal error
- `-32001`: Session not found (custom)

## Configuration

Environment variables:
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)
- `LOG_LEVEL`: Logging verbosity

## Integration Points

### With Daemon

The MCP server communicates with the daemon for tool execution:

```typescript
// Tool execution request
{
  tool: "claude",
  command: "Add authentication",
  workingDirectory: "/project"
}
```

### With Task Store

Manages persistent task state:
- Creates tasks on tool execution
- Updates task status
- Stores execution logs

### With Event System

Emits events for:
- Session lifecycle
- Tool execution
- Task updates
- System notifications

## Security Considerations

1. **No Authentication**: Currently operates without auth
2. **Session Isolation**: Each session has separate state
3. **Input Validation**: All inputs validated via schemas
4. **Rate Limiting**: Prevents abuse

## Development Tips

### Testing MCP Endpoints

```bash
# Initialize session
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{},"id":1}'

# List tools with session
curl -X POST http://localhost:3000/mcp \
  -H "mcp-session-id: session_123" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":2}'
```

### Debugging Sessions

```typescript
// Get active session count
mcpHandler.getActiveSessionCount()

// Get specific session server
mcpHandler.getServerForSession(sessionId)

// Manual session cleanup
mcpHandler.cleanupSession(sessionId)
```

## Performance Optimization

1. **Session Cleanup**: Automatic cleanup every 5 minutes
2. **Connection Pooling**: Reuses TCP connections to daemon
3. **Streaming**: Uses SSE for efficient real-time updates
4. **Request Batching**: Supports multiple operations per request

## Troubleshooting

### Common Issues

1. **Session Not Found**
   - Session expired (>1 hour)
   - Server restarted
   - Invalid session ID

2. **Connection Refused**
   - Daemon not running
   - Port misconfiguration
   - Docker networking issue

3. **Timeout Errors**
   - Long-running tool execution
   - Network latency
   - Resource constraints

### Debug Logging

Enable verbose logging:
```bash
export LOG_LEVEL=debug
npm start
```

This provides detailed information about:
- Session creation/cleanup
- Request routing
- Handler execution
- Error details