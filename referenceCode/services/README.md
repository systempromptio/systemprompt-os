# Services

Core business logic layer implementing agent orchestration, task management, and state persistence for the SystemPrompt Coding Agent MCP server.

## Overview

The services layer provides the essential functionality for:
- **Agent Management**: Orchestrating AI coding assistants (Claude Code, Gemini)
- **Task Execution**: Managing coding task lifecycle and execution
- **State Persistence**: Saving and restoring system state
- **Event Management**: Real-time notifications and progress tracking
- **Session Management**: Handling concurrent agent sessions

## Architecture

```
┌─────────────────────────────────────────┐
│            Handler Layer                │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│           Services Layer                │
├─────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐      │
│  │Agent Manager│  │ Task Store  │      │
│  └──────┬──────┘  └──────┬──────┘      │
│         │                │              │
│  ┌──────▼──────┐  ┌──────▼──────┐      │
│  │Claude Code  │  │State Persist│      │
│  │  Service    │  │   Service   │      │
│  └──────┬──────┘  └─────────────┘      │
└─────────┼───────────────────────────────┘
          │
┌─────────▼───────────────────────────────┐
│      Host Bridge Daemon                 │
│         (Port 9876)                     │
└─────────────────────────────────────────┘
```

## Core Services

### 🤖 Agent Manager (`agent-manager/`)

Central orchestrator for AI coding agents.

#### Key Components:

##### `agent-manager.ts`
Main orchestration service:
```typescript
export class AgentManager {
  // Agent allocation
  async allocateAgent(taskId: string, tool: string): Promise<Agent>
  
  // Task execution
  async executeTask(task: Task): Promise<TaskResult>
  
  // Health monitoring
  checkAgentHealth(): AgentHealthStatus[]
  
  // Resource management
  releaseAgent(agentId: string): void
}
```

##### `agent-interface.ts`
Abstract interface for agents:
```typescript
export interface Agent {
  id: string;
  type: 'claude-code' | 'gemini' | 'shell';
  status: AgentStatus;
  
  // Core operations
  execute(command: string): Promise<ExecutionResult>;
  cancel(): Promise<void>;
  getStatus(): AgentStatus;
}
```

##### `claude-session-manager.ts`
Claude-specific session handling:
- Session creation and lifecycle
- Query execution management
- Output stream handling
- Error recovery

##### `session-store.ts`
Session persistence:
- Active session tracking
- Session state management
- Cleanup on disconnect

##### `task-logger.ts`
Comprehensive task logging:
- Execution history
- Performance metrics
- Error tracking
- Debug information

### 🔧 Claude Code Service (`claude-code/`)

Claude Code CLI integration implementation.

#### Key Components:

##### `claude-code-service.ts`
Main Claude integration:
```typescript
export class ClaudeCodeService extends EventEmitter {
  // Session management
  async createSession(config: SessionConfig): Promise<Session>
  
  // Command execution
  async execute(sessionId: string, command: string): Promise<Result>
  
  // Output streaming
  onOutput(sessionId: string, callback: OutputCallback): void
  
  // Event emission
  emit(event: 'claude:event', data: ClaudeEvent): void
}
```

##### `host-proxy-client.ts`
Communication with host daemon:
```typescript
export class HostProxyClient {
  // Connect to daemon
  connect(host: string, port: number): Promise<void>
  
  // Execute commands
  execute(command: ClaudeCommand): Promise<CommandResult>
  
  // Handle streaming
  onData(callback: DataCallback): void
}
```

##### `event-parser.ts`
Claude output parsing:
```typescript
export class EventParser {
  // Parse Claude events
  parseEvent(data: string): ClaudeEvent | null
  
  // Extract tool usage
  extractToolUsage(event: ClaudeEvent): ToolUsage
  
  // Track progress
  getProgress(events: ClaudeEvent[]): Progress
}
```

##### `progress-tracker.ts`
Task progress monitoring:
- Step completion tracking
- Time estimation
- Performance metrics
- Status updates

##### `query-executor.ts`
Query execution management:
- Query queuing
- Timeout handling
- Result parsing
- Error recovery

### 📊 Task Store (`task-store.ts`)

In-memory task management with persistence.

#### Features:
```typescript
export class TaskStore extends EventEmitter {
  // Task operations
  createTask(params: CreateTaskParams): Task
  updateTask(id: string, updates: TaskUpdate): Task
  getTask(id: string): Task | undefined
  getTasks(filter?: TaskFilter): Task[]
  
  // Event emission
  emit(event: 'task:created', task: Task): void
  emit(event: 'task:updated', task: Task): void
  emit(event: 'task:completed', task: Task): void
  
  // Persistence
  async save(): Promise<void>
  async load(): Promise<void>
}
```

#### Task Lifecycle:
1. **Created**: Initial state
2. **Running**: Agent executing
3. **Completed**: Successfully finished
4. **Failed**: Error occurred
5. **Cancelled**: User cancelled

### 💾 State Persistence (`state-persistence.ts`)

Persistent state management across restarts.

#### Features:
```typescript
export class StatePersistence {
  // Save state
  async saveState(state: SystemState): Promise<void>
  
  // Load state
  async loadState(): Promise<SystemState | null>
  
  // Auto-save
  enableAutoSave(interval: number): void
  
  // State migration
  migrateState(oldVersion: number, state: any): SystemState
}
```

#### Persisted Data:
- Active tasks
- Agent sessions
- System configuration
- Performance metrics

### 📢 Task Store Events (`task-store-events.ts`)

Event definitions and handlers:
```typescript
export enum TaskEvent {
  CREATED = 'task:created',
  UPDATED = 'task:updated',
  STARTED = 'task:started',
  COMPLETED = 'task:completed',
  FAILED = 'task:failed',
  CANCELLED = 'task:cancelled'
}

export interface TaskEventData {
  task: Task;
  timestamp: number;
  changes?: Partial<Task>;
}
```

## Service Patterns

### Agent Allocation Pattern
```typescript
// 1. Request agent
const agent = await agentManager.allocateAgent({
  type: 'claude-code',
  taskId: task.id
});

// 2. Execute task
const result = await agent.execute(task.instructions);

// 3. Release agent
agentManager.releaseAgent(agent.id);
```

### Task Execution Pattern
```typescript
// 1. Create task
const task = taskStore.createTask({
  tool: 'CLAUDECODE',
  instructions: 'Create a React component',
  branch: 'feature/new-component'
});

// 2. Execute with agent
await agentManager.executeTask(task);

// 3. Monitor progress
taskStore.on('task:updated', (data) => {
  console.log(`Progress: ${data.task.progress}%`);
});
```

### Event Handling Pattern
```typescript
// Listen for Claude events
claudeService.on('claude:event', (event) => {
  switch (event.type) {
    case 'tool:start':
      console.log(`Tool ${event.toolName} started`);
      break;
    case 'tool:end':
      console.log(`Tool completed in ${event.duration}ms`);
      break;
  }
});
```

## Error Handling

### Service-Level Errors
```typescript
export class ServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: any
  ) {
    super(message);
  }
}
```

### Recovery Strategies
1. **Retry with backoff**: For transient failures
2. **Agent restart**: For crashed processes
3. **Task reassignment**: For failed agents
4. **State rollback**: For corruption

## Configuration

### Environment Variables
```bash
# Agent configuration
MAX_CONCURRENT_AGENTS=5
AGENT_TIMEOUT=300000  # 5 minutes
AGENT_RETRY_ATTEMPTS=3

# Task configuration
TASK_TIMEOUT=600000   # 10 minutes
TASK_MAX_OUTPUT=1048576  # 1MB

# State persistence
STATE_FILE_PATH=./state/tasks.json
STATE_SAVE_INTERVAL=30000  # 30 seconds

# Claude configuration
CLAUDE_SESSION_TIMEOUT=1800000  # 30 minutes
CLAUDE_MAX_RETRIES=3
```

### Service Options
```typescript
interface ServiceConfig {
  agentManager: {
    maxConcurrent: number;
    timeout: number;
    retryAttempts: number;
  };
  taskStore: {
    maxTasks: number;
    cleanupInterval: number;
  };
  statePersistence: {
    filePath: string;
    saveInterval: number;
    compression: boolean;
  };
}
```

## Monitoring

### Metrics Exposed
- **Agent Metrics**:
  - Active agents count
  - Agent utilization
  - Success/failure rates
  - Average execution time

- **Task Metrics**:
  - Tasks created/completed
  - Queue length
  - Processing time
  - Error rates

- **System Metrics**:
  - Memory usage
  - CPU utilization
  - Event throughput
  - State size

### Health Checks
```typescript
interface HealthStatus {
  healthy: boolean;
  services: {
    agentManager: ServiceHealth;
    taskStore: ServiceHealth;
    statePersistence: ServiceHealth;
  };
  metrics: SystemMetrics;
}
```

## Testing

### Unit Testing
```typescript
describe('AgentManager', () => {
  it('should allocate agent for task', async () => {
    const agent = await manager.allocateAgent('task-1', 'claude-code');
    expect(agent).toBeDefined();
    expect(agent.status).toBe('idle');
  });
});
```

### Integration Testing
- Test agent-task integration
- Verify state persistence
- Check event propagation
- Validate error recovery

## Best Practices

1. **Resource Management**
   - Always release agents after use
   - Implement timeouts for all operations
   - Clean up failed tasks

2. **Error Handling**
   - Log all errors with context
   - Implement retry logic
   - Provide graceful degradation

3. **Performance**
   - Stream large outputs
   - Batch state saves
   - Use event debouncing

4. **Security**
   - Validate all inputs
   - Sanitize command execution
   - Limit resource usage

## Future Enhancements

- **Multi-Agent Types**: Support for more AI assistants
- **Distributed Execution**: Scale across multiple hosts
- **Advanced Scheduling**: Priority queues and scheduling
- **Plugin System**: Extensible agent capabilities
- **Metrics Dashboard**: Real-time monitoring UI

This service layer forms the core engine of the SystemPrompt Coding Agent, providing reliable, scalable, and maintainable agent orchestration.