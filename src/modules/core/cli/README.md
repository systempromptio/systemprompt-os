# CLI Module

The CLI module provides utilities for command-line interface management, including help system, command discovery, and documentation generation.

## Features

- Command help system
- Dynamic command discovery
- Command listing and filtering
- Documentation generation
- Multiple output formats

## CLI Commands

### cli:help

Show help information for commands.

```bash
# Show general help
systemprompt cli:help

# Show help for specific command
systemprompt cli:help --command auth:generatekey

# Show all commands with full details
systemprompt cli:help --all
```

### cli:list

List all available commands.

```bash
# List all commands
systemprompt cli:list

# List commands from specific module
systemprompt cli:list --module auth

# List in different formats
systemprompt cli:list --format json
systemprompt cli:list --format table
```

### cli:docs

Generate command documentation.

```bash
# Generate markdown documentation
systemprompt cli:docs

# Save to file
systemprompt cli:docs --output ./docs/commands.md

# Generate in different formats
systemprompt cli:docs --format json --output ./docs/commands.json
systemprompt cli:docs --format html --output ./docs/commands.html
```

## Command Discovery

The CLI module automatically discovers commands from:
1. Core modules in `/src/modules/core/*/cli/`
2. Custom modules in `/src/modules/custom/*/cli/`
3. Extension modules

Commands are namespaced by module name (e.g., `auth:generatekey`, `config:set`).

## Module Structure

```
cli/
├── module.yaml      # Module configuration
├── index.ts        # Module entry point with CLIModule class
├── cli/           # CLI commands
│   ├── help.ts
│   ├── list.ts
│   └── docs.ts
└── tests/         # Test files
    └── unit/
        └── cli.test.ts
```

## Configuration

The module can be configured in `module.yaml`:

```yaml
config:
  showColors: true
  outputFormat: text
  interactiveMode: true
```

## Adding New Commands

To add a new command to any module:

1. Create a CLI command file in the module's `cli/` directory
2. Export a `command` object with an `execute` function
3. Define the command in the module's `module.yaml`

Example:
```typescript
// mymodule/cli/mycommand.ts
export const command = {
  execute: async (context: CLIContext): Promise<void> => {
    console.log('Hello from my command!');
  }
};
```