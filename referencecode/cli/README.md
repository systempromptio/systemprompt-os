# SystemPrompt OS CLI

The SystemPrompt OS CLI provides a modular command-line interface with automatic command discovery and extension support.

## Architecture

The CLI follows a modular architecture where commands are defined within modules rather than in a centralized commands folder. This approach provides:

- Better organization and separation of concerns
- Automatic command discovery
- Namespace isolation
- Easy extension and customization

## Command Discovery Process

The CLI automatically discovers commands from modules in the following locations:

1. **Core Modules**: `/src/modules/core/*/cli/`
2. **Custom Modules**: `/src/modules/custom/*/cli/`
3. **Extension Modules**: `/extensions/modules/*/cli/`

### Discovery Flow

1. The CLI scans module directories for `module.yaml` files
2. It reads the `cli.commands` section from each module configuration
3. For each defined command, it loads the corresponding TypeScript file from the module's `cli/` directory
4. Commands are registered with the module name as a namespace (e.g., `auth:generatekey`)

## Module Command Structure

### Module Configuration (module.yaml)

```yaml
name: mymodule
type: service
version: 1.0.0
description: My module description
cli:
  commands:
    - name: mycommand
      description: Description of my command
      options:
        - name: option1
          alias: o
          type: string
          description: Option description
          required: false
          default: "default value"
```

### Command Implementation

Each command must be in a separate file in the module's `cli/` directory:

```typescript
// mymodule/cli/mycommand.ts
import { CLIContext } from '../../../../interfaces/cli.js';

export const command = {
  execute: async (context: CLIContext): Promise<void> => {
    const { args, flags, cwd, env } = context;
    
    // Command implementation
    console.log('Command executed with args:', args);
  }
};
```

### CLIContext Interface

```typescript
interface CLIContext {
  args: Record<string, any>;    // Parsed command arguments
  flags: Record<string, any>;   // Boolean flags
  cwd: string;                  // Current working directory
  env: Record<string, string>;  // Environment variables
}
```

## Adding Commands to Modules

To add a new command to any module:

1. **Define the command** in the module's `module.yaml`:
```yaml
cli:
  commands:
    - name: newcommand
      description: My new command
      options:
        - name: input
          type: string
          required: true
```

2. **Create the command file** at `module/cli/newcommand.ts`:
```typescript
export const command = {
  execute: async (context: CLIContext): Promise<void> => {
    const input = context.args.input;
    // Implementation
  }
};
```

3. **Test the command**:
```bash
systemprompt mymodule:newcommand --input "value"
```

## Command Naming Convention

Commands follow a namespace:command pattern:

- Core module commands: `auth:generatekey`, `config:set`, `test:unit`
- Custom module commands: `mymodule:mycommand`
- Extension commands: `myextension:command`

## Core Modules

The following core modules provide essential CLI commands:

### auth
- `auth:generatekey` - Generate cryptographic keys

### config
- `config:get` - Get configuration values
- `config:set` - Set configuration values
- `config:list` - List all configuration
- `config:validate` - Validate configuration

### test
- `test:unit` - Run unit tests
- `test:integration` - Run integration tests
- `test:e2e` - Run end-to-end tests
- `test:all` - Run all test suites

### cli
- `cli:help` - Show help information
- `cli:list` - List available commands
- `cli:docs` - Generate command documentation

### extension
- `extension:list` - List installed extensions
- `extension:info` - Show extension details
- `extension:validate` - Validate extension structure
- `extension:install` - Install an extension
- `extension:remove` - Remove an extension

## Creating a New Module with CLI Commands

1. **Create module structure**:
```bash
mkdir -p src/modules/custom/mymodule/cli
```

2. **Create module.yaml**:
```yaml
name: mymodule
type: service
version: 1.0.0
description: My custom module
dependencies:
  - logger
cli:
  commands:
    - name: hello
      description: Say hello
      options:
        - name: name
          type: string
          default: "World"
```

3. **Create module entry point** (`index.ts`):
```typescript
import { ModuleInterface } from '../../../interfaces/module.js';

export class MyModule implements ModuleInterface {
  name = 'mymodule';
  version = '1.0.0';
  type = 'service' as const;
  
  async initialize(context: any): Promise<void> {
    // Initialization logic
  }
  
  async start(): Promise<void> {
    // Start logic
  }
  
  async stop(): Promise<void> {
    // Stop logic
  }
  
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    return { healthy: true };
  }
}
```

4. **Create CLI command** (`cli/hello.ts`):
```typescript
import { CLIContext } from '../../../../interfaces/cli.js';

export const command = {
  execute: async (context: CLIContext): Promise<void> => {
    const name = context.args.name || 'World';
    console.log(`Hello, ${name}!`);
  }
};
```

5. **Use the command**:
```bash
systemprompt mymodule:hello --name "SystemPrompt"
```

## Extension Process

The CLI supports extensions through:

1. **Module Extensions**: Full modules with services and CLI commands
2. **Server Extensions**: MCP servers for additional functionality

Extensions are automatically discovered and integrated into the CLI without modifying core code.

## Best Practices

1. **Keep commands focused**: Each command should do one thing well
2. **Use module namespacing**: Prevents command name conflicts
3. **Provide helpful descriptions**: Make commands discoverable
4. **Handle errors gracefully**: Use try-catch and provide meaningful error messages
5. **Follow TypeScript conventions**: Use proper types and interfaces
6. **Document options**: Clear descriptions for all command options

## Directory Structure

```
src/
├── tools/
│   └── cli/
│       ├── src/
│       │   ├── index.ts       # CLI entry point
│       │   ├── discovery.ts   # Command discovery logic
│       │   └── types.ts       # CLI type definitions
│       └── README.md          # This file
├── modules/
│   ├── core/                  # Core modules
│   │   ├── auth/
│   │   ├── config/
│   │   ├── test/
│   │   ├── cli/
│   │   └── extension/
│   └── custom/                # Custom modules
└── interfaces/
    └── cli.ts                 # CLI interfaces
```

## Migrating from Centralized Commands

If you have existing commands in a centralized structure, migrate them to modules:

1. Identify the appropriate module for each command
2. Move the command logic to the module's `cli/` directory
3. Update the module's `module.yaml` to define the command
4. Remove the old centralized command file
5. Test the new module-based command

This modular approach ensures better organization, maintainability, and extensibility of the CLI system.