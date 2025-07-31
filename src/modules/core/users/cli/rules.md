# CLI Subfolder Rules

## Purpose
CLI commands are managed by the central CLI module (`@/modules/core/cli`). Module-specific CLI commands must follow the established patterns for registration and execution.

## Required Files

### index.ts (Command Registry)
- **MUST** export individual commands using named exports
- **MUST** export a default command metadata object for CLI registration
- **MUST** follow the exact pattern:
  ```typescript
  export { command as commandName } from './command-file';
  export const usersCommands = {
    name: 'users',
    alias: '{shortname}',  
    description: 'Users module commands',
    subcommands: [/* command metadata */]
  };
  export default usersCommands;
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
import { UsersService } from '../services/users.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';

export const command: ICLICommand = {
  description: 'Command description',
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();
    
    try {
      const service = UsersService.getInstance();
      
      // Command logic here
      
      cliOutput.success('Operation completed');
      process.exit(0);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      cliOutput.error(`Error: ${errorMessage}`);
      logger.error(LogSource.USERS, 'Command failed', { error });
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
- Support JSON output via `--format json` flag

## Error Handling

- Use appropriate exit codes (0 for success, 1 for errors)
- Log errors using the module's LogSource
- Provide user-friendly error messages
- Fail gracefully with proper cleanup

## How the CLI System Works

### Command Registration Flow
1. **Module Definition**: Commands are defined in `module.yaml` under the `cli.commands` section
2. **Command Implementation**: Each command is implemented in `src/modules/core/users/cli/{command}.ts`
3. **Database Storage**: During bootstrap, commands are registered in the `cli_commands` table with:
   - `command_path`: Full path like `users:command` (e.g., `users:create`)
   - `executor_path`: Path to the TypeScript file implementing the command
   - Command metadata (description, options, etc.)
4. **CLI Execution**: When running `systemprompt users {command}`:
   - The CLI main.ts loads commands from the database
   - Parses the command path (`users:{command}`) to find the executor
   - Dynamically imports the command module
   - Executes the command with parsed context

### Command Handler Resolution
- The handler string in `cli/index.ts` (e.g., `handler: 'users:{command}'`) maps to the command path
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