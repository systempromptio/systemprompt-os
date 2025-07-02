# Utils Directory

Comprehensive utility functions and helpers providing security-focused validation, JSON Schema conversion, agent output parsing, logging, and tool availability checking for the SystemPrompt Coding Agent MCP server.

## Overview

The utilities directory contains essential helper functions that ensure:
- **Security**: UUID validation to prevent path traversal attacks
- **Interoperability**: JSON Schema to Zod conversion for MCP compatibility
- **Observability**: Structured logging and agent output parsing
- **Reliability**: Tool availability checking and graceful degradation

## Architecture

```
utils/
├── id-validation.ts      # UUID validation for security
├── json-schema-to-zod.ts # Schema conversion for MCP tools
├── log-parser.ts         # Agent output parsing
├── logger.ts             # Centralized logging
└── tool-availability.ts  # AI tool availability checks
```

## Core Utilities

### 🔒 ID Validation (`id-validation.ts`)

Security-focused validation to prevent path traversal attacks and ensure safe filesystem operations.

#### Key Features:
- **UUID v4 Validation**: Enforces proper format for task IDs
- **Path Traversal Prevention**: Blocks dangerous characters (.., /, \)
- **Type Safety**: Compile-time and runtime validation

#### Usage:
```typescript
import { validateTaskId, isValidUUID, sanitizeTaskId } from './utils/id-validation';

// Validate UUID format
if (isValidUUID('550e8400-e29b-41d4-a716-446655440000')) {
  console.log('Valid UUID');
}

// Validate and sanitize task ID
try {
  const safeId = validateTaskId(userInput);
  // safeId is guaranteed safe for filesystem operations
} catch (error) {
  console.error('Invalid task ID:', error.message);
}
```

#### Security Notes:
- All task IDs MUST be valid UUID v4 format
- Prevents directory traversal attacks
- Safe for use in filesystem paths

### 🔄 JSON Schema to Zod Converter (`json-schema-to-zod.ts`)

Converts JSON Schema definitions to Zod schemas for MCP tool validation.

#### Supported Features:
- Basic types: string, number, boolean, object, array
- Required/optional fields
- Default values
- String enums
- Nested schemas

#### Usage:
```typescript
import { jsonSchemaToZod } from './utils/json-schema-to-zod';

const jsonSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number' },
    active: { type: 'boolean', default: true }
  },
  required: ['name']
};

const zodSchema = jsonSchemaToZod(jsonSchema);
const result = zodSchema.parse({ name: 'John', age: 30 });
```

#### Limitations:
- Designed specifically for MCP tool schemas
- Complex validators (patterns, formats) not supported
- Subset of JSON Schema spec

### 📊 Log Parser (`log-parser.ts`)

Extracts structured information from AI agent outputs for better observability.

#### Features:
- **Claude Pattern Detection**: XML-style function calls
- **Tool Usage Extraction**: Parameters and file paths
- **Structured Output**: Converts raw text to TaskLogEntry[]

#### Usage:
```typescript
import { LogParser } from './utils/log-parser';

const claudeOutput = `
I'll analyze the file structure...
<function_calls>
<invoke name="read_file">
  <parameter name="file_path">src/index.ts</parameter>
</invoke>
</function_calls>
`;

const logEntries = LogParser.parseAgentOutput(claudeOutput, 'claude');
// Returns structured TaskLogEntry[] with tool usage information
```

#### Parsed Events:
- Tool invocations with parameters
- File operations
- General output messages
- Timing information

### 📝 Logger (`logger.ts`)

Simple, effective logging with environment-based debug control.

#### Log Levels:
- **debug**: Detailed debugging (requires DEBUG=true)
- **info**: General informational messages
- **warn**: Warning messages
- **error**: Error messages with stack traces

#### Usage:
```typescript
import { logger } from './utils/logger';

logger.debug('Detailed debugging information', { userId: 'user123' });
logger.info('Server started on port', 3000);
logger.warn('Rate limit approaching', { remaining: 10 });
logger.error('Failed to connect to agent service', error);
```

#### Configuration:
```bash
# Enable debug logging
DEBUG=true npm start
```

### 🛠️ Tool Availability (`tool-availability.ts`)

Checks and validates AI tool availability based on environment configuration.

#### Features:
- **Environment Checking**: Reads CLAUDE_AVAILABLE and GEMINI_AVAILABLE
- **Graceful Degradation**: Handle missing tools
- **Startup Validation**: Ensure at least one tool is available

#### Usage:
```typescript
import { 
  validateToolsAvailable, 
  getAvailableTools,
  isToolAvailable 
} from './utils/tool-availability';

// Startup validation
try {
  validateToolsAvailable();
} catch (error) {
  console.error('No AI tools configured:', error.message);
  process.exit(1);
}

// Check specific tool
if (isToolAvailable('CLAUDECODE')) {
  // Use Claude Code
}

// Get all available tools
const tools = getAvailableTools();
// Returns: ['CLAUDECODE', 'GEMINICLI'] or subset
```

## Usage Patterns

### Security-First Validation
```typescript
// Always validate IDs before filesystem operations
export async function getTaskFile(taskId: string): Promise<string> {
  const safeId = validateTaskId(taskId); // Throws if invalid
  const filePath = path.join(TASK_DIR, `${safeId}.json`);
  return fs.readFile(filePath, 'utf-8');
}
```

### Schema Validation for Tools
```typescript
// Convert MCP tool schema to Zod for validation
const tool = {
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      limit: { type: 'number', default: 10 }
    },
    required: ['query']
  }
};

const validator = jsonSchemaToZod(tool.inputSchema);
const validatedInput = validator.parse(userInput);
```

### Structured Logging from Agents
```typescript
// Parse and log agent output
agentProcess.on('data', (chunk: string) => {
  const entries = LogParser.parseAgentOutput(chunk, 'claude');
  entries.forEach(entry => {
    taskLogger.log(entry);
  });
});
```

### Conditional Tool Usage
```typescript
// Fallback logic based on availability
function selectBestTool(): string {
  if (isToolAvailable('CLAUDECODE')) {
    return 'CLAUDECODE';
  } else if (isToolAvailable('GEMINICLI')) {
    logger.warn('Claude not available, using Gemini');
    return 'GEMINICLI';
  } else {
    throw new Error('No AI tools available');
  }
}
```

## Best Practices

### Security
1. **Always Validate IDs**: Use validateTaskId for any user-provided IDs
2. **No Direct Paths**: Never accept file paths from users
3. **Sanitize Inputs**: Use provided validators before operations

### Error Handling
1. **Catch Validation Errors**: Handle invalid IDs gracefully
2. **Log Errors with Context**: Include relevant metadata
3. **Fail Fast**: Validate early in request lifecycle

### Performance
1. **Cache Validations**: Store validated IDs when appropriate
2. **Batch Operations**: Parse logs in chunks
3. **Lazy Loading**: Only check tool availability when needed

### Maintainability
1. **Single Purpose**: Each utility has one clear responsibility
2. **Pure Functions**: Avoid side effects where possible
3. **Comprehensive Docs**: JSDoc with examples for all exports

## Testing

### Unit Test Examples
```typescript
describe('ID Validation', () => {
  it('should accept valid UUID v4', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(validateTaskId(uuid)).toBe(uuid);
  });

  it('should reject path traversal attempts', () => {
    expect(() => validateTaskId('../etc/passwd')).toThrow();
    expect(() => validateTaskId('../../secret')).toThrow();
  });
});

describe('JSON Schema to Zod', () => {
  it('should handle required fields', () => {
    const schema = jsonSchemaToZod({
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id']
    });
    
    expect(() => schema.parse({})).toThrow();
    expect(schema.parse({ id: 'test' })).toEqual({ id: 'test' });
  });
});
```

## Environment Variables

```bash
# Logging
DEBUG=true|false                  # Enable debug logging

# Tool Availability
CLAUDE_AVAILABLE=true|false       # Claude Code CLI available
GEMINI_AVAILABLE=true|false       # Gemini CLI available
```

## Future Enhancements

- **Advanced Log Parsing**: Support for more agent patterns
- **Schema Validation**: Support more JSON Schema features
- **Metrics Collection**: Performance tracking utilities
- **Retry Logic**: Configurable retry helpers
- **Rate Limiting**: Request throttling utilities

This utilities layer provides essential security, validation, and helper functions that ensure the SystemPrompt Coding Agent operates safely and reliably.