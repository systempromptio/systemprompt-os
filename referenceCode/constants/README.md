# Constants Directory

Central repository for all static definitions, configurations, and schemas used throughout the SystemPrompt Coding Agent MCP server. This directory serves as the single source of truth for tool definitions, resources, and server configuration.

## Overview

The constants directory defines the static aspects of the MCP server:
- Tool definitions and schemas
- Resource URIs and templates
- Server configuration and metadata
- Task status enumerations
- Static validation schemas

## Directory Structure

```
constants/
├── server/                 # Server-level configuration
│   ├── server-config.ts   # MCP server metadata
│   └── README.md         
├── tool/                  # Individual tool definitions
│   ├── create-task.ts     # Task creation tool
│   ├── update-task.ts     # Task update tool
│   ├── check-status.ts    # Status checking tool
│   ├── end-task.ts        # Task completion tool
│   ├── report-task.ts     # Task reporting tool
│   ├── clean-state.ts     # State cleanup tool
│   └── get-prompt.ts      # Prompt retrieval tool
├── tools.ts               # Tool aggregator
├── resources.ts           # Resource definitions
├── task-status.ts         # Task status enums
└── README.md
```

## Core Files

### 📄 `tools.ts`
Master list of all available MCP tools:
```typescript
export const TOOLS: Tool[] = [
  createTask,
  updateTask,
  endTask,
  reportTask,
  checkStatus,
  cleanState,
  getPrompt
];
```

### 📄 `resources.ts`
Defines available resources and URI patterns:
- Task resource URIs
- Resource templates
- Subscription patterns

### 📄 `task-status.ts`
Task status enumerations:
```typescript
export enum TaskStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled"
}
```

## Server Configuration (`/server`)

### `server-config.ts`
MCP server metadata and capabilities:
- Server name and version
- Protocol capabilities
- Feature declarations
- Session configuration

Key exports:
```typescript
export const SERVER_CONFIG = {
  name: "systemprompt-coding-agent",
  version: "1.0.0",
  capabilities: {
    tools: true,
    resources: true,
    prompts: true,
    notifications: true
  }
};
```

## Tool Definitions (`/tool`)

Each tool file defines a complete MCP tool specification following this pattern:

```typescript
export const toolName: Tool = {
  name: "tool_name",
  description: "Clear description of what the tool does",
  inputSchema: {
    type: "object",
    properties: {
      param1: {
        type: "string",
        description: "Parameter description",
        enum: ["option1", "option2"] // Optional constraints
      },
      param2: {
        type: "number",
        description: "Another parameter",
        minimum: 0,
        maximum: 100
      }
    },
    required: ["param1"],
    additionalProperties: false
  }
};
```

### Core Tools

#### 🔧 `create-task.ts`
Creates new coding tasks:
- Parameters: `tool`, `instructions`, `branch`, `requirements`
- Supports: SHELL, CLAUDECODE agents
- Returns: Task ID and initial status

#### 🔄 `update-task.ts`
Updates existing task state:
- Parameters: `taskId`, `status`, `output`, `error`
- Validates: Task existence and transitions
- Emits: Update notifications

#### ✅ `end-task.ts`
Marks tasks as completed:
- Parameters: `taskId`, `status`, `output`
- Finalizes: Task state
- Triggers: Cleanup operations

#### 📊 `report-task.ts`
Generates task reports:
- Parameters: `taskId`
- Returns: Complete task history
- Includes: Logs, output, metrics

#### 🔍 `check-status.ts`
Checks task or system status:
- Parameters: `taskId` (optional)
- Returns: Current state
- Monitors: Agent health

#### 🧹 `clean-state.ts`
Cleans up system state:
- Parameters: `scope` (tasks, sessions, all)
- Removes: Stale data
- Resets: System state

#### 📝 `get-prompt.ts`
Retrieves system prompts:
- Parameters: `name`, `arguments`
- Returns: Formatted prompts
- Supports: Dynamic generation

## Schema Patterns

### Consistent Structure
All tool schemas follow JSON Schema Draft 7:
```typescript
{
  type: "object",
  properties: {
    // Property definitions
  },
  required: ["requiredProp"],
  additionalProperties: false
}
```

### Validation Rules
- **Type Safety**: Strict type definitions
- **Constraints**: Min/max values, string patterns
- **Enumerations**: Limited option sets
- **Descriptions**: Clear parameter explanations

### Error Messages
Tools provide helpful error context:
```typescript
{
  error: {
    type: "validation_error",
    message: "Invalid parameter",
    details: {
      parameter: "branch",
      reason: "Must be alphanumeric with hyphens"
    }
  }
}
```

## Resource Patterns

### URI Structure
Resources follow consistent URI patterns:
```
task://[taskId]
task://[taskId]/output
task://[taskId]/logs
task-template://[type]
```

### Templates
Pre-defined resource templates:
```typescript
export const RESOURCE_TEMPLATES = {
  "task-template://coding": {
    name: "Coding Task Template",
    description: "Template for coding tasks",
    mimeType: "application/json"
  }
};
```

## Adding New Constants

### Adding a Tool

1. **Create Tool Definition**
   ```typescript
   // tool/my-tool.ts
   export const myTool: Tool = {
     name: "my_tool",
     description: "What it does",
     inputSchema: { /* schema */ }
   };
   ```

2. **Add to Tools List**
   ```typescript
   // tools.ts
   import { myTool } from "./tool/my-tool.js";
   export const TOOLS = [...existing, myTool];
   ```

3. **Implement Handler**
   Create corresponding handler in `handlers/tools/`

### Adding Resources

1. **Define URI Pattern**
   ```typescript
   // resources.ts
   export const MY_RESOURCE_URI = "myresource://[id]";
   ```

2. **Add Template** (if applicable)
   ```typescript
   export const RESOURCE_TEMPLATES = {
     "myresource-template://type": { /* template */ }
   };
   ```

## Best Practices

### Schema Design
1. **Minimal Required Fields**: Only require essential parameters
2. **Clear Descriptions**: Every parameter needs explanation
3. **Sensible Defaults**: Provide defaults where appropriate
4. **Strict Validation**: Use constraints to prevent errors

### Naming Conventions
- **Tools**: Verb-based names (`create_task`, `check_status`)
- **Constants**: UPPER_SNAKE_CASE
- **Types**: PascalCase
- **Properties**: camelCase

### Documentation
- Every exported constant must have JSDoc
- Include usage examples for complex schemas
- Document validation rules
- Explain parameter relationships

### Versioning
- Consider backward compatibility
- Use deprecation notices
- Version schemas if needed
- Document breaking changes

## Type Safety

All constants are strictly typed:
```typescript
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

// Type-safe tool definition
export const myTool: Tool = { /* ... */ };

// Type-safe status enum
export enum TaskStatus { /* ... */ }
```

## Testing

Constants should be:
- Validated against their schemas
- Tested for completeness
- Checked for consistency
- Verified for correctness

## Maintenance

When updating constants:
1. Update TypeScript types
2. Update handler implementations
3. Test all affected flows
4. Update documentation
5. Notify of breaking changes

This directory forms the contract between the MCP server and its clients - changes here affect the entire system's interface.