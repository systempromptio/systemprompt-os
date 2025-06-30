# Systemprompt Coding Agent: Technical Architecture Deep Dive

## Overview

The Systemprompt Coding Agent is a sophisticated MCP (Model Context Protocol) server that orchestrates AI-powered coding assistants. This document provides a comprehensive technical overview of its architecture, design decisions, and implementation details.

## Architecture Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   MCP Client    │────▶│  Docker MCP     │────▶│  Host Bridge    │
│  (Mobile App)   │     │    Server       │     │    Daemon       │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │   AI Agent      │
                                                 │ (Claude Code)   │
                                                 └────────┬────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │  Project Files  │
                                                 │  (Git Repo)     │
                                                 └─────────────────┘
```

## Core Components

### 1. MCP Server (Docker Container)

The MCP server runs in a Docker container for isolation and consistency. Key responsibilities:

- **Protocol Implementation**: Implements the full MCP specification
- **Request Validation**: Uses Zod schemas for strict input validation
- **State Management**: Maintains task and session state with persistence
- **WebSocket Support**: Real-time communication for streaming responses
- **Resource Exposure**: Provides discoverable tools and prompts to clients

**Key Files:**
- `src/server.ts`: Express HTTP server setup
- `src/mcp.ts`: MCP protocol implementation
- `src/handlers/`: Tool-specific request handlers

### 2. Host Bridge Daemon

A critical component that bridges the containerized MCP server with the host system:

- **Process Management**: Spawns and manages AI agent processes
- **File System Access**: Provides controlled access to host directories
- **Git Operations**: Executes git commands for branch management
- **Stream Forwarding**: Relays output from AI agents to the MCP server
- **Security Boundary**: Validates and sanitizes all host operations

**Key Implementation:**
```typescript
// daemon/src/host-bridge-daemon.ts
interface DaemonCommand {
  id: string;
  type: 'spawn' | 'shell' | 'kill' | 'status';
  data: {
    command?: string;
    args?: string[];
    options?: SpawnOptions;
  };
}
```

### 3. Agent Management System

Sophisticated system for managing AI agent lifecycles:

- **Session Management**: Tracks agent sessions with unique identifiers
- **Process Lifecycle**: Handles spawn, monitor, and cleanup of processes
- **Output Streaming**: Captures and streams stdout/stderr in real-time
- **Resource Limits**: Implements timeouts and memory constraints
- **Error Recovery**: Graceful handling of agent failures

**Key Classes:**
```typescript
// src/services/agent-manager/agent-manager.ts
class AgentManager {
  async createSession(config: AgentConfig): Promise<AgentSession>
  async sendMessage(sessionId: string, message: string): Promise<void>
  async endSession(sessionId: string): Promise<void>
}
```

### 4. Task Orchestration

High-level task management built on top of agent sessions:

- **Task States**: `pending`, `in_progress`, `completed`, `failed`
- **Branch Integration**: Automatic git branch creation per task
- **Progress Tracking**: Real-time status updates and output streaming
- **Persistence**: Tasks survive server restarts
- **Cleanup**: Automatic resource cleanup on completion

**Task Flow:**
```typescript
// src/handlers/tools/orchestrator/create-task.ts
async function createTask(params: CreateTaskParams) {
  // 1. Validate inputs
  // 2. Create git branch (if specified)
  // 3. Spawn AI agent process
  // 4. Initialize task state
  // 5. Stream output to client
}
```

## Security Architecture

### Defense in Depth

1. **Container Isolation**: MCP server runs in Docker with limited privileges
2. **Daemon Validation**: All host operations go through validation layer
3. **Directory Restrictions**: Agents limited to PROJECT_ROOT directory
4. **Command Sanitization**: Shell injection prevention
5. **Process Limits**: Resource constraints on AI agent processes

### Authentication (Planned)

```typescript
// JWT-based auth prepared but not yet enabled
interface AuthConfig {
  jwt: {
    secret: string;
    expiresIn: string;
  };
  allowedOrigins: string[];
}
```

## Communication Protocols

### MCP Protocol

Standard MCP protocol with custom tool implementations:

```typescript
// Tool Definition Example
const CREATE_TASK_TOOL = {
  name: "create_task",
  description: "Creates a new coding task",
  inputSchema: {
    type: "object",
    properties: {
      tool: { enum: ["CLAUD", "CLAUD_WITH_RESUME"] },
      instructions: { type: "string" },
      branch: { type: "string" },
      context: { type: "string" }
    }
  }
};
```

### WebSocket Streaming

Real-time output streaming using Server-Sent Events pattern:

```typescript
// Stream format
interface StreamEvent {
  type: 'output' | 'error' | 'status' | 'complete';
  data: {
    content?: string;
    error?: string;
    status?: TaskStatus;
  };
}
```

## State Management

### Task State

Tasks are persisted to disk for durability:

```typescript
interface TaskState {
  id: string;
  status: TaskStatus;
  tool: string;
  instructions: string;
  branch?: string;
  output: string[];
  created_at: number;
  updated_at: number;
  metadata: Record<string, any>;
}
```

### Session State

Active agent sessions tracked in memory with cleanup:

```typescript
class SessionManager {
  private sessions: Map<string, AgentSession>;
  private cleanupTimers: Map<string, NodeJS.Timeout>;
}
```

## Performance Optimizations

1. **Stream Buffering**: Efficient output buffering to prevent overwhelming clients
2. **Lazy Loading**: Tasks loaded on-demand rather than all at startup
3. **Connection Pooling**: Reuse daemon connections for better performance
4. **Graceful Degradation**: Fallback mechanisms for daemon communication

## Extensibility

### Adding New AI Tools

1. Define tool constant in `src/constants/tool/`
2. Implement handler in `src/handlers/tools/`
3. Update AgentManager to support new tool type
4. Add tool-specific configuration

### Custom Prompts

Prompts are modular and can be extended:

```typescript
// src/constants/tool/orchestrator/prompts.ts
export const PROMPTS = {
  TASK_PLANNING: { /* ... */ },
  CODE_REVIEW: { /* ... */ },
  // Add custom prompts here
};
```

## Deployment Considerations

### Docker Configuration

```yaml
# docker-compose.yml
services:
  mcp-server:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./state:/app/state  # Persistent state
    environment:
      - DAEMON_URL=http://host.docker.internal:3001
      - PROJECT_ROOT=/var/www/html/your-project
```

### Scaling Considerations

- **Horizontal Scaling**: Not recommended due to local file system dependency
- **Vertical Scaling**: Increase container resources for more concurrent tasks
- **Queue System**: Future enhancement for task queuing
- **Multi-Project**: Separate instances per project recommended

## Monitoring and Debugging

### Logging

Structured logging throughout the application:

```typescript
console.log('[AgentManager]', 'Creating session', { sessionId, tool });
console.error('[TaskHandler]', 'Task failed', { taskId, error });
```

### Health Checks

```typescript
// GET /health
{
  "status": "healthy",
  "daemon": "connected",
  "tasks": {
    "active": 2,
    "completed": 45,
    "failed": 3
  }
}
```

## Future Architecture Enhancements

1. **Plugin System**: Modular tool loading
2. **Distributed Tasks**: Multi-machine task execution
3. **Smart Routing**: Intelligent agent selection based on task type
4. **Caching Layer**: Response caching for common operations
5. **Metrics Collection**: Prometheus/Grafana integration

## Conclusion

The Systemprompt Coding Agent represents a carefully designed system that balances power, security, and extensibility. Its architecture enables seamless integration of AI coding assistants while maintaining the safety and integrity of your development environment.