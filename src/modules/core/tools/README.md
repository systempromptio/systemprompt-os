# Tools Module

## Overview

The tools module provides a comprehensive system for managing and serving tools (functions) within SystemPrompt OS. It enables dynamic tool discovery, validation, and execution for AI assistants.

## Features

- Dynamic tool discovery from module directories
- Tool validation and schema enforcement
- Database-backed tool registry
- Enable/disable functionality for individual tools
- CLI commands for tool management
- Integration with MCP tool protocol
- Tool scanner for automatic discovery

## Configuration

The tools module is configured through the module system:

```yaml
tools:
  enabled: true
  config:
    autoDiscover: true
    scanInterval: 300000  # 5 minutes
```

## CLI Commands

### List Tools

List all available tools in the system:

```bash
systemprompt tools:list
```

Options:
- `--format, -f`: Output format (text, json, table) [default: text]
- `--module, -m`: Filter by module name
- `--enabled`: Show only enabled tools
- `--disabled`: Show only disabled tools

### Enable/Disable Tools

Enable a specific tool:

```bash
systemprompt tools:enable --name <tool-name>
```

Disable a specific tool:

```bash
systemprompt tools:disable --name <tool-name>
```

### Tool Information

Get detailed information about a tool:

```bash
systemprompt tools:info --name <tool-name>
```

### Refresh Tools

Manually trigger tool discovery:

```bash
systemprompt tools:refresh
```

## Database Schema

The tools module uses the following database schema:

- `tools` table: Stores tool definitions
  - `id`: Unique identifier
  - `name`: Tool name
  - `module`: Source module name
  - `description`: Tool description
  - `inputSchema`: JSON schema for input validation
  - `enabled`: Whether the tool is enabled
  - `metadata`: Additional tool metadata
  - `created_at`: Creation timestamp
  - `updated_at`: Last update timestamp

## API

The tools module exports the following functionality:

- `ToolService`: Service for managing tools
  - `getAll()`: Get all tools
  - `getEnabled()`: Get only enabled tools
  - `getByName(name)`: Get tool by name
  - `enable(name)`: Enable a tool
  - `disable(name)`: Disable a tool
  - `scanTools()`: Scan for new tools
  - `validateInput(tool, input)`: Validate tool input

## Development

### Adding New Tools

Tools can be added to any module by creating files in the `tools/` directory:

```typescript
// tools/my-tool.tool.ts
export const tool = {
  name: 'my-tool',
  description: 'Description of my tool',
  inputSchema: {
    type: 'object',
    properties: {
      input: {
        type: 'string',
        description: 'Input parameter'
      }
    },
    required: ['input']
  },
  async execute(args: { input: string }): Promise<any> {
    // Tool implementation
    return {
      result: `Processed: ${args.input}`
    };
  }
};
```

### Tool Formats

Tools can be defined in multiple formats:
- TypeScript files (`.tool.ts`)
- JavaScript files (`.tool.js`)
- JSON definitions (`.tool.json`)

### Tool Validation

All tools are validated against their input schema before execution. The module uses JSON Schema for validation.

### Testing

Run tests with:

```bash
npm test -- src/modules/core/tools
```

## Tool Scanner

The tool scanner automatically discovers tools from all loaded modules:

1. Scans `tools/` directories in each module
2. Validates tool definitions
3. Registers tools in the database
4. Monitors for changes

## Dependencies

- logger: For logging operations
- database: For persistent storage

## Security

- Tools are sandboxed during execution
- Input validation is enforced
- Tools can be disabled without removing them
- Access control can be implemented per tool

## License

MIT