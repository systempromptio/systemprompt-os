# SystemPrompt Coding Agent Source Code

Core implementation of the SystemPrompt Coding Agent MCP server, providing orchestration of AI coding assistants (Claude Code CLI, Gemini CLI) through the Model Context Protocol.

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   MCP Client                        │
│              (Claude, Cline, etc)                   │
└────────────────────┬────────────────────────────────┘
                     │ MCP Protocol
┌────────────────────▼────────────────────────────────┐
│                  MCP Server                         │
│  ┌──────────────────────────────────────────────┐  │
│  │            Request Handlers                   │  │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐│  │
│  │  │ Tools  │ │Prompts │ │Resource│ │ Roots  ││  │
│  │  └────────┘ └────────┘ └────────┘ └────────┘│  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │              Services Layer                   │  │
│  │  ┌─────────────┐ ┌──────────┐ ┌───────────┐ │  │
│  │  │Agent Manager│ │Task Store│ │State Mgmt │ │  │
│  │  └─────────────┘ └──────────┘ └───────────┘ │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                     │ TCP Socket
┌────────────────────▼────────────────────────────────┐
│              Host Bridge Daemon                     │
│                 (Port 9876)                         │
└────────────────────┬────────────────────────────────┘
                     │ Process Spawn
┌────────────────────▼────────────────────────────────┐
│           CLI Tools (Claude, Gemini)                │
└─────────────────────────────────────────────────────┘
```

## Directory Structure

### 📄 Entry Points

- **`index.ts`** - Main executable entry point, sets up and starts the MCP server
- **`server.ts`** - HTTP server implementation hosting MCP endpoints via WebSocket

### 📁 `/constants`
Static definitions and configuration constants used throughout the application.

- **`server/server-config.ts`** - Server metadata and configuration
- **`tools.ts`** - Tool definitions for MCP protocol
- **`resources.ts`** - Resource URIs and templates
- **`task-status.ts`** - Task status enumerations
- **`tool/*.ts`** - Individual tool metadata and schemas

### 📁 `/handlers`
Request handlers implementing the core business logic for MCP operations.

#### Key Handlers:
- **`tool-handlers.ts`** - Orchestrates tool execution
- **`prompt-handlers.ts`** - Manages prompt discovery and retrieval
- **`resource-handlers.ts`** - Handles resource reading and subscriptions
- **`notifications.ts`** - Manages real-time notifications
- **`roots-handlers.ts`** - Provides root URIs for exploration

#### Sub-directories:
- **`tools/`** - Individual tool implementations (create-task, check-status, etc.)
- **`prompts/`** - Prompt templates for different use cases
- **`resources/`** - Resource-specific handlers

### 📁 `/server`
HTTP server infrastructure and MCP protocol implementation.

- **`mcp.ts`** - MCP WebSocket server setup
- **`middleware.ts`** - Express middleware for auth, CORS, etc.
- **`config.ts`** - Server configuration and environment
- **`types.ts`** - Server-specific TypeScript types

### 📁 `/services`
Core service implementations providing the main functionality.

#### Key Services:

##### `agent-manager/`
Manages AI agent lifecycles and orchestration:
- **`agent-manager.ts`** - Main orchestrator for multiple agents
- **`claude-session-manager.ts`** - Claude-specific session handling
- **`session-store.ts`** - Session persistence
- **`task-logger.ts`** - Task execution logging

##### `claude-code/`
Claude Code CLI integration:
- **`claude-code-service.ts`** - Main Claude service
- **`host-proxy-client.ts`** - Communication with host daemon
- **`event-parser.ts`** - Parses Claude output events
- **`progress-tracker.ts`** - Tracks task progress
- **`session-manager.ts`** - Manages Claude sessions

##### Core Services:
- **`task-store.ts`** - Task persistence and management
- **`state-persistence.ts`** - Application state management
- **`task-store-events.ts`** - Task event handling

### 📁 `/types`
Comprehensive TypeScript type definitions.

#### Organization:
- **`api/`** - API request/response types
- **`core/`** - Core domain types (agent, session, context)
- **`events/`** - Event type definitions
- **`providers/`** - Provider-specific types
- **`resources/`** - Resource type definitions
- **`utils/`** - Utility types and guards
- **`validation/`** - Validation schemas

Key Files:
- **`task.ts`** - Task-related types
- **`claude-events.ts`** - Strongly-typed Claude events
- **`shared.ts`** - Shared type definitions
- **`state.ts`** - State management types

### 📁 `/utils`
Utility functions and helpers.

- **`logger.ts`** - Structured logging utilities
- **`id-validation.ts`** - ID format validation
- **`tool-availability.ts`** - Tool detection
- **`log-parser.ts`** - Log parsing utilities
- **`json-schema-to-zod.ts`** - Schema conversion

## Key Features

### 1. **Multi-Agent Orchestration**
- Manages multiple AI coding assistants simultaneously
- Supports Claude Code CLI and Gemini CLI
- Extensible architecture for new agents

### 2. **Task Management**
- Create, monitor, and manage coding tasks
- Branch-based execution for git integration
- Real-time progress tracking
- Comprehensive logging

### 3. **MCP Protocol Compliance**
- Full implementation of Model Context Protocol
- Tools, prompts, resources, and notifications
- WebSocket-based communication

### 4. **State Persistence**
- Tasks persist across server restarts
- Session management for long-running operations
- Configurable state storage

### 5. **Event System**
- Strongly-typed event definitions
- Real-time notifications
- Progress tracking and updates

### 6. **Security**
- Tool whitelisting
- Path validation
- Secure daemon communication

## Development

### Running the Server

```bash
# Build the project
npm run build

# Start the server
npm start

# Development mode with hot reload
npm run dev

# Watch mode for development
npm run watch
```

### Environment Variables

Key configuration via environment:
- `PORT` - Server port (default: 3000)
- `PROJECT_ROOT` - Root directory for operations
- `STATE_PATH` - State persistence location
- `JWT_SECRET` - Authentication secret

### Adding New Features

#### Adding a New Tool

1. Create tool definition in `constants/tool/`
2. Implement handler in `handlers/tools/`
3. Register in `handlers/tool-handlers.ts`
4. Update tool list in `constants/tools.ts`

#### Adding a New Agent

1. Create agent interface extending `agent-manager/agent-interface.ts`
2. Implement service in `services/`
3. Register in `agent-manager/agent-manager.ts`
4. Add types in `types/providers/`

## Testing

```bash
# Run tests
npm test

# Run E2E tests
npm run test:e2e

# Test coverage
npm run test:coverage
```

## Best Practices

1. **Type Safety**: Use TypeScript strictly, avoid `any`
2. **Error Handling**: Comprehensive error handling with custom errors
3. **Logging**: Use structured logging for debugging
4. **Validation**: Validate all inputs using Zod schemas
5. **Documentation**: Document all public APIs and complex logic

## Architecture Decisions

### Why Host Bridge Daemon?
Docker containers cannot access host CLI tools directly. The daemon provides secure, controlled access.

### Why MCP?
Standardized protocol for AI-human collaboration, supported by multiple clients.

### Why TypeScript?
Type safety, better tooling, and maintainability for complex orchestration logic.

## Contributing

1. Follow existing patterns and conventions
2. Add tests for new functionality
3. Update relevant documentation
4. Ensure type safety throughout
5. Use meaningful commit messages

## Debugging

### Enable Debug Logging
```bash
DEBUG=* npm start
```

### Common Issues

1. **Port conflicts**: Check if port 3000 is available
2. **Daemon connection**: Verify daemon is running on port 9876
3. **Tool not found**: Ensure Claude CLI is installed and in PATH

## Performance Considerations

- Tasks are processed asynchronously
- State updates are batched
- WebSocket connections are managed efficiently
- Large outputs are streamed, not buffered

## Security Notes

- All tool executions are validated
- Paths are sanitized before use
- No arbitrary command execution
- JWT tokens for authentication (when enabled)