# Tools and Resources

## Overview

The SystemPrompt Coding Agent implements the MCP (Model Context Protocol) specification for tools and resources, providing a structured way for AI agents to interact with the system and access information.

## Architecture

```
Tools                           Resources
-----                           ---------
create_task  ─────┐             agent://status
update_task  ─────┼──► Handler  task://list
end_task     ─────┤             task://{id}
report_task  ─────┘             task://{id}/logs
                                task://{id}/result
```

## Tools

Tools are actions that AI agents can perform to interact with the system.

### Core Tools

#### 1. **create_task**
Creates a new task and optionally starts an AI agent to work on it.

**Parameters:**
- `tool`: Tool type ("CLAUDECODE", "GEMINI", etc.)
- `description`: Task description
- `instructions`: Detailed instructions for the AI agent
- `branch`: Optional git branch name (auto-generated if not provided)
- `config`: Optional configuration for the AI agent

**Example:**
```json
{
  "tool": "CLAUDECODE",
  "description": "Add authentication to the app",
  "instructions": "Implement JWT authentication with login/logout endpoints",
  "branch": "feature/auth"
}
```

#### 2. **update_task**
Updates an existing task's status or adds log entries.

**Parameters:**
- `taskId`: Task identifier
- `status`: New status ("in_progress", "completed", "failed")
- `log`: Optional log message to append

#### 3. **end_task**
Ends a task and its associated AI agent session.

**Parameters:**
- `taskId`: Task identifier
- `status`: Final status ("completed" or "failed")
- `result`: Optional result data

#### 4. **report_task**
Generates a detailed report for a task.

**Parameters:**
- `taskId`: Task identifier

### Tool Handler System

Tools are implemented using a handler pattern:

```typescript
interface ToolHandler<T = any> {
  (args: T, context?: ToolHandlerContext): Promise<CallToolResult>;
}

interface ToolHandlerContext {
  userId?: string;
  sessionId?: string;
  progressToken?: string | number;
}
```

### Tool Response Format

All tools return a standardized response:

```typescript
interface ToolResponse<T = any> {
  status: "success" | "error";
  message: string;
  result?: T;
  error?: {
    type: string;
    details?: any;
  };
}
```

## Resources

Resources provide read-only access to system state and information.

### Static Resources

1. **agent://status**
   - System status and capabilities
   - Active task count
   - Available tools

2. **task://list** or **agent://tasks**
   - List of all tasks
   - Task metadata (id, description, status)

### Dynamic Resources

1. **task://{taskId}**
   - Complete task information
   - Session details
   - Streaming output
   - Duration and timing
   - Logs and events

2. **task://{taskId}/logs**
   - Task log entries
   - Formatted as plain text

3. **task://{taskId}/result**
   - Task completion result
   - JSON formatted data

### Resource Templates

The system supports URI templates for dynamic resource access:

- `session://{sessionType}/{sessionId}` - Session details
- `branch://{branchName}/tasks` - Tasks on a specific branch
- `project://{projectPath}/status` - Project status
- `log://{logType}/{date}` - Historical logs

### Resource Response Format

Resources return MCP-compliant responses:

```typescript
interface ResourceContent {
  uri: string;
  mimeType: string;
  text: string;
}
```

## Implementation Details

### Tool Registration

Tools are registered in `/src/constants/tools.ts`:

```typescript
export const TOOLS = [
  {
    name: "create_task",
    description: "Create a new task",
    inputSchema: { /* JSON Schema */ }
  },
  // ...
];
```

### Resource Registration

Resources are registered in `/src/constants/resources.ts`:

```typescript
export const RESOURCES = [
  {
    uri: "agent://status",
    name: "Agent Status",
    mimeType: "application/json",
    description: "Current agent status"
  },
  // ...
];
```

### Handler Implementation

Tool handlers are implemented in `/src/handlers/tools/`:

```typescript
export async function handleCreateTask(
  args: CreateTaskArgs,
  context?: ToolHandlerContext
): Promise<CallToolResult> {
  // Implementation
  return formatToolResponse({
    status: "success",
    message: "Task created",
    result: { taskId }
  });
}
```

## Usage Examples

### Creating a Task via MCP

```json
{
  "method": "tools/call",
  "params": {
    "name": "create_task",
    "arguments": {
      "tool": "CLAUDECODE",
      "description": "Fix bug in auth module",
      "instructions": "Debug and fix the login issue"
    }
  }
}
```

### Reading a Resource via MCP

```json
{
  "method": "resources/read",
  "params": {
    "uri": "task://12345"
  }
}
```

## Best Practices

1. **Tool Design**
   - Keep tools focused on single actions
   - Use descriptive parameter names
   - Validate inputs thoroughly
   - Return meaningful error messages

2. **Resource Design**
   - Use consistent URI patterns
   - Provide appropriate MIME types
   - Keep responses reasonably sized
   - Use JSON for structured data

3. **Error Handling**
   - Always use the standard error format
   - Include helpful error details
   - Log errors for debugging
   - Maintain system stability

4. **Performance**
   - Cache resource responses when appropriate
   - Implement pagination for large lists
   - Use streaming for real-time data
   - Minimize database queries

## Extending the System

### Adding a New Tool

1. Define the tool schema in `/src/constants/tool/`
2. Implement the handler in `/src/handlers/tools/`
3. Export from the tools index
4. Register in the tools constant

### Adding a New Resource

1. Add to `/src/constants/resources.ts`
2. Implement handler logic in `/src/handlers/resource-handlers.ts`
3. Add URI template if dynamic
4. Test with MCP client

## Security Considerations

1. **Input Validation**: All tool inputs are validated against JSON schemas
2. **Authorization**: Context includes user/session information for access control
3. **Rate Limiting**: Tools can be rate-limited based on context
4. **Audit Logging**: All tool calls are logged for security auditing