# Dev Module CLI Rules

## Purpose
The dev module CLI provides essential development commands for SystemPrompt OS development workflow.

## Required CLI Commands

### generate-types Command
**Purpose**: Generate comprehensive types for modules from database schemas and service interfaces

**Implementation Requirements**:
- Support module-specific and all-module generation
- Generate database types from schema.sql files
- Generate service interfaces from TypeScript AST analysis
- Create Zod validation schemas for all types
- Generate type guard functions for runtime validation
- Provide clear progress reporting and error handling

**Options**:
- `--module, -m`: Specific module to generate types for
- `--all, -a`: Generate types for all modules
- `--types, -t`: Comma-separated list of type categories to generate
- `--pattern, -p`: Glob pattern for file matching
- `--format, -f`: Output format (text, json)

### validate Command
**Purpose**: Comprehensive module validation for type safety and structure compliance

**Implementation Requirements**:
- Check TypeScript compilation errors
- Validate database schema integrity
- Verify service interface implementations
- Check file structure compliance
- Report validation errors with actionable feedback
- Exit with appropriate error codes for CI/CD

**Options**:
- `--module, -m`: Module name to validate (required)

### lint Command
**Purpose**: Code quality checking with ESLint integration

**Implementation Requirements**:
- Module-specific or project-wide linting
- Auto-fix capabilities where possible
- Support for custom SystemPrompt OS ESLint rules
- Formatted error reporting with file locations
- Integration with development workflow

**Options**:
- `--module, -m`: Module name to lint
- `--target, -t`: Target file or folder to lint
- `--fix, -f`: Automatically fix problems
- `--max`: Maximum number of files to display
- `--format, -F`: Output format (text, json)

### test Command
**Purpose**: Test execution with coverage reporting

**Implementation Requirements**:
- Module-specific or project-wide testing
- Support for unit and integration test separation
- Coverage reporting and threshold validation
- Detailed result reporting and analysis
- Integration with Jest testing framework

**Options**:
- `--module, -m`: Module name to test
- `--target, -t`: Target file or folder to test
- `--unit, -u`: Run only unit tests
- `--integration, -i`: Run only integration tests
- `--coverage, -c`: Generate and display coverage report
- `--max`: Maximum number of test suites to display
- `--format, -f`: Output format (text, json)

### typecheck Command
**Purpose**: TypeScript type checking and error reporting

**Implementation Requirements**:
- Module-specific or project-wide type checking
- Integration with TypeScript compiler API
- Clear error reporting with locations
- Support for strict mode checking
- Performance optimization for large codebases

**Options**:
- `--module, -m`: Module name to typecheck
- `--target, -t`: Target file or folder to typecheck
- `--strict, -s`: Enable strict type checking
- `--max`: Maximum number of errors to display
- `--format, -f`: Output format (text, json)

### create-module Command
**Purpose**: Create new SystemPrompt OS modules with complete boilerplate

**Implementation Requirements**:
- Generate complete module structure following rules
- Create database schema boilerplate
- Generate service and repository templates
- Set up CLI command templates
- Create test file templates
- Initialize module configuration

**Options**:
- `--name, -n`: Module name (lowercase with hyphens)
- `--type, -t`: Module type (service, utility, integration)
- `--description, -d`: Module description
- `--no-database`: Skip database setup
- `--no-cli`: Skip CLI commands
- `--deps`: Array of module dependencies

### sync-rules Command
**Purpose**: Synchronize generic rules to specific modules with placeholder replacement

**Implementation Requirements**:
- Sync generic rules from templates to specific modules
- Replace placeholders with module-specific values
- Backup existing rules before overwriting
- Validate synchronized rules
- Support for all modules or specific module

**Options**:
- `--module, -m`: Module name to sync rules for
- `--all, -a`: Sync rules for all modules
- `--force, -f`: Force overwrite existing rules files

## CLI Implementation Standards

### Command Structure
All dev CLI commands MUST follow this pattern:
```typescript
import { Command } from '@/modules/core/cli/types/manual';
import { DevService } from '@/modules/core/dev/services/dev.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';

export const commandName: Command = {
  name: 'command-name',
  description: 'Command description',
  handler: async (args) => {
    const logger = LoggerService.getInstance();
    const devService = DevService.getInstance();
    
    try {
      // Validate arguments using Zod schemas
      const validatedArgs = CommandArgsSchema.parse(args);
      
      // Execute command logic
      const result = await devService.executeCommand(validatedArgs);
      
      // Format and display output
      await formatOutput(result, validatedArgs.format);
      
    } catch (error) {
      logger.error(LogSource.DEV, `Command failed: ${error.message}`);
      process.exit(1);
    }
  }
};
```

### Output Formatting
All commands MUST support both text and JSON output formats:
- **Text Format**: Human-readable output with colors and formatting
- **JSON Format**: Structured output for programmatic consumption
- **Consistent Structure**: Same data structure for both formats
- **Error Handling**: Proper error formatting for both modes

### Progress Reporting
Long-running commands MUST provide progress reporting:
- Progress bars for operations with known duration
- Spinner indicators for indeterminate operations
- Step-by-step progress for multi-stage operations
- Time estimates and completion status

### Error Handling
All commands MUST implement comprehensive error handling:
- Graceful handling of all error conditions
- Clear error messages with suggested fixes
- Appropriate exit codes for CI/CD integration
- Logging of errors for debugging

## Validation Requirements

### Argument Validation
All command arguments MUST be validated using Zod schemas:
```typescript
import { z } from 'zod';

const GenerateTypesArgsSchema = z.object({
  module: z.string().optional(),
  all: z.boolean().default(false),
  types: z.array(z.enum(['database', 'interfaces', 'schemas', 'service-schemas', 'type-guards', 'all'])).optional(),
  pattern: z.string().optional(),
  format: z.enum(['text', 'json']).default('text')
});
```

### File System Validation
Commands that operate on files MUST validate:
- File and directory existence
- Read/write permissions
- Path traversal security
- Module structure compliance

## Integration Requirements

### Service Integration
CLI commands MUST integrate with appropriate services:
- Use DevService for development operations
- Use LoggerService for operation logging
- Use ReportWriterService for result reporting
- Use validation services for compliance checking

### Module System Integration
CLI commands MUST respect module boundaries:
- Only operate on valid modules
- Respect module dependencies
- Follow module naming conventions
- Validate module structure compliance

## Performance Requirements

### Response Time
- Simple commands (status, list): < 100ms
- Type generation: < 5s per module
- Validation: < 2s per module
- Linting: < 3s per module
- Testing: Variable based on test suite

### Memory Usage
- Efficient memory management for large codebases
- Streaming output for large result sets
- Garbage collection optimization
- Memory leak prevention

## Testing Requirements

### Unit Tests
Each CLI command MUST have unit tests covering:
- Argument validation
- Error handling
- Output formatting
- Service integration

### Integration Tests
CLI commands MUST have integration tests covering:
- End-to-end command execution
- File system operations
- Service interactions
- Error scenarios

## Documentation Requirements

### Help Text
All commands MUST provide comprehensive help:
- Clear description of command purpose
- Detailed option descriptions
- Usage examples
- Common use cases

### Examples
Commands MUST include practical examples:
```bash
# Generate types for specific module
./bin/systemprompt dev generate-types --module auth

# Validate all modules
./bin/systemprompt dev validate --module users

# Lint with auto-fix
./bin/systemprompt dev lint --module auth --fix

# Run tests with coverage
./bin/systemprompt dev test --module auth --coverage
```