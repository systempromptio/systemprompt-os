# Claude Code Integration

## Overview

The Claude Code Integration is a sophisticated service that bridges the MCP server with Anthropic's Claude CLI tool, enabling AI-powered coding assistance. It manages sessions, executes queries, streams responses, and parses structured events from Claude's output.

## Architecture

```
MCP Server (Docker)          Host Machine
┌─────────────────┐         ┌──────────────┐
│ Claude Code     │  TCP    │ Host Bridge  │
│ Service         │ ──────> │ Daemon       │
├─────────────────┤  :9876  ├──────────────┤
│ Session Manager │         │ Claude CLI   │
│ Query Executor  │         │ Process      │
│ Event Parser    │         └──────────────┘
└─────────────────┘
```

## Core Components

### 1. Claude Code Service (`claude-code-service.ts`)

The main service that orchestrates all Claude interactions:

```typescript
class ClaudeCodeService extends EventEmitter {
  // Singleton instance
  static getInstance(): ClaudeCodeService
  
  // Session management
  createSession(options: ClaudeCodeOptions): Promise<string>
  findSession(sessionId: string): ClaudeCodeSession | undefined
  
  // Query execution
  querySync(sessionId: string, prompt: string): Promise<string>
  
  // Task integration
  setTaskId(sessionId: string, taskId: string): void
  setMcpSessionId(sessionId: string, mcpSessionId: string): void
}
```

#### Key Features:
- **Singleton Pattern**: Ensures single instance across the application
- **Event Emission**: Broadcasts session and task events
- **Dual Execution Modes**: SDK mode (with API key) or Host Proxy mode
- **Session Isolation**: Each query runs in its own session context

### 2. Session Manager (`session-manager.ts`)

Manages Claude Code sessions with lifecycle control:

```typescript
interface ClaudeCodeSession {
  id: string;
  status: 'initializing' | 'ready' | 'busy' | 'error' | 'terminated';
  workingDirectory: string;
  taskId?: string;
  mcpSessionId?: string;
  streamBuffer: string[];
  errorBuffer: string[];
}
```

#### Session States:
- `initializing`: Session being created
- `ready`: Available for queries
- `busy`: Currently executing a query
- `error`: Encountered an error
- `terminated`: Session ended

### 3. Host Proxy Client (`host-proxy-client.ts`)

Communicates with the daemon for Claude execution:

```typescript
class HostProxyClient {
  execute(
    prompt: string,
    workingDirectory: string,
    onStream?: (data: string) => void,
    env?: Record<string, string>,
    sessionId?: string,
    taskId?: string,
    onEvent?: (event: ClaudeEvent) => void
  ): Promise<string>
}
```

#### Key Responsibilities:
- **Path Mapping**: Converts Docker paths to host paths
- **TCP Communication**: Manages socket connection to daemon
- **Stream Processing**: Handles real-time output streaming
- **Event Integration**: Parses and emits Claude events

### 4. Event Parser (`event-parser.ts`)

Extracts structured events from Claude's output stream:

```typescript
class ClaudeEventParser {
  parseLine(line: string, streamType: 'stdout' | 'stderr'): ClaudeEvent[]
}
```

#### Detected Event Types:
- **Tool Usage**: Start/end of tool executions
- **Messages**: Assistant explanations and thinking
- **Errors**: Error messages and stack traces
- **Stream Data**: Raw output for logging

## Event System

### Event Types

```typescript
// Tool usage events
{
  type: 'tool:start',
  toolName: 'bash',
  toolId: 'tool_123',
  parameters: { command: 'npm test' }
}

{
  type: 'tool:end',
  toolName: 'bash',
  toolId: 'tool_123',
  duration: 1234,
  success: true
}

// Message events
{
  type: 'message',
  content: "I'll run the tests now",
  messageType: 'thinking'
}

// Process events
{
  type: 'process:start',
  pid: 12345,
  command: 'claude',
  workingDirectory: '/project'
}
```

### Event Flow

1. Claude outputs to stdout/stderr
2. Daemon captures and streams to Docker
3. Event parser extracts structured events
4. Service emits events to listeners
5. Task store logs events for persistence

## Query Execution

### Execution Flow

```
1. Client calls querySync(sessionId, prompt)
   ↓
2. Service validates session state
   ↓
3. Determines execution mode (SDK vs Host Proxy)
   ↓
4. For Host Proxy:
   a. Maps Docker paths to host paths
   b. Sends request to daemon via TCP
   c. Daemon spawns Claude process
   d. Streams output back
   ↓
5. Parses events and updates task progress
   ↓
6. Returns final response
```

### Command Building

For Claude CLI execution:
```bash
claude \
  -p \
  --output-format json \
  --dangerously-skip-permissions \
  --max-turns 5 \
  "Your prompt here"
```

## Progress Tracking

The service integrates with task management for progress tracking:

```typescript
class ProgressTracker {
  // Logs assistant messages to task
  logAssistantMessage(taskId: string, content: string): Promise<void>
  
  // Parses progress from stream
  parseProgressFromStream(session: ClaudeCodeSession, data: string): Promise<void>
}
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | API key for SDK mode | None |
| `CLAUDE_PROXY_HOST` | Daemon hostname | `host.docker.internal` |
| `CLAUDE_PROXY_PORT` | Daemon port | `9876` |
| `HOST_FILE_ROOT` | Host project root | `/var/www/html/systemprompt-coding-agent` |

### Options

```typescript
interface ClaudeCodeOptions {
  workingDirectory?: string;
  env?: Record<string, string>;
  timeout?: number;
  maxTurns?: number;
}
```

## Error Handling

### Error Types

1. **SessionNotReadyError**: Session not in ready state
2. **HostProxyConnectionError**: Cannot connect to daemon
3. **HostProxyTimeoutError**: Command execution timeout
4. **HostProxyError**: General proxy errors

### Error Recovery

```typescript
try {
  const result = await service.querySync(sessionId, prompt);
} catch (error) {
  if (error instanceof SessionNotReadyError) {
    // Wait for session to be ready
  } else if (error instanceof HostProxyConnectionError) {
    // Check daemon is running
  }
}
```

## Integration Points

### With Agent Manager

```typescript
// Link Claude session to agent session
const agentSession = agentManager.findSessionByTaskId(taskId);
if (agentSession) {
  env.CLAUDE_SESSION_ID = agentSession.id;
}
```

### With Task Store

```typescript
// Update task with Claude events
taskStore.updateTask(taskId, {
  logs: [...events],
  lastActivity: new Date()
});
```

### With MCP Handler

```typescript
// Create Claude session for MCP tool execution
const sessionId = await claudeService.createSession({
  workingDirectory: '/workspace'
});
claudeService.setTaskId(sessionId, task.id);
```

## Best Practices

### Session Management

1. **Create per-task sessions**: Each task should have its own session
2. **Set working directory**: Always specify the correct working directory
3. **Clean up sessions**: Terminate sessions when tasks complete
4. **Handle session states**: Check session state before queries

### Event Handling

1. **Subscribe early**: Set up event listeners before execution
2. **Parse all events**: Don't ignore stream events
3. **Log structured events**: Store events for debugging
4. **Handle errors gracefully**: Expect and handle parsing errors

### Performance

1. **Stream processing**: Process streams incrementally
2. **Event batching**: Batch events for storage
3. **Connection pooling**: Reuse TCP connections
4. **Timeout handling**: Set appropriate timeouts

## Troubleshooting

### Common Issues

1. **"Tool 'claude' is not available"**
   - Check CLAUDE_PATH environment variable
   - Verify Claude CLI is installed on host
   - Ensure daemon has execute permissions

2. **Connection Refused**
   - Verify daemon is running
   - Check port configuration
   - Ensure Docker networking is correct

3. **Path Not Found**
   - Verify path mapping configuration
   - Check HOST_FILE_ROOT environment variable
   - Ensure volumes are mounted correctly

### Debug Logging

Enable verbose logging:
```typescript
// In your code
logger.debug('Claude query', {
  sessionId,
  prompt: prompt.substring(0, 100),
  workingDirectory
});
```

### Testing Claude Integration

```bash
# Test daemon connection
nc -zv host.docker.internal 9876

# Test Claude execution
docker exec mcp-server \
  node -e "
    const service = require('./build/services/claude-code').ClaudeCodeService.getInstance();
    service.createSession().then(async (id) => {
      const result = await service.querySync(id, 'echo Hello');
      console.log(result);
    });
  "
```

This integration provides a robust bridge between the MCP protocol and Claude's powerful coding capabilities, enabling sophisticated AI-assisted development workflows.