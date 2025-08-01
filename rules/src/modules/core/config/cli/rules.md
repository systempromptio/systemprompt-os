# CLI Subfolder Rules

## STRICT OUTPUT FORMATTING REQUIREMENTS

**CRITICAL**: All CLI commands MUST follow these output standards for world-class CLI experience:

### 1. JSON Output (MANDATORY)
Every command that returns data MUST support `--format json` with properly formatted JSON:
```typescript
if (args.format === 'json') {
  // ALWAYS use CliOutputService for JSON output
  cliOutput.json(data); // This ensures consistent 2-space indentation
}
```

### 2. Database Objects
When displaying database records, ALWAYS return the complete object in JSON format:
```typescript
// GOOD - Returns full database object
const config = await configService.getConfig(key);
if (args.format === 'json') {
  cliOutput.json(config); // Full object with all fields
}

// BAD - Filtering fields
if (args.format === 'json') {
  console.log(JSON.stringify({ key: config.key, value: config.value })); // NO!
}
```

### 3. Consistent Output Service Usage
**NEVER use console.log directly**. ALWAYS use CliOutputService:
```typescript
// MANDATORY imports for every CLI command
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';

// ALWAYS get instances
const cliOutput = CliOutputService.getInstance();
const logger = LoggerService.getInstance();
```

## CLI Execution

**CRITICAL**: Always use the SystemPrompt binary for CLI commands:

```bash
# Correct way to execute CLI commands
./bin/systemprompt config {command}

# Examples:
./bin/systemprompt config set --key api_url --value https://api.example.com
./bin/systemprompt config get --key api_url
./bin/systemprompt config list --format json
```

**NEVER use `npm run cli`** - this is for development only and may not work in production environments.

## Purpose
CLI commands are managed by the central CLI module (`@/modules/core/cli`). Module-specific CLI commands must follow the established patterns for registration and execution.

## Required Files

### index.ts (Command Registry)
- **MUST** export individual commands using named exports
- **MUST** export a default command metadata object for CLI registration
- **MUST** follow the exact pattern:
  ```typescript
  export { command as commandName } from './command-file';
  export const configCommands = {
    name: 'config',
    alias: 'cfg',  
    description: 'Config module commands',
    subcommands: [/* command metadata */]
  };
  export default configCommands;
  ```

### Individual Command Files
Each command file **MUST**:
- Export a `command` object implementing `ICLICommand`
- Include proper type imports from `@/modules/core/cli/types/index`
- Use `CliOutputService.getInstance()` for consistent output formatting
- Use `LoggerService.getInstance()` for logging
- Access module services via singleton `getInstance()` pattern
- Handle errors gracefully with proper exit codes
- Support both JSON and table output formats when applicable

## Command Implementation Pattern

```typescript
import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { ConfigService } from '../services/config.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

export const command: ICLICommand = {
  description: 'Command description',
  options: [
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format',
      choices: ['text', 'json'],
      default: 'text'
    }
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();
    
    try {
      const service = ConfigService.getInstance();
      
      // Get data from service
      const data = await service.getData();
      
      // MANDATORY: Support JSON output for data
      if (args.format === 'json') {
        cliOutput.json(data); // Full object, properly formatted
      } else {
        // Text/table output for human readability
        cliOutput.table(data.items, [
          { key: 'id', header: 'ID' },
          { key: 'key', header: 'Key' },
          { key: 'value', header: 'Value' }
        ]);
      }
      
      process.exit(0);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      cliOutput.error(`Error: ${errorMessage}`);
      logger.error(LogSource.CONFIG, 'Command failed', { error });
      process.exit(1);
    }
  },
};
```

## CLI Integration

CLI commands are automatically discovered and registered by the CLI module through:
1. Module scanning during bootstrap
2. Command metadata parsing from `index.ts` default export
3. Dynamic command handler registration
4. Integration with the help system

## Options and Arguments

Commands **MUST** follow the module.yaml CLI configuration:
- Options defined in module.yaml are automatically validated
- Use `context.args` to access parsed command-line arguments
- Support common formatting options (--format, -f) where applicable
- Include proper validation for required parameters

## Output Formatting

**MUST** use `CliOutputService` for consistent output:
- `cliOutput.section(title)` - Section headers
- `cliOutput.success(message)` - Success messages
- `cliOutput.error(message)` - Error messages
- `cliOutput.keyValue(object)` - Key-value display
- `cliOutput.json(data)` - JSON output (MANDATORY for data commands)
- `cliOutput.table(data, columns)` - Table output for lists

### MANDATORY Output Rules:
1. **ALWAYS include `--format` option** for commands that return data
2. **ALWAYS use `cliOutput.json()`** for JSON output - NEVER console.log
3. **ALWAYS return full database objects** in JSON - no field filtering
4. **NEVER use process.stdout.write** or console.log directly
5. **ALWAYS support both human-readable (table/text) and machine-readable (JSON) formats

## Error Handling

- Use appropriate exit codes (0 for success, 1 for errors)
- Log errors using the module's LogSource
- Provide user-friendly error messages
- Fail gracefully with proper cleanup

## How the CLI System Works

### Command Registration Flow
1. **Module Definition**: Commands are defined in `module.yaml` under the `cli.commands` section
2. **Command Implementation**: Each command is implemented in `src/modules/core/config/cli/{command}.ts`
3. **Database Storage**: During bootstrap, commands are registered in the `cli_commands` table with:
   - `command_path`: Full path like `config:command` (e.g., `config:set`)
   - `executor_path`: Path to the TypeScript file implementing the command
   - Command metadata (description, options, etc.)
4. **CLI Execution**: When running `systemprompt config {command}`:
   - The CLI main.ts loads commands from the database
   - Parses the command path (`config:{command}`) to find the executor
   - Dynamically imports the command module
   - Executes the command with parsed context

### Command Handler Resolution
- The handler string in `cli/index.ts` (e.g., `handler: 'config:{command}'`) maps to the command path
- The executor path is constructed as: `{modulePath}/cli/{commandName}.ts`
- For subcommands with colons, they're converted to paths (e.g., `generate:types` → `cli/generate/types.ts`)

### CRITICAL: Use the Correct Interface
**ONLY USE `ICLICommand` from `@/modules/core/cli/types/index`**

The correct pattern is:
```typescript
import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';

export const command: ICLICommand = {
  description: 'Command description',
  execute: async (context: ICLIContext): Promise<void> => {
    // Implementation
  }
};
```

DO NOT USE:
- `ICliCommand` (wrong casing)
- `ICommandModule` (internal interface)
- Direct Commander patterns
- Any other command interface

## World-Class CLI Output Examples

### List Command (GOOD)
```typescript
// List command with proper JSON support
export const command: ICLICommand = {
  description: 'List all config items',
  options: [
    { name: 'format', alias: 'f', type: 'string', choices: ['text', 'json'], default: 'text' },
    { name: 'prefix', alias: 'p', type: 'string', description: 'Filter by key prefix' }
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const cliOutput = CliOutputService.getInstance();
    const service = ConfigService.getInstance();
    
    const configs = await service.listConfigs(context.args.prefix);
    
    if (context.args.format === 'json') {
      // Full objects, properly formatted
      cliOutput.json(configs);
    } else {
      cliOutput.section('Configuration Items');
      cliOutput.table(configs, [
        { key: 'key', header: 'Key', width: 30 },
        { key: 'value', header: 'Value', width: 40 },
        { key: 'type', header: 'Type', width: 15 },
        { key: 'updated_at', header: 'Updated', format: (v) => new Date(v).toLocaleDateString() }
      ]);
    }
    process.exit(0);
  }
};
```

### Get Command (GOOD)
```typescript
// Get single config item with full object in JSON
export const command: ICLICommand = {
  description: 'Get config value',
  options: [
    { name: 'format', alias: 'f', type: 'string', choices: ['text', 'json'], default: 'text' }
  ],
  positionals: [
    { name: 'key', description: 'Config key', required: true }
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const cliOutput = CliOutputService.getInstance();
    const service = ConfigService.getInstance();
    
    const config = await service.getConfig(context.args.key);
    
    if (context.args.format === 'json') {
      // FULL DATABASE OBJECT
      cliOutput.json(config);
    } else {
      cliOutput.section('Configuration Details');
      cliOutput.keyValue({
        'Key': config.key,
        'Value': config.value,
        'Type': config.type,
        'Description': config.description || 'N/A',
        'Created': new Date(config.created_at).toLocaleString(),
        'Updated': new Date(config.updated_at).toLocaleString()
      });
    }
    process.exit(0);
  }
};
```

## Zod Validation with Autogenerated Types

### MANDATORY: Use Autogenerated Zod Schemas for CLI Validation

SystemPrompt OS automatically generates Zod schemas from database tables and module types. CLI commands MUST leverage these schemas for consistency and type safety.

### Integration with Autogenerated Types

Every module has autogenerated Zod schemas in `types/` directory:
- `database.generated.ts` - Database row schemas with enums
- `config.module.generated.ts` - Create/Update data schemas
- `config.service.generated.ts` - Service method schemas

### MANDATORY Pattern: Use Autogenerated Schemas

```typescript
import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { z } from 'zod';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

// ALWAYS import autogenerated schemas
import { 
  ConfigCreateDataSchema,
  ConfigUpdateDataSchema,
  ConfigTypeSchema,
  type IConfigCreateData 
} from '../types/config.module.generated';

// Extend autogenerated schema for CLI-specific fields
const setConfigArgsSchema = ConfigCreateDataSchema.extend({
  // CLI-specific options
  format: z.enum(['text', 'json']).default('text'),
  // Override if different CLI naming
  key: z.string().min(1, 'Key is required'),
  value: z.string().min(1, 'Value is required')
});

type SetConfigArgs = z.infer<typeof setConfigArgsSchema>;

export const command: ICLICommand = {
  description: 'Set a configuration value',
  options: [
    { name: 'key', alias: 'k', type: 'string', description: 'Config key', required: true },
    { name: 'value', alias: 'v', type: 'string', description: 'Config value', required: true },
    { name: 'type', alias: 't', type: 'string', description: 'Value type', choices: ['string', 'number', 'boolean', 'json'] },
    { name: 'format', alias: 'f', type: 'string', choices: ['text', 'json'], default: 'text' }
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const cliOutput = CliOutputService.getInstance();
    const logger = LoggerService.getInstance();
    
    try {
      // Validate arguments with Zod
      const validatedArgs = setConfigArgsSchema.parse(context.args);
      
      const service = ConfigService.getInstance();
      const config = await service.setConfig({
        key: validatedArgs.key,
        value: validatedArgs.value,
        type: validatedArgs.type || 'string'
      });
      
      if (validatedArgs.format === 'json') {
        cliOutput.json(config);
      } else {
        cliOutput.success('Configuration set successfully');
        cliOutput.keyValue({
          'Key': config.key,
          'Value': config.value,
          'Type': config.type
        });
      }
      
      process.exit(0);
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Handle validation errors
        cliOutput.error('Invalid arguments:');
        error.errors.forEach(err => {
          cliOutput.error(`  - ${err.path.join('.')}: ${err.message}`);
        });
        process.exit(1);
      }
      
      // Handle other errors
      cliOutput.error('Command failed');
      logger.error(LogSource.CONFIG, 'Error in command', { error });
      process.exit(1);
    }
  }
};
```

### Best Practices

1. **ALWAYS use autogenerated schemas** as the base for validation
2. **Extend schemas** rather than creating new ones from scratch
3. **Transform CLI strings** to proper types using `z.coerce` or `.transform()`
4. **Validate both input AND output** for type safety
5. **Create reusable validation utilities** per module