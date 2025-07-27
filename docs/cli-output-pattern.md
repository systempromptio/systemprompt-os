# CLI Output Service Usage Pattern

## Overview

All CLI commands in SystemPrompt OS should use the `CliOutputService` for consistent, accessible, and properly formatted output. This ensures a uniform user experience across all commands.

## Basic Usage

```typescript
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

export const command = {
  description: 'Your command description',
  execute: async (context: ICLIContext): Promise<void> => {
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();
    
    try {
      // Your command logic here
      
      // Use cliOutput for all user-facing output
      cliOutput.success('Operation completed successfully');
      
      process.exit(0);
    } catch (error) {
      // Use cliOutput.error for user-facing errors
      cliOutput.error('Operation failed');
      
      // Use logger.error for logging the actual error details
      logger.error(LogSource.YOUR_MODULE, 'Detailed error message', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      
      process.exit(1);
    }
  },
};
```

## Output Methods

### Basic Messages

```typescript
// Success message with checkmark
cliOutput.success('Operation completed');

// Error message with X
cliOutput.error('Operation failed');

// Warning message with warning icon
cliOutput.warning('This action is irreversible');

// Info message with info icon
cliOutput.info('Processing 10 items...');
```

### Sections and Headers

```typescript
// Create a section with title
cliOutput.section('Database Status');

// Create a section with title and subtitle
cliOutput.section('User Profile', 'Last updated: 2024-01-01');
```

### Key-Value Display

```typescript
// Display key-value pairs with automatic alignment
cliOutput.keyValue({
  'Name': 'John Doe',
  'Email': 'john@example.com',
  'Status': 'Active',
  'Created': new Date().toISOString()
});
```

### Lists

```typescript
// Display a bulleted list
cliOutput.list([
  'First item',
  'Second item',
  'Third item'
]);
```

### Tables

```typescript
// Define columns
const columns: ITableColumn[] = [
  {
    key: 'name',
    header: 'Name',
    align: 'left'
  },
  {
    key: 'count',
    header: 'Count',
    align: 'right',
    format: (value) => Number(value).toLocaleString()
  }
];

// Display table
cliOutput.table(data, columns);
```

### Format Support

```typescript
// Support different output formats based on user preference
const format = context.args.format || 'text';

if (format === 'json') {
  cliOutput.output(data, { format: 'json' });
} else if (format === 'csv') {
  cliOutput.output(data, { format: 'csv' });
} else {
  // Use specific formatting methods for text output
  cliOutput.section('Results');
  cliOutput.table(data, columns);
}
```

## Migration Guide

### Before (using console.log)

```typescript
console.log('\nModule Status:');
console.log('==============\n');
console.log('Module: example');
console.log('Enabled: ✓');
console.error('Error:', error);
```

### After (using CliOutputService)

```typescript
cliOutput.section('Module Status');
cliOutput.keyValue({
  'Module': 'example',
  'Enabled': '✓'
});
cliOutput.error('Error occurred');
```

## Best Practices

1. **Never use console.log/console.error directly** - Always use CliOutputService
2. **Use logger for detailed error information** - Logger is for debugging, CliOutput is for users
3. **Support multiple output formats** - At minimum, support 'text' and 'json'
4. **Use semantic methods** - Use success() for success, error() for errors, etc.
5. **Provide clear sections** - Group related information under sections
6. **Format data appropriately** - Use tables for tabular data, key-value for properties
7. **Always exit with proper codes** - Use process.exit(0) for success, process.exit(1) for errors

## Common Patterns

### Status Commands

```typescript
cliOutput.section('Module Status');
cliOutput.keyValue({
  'Module': moduleName,
  'Enabled': isEnabled ? '✓' : '✗',
  'Healthy': isHealthy ? '✓' : '✗',
  'Version': version
});

if (hasDetails) {
  cliOutput.section('Details');
  // Additional details...
}
```

### List Commands

```typescript
if (items.length === 0) {
  cliOutput.info('No items found');
  return;
}

const columns: ITableColumn[] = [
  { key: 'name', header: 'Name' },
  { key: 'status', header: 'Status' },
  { key: 'created', header: 'Created', format: (v) => new Date(v).toLocaleDateString() }
];

cliOutput.section(`Found ${items.length} items`);
cliOutput.table(items, columns);
```

### Operation Commands

```typescript
const logger = cliOutput.createProgressLogger('Processing...');
logger.start();

try {
  await performOperation();
  logger.succeed('Operation completed');
  cliOutput.success('All tasks completed successfully');
} catch (error) {
  logger.fail('Operation failed');
  cliOutput.error('Failed to complete operation');
  throw error;
}
```

## Testing

When testing CLI commands, you can mock the CliOutputService to capture output:

```typescript
// In your test
const mockOutput = {
  success: jest.fn(),
  error: jest.fn(),
  // ... other methods
};

jest.mock('@/modules/core/cli/services/cli-output.service', () => ({
  CliOutputService: {
    getInstance: () => mockOutput
  }
}));

// Assert on captured output
expect(mockOutput.success).toHaveBeenCalledWith('Expected message');
```