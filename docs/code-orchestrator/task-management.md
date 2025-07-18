# Task Management

## Overview

Task Management is the core system that tracks, persists, and manages all AI agent tasks within the SystemPrompt Coding Agent. It provides a centralized store for task state, logging, and lifecycle management.

## Architecture

```
                    TaskStore
                        │
        ┌───────────────┼───────────────┐
        │               │               │
   State Persistence  Events       Resource Updates
        │               │               │
   File System    EventEmitter    MCP Notifications
```

## Core Components

### 1. **TaskStore (Singleton)**
The central repository for all task data.

**Key Features:**
- In-memory task storage with Map
- Automatic persistence to disk
- Event emission for state changes
- Resource update notifications
- Metrics calculation

### 2. **Task Data Structure**
Tasks are strongly-typed entities representing work units.

```typescript
interface Task {
  id: TaskId;                    // Branded string type
  description: string;           // Human-readable description
  status: TaskStatus;           // Current state
  tool: AITool;                 // AI agent type (CLAUDECODE)
  created_at: string;           // ISO timestamp
  updated_at: string;           // Last modification
  started_at?: string;          // Execution start
  completed_at?: string;        // Completion time
  assigned_to?: string;         // Agent assignment
  error?: string;               // Error message if failed
  result?: unknown;             // Task output
  logs: TaskLogEntry[];         // Structured logs
}
```

### 3. **Task Status Lifecycle**

```
pending → in_progress → completed_active → completed
                     ↘                   ↗
                       → failed/cancelled
```

**Status Definitions:**
- **pending** - Task created but not started
- **in_progress** - Task actively being worked on
- **completed_active** - Task done but session still active
- **completed** - Task done and session terminated
- **failed** - Task failed with error
- **cancelled** - Task manually cancelled

### 4. **Task Logging System**

Structured logging with rich metadata:

```typescript
interface TaskLogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  type: 'system' | 'agent' | 'tool' | 'output' | 'progress';
  prefix?: string;
  message: string;
  metadata?: {
    source?: string;
    toolName?: string;
    toolInput?: any;
    toolOutput?: any;
    fileName?: string;
    lineNumber?: number;
    duration?: number;
    error?: any;
  };
}
```

## API Methods

### Task Creation

```typescript
async createTask(params: {
  description: string;
  tool: AITool;
  instructions?: string;
  metadata?: Record<string, unknown>;
}): Promise<Task>
```

Creates a new task with auto-generated ID and timestamps.

### Task Updates

```typescript
async updateTask(
  id: string,
  updates: UpdateTaskParams
): Promise<Task | null>
```

Updates task properties and emits change events.

### Task Retrieval

```typescript
async getTask(id: string): Promise<Task | null>
async getTasks(filter?: TaskFilter): Promise<Task[]>
async getTasksByStatus(status: TaskStatus): Promise<Task[]>
```

### Task Logging

```typescript
async addLog(
  taskId: string,
  message: string,
  level?: LogLevel,
  metadata?: any
): Promise<void>
```

Appends structured log entries to tasks.

### Task Completion

```typescript
async completeTask(
  id: string,
  result?: unknown
): Promise<Task | null>
```

Marks task as completed with optional result.

## State Persistence

Tasks are automatically persisted to disk:

### Storage Location
```
.systemprompt/
├── state/
│   ├── state.json          # Application state
│   └── tasks/              # Individual task files
│       ├── task_123.json
│       └── task_456.json
```

### Persistence Strategy
1. **Auto-save** on task creation/update
2. **Individual files** per task for reliability
3. **JSON format** for human readability
4. **Atomic writes** to prevent corruption

### State Recovery
On startup:
1. Load all task files from disk
2. Rebuild in-memory Map
3. Validate task data
4. Emit loaded events

## Events

The TaskStore emits typed events:

### task:created
```typescript
{ task: Task }
```

### task:updated
```typescript
{ 
  taskId: string;
  updates: UpdateTaskParams;
  task: Task;
}
```

### task:log:added
```typescript
{
  taskId: string;
  entry: TaskLogEntry;
}
```

### task:completed
```typescript
{ task: Task }
```

## Task Filtering

Query tasks with flexible filters:

```typescript
interface TaskFilter {
  status?: TaskStatus | TaskStatus[];
  tool?: AITool | AITool[];
  assignedTo?: string;
  createdAfter?: string;
  createdBefore?: string;
  search?: string;
}
```

Example:
```typescript
const activeTasks = await taskStore.getTasks({
  status: ['pending', 'in_progress'],
  tool: 'CLAUDECODE',
  createdAfter: '2024-01-01'
});
```

## Metrics and Analytics

The TaskStore provides real-time metrics:

```typescript
interface TaskStats {
  total: number;
  byStatus: Record<TaskStatus, number>;
  byTool: Record<AITool, number>;
  averageDuration: number;
  successRate: number;
}
```

Access via:
```typescript
const metrics = await taskStore.getMetrics();
```

## Integration with Other Systems

### 1. **Agent Manager Integration**
- Tasks linked to agent sessions via `assigned_to`
- Status updates from agent lifecycle
- Log streaming from agent output

### 2. **MCP Resource Integration**
- Tasks exposed as resources (`task://{id}`)
- Real-time updates via notifications
- Resource list changes on task CRUD

### 3. **Event System Integration**
- Claude events logged to tasks
- Tool usage tracked in metadata
- Progress events update task logs

## Best Practices

### 1. **Task Creation**
- Provide clear, concise descriptions
- Include detailed instructions for agents
- Set appropriate metadata for tracking
- Use structured logging from the start

### 2. **Status Management**
- Update status immediately on state change
- Use `completed_active` for post-processing
- Always set error message on failure
- Include timestamps for all transitions

### 3. **Logging**
- Use appropriate log levels
- Include rich metadata for tools
- Keep messages concise but informative
- Log both successes and failures

### 4. **Error Handling**
- Catch and log all exceptions
- Set task to failed state on errors
- Include stack traces in metadata
- Provide recovery suggestions

## Usage Examples

### Creating and Running a Task

```typescript
const taskStore = TaskStore.getInstance();

// Create task
const task = await taskStore.createTask({
  description: "Implement user authentication",
  tool: "CLAUDECODE",
  instructions: "Add JWT-based auth with login/logout"
});

// Update when agent starts
await taskStore.updateTask(task.id, {
  status: "in_progress",
  started_at: new Date().toISOString(),
  assigned_to: agentSession.id
});

// Log progress
await taskStore.addLog(
  task.id,
  "Created auth middleware",
  "info",
  { fileName: "auth.js" }
);

// Complete task
await taskStore.completeTask(task.id, {
  filesCreated: ["auth.js", "auth.test.js"],
  testsPass: true
});
```

### Monitoring Active Tasks

```typescript
// Listen for updates
taskStore.on('task:updated', ({ task }) => {
  console.log(`Task ${task.id}: ${task.status}`);
});

// Query active tasks
const active = await taskStore.getTasks({
  status: ['in_progress', 'completed_active']
});

// Get task with full details
const task = await taskStore.getTask(taskId);
console.log(`Logs: ${task.logs.length}`);
console.log(`Duration: ${task.duration}ms`);
```

## Performance Considerations

1. **Memory Management**
   - Tasks stored in memory for fast access
   - Consider archiving old tasks
   - Monitor Map size for large deployments

2. **Persistence Optimization**
   - Batch writes when possible
   - Use debouncing for frequent updates
   - Consider async persistence queue

3. **Query Performance**
   - Index tasks by common fields
   - Implement caching for filters
   - Paginate large result sets