# Prompts Module

## Overview

The prompts module provides a centralized system for managing and serving AI prompts within SystemPrompt OS. It allows for dynamic prompt discovery, storage, and retrieval.

## Features

- Dynamic prompt discovery from module directories
- Database-backed prompt storage
- Prompt versioning and metadata management
- CLI commands for prompt management
- Integration with MCP prompt protocol

## Configuration

The prompts module is configured through the module system:

```yaml
prompts:
  enabled: true
  config:
    # Module-specific configuration
```

## CLI Commands

### List Prompts

List all available prompts in the system:

```bash
systemprompt prompts:list
```

Options:
- `--format, -f`: Output format (text, json, table) [default: text]
- `--module, -m`: Filter by module name

## Database Schema

The prompts module uses the following database schema:

- `prompts` table: Stores prompt definitions
  - `id`: Unique identifier
  - `name`: Prompt name
  - `description`: Prompt description
  - `arguments`: JSON array of prompt arguments
  - `module`: Source module name
  - `created_at`: Creation timestamp
  - `updated_at`: Last update timestamp

## API

The prompts module exports the following functionality:

- `PromptService`: Service for managing prompts
  - `getAll()`: Get all prompts
  - `getByName(name)`: Get prompt by name
  - `scanPrompts()`: Scan for new prompts in modules

## Development

### Adding New Prompts

Prompts can be added to any module by creating files in the `prompts/` directory:

```typescript
// prompts/my-prompt.ts
export const prompt = {
  name: 'my-prompt',
  description: 'Description of my prompt',
  arguments: [
    {
      name: 'input',
      description: 'Input parameter',
      required: true
    }
  ],
  template: 'Prompt template with {{input}} placeholder'
};
```

### Testing

Run tests with:

```bash
npm test -- src/modules/core/prompts
```

## Dependencies

- logger: For logging operations
- database: For persistent storage

## License

MIT