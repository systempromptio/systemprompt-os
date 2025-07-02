# Types Directory

Comprehensive TypeScript type definitions providing strong typing, interfaces, and contracts for the SystemPrompt Coding Agent MCP server, ensuring type safety and clear data structures throughout the application.

## Overview

The types directory serves as the central source of truth for all TypeScript definitions, providing:
- **Type Safety**: Compile-time checking for data structures
- **Clear Contracts**: Well-defined interfaces between components
- **Documentation**: Self-documenting code through types
- **IDE Support**: Enhanced auto-completion and refactoring
- **Runtime Validation**: Type guards and validators

## Architecture

```
types/
├── api/                 # API-related types
│   ├── errors.ts       # Error definitions
│   ├── requests.ts     # Request structures
│   └── responses.ts    # Response formats
├── core/               # Core domain types
│   ├── agent.ts        # Agent interfaces
│   ├── context.ts      # Context types
│   └── session.ts      # Session management
├── events/             # Event system types
│   ├── base.ts         # Base event interface
│   ├── agent.ts        # Agent events
│   └── task.ts         # Task events
├── providers/          # Provider-specific types
│   ├── base.ts         # Base provider interface
│   └── claude.ts       # Claude-specific types
├── resources/          # Resource types
│   └── task-resource.ts # Task resource definitions
├── utils/              # Utility types
│   ├── guards.ts       # Type guards
│   └── transformers.ts # Type transformers
└── validation/         # Validation schemas
    └── index.ts        # Zod schemas
```

## Core Type Categories

### 🎯 API Types (`/api`)

#### Error Types (`errors.ts`)
```typescript
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  statusCode?: number;
}

export class ServiceError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public context?: any
  ) {
    super(message);
  }
}

export enum ErrorCode {
  INVALID_REQUEST = 'INVALID_REQUEST',
  AGENT_NOT_FOUND = 'AGENT_NOT_FOUND',
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  EXECUTION_FAILED = 'EXECUTION_FAILED'
}
```

#### Request Types (`requests.ts`)
```typescript
export interface CreateTaskRequest {
  tool: 'CLAUDECODE' | 'SHELL';
  instructions: string;
  branch?: string;
  requirements?: string[];
}

export interface UpdateTaskRequest {
  taskId: string;
  status?: TaskStatus;
  output?: string;
  error?: string;
}
```

#### Response Types (`responses.ts`)
```typescript
export interface CreateTaskResponse {
  taskId: string;
  status: TaskStatus;
  createdAt: number;
}

export interface TaskStatusResponse {
  task: Task;
  agent?: AgentInfo;
  progress?: number;
}
```

### 🏗️ Core Domain Types (`/core`)

#### Agent Types (`agent.ts`)
```typescript
export interface Agent {
  id: string;
  type: AgentType;
  status: AgentStatus;
  capabilities: string[];
  metadata?: Record<string, unknown>;
}

export enum AgentType {
  CLAUDE_CODE = 'claude-code',
  GEMINI = 'gemini',
  SHELL = 'shell'
}

export enum AgentStatus {
  IDLE = 'idle',
  BUSY = 'busy',
  ERROR = 'error',
  OFFLINE = 'offline'
}
```

#### Context Types (`context.ts`)
```typescript
export interface RequestContext {
  sessionId: string;
  timestamp: number;
  clientId?: string;
  metadata?: Record<string, unknown>;
}

export interface ExecutionContext {
  task: Task;
  agent: Agent;
  workingDirectory: string;
  environment?: Record<string, string>;
}
```

#### Session Types (`session.ts`)
```typescript
export interface Session {
  id: string;
  agentId: string;
  createdAt: number;
  lastActivity: number;
  state: SessionState;
}

export interface SessionState {
  currentTask?: string;
  history: string[];
  variables: Record<string, unknown>;
}
```

### 📊 Task Types (`task.ts`)

```typescript
export interface Task {
  id: string;
  tool: string;
  instructions: string;
  status: TaskStatus;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
  output?: string;
  error?: string;
  branch?: string;
  requirements?: string[];
  metadata?: TaskMetadata;
}

export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface TaskMetadata {
  agentId?: string;
  sessionId?: string;
  duration?: number;
  retryCount?: number;
  logs?: TaskLog[];
}
```

### 🎭 Event Types (`/events`)

#### Base Event (`base.ts`)
```typescript
export interface BaseEvent<T = unknown> {
  id: string;
  type: string;
  timestamp: number;
  source: string;
  data: T;
}
```

#### Task Events (`task.ts`)
```typescript
export interface TaskCreatedEvent extends BaseEvent<Task> {
  type: 'task:created';
}

export interface TaskUpdatedEvent extends BaseEvent<{
  task: Task;
  changes: Partial<Task>;
}> {
  type: 'task:updated';
}

export type TaskEvent = 
  | TaskCreatedEvent
  | TaskUpdatedEvent
  | TaskCompletedEvent
  | TaskFailedEvent;
```

#### Agent Events (`agent.ts`)
```typescript
export interface AgentStartedEvent extends BaseEvent<{
  agentId: string;
  taskId: string;
}> {
  type: 'agent:started';
}

export interface AgentOutputEvent extends BaseEvent<{
  agentId: string;
  output: string;
}> {
  type: 'agent:output';
}
```

### 🔌 Provider Types (`/providers`)

#### Base Provider (`base.ts`)
```typescript
export interface Provider {
  name: string;
  type: string;
  
  initialize(): Promise<void>;
  execute(command: string): Promise<ExecutionResult>;
  shutdown(): Promise<void>;
}

export interface ExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
}
```

#### Claude Provider (`claude.ts`)
```typescript
export interface ClaudeConfig {
  apiKey?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ClaudeSession extends Session {
  config: ClaudeConfig;
  conversationId?: string;
}
```

### 🎯 Claude Event Types (`claude-events.ts`)

Strongly-typed events from Claude output:

```typescript
export interface ClaudeEventBase {
  type: string;
  timestamp: string;
  sessionId: string;
  taskId?: string;
}

export interface ToolStartEvent extends ClaudeEventBase {
  type: 'tool:start';
  toolName: string;
  toolId: string;
  parameters?: Record<string, unknown>;
}

export interface ToolEndEvent extends ClaudeEventBase {
  type: 'tool:end';
  toolId: string;
  toolName: string;
  duration: number;
  success: boolean;
  result?: unknown;
}

export type ClaudeEvent = 
  | ProcessStartEvent
  | ProcessEndEvent
  | ToolStartEvent
  | ToolEndEvent
  | MessageEvent
  | ErrorEvent;
```

### 📦 Resource Types (`/resources`)

```typescript
export interface TaskResource {
  uri: string;
  name: string;
  mimeType: string;
  description?: string;
}

export interface TaskOutputResource extends TaskResource {
  taskId: string;
  content: string;
  size: number;
}
```

### 🛠️ Utility Types (`/utils`)

#### Type Guards (`guards.ts`)
```typescript
export function isTask(value: unknown): value is Task {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'status' in value
  );
}

export function isClaudeEvent(value: unknown): value is ClaudeEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'timestamp' in value
  );
}
```

#### Type Transformers (`transformers.ts`)
```typescript
export function taskToResource(task: Task): TaskResource {
  return {
    uri: `task://${task.id}`,
    name: `Task ${task.id}`,
    mimeType: 'application/json',
    description: task.instructions
  };
}

export function cleanTaskForResponse(task: Task): TaskResponse {
  const { metadata, ...publicFields } = task;
  return publicFields;
}
```

### ✅ Validation Types (`/validation`)

Zod schemas for runtime validation:

```typescript
import { z } from 'zod';

export const CreateTaskSchema = z.object({
  tool: z.enum(['CLAUDECODE', 'SHELL']),
  instructions: z.string().min(1),
  branch: z.string().optional(),
  requirements: z.array(z.string()).optional()
});

export const TaskIdSchema = z.string().regex(/^[a-z0-9-]+$/);

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
```

## Type Patterns

### Discriminated Unions
```typescript
type AgentMessage = 
  | { type: 'output'; data: string }
  | { type: 'error'; error: Error }
  | { type: 'complete'; exitCode: number };
```

### Branded Types
```typescript
type TaskId = string & { readonly brand: unique symbol };
type SessionId = string & { readonly brand: unique symbol };
```

### Utility Types
```typescript
// Make all properties optional except specified
type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>;

// Deep readonly
type DeepReadonly<T> = {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
};
```

## Best Practices

### Interface Design
1. **Single Responsibility**: Each type serves one purpose
2. **Clear Naming**: Use descriptive, unambiguous names
3. **Documentation**: Add JSDoc for complex types
4. **Immutability**: Prefer readonly where appropriate

### Organization
1. **Logical Grouping**: Related types in same file
2. **Barrel Exports**: Use index.ts for clean imports
3. **Avoid Circular Deps**: Structure to prevent cycles
4. **Co-location**: Keep types near usage when specific

### Type Safety
1. **Strict Mode**: Always use TypeScript strict mode
2. **No Any**: Avoid `any`, use `unknown` if needed
3. **Exhaustive Checks**: Use never for completeness
4. **Type Guards**: Implement for runtime safety

## Adding New Types

### Step-by-Step Guide

1. **Identify Category**
   - Is it API, Core, Event, or Utility?
   - Choose appropriate subdirectory

2. **Create Type File**
   ```typescript
   // types/core/my-feature.ts
   export interface MyFeature {
     id: string;
     // properties...
   }
   ```

3. **Add Validation** (if needed)
   ```typescript
   // types/validation/my-feature.ts
   export const MyFeatureSchema = z.object({
     id: z.string(),
     // validations...
   });
   ```

4. **Export from Index**
   ```typescript
   // types/index.ts
   export * from './core/my-feature';
   ```

5. **Add Type Guards** (if needed)
   ```typescript
   // types/utils/guards.ts
   export function isMyFeature(value: unknown): value is MyFeature {
     // implementation
   }
   ```

## Type Documentation

### JSDoc Standards
```typescript
/**
 * Represents a coding task to be executed by an agent
 * @interface Task
 * @property {string} id - Unique identifier
 * @property {TaskStatus} status - Current execution status
 */
export interface Task {
  // ...
}
```

### Complex Type Examples
```typescript
/**
 * Configuration for task execution
 * @example
 * ```typescript
 * const config: TaskConfig = {
 *   timeout: 300000,
 *   retries: 3,
 *   environment: { NODE_ENV: 'production' }
 * };
 * ```
 */
export interface TaskConfig {
  // ...
}
```

## Future Enhancements

- **Generated Types**: Auto-generate from OpenAPI specs
- **Type Testing**: Runtime type verification tests
- **Type Metrics**: Measure type coverage
- **Type Migration**: Tools for version migrations
- **Type Registry**: Central type repository

This type system provides the foundation for a robust, maintainable, and scalable MCP server implementation with strong guarantees about data structures and contracts.