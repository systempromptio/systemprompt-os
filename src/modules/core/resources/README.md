# Resources Module

## Overview

The resources module provides a system for managing and serving resources within SystemPrompt OS. It enables dynamic resource discovery, storage, and retrieval for use by AI assistants and other modules.

## Features

- Dynamic resource discovery from module directories
- Database-backed resource storage
- Resource metadata management
- CLI commands for resource management
- Integration with MCP resource protocol

## Configuration

The resources module is configured through the module system:

```yaml
resources:
  enabled: true
  config:
    # Module-specific configuration
```

## CLI Commands

### List Resources

List all available resources in the system:

```bash
systemprompt resources:list
```

Options:
- `--format, -f`: Output format (text, json, table) [default: text]
- `--module, -m`: Filter by module name
- `--type, -t`: Filter by resource type

## Database Schema

The resources module uses the following database schema:

- `resources` table: Stores resource definitions
  - `id`: Unique identifier
  - `uri`: Resource URI
  - `name`: Resource name
  - `description`: Resource description
  - `mimeType`: MIME type of the resource
  - `module`: Source module name
  - `metadata`: JSON metadata
  - `created_at`: Creation timestamp
  - `updated_at`: Last update timestamp

## API

The resources module exports the following functionality:

- `ResourceService`: Service for managing resources
  - `getAll()`: Get all resources
  - `getByUri(uri)`: Get resource by URI
  - `scanResources()`: Scan for new resources in modules
  - `getResourceContent(uri)`: Get resource content

## Development

### Adding New Resources

Resources can be added to any module by creating files in the `resources/` directory:

```typescript
// resources/my-resource.ts
export const resource = {
  uri: 'resource://my-module/my-resource',
  name: 'My Resource',
  description: 'Description of my resource',
  mimeType: 'text/plain',
  content: 'Resource content or path to content'
};
```

### Resource Types

Supported resource types:
- Text resources (text/plain)
- JSON resources (application/json)
- Markdown resources (text/markdown)
- Binary resources (various MIME types)

### Testing

Run tests with:

```bash
npm test -- src/modules/core/resources
```

## Dependencies

- logger: For logging operations
- database: For persistent storage

## License

MIT