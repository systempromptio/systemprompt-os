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
const user = await userService.getUser(id);
if (args.format === 'json') {
  cliOutput.json(user); // Full object with all fields
}

// BAD - Filtering fields
if (args.format === 'json') {
  console.log(JSON.stringify({ id: user.id, name: user.name })); // NO!
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
./bin/systemprompt cli {command}

# Examples:
./bin/systemprompt users create --username john --email john@example.com
./bin/systemprompt dev sync-rules users
./bin/systemprompt auth login
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
  export const cliCommands = {
    name: 'cli',
    alias: '{shortname}',  
    description: 'Cli module commands',
    subcommands: [/* command metadata */]
  };
  export default cliCommands;
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
import { CliService } from '../services/cli.service';
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
      const service = CliService.getInstance();
      
      // Get data from service
      const data = await service.getData();
      
      // MANDATORY: Support JSON output for data
      if (args.format === 'json') {
        cliOutput.json(data); // Full object, properly formatted
      } else {
        // Text/table output for human readability
        cliOutput.table(data.items, [
          { key: 'id', header: 'ID' },
          { key: 'name', header: 'Name' },
          { key: 'status', header: 'Status' }
        ]);
      }
      
      process.exit(0);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      cliOutput.error(`Error: ${errorMessage}`);
      logger.error(LogSource.CLI, 'Command failed', { error });
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
2. **Command Implementation**: Each command is implemented in `src/modules/core/cli/cli/{command}.ts`
3. **Database Storage**: During bootstrap, commands are registered in the `cli_commands` table with:
   - `command_path`: Full path like `cli:command` (e.g., `cli:create`)
   - `executor_path`: Path to the TypeScript file implementing the command
   - Command metadata (description, options, etc.)
4. **CLI Execution**: When running `systemprompt cli {command}`:
   - The CLI main.ts loads commands from the database
   - Parses the command path (`cli:{command}`) to find the executor
   - Dynamically imports the command module
   - Executes the command with parsed context

### Command Handler Resolution
- The handler string in `cli/index.ts` (e.g., `handler: 'cli:{command}'`) maps to the command path
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
  description: 'List all items',
  options: [
    { name: 'format', alias: 'f', type: 'string', choices: ['text', 'json'], default: 'text' },
    { name: 'filter', alias: 'F', type: 'string', description: 'Filter by status' }
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const cliOutput = CliOutputService.getInstance();
    const service = ItemService.getInstance();
    
    const items = await service.listItems(context.args.filter);
    
    if (context.args.format === 'json') {
      // Full objects, properly formatted
      cliOutput.json(items);
    } else {
      cliOutput.section('Items');
      cliOutput.table(items, [
        { key: 'id', header: 'ID', width: 36 },
        { key: 'name', header: 'Name', width: 30 },
        { key: 'status', header: 'Status', width: 15 },
        { key: 'created_at', header: 'Created', format: (v) => new Date(v).toLocaleDateString() }
      ]);
    }
    process.exit(0);
  }
};
```

### Get Command (GOOD)
```typescript
// Get single item with full object in JSON
export const command: ICLICommand = {
  description: 'Get item details',
  options: [
    { name: 'format', alias: 'f', type: 'string', choices: ['text', 'json'], default: 'text' }
  ],
  positionals: [
    { name: 'id', description: 'Item ID', required: true }
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const cliOutput = CliOutputService.getInstance();
    const service = ItemService.getInstance();
    
    const item = await service.getItem(context.args.id);
    
    if (context.args.format === 'json') {
      // FULL DATABASE OBJECT
      cliOutput.json(item);
    } else {
      cliOutput.section('Item Details');
      cliOutput.keyValue({
        'ID': item.id,
        'Name': item.name,
        'Status': item.status,
        'Created': new Date(item.created_at).toLocaleString(),
        'Updated': new Date(item.updated_at).toLocaleString(),
        'Description': item.description || 'N/A'
      });
    }
    process.exit(0);
  }
};
```

### Status Command (GOOD)
```typescript
// Status command with structured JSON output
export const command: ICLICommand = {
  description: 'Show module status',
  options: [
    { name: 'format', alias: 'f', type: 'string', choices: ['text', 'json'], default: 'text' }
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const cliOutput = CliOutputService.getInstance();
    const service = ModuleService.getInstance();
    
    const status = await service.getStatus();
    const stats = await service.getStatistics();
    
    if (context.args.format === 'json') {
      // Structured status object
      cliOutput.json({
        module: 'cli',
        status: status,
        statistics: stats,
        timestamp: new Date().toISOString()
      });
    } else {
      cliOutput.section('Module Status');
      cliOutput.keyValue({
        'Status': status.healthy ? '✓ Healthy' : '✗ Unhealthy',
        'Uptime': status.uptime,
        'Total Items': stats.total,
        'Active Items': stats.active
      });
    }
    process.exit(0);
  }
};
```

### BAD Examples (DO NOT DO THIS)
```typescript
// BAD - Direct console.log
console.log(JSON.stringify(data));  // NO!

// BAD - Filtering fields in JSON
if (args.format === 'json') {
  console.log(JSON.stringify({
    id: user.id,
    name: user.name  // Missing other fields!
  }));
}

// BAD - process.stdout.write
process.stdout.write(`User: ${user.name}\n`);  // NO!

// BAD - No format option
export const command: ICLICommand = {
  // Missing format option for data command!
  execute: async () => {
    const data = await service.getData();
    console.log(data);  // NO!
  }
};
```

## Zod Validation with Autogenerated Types

### MANDATORY: Use Autogenerated Zod Schemas for CLI Validation

SystemPrompt OS automatically generates Zod schemas from database tables and module types. CLI commands MUST leverage these schemas for consistency and type safety.

### How CLI Arguments Are Parsed

1. **Commander.js** parses command-line arguments into a plain object (`Record<string, unknown>`)
2. **Context Creation**: Arguments are passed to commands via `ICLIContext.args`
3. **Type Safety Gap**: Arguments arrive as `unknown` types, requiring validation

### Integration with Autogenerated Types

Every module has autogenerated Zod schemas in `types/` directory:
- `database.generated.ts` - Database row schemas with enums
- `cli.module.generated.ts` - Create/Update data schemas
- `cli.service.generated.ts` - Service method schemas

### MANDATORY Pattern: Use Autogenerated Schemas

```typescript
import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { z } from 'zod';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

// ALWAYS import autogenerated schemas
import { 
  UserCreateDataSchema,
  UserUpdateDataSchema,
  UsersStatusSchema,
  type IUserCreateData 
} from '../types/cli.module.generated';

// Extend autogenerated schema for CLI-specific fields
const createUserArgsSchema = UserCreateDataSchema.extend({
  // CLI-specific options
  format: z.enum(['text', 'json']).default('text'),
  // Transform string booleans from CLI
  emailVerified: z.enum(['true', 'false'])
    .transform(v => v === 'true')
    .optional()
    .default('false')
}).transform(data => ({
  ...data,
  // Map CLI arg names to schema field names if needed
  display_name: data.displayName,
  avatar_url: data.avatarUrl,
  email_verified: data.emailVerified
}));

// Type is automatically inferred from extended schema
type CreateUserArgs = z.infer<typeof createUserArgsSchema>;

export const command: ICLICommand = {
  description: 'Create a new user',
  options: [
    { name: 'username', alias: 'u', type: 'string', description: 'Username', required: true },
    { name: 'email', alias: 'e', type: 'string', description: 'Email address', required: true },
    { name: 'displayName', alias: 'd', type: 'string', description: 'Display name' },
    { name: 'format', alias: 'f', type: 'string', choices: ['text', 'json'], default: 'text' }
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const cliOutput = CliOutputService.getInstance();
    const logger = LoggerService.getInstance();
    
    try {
      // Validate arguments with Zod
      const validatedArgs = createUserArgsSchema.parse(context.args);
      
      // Now validatedArgs is fully typed as CreateUserArgs
      const service = UserService.getInstance();
      const user = await service.createUser({
        username: validatedArgs.username,
        email: validatedArgs.email,
        display_name: validatedArgs.displayName,
        // ... other fields
      });
      
      if (validatedArgs.format === 'json') {
        cliOutput.json(user);
      } else {
        cliOutput.success('User created successfully');
        cliOutput.keyValue({
          'ID': user.id,
          'Username': user.username,
          'Email': user.email
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
      logger.error(LogSource.MODULE, 'Error in command', { error });
      process.exit(1);
    }
  }
};
```

### Real-World Examples with Autogenerated Types

#### 1. List Command with Database Enums
```typescript
import { UsersStatusSchema } from '../types/database.generated';

// Use autogenerated enum schema for validation
const listArgsSchema = z.object({
  format: z.enum(['text', 'json']).default('text'),
  // Directly use the autogenerated status enum
  status: UsersStatusSchema.optional(),
  // CLI arguments come as strings, transform to numbers
  limit: z.coerce.number().positive().max(100).default(20),
  page: z.coerce.number().positive().default(1),
  sortBy: z.enum(['created_at', 'updated_at', 'username']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});
```

#### 2. Update Command with Partial Schema
```typescript
import { UserUpdateDataSchema } from '../types/cli.module.generated';

// Extend the autogenerated update schema
const updateArgsSchema = z.object({
  // ID is required for updates
  id: z.string().uuid('Invalid user ID format'),
  format: z.enum(['text', 'json']).default('text'),
  // Spread the update schema fields as optional
  ...UserUpdateDataSchema.shape
}).transform(({ id, format, ...updateData }) => ({
  id,
  format,
  // Filter out undefined values for clean updates
  updateData: Object.fromEntries(
    Object.entries(updateData).filter(([_, v]) => v !== undefined)
  ) as z.infer<typeof UserUpdateDataSchema>
}));
```

#### 3. Get Command with Relationship Loading
```typescript
import { z } from 'zod';
import { UsersRowSchema } from '../types/database.generated';

// Validate ID and include options
const getArgsSchema = z.object({
  // Use regex that matches your ID format (UUID, etc)
  id: z.string().uuid('Invalid ID format'),
  format: z.enum(['text', 'json']).default('text'),
  // Boolean flags from CLI need transformation
  includePreferences: z.enum(['true', 'false'])
    .transform(v => v === 'true')
    .default('false'),
  includeMetadata: z.enum(['true', 'false'])
    .transform(v => v === 'true')
    .default('false')
});

// In execute function, validate response with autogenerated schema
const user = await userService.getUser(validatedArgs.id);
const validatedUser = UsersRowSchema.parse(user);
```

### Benefits of Using Zod

1. **Type Safety**: Full TypeScript inference from schemas
2. **Runtime Validation**: Catches errors before they reach your business logic
3. **Better Error Messages**: Clear, user-friendly validation error messages
4. **Data Transformation**: Convert strings to proper types (numbers, booleans, dates)
5. **Composability**: Reuse schemas across commands
6. **Documentation**: Schemas serve as documentation for expected inputs

### Common CLI Argument Transformations

Since CLI arguments arrive as strings, use these patterns:

```typescript
// Common CLI transformations
const cliTransforms = {
  // String to boolean
  boolean: z.enum(['true', 'false']).transform(v => v === 'true'),
  
  // String to number with validation
  number: z.coerce.number(),
  positiveInt: z.coerce.number().int().positive(),
  
  // Optional boolean with default
  optionalBoolean: z.enum(['true', 'false'])
    .transform(v => v === 'true')
    .optional()
    .default('false'),
    
  // Date parsing
  date: z.coerce.date(),
  
  // JSON parsing for complex inputs
  json: z.string().transform(str => JSON.parse(str))
};

// Example usage
const commandArgsSchema = z.object({
  verbose: cliTransforms.boolean.default('false'),
  limit: cliTransforms.positiveInt.default(10),
  since: cliTransforms.date.optional(),
  metadata: cliTransforms.json.optional()
});
```

### Integration Helper with Autogenerated Types

Create module-specific validation utilities:

```typescript
// In cli/utils/cli-validation.ts
import { z } from 'zod';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { 
  UserCreateDataSchema,
  UserUpdateDataSchema 
} from '../types/cli.module.generated';

// Base CLI options that all commands should have
const baseCliOptionsSchema = z.object({
  format: z.enum(['text', 'json']).default('text')
});

// Composed schemas for each command
export const cliSchemas = {
  create: UserCreateDataSchema.merge(baseCliOptionsSchema),
  update: UserUpdateDataSchema.partial().extend({
    id: z.string().uuid(),
    ...baseCliOptionsSchema.shape
  }),
  list: baseCliOptionsSchema.extend({
    limit: z.coerce.number().positive().max(100).default(20),
    page: z.coerce.number().positive().default(1)
  })
};

// Type-safe validation function
export function validateCliArgs<T extends keyof typeof cliSchemas>(
  command: T,
  args: Record<string, unknown>,
  cliOutput: CliOutputService
): z.infer<typeof cliSchemas[T]> | null {
  try {
    return cliSchemas[command].parse(args);
  } catch (error) {
    if (error instanceof z.ZodError) {
      cliOutput.error('Invalid arguments:');
      error.errors.forEach(err => {
        const field = err.path.join('.');
        cliOutput.error(`  ${field}: ${err.message}`);
      });
    }
    return null;
  }
}
```

### CRITICAL: Compatibility Notes

1. **Commander.js Compatibility**: 
   - Commander passes all CLI arguments as strings
   - Use `z.coerce` for number/date conversions
   - Boolean flags need explicit transformation

2. **Autogenerated Schema Alignment**:
   - Database schemas use snake_case (e.g., `display_name`)
   - CLI typically uses camelCase (e.g., `displayName`)
   - Use `.transform()` to map between conventions

3. **Type Generation**:
   - Run `./bin/systemprompt dev generate-types cli` after schema changes
   - Generated types are in `types/*.generated.ts`
   - DO NOT modify generated files

### Best Practices

1. **ALWAYS use autogenerated schemas** as the base for validation
2. **Extend schemas** rather than creating new ones from scratch
3. **Transform CLI strings** to proper types using `z.coerce` or `.transform()`
4. **Validate both input AND output** for type safety
5. **Create reusable validation utilities** per module

### Future CLI Enhancement

The CLI framework will be enhanced to:
1. Automatically generate CLI argument schemas from module schemas
2. Provide built-in validation before command execution
3. Generate help text from Zod schema descriptions
4. Support complex nested object inputs via JSON