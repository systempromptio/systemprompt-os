# Dev Module

The dev module provides development and debugging tools for SystemPrompt OS.

## Features

- Interactive REPL for debugging and exploration
- Debug mode toggle for enhanced logging
- Performance profiling
- Test runner with watch mode
- Code linting with auto-fix
- Code formatting
- File watching with custom commands

## Commands

### dev:repl
Start an interactive REPL (Read-Eval-Print Loop) session.

```bash
systemprompt dev:repl
```

The REPL provides access to:
- `db` - Database connection
- `logger` - Logger instance
- `modules` - All loaded modules
- `moduleManager` - Module manager instance

### dev:debug
Enable or disable debug mode.

```bash
systemprompt dev:debug [on|off|status]
```

Debug mode:
- Sets log level to debug
- Sets NODE_ENV to development
- Enables DEBUG environment variable

### dev:profile
Profile system performance for a specified duration.

```bash
systemprompt dev:profile [duration-in-seconds]
```

Default duration is 10 seconds. The profiler tracks:
- Memory usage (heap, external, RSS)
- CPU usage (user, system)

### dev:test
Run tests with optional pattern matching.

```bash
systemprompt dev:test [pattern] [--watch]
```

Options:
- `pattern` - Test file pattern
- `--watch` - Watch mode for continuous testing

### dev:lint
Run the linter on the codebase.

```bash
systemprompt dev:lint [--fix]
```

Options:
- `--fix` - Automatically fix linting issues

### dev:format
Format code using Prettier.

```bash
systemprompt dev:format [pattern]
```

Default pattern: `src/**/*.{ts,js,json}`

### dev:watch
Watch files for changes and optionally run commands.

```bash
systemprompt dev:watch [pattern] [--command <cmd>]
```

Options:
- `pattern` - File pattern to watch (default: `src/**/*.ts`)
- `--command` - Command to run on file change

## Usage Examples

### Start REPL and explore modules
```bash
systemprompt dev:repl
> modules.auth.healthCheck()
> logger.info('Test message')
```

### Enable debug mode for troubleshooting
```bash
systemprompt dev:debug on
# Run commands with debug logging
systemprompt dev:debug off
```

### Profile performance during load
```bash
systemprompt dev:profile 30
```

### Run tests in watch mode
```bash
systemprompt dev:test --watch
```

### Fix linting issues
```bash
systemprompt dev:lint --fix
```

### Watch and rebuild on changes
```bash
systemprompt dev:watch "src/**/*.ts" --command "npm run build"
```

## Configuration

The dev module can be configured through environment variables:

- `DEBUG` - Enable debug output
- `NODE_ENV` - Set to 'development' for debug mode
- `TEST_PATTERN` - Default test pattern
- `PRETTIER_CONFIG` - Path to Prettier config