# Handler Functions

Core request processing layer for the SystemPrompt Coding Agent MCP server, implementing business logic for tools, resources, prompts, and notifications according to the Model Context Protocol specification.

## Overview

Handlers are the execution layer of the MCP server, responsible for:
- Processing incoming MCP requests (tools, resources, prompts)
- Orchestrating AI coding agents (Claude Code, Gemini)
- Managing task lifecycle and state
- Sending real-time notifications
- Validating inputs and formatting responses

## Architecture

```
┌─────────────────────┐
│   MCP Client        │
│  (Claude, Cline)    │
└──────────┬──────────┘
           │ MCP Protocol
┌──────────▼──────────┐
│   Handler Layer     │
├─────────────────────┤
│ • Tool Handlers     │──┐
│ • Resource Handlers │  │
│ • Prompt Handlers   │  │
│ • Notifications     │  │
└─────────────────────┘  │
           │             │
┌──────────▼──────────┐  │
│   Services Layer    │◄─┘
│ • Agent Manager     │
│ • Task Store        │
│ • State Persistence │
└─────────────────────┘
```

## Directory Structure

```
handlers/
├── tools/                    # Tool implementations
│   ├── create-task.ts       # Task creation
│   ├── update-task.ts       # Task updates
│   ├── check-status.ts      # Status checks
│   ├── end-task.ts          # Task completion
│   ├── report-task.ts       # Task reporting
│   ├── clean-state.ts       # State cleanup
│   ├── get-prompt.ts        # Prompt retrieval
│   └── utils/               # Shared utilities
├── prompts/                 # Prompt templates
│   ├── bug-fixing.ts        # Bug fix workflows
│   ├── unit-testing.ts      # Test generation
│   ├── react-components.ts  # React patterns
│   └── reddit-post.ts       # Content creation
├── resources/               # Resource handlers
│   └── task-output.ts       # Task output access
├── tool-handlers.ts         # Tool router
├── resource-handlers.ts     # Resource router
├── prompt-handlers.ts       # Prompt router
├── notifications.ts         # Notification system
├── resource-templates-handler.ts  # Templates
└── roots-handlers.ts        # Root listings
```

## Core Handlers

### 🛠️ `tool-handlers.ts`
Main tool execution router:
```typescript
export async function handleTools(): Promise<{ tools: Tool[] }> {
  // Returns all available tools
}

export async function handleToolCall(
  name: string,
  args: unknown
): Promise<CallToolResult> {
  // Routes to specific tool handler
  // Validates arguments
  // Formats responses
}
```

### 📢 `notifications.ts`
Real-time notification system:
```typescript
export class NotificationService {
  // Send to all sessions
  broadcastNotification(notification: Notification): void
  
  // Send to specific session
  sendToSession(sessionId: string, notification: Notification): void
  
  // Operation notifications
  sendOperationNotification(operation: string, message: string): void
}
```

### 📋 `prompt-handlers.ts`
Prompt template management:
```typescript
export async function handleListPrompts(): Promise<{ prompts: Prompt[] }> {
  // Returns available prompts
}

export async function handleGetPrompt(
  name: string,
  args?: Record<string, string>
): Promise<GetPromptResult> {
  // Returns formatted prompt
}
```

### 📦 `resource-handlers.ts`
Resource access management:
```typescript
export async function handleListResources(): Promise<{ resources: Resource[] }> {
  // Lists available resources
}

export async function handleReadResource(
  uri: string
): Promise<ReadResourceResult> {
  // Reads resource content
}
```

## Tool Implementations (`/tools`)

### Task Management Tools

#### 🔧 `create-task.ts`
Creates new coding tasks:
```typescript
{
  tool: "CLAUDECODE" | "SHELL",
  instructions: string,
  branch?: string,
  requirements?: string[]
}
```

#### 🔄 `update-task.ts`
Updates task state:
```typescript
{
  taskId: string,
  status?: TaskStatus,
  output?: string,
  error?: string
}
```

#### ✅ `end-task.ts`
Completes tasks:
```typescript
{
  taskId: string,
  status: "completed" | "failed" | "cancelled",
  output?: string
}
```

#### 📊 `check-status.ts`
Checks system/task status:
```typescript
{
  taskId?: string  // Optional: specific task
}
```

#### 📝 `report-task.ts`
Generates task reports:
```typescript
{
  taskId: string,
  format?: "summary" | "detailed"
}
```

#### 🧹 `clean-state.ts`
Cleans system state:
```typescript
{
  scope: "tasks" | "sessions" | "all"
}
```

#### 💬 `get-prompt.ts`
Retrieves prompt templates:
```typescript
{
  name: string,
  arguments?: Record<string, string>
}
```

### Utilities (`/tools/utils`)

Shared tool utilities:
- **`validation.ts`** - Argument validation
- **`agent.ts`** - Agent operations
- **`task.ts`** - Task operations
- **`types.ts`** - Shared types

## Prompt Templates (`/prompts`)

Pre-defined coding workflows:

### 🐛 `bug-fixing.ts`
Bug fixing methodology:
- Problem identification
- Root cause analysis
- Solution implementation
- Testing approach

### 🧪 `unit-testing.ts`
Test generation patterns:
- Test structure
- Coverage guidelines
- Assertion patterns
- Mock strategies

### ⚛️ `react-components.ts`
React development:
- Component architecture
- State management
- Props validation
- Hook patterns

### 📝 `reddit-post.ts`
Content creation:
- Post formatting
- Engagement strategies
- Community guidelines

## Request Flow

### Tool Execution Flow
```
1. Client Request
   └─> tool-handlers.ts
       └─> Argument Validation
           └─> Tool Implementation
               └─> Service Layer Call
                   └─> Response Formatting
                       └─> Notification Send
```

### Error Handling Flow
```
1. Error Occurs
   └─> Error Context Added
       └─> User-Friendly Message
           └─> Error Notification
               └─> Structured Response
```

## Key Patterns

### Consistent Response Format
```typescript
// Success
{
  content: [{
    type: "text",
    text: JSON.stringify(result, null, 2)
  }]
}

// Error
{
  content: [{
    type: "text",
    text: `Error: ${message}`
  }],
  isError: true
}
```

### Validation Pattern
```typescript
function validateArgs(args: unknown): ValidatedArgs {
  const parsed = schema.safeParse(args);
  if (!parsed.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      formatZodError(parsed.error)
    );
  }
  return parsed.data;
}
```

### Notification Pattern
```typescript
// Before operation
await notify("operation_start", { operation, taskId });

// After success
await notify("operation_complete", { operation, result });

// On error
await notify("operation_error", { operation, error });
```

## Adding New Handlers

### Adding a Tool

1. **Create Tool Definition**
   ```typescript
   // tools/my-tool.ts
   export async function handleMyTool(args: MyToolArgs) {
     // Implementation
   }
   ```

2. **Register in Router**
   ```typescript
   // tool-handlers.ts
   case "my_tool":
     return handleMyTool(args);
   ```

3. **Add Constants**
   ```typescript
   // constants/tool/my-tool.ts
   export const MY_TOOL = {
     name: "my_tool",
     inputSchema: { /* ... */ }
   };
   ```

### Adding a Resource

1. **Create Resource Handler**
   ```typescript
   // resources/my-resource.ts
   export function handleMyResource(uri: string) {
     // Implementation
   }
   ```

2. **Register in Router**
   ```typescript
   // resource-handlers.ts
   if (uri.startsWith("myresource://")) {
     return handleMyResource(uri);
   }
   ```

## Best Practices

### Input Validation
- Use Zod schemas for type safety
- Validate early, fail fast
- Provide helpful error messages
- Check permissions and limits

### Error Handling
- Catch all exceptions
- Add context to errors
- Log for debugging
- Return user-friendly messages

### Performance
- Use async/await properly
- Stream large outputs
- Implement timeouts
- Cache when appropriate

### Security
- Validate all inputs
- Sanitize file paths
- Check resource access
- Limit operation scope

## Testing

### Unit Tests
```typescript
describe('Tool Handler', () => {
  it('should create task successfully', async () => {
    const result = await handleCreateTask({
      tool: 'CLAUDECODE',
      instructions: 'Test task'
    });
    expect(result.taskId).toBeDefined();
  });
});
```

### Integration Tests
- Test with real services
- Verify notifications sent
- Check state persistence
- Validate error scenarios

## Monitoring

Handlers emit metrics for:
- Request counts
- Error rates
- Response times
- Tool usage

## Future Enhancements

- Batch operations support
- Streaming responses
- Advanced validation
- Custom tool plugins
- Rate limiting per tool

This handler layer forms the core execution engine of the MCP server, translating protocol requests into actionable operations while maintaining consistency, security, and performance.