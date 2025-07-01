# Event System and Logging

## Overview

The SystemPrompt Coding Agent implements a comprehensive event system and logging framework that captures, processes, and persists all system activities. This provides visibility into AI agent operations, debugging capabilities, and audit trails for all tasks.

## Architecture

```
Event Sources                Event Processing              Storage
┌────────────┐              ┌─────────────┐              ┌──────────┐
│ Claude CLI │ ─────────>   │ Event Parser│ ─────────>   │ Task     │
│ Process    │              │             │              │ Store    │
└────────────┘              └─────────────┘              └──────────┘
                                   │
┌────────────┐              ┌─────▼───────┐              ┌──────────┐
│ MCP Server │ ─────────>   │ Event       │ ─────────>   │ Log      │
│ Operations │              │ Emitters    │              │ Files    │
└────────────┘              └─────────────┘              └──────────┘
                                   │
┌────────────┐              ┌─────▼───────┐              ┌──────────┐
│ Tool       │ ─────────>   │ Logger      │ ─────────>   │ Console  │
│ Executions │              │ Service     │              │ Output   │
└────────────┘              └─────────────┘              └──────────┘
```

## Claude Event System

### Event Types

The system defines strongly-typed events for all Claude operations:

```typescript
// Process lifecycle events
interface ClaudeProcessStartEvent {
  type: 'process:start';
  pid: number;
  command: string;
  workingDirectory: string;
  environment?: Record<string, string>;
}

interface ClaudeProcessEndEvent {
  type: 'process:end';
  exitCode: number | null;
  signal: string | null;
  duration: number;
}

// Tool usage events
interface ClaudeToolUseStartEvent {
  type: 'tool:start';
  toolName: string;
  toolId: string;
  parameters: Record<string, any>;
}

interface ClaudeToolUseEndEvent {
  type: 'tool:end';
  toolName: string;
  toolId: string;
  duration: number;
  success: boolean;
  result?: any;
  error?: string;
}

// Communication events
interface ClaudeMessageEvent {
  type: 'message';
  role: 'assistant' | 'user' | 'system';
  content: string;
  metadata?: {
    tokens?: number;
    model?: string;
  };
}

// Raw stream events
interface ClaudeStreamEvent {
  type: 'stream';
  data: string;
  streamType: 'stdout' | 'stderr';
}

// Error events
interface ClaudeErrorEvent {
  type: 'error';
  error: string;
  code?: string;
  stack?: string;
}
```

### Event Flow

1. **Event Generation**
   ```
   Claude Process → stdout/stderr → Daemon → Event Parser
   ```

2. **Event Parsing**
   ```typescript
   const parser = new ClaudeEventParser(sessionId, taskId);
   const events = parser.parseLine(outputLine, 'stdout');
   ```

3. **Event Emission**
   ```typescript
   claudeService.on('claude:event', (event: ClaudeEvent) => {
     // Handle event
   });
   ```

4. **Event Storage**
   ```typescript
   await taskStore.addLog(taskId, {
     timestamp: event.timestamp,
     level: 'info',
     type: 'tool',
     message: `${event.toolName} started`,
     metadata: event
   });
   ```

### Event Parser

The event parser (`event-parser.ts`) uses pattern matching to extract structured events:

```typescript
// Tool detection patterns
toolStart: /^(?:I'll|Let me|I will) (?:use|run|execute) (?:the )?(\w+)/i
toolCall: /^(?:Running|Executing|Calling) (?:the)? (\w+)/i

// File operation patterns
readFile: /^(?:Reading|Opening) file:\s*(.+)$/i
writeFile: /^(?:Writing|Creating) (?:to )?file:\s*(.+)$/i

// Command patterns
bashCommand: /^\$ (.+)$/

// Error patterns
error: /^(?:Error|Failed|Exception):\s*(.+)$/i
```

## Logging System

### Logger Service

The core logger (`utils/logger.ts`) provides multiple log levels:

```typescript
const logger = {
  debug: (...args: any[]) => {
    if (process.env.DEBUG === 'true') {
      console.debug('[DEBUG]', ...args);
    }
  },
  info: (...args: any[]) => {
    console.info('[INFO]', ...args);
  },
  warn: (...args: any[]) => {
    console.warn('[WARN]', ...args);
  },
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);
  }
};
```

### Task Logger

The task logger (`task-logger.ts`) handles task-specific logging:

```typescript
class TaskLogger {
  // Log session creation
  async logSessionCreated(
    taskId: string,
    sessionId: string,
    type: string,
    projectPath: string
  ): Promise<void>

  // Log commands sent
  async logCommandSent(
    taskId: string,
    command: string
  ): Promise<void>

  // Log responses received
  async logResponseReceived(
    taskId: string,
    response: string
  ): Promise<void>

  // Log errors
  async logError(
    taskId: string,
    error: Error,
    context?: string
  ): Promise<void>
}
```

### Log Entry Structure

```typescript
interface TaskLogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  type: 'system' | 'agent' | 'tool' | 'user';
  prefix?: string;
  message: string;
  metadata?: {
    sessionId?: string;
    toolName?: string;
    duration?: number;
    error?: any;
    [key: string]: any;
  };
}
```

## Log Types and Prefixes

### System Logs
- `PROCESS_START`: Claude process initiated
- `PROCESS_END`: Claude process completed
- `SESSION_CREATE`: New session created
- `SESSION_END`: Session terminated
- `TASK_UPDATE`: Task status changed

### Agent Logs
- `AGENT_MESSAGE`: AI assistant communication
- `AGENT_THINKING`: Internal reasoning
- `AGENT_COMMAND`: Commands sent to agent

### Tool Logs
- `TOOL_START`: Tool execution began
- `TOOL_END`: Tool execution completed
- `TOOL_OUTPUT`: Tool output data
- `TOOL_ERROR`: Tool execution error

### User Logs
- `USER_REQUEST`: User input/request
- `USER_FEEDBACK`: User feedback/response

## Storage and Persistence

### Task Store Integration

Logs are persisted through the task store:

```typescript
// Add log entry
await taskStore.addLog(taskId, logEntry, mcpSessionId);

// Retrieve logs
const task = await taskStore.getTask(taskId);
const logs = task.logs;

// Filter logs
const errorLogs = logs.filter(log => log.level === 'error');
const toolLogs = logs.filter(log => log.type === 'tool');
```

### Log Files

Additional log destinations:

1. **Daemon Logs**: `/daemon/logs/host-bridge.log`
2. **Claude Hooks**: `/daemon/logs/claude-hooks.jsonl`
3. **Docker Logs**: `docker-compose logs mcp-server`

## Real-time Event Streaming

### Server-Sent Events (SSE)

For real-time updates to clients:

```typescript
// Emit notification
await notificationManager.notify({
  type: 'task:log',
  taskId: task.id,
  data: logEntry
});

// Client receives via SSE
eventSource.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'task:log') {
    updateTaskLogs(data.taskId, data.data);
  }
});
```

### Event Subscriptions

```typescript
// Subscribe to specific events
claudeService.on('tool:start', (event) => {
  console.log(`Tool ${event.toolName} started`);
});

// Subscribe to all Claude events
claudeService.on('claude:event', (event) => {
  switch(event.type) {
    case 'process:start':
      handleProcessStart(event);
      break;
    case 'tool:end':
      handleToolEnd(event);
      break;
  }
});
```

## Debugging and Monitoring

### Enable Debug Logging

```bash
# Enable debug output
export DEBUG=true
export LOG_LEVEL=debug

# Start server with debug logging
npm start
```

### Log Analysis

```bash
# View recent errors
grep "ERROR" daemon/logs/host-bridge.log | tail -20

# Monitor tool usage
grep "TOOL_" daemon/logs/host-bridge.log | grep -v "TOOL_OUTPUT"

# Track specific session
grep "session_123" daemon/logs/host-bridge.log
```

### Performance Monitoring

```typescript
// Log with timing
const startTime = Date.now();
await executeOperation();
const duration = Date.now() - startTime;

logger.info('Operation completed', {
  operation: 'tool_execution',
  duration,
  toolName: 'bash'
});
```

## Best Practices

### Logging Guidelines

1. **Use Appropriate Levels**
   - `debug`: Detailed internal state
   - `info`: Normal operations
   - `warn`: Recoverable issues
   - `error`: Failures requiring attention

2. **Include Context**
   ```typescript
   logger.error('Tool execution failed', {
     toolName,
     taskId,
     sessionId,
     error: error.message,
     stack: error.stack
   });
   ```

3. **Avoid Sensitive Data**
   - Don't log passwords or API keys
   - Sanitize user data
   - Use placeholders for secrets

### Event Design

1. **Consistent Structure**
   - Always include timestamp
   - Use standard type names
   - Include relevant IDs

2. **Granular Events**
   - Separate start/end events
   - Include duration calculations
   - Capture success/failure states

3. **Metadata Rich**
   - Add contextual information
   - Include environment details
   - Track relationships (task/session)

## Integration Examples

### Custom Event Handler

```typescript
class CustomEventHandler {
  constructor(private taskStore: TaskStore) {
    const claudeService = ClaudeCodeService.getInstance();
    
    claudeService.on('claude:event', async (event) => {
      await this.handleEvent(event);
    });
  }
  
  async handleEvent(event: ClaudeEvent) {
    // Custom processing
    if (isToolUseEndEvent(event) && !event.success) {
      await this.notifyToolFailure(event);
    }
    
    // Store in custom format
    await this.storeEvent(event);
  }
}
```

### Log Aggregation

```typescript
// Aggregate logs by type
const aggregateLogs = (logs: TaskLogEntry[]) => {
  return logs.reduce((acc, log) => {
    acc[log.type] = (acc[log.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
};

// Generate report
const stats = aggregateLogs(task.logs);
console.log('Log statistics:', stats);
// Output: { system: 10, agent: 25, tool: 45, user: 5 }
```

This event system and logging framework provides comprehensive visibility into all operations, enabling effective debugging, monitoring, and auditing of AI agent activities.