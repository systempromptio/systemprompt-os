# Agent Manager

## Overview

The Agent Manager is a central service that orchestrates AI agent sessions within the SystemPrompt Coding Agent. It provides a unified interface for creating, managing, and monitoring different types of AI agents (currently Claude, with support for future agent types).

## Architecture

```
                    Agent Manager
                         │
         ┌───────────────┴───────────────┐
         │                               │
    Session Store                   Task Logger
         │                               │
    ┌────┴────┐                         │
    │         │                         │
Claude    [Future]              Task Store Integration
Manager    Agents
```

## Core Components

### 1. **AgentManager (Singleton)**
The main orchestrator that coordinates all agent operations.

**Key Responsibilities:**
- Session lifecycle management
- Event emission and handling
- Command routing to appropriate agents
- Cross-service coordination

### 2. **SessionStore**
In-memory storage for active agent sessions.

**Features:**
- Fast session lookup by ID
- Session state tracking
- Service ID mapping
- Task association

### 3. **ClaudeSessionManager**
Specialized manager for Claude AI agents.

**Capabilities:**
- Claude process spawning via daemon
- Stream handling and buffering
- Event parsing and emission
- Git branch context management

### 4. **TaskLogger**
Handles logging of agent activities to task records.

**Functions:**
- Log message persistence
- Event recording
- Progress tracking
- Error capture

## Data Structures

### AgentSession
The primary data structure representing an active AI agent:

```typescript
interface AgentSession {
  id: string;                    // Unique session identifier
  type: AgentType;              // 'claude' (extensible)
  serviceSessionId: string;      // Underlying service ID
  status: AgentState;           // Current state
  projectPath: string;          // Working directory
  taskId?: string;              // Associated task
  mcpSessionId?: string;        // MCP correlation ID
  created_at: string;           // Creation timestamp
  last_activity: string;        // Last activity time
  output_buffer: string[];      // Stdout messages
  error_buffer: string[];       // Stderr messages
}
```

### Agent States
Agents progress through these states:

1. **initializing** - Agent is being created
2. **ready** - Agent is ready for commands
3. **busy** - Agent is processing a command
4. **idle** - Agent is waiting for input
5. **error** - Agent encountered an error
6. **completed** - Agent finished successfully
7. **cancelled** - Agent was terminated

## API Methods

### Creating Sessions

```typescript
async createSession(params: {
  type: AgentType;
  taskId?: string;
  mcpSessionId?: string;
  config?: AgentConfig;
}): Promise<AgentSession>
```

Creates a new agent session with the specified configuration.

### Sending Commands

```typescript
async sendCommand(
  sessionId: string,
  command: string
): Promise<AgentCommandResult>
```

Sends a command to an active agent session.

### Ending Sessions

```typescript
async endSession(
  sessionId: string,
  reason?: string
): Promise<void>
```

Gracefully terminates an agent session.

### Retrieving Sessions

```typescript
getSession(sessionId: string): AgentSession | null
getAllSessions(): AgentSession[]
getSessionsByTask(taskId: string): AgentSession[]
```

## Events

The Agent Manager emits these events:

### session:created
Fired when a new session is created.
```typescript
{
  session: AgentSession;
  timestamp: string;
}
```

### session:ready
Fired when a session becomes ready for commands.
```typescript
sessionId: string
```

### task:progress
Fired for task progress updates.
```typescript
{
  taskId: string;
  message: string;
  metadata?: any;
}
```

## Claude Integration

### Session Creation Flow

1. **Request arrives** at Agent Manager
2. **Session created** in SessionStore
3. **Claude Manager** prepares environment:
   - Sets working directory
   - Checks out git branch (if specified)
   - Configures environment variables
4. **Daemon spawns** Claude process on host
5. **Stream connection** established
6. **Events parsed** from Claude output
7. **Session marked** as ready

### Command Execution Flow

1. **Command received** via `sendCommand`
2. **Session validated** (must be in accepting state)
3. **Command routed** to appropriate manager
4. **Claude processes** the command
5. **Output streamed** back through daemon
6. **Events emitted** for tool usage, progress
7. **Result returned** to caller

## Error Handling

### Error Types

1. **SessionNotFoundError** - Invalid session ID
2. **UnknownSessionTypeError** - Unsupported agent type
3. **InvalidStateError** - Operation not allowed in current state
4. **CommandError** - Command execution failed

### Error Recovery

- Sessions automatically transition to error state
- Error details logged to task
- Cleanup performed on session termination
- Resources released properly

## Usage Examples

### Basic Session Creation

```typescript
const agentManager = AgentManager.getInstance();

const session = await agentManager.createSession({
  type: 'claude',
  taskId: 'task-123',
  config: {
    instructions: 'Implement authentication',
    branch: 'feature/auth'
  }
});
```

### Sending Commands

```typescript
const result = await agentManager.sendCommand(
  session.id,
  'Create a login endpoint with JWT'
);

if (result.success) {
  console.log('Command executed:', result.output);
}
```

### Event Listening

```typescript
agentManager.on('session:ready', (sessionId) => {
  console.log(`Session ${sessionId} is ready`);
});

agentManager.on('task:progress', (event) => {
  console.log(`Task ${event.taskId}: ${event.message}`);
});
```

## Best Practices

1. **Session Management**
   - Always end sessions when done
   - Monitor session states
   - Handle errors gracefully
   - Set appropriate timeouts

2. **Command Handling**
   - Validate commands before sending
   - Check session state first
   - Handle async responses properly
   - Log important operations

3. **Resource Usage**
   - Limit concurrent sessions
   - Clean up abandoned sessions
   - Monitor memory usage
   - Implement session timeouts

4. **Error Handling**
   - Catch and log all errors
   - Provide meaningful error messages
   - Implement retry logic where appropriate
   - Clean up on failure

## Configuration

Agent Manager can be configured via environment variables:

- `MAX_CONCURRENT_SESSIONS` - Maximum active sessions (default: 10)
- `SESSION_TIMEOUT` - Session timeout in minutes (default: 30)
- `COMMAND_TIMEOUT` - Command timeout in seconds (default: 300)

## Future Extensibility

The Agent Manager is designed to support multiple agent types:

1. **Adding New Agent Types**
   - Implement agent-specific manager
   - Register with AgentManager
   - Define configuration schema
   - Implement command interface

2. **Potential Future Agents**
   - Gemini integration
   - Local LLM support
   - Custom tool agents
   - Specialized task agents