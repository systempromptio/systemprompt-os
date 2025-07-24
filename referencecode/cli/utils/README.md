# CLI Formatting Utilities

This directory contains utilities for consistent command-line interface formatting across all SystemPrompt OS CLI commands.

## Usage

Import the formatter in your CLI commands:

```typescript
import formatter from '@cli/utils/formatting.js';
const { style, icons, format, output } = formatter;
```

Or import specific utilities:

```typescript
import { style, icons, format, output } from '@cli/utils/formatting.js';
```

## Available Utilities

### Style Functions

Apply colors and text styles:

```typescript
// Basic styles
style.bold('Bold text')
style.dim('Dimmed text')
style.italic('Italic text')
style.underline('Underlined text')

// Colors
style.red('Error text')
style.green('Success text')
style.yellow('Warning text')
style.blue('Info text')
style.cyan('Cyan text')
style.magenta('Magenta text')
style.gray('Gray text')

// Semantic styles
style.success('✓ Operation successful')
style.error('✗ Operation failed')
style.warning('⚠ Be careful')
style.info('ℹ Information')
style.muted('Less important text')

// Combined styles
style.header('Page Header')
style.label('Field Label')
style.code('const x = 42')
style.path('/usr/local/bin')
style.command('npm install')
```

### Icons

Consistent icons for various states:

```typescript
icons.success   // ✓
icons.error     // ✗
icons.warning   // ⚠
icons.info      // ℹ
icons.arrow     // →
icons.bullet    // •
icons.chevron   // ›
icons.search    // 🔍
icons.folder    // 📁
icons.file      // 📄
icons.package   // 📦
icons.gear      // ⚙️
icons.rocket    // 🚀
icons.sparkles  // ✨
icons.chart     // 📊
```

### Format Helpers

Layout and structure helpers:

```typescript
// Dividers
format.divider()              // ────────────... (60 chars)
format.divider(80)            // ────────────... (80 chars)
format.doubleDivider()        // ════════════...
format.dashedDivider()        // ┈┈┈┈┈┈┈┈┈┈┈┈...

// Headers
format.title('My Title', icons.rocket)     // Formatted title with icon
format.section('Section Name')              // Section header

// Lists
format.bulletItem('Item text')              // • Item text
format.bulletItem('Nested', 2)              // With indent
format.checkItem('Task', true)              // ✓ Task
format.checkItem('Task', false)             // ■ Task

// Key-value pairs
format.keyValue('Name', 'John')             // Name: John
format.keyValue('Status', 'Active', 10)     // With fixed key width

// Tables
format.table(
  ['Name', 'Status'],
  [
    ['Service 1', 'Active'],
    ['Service 2', 'Stopped']
  ]
)

// Progress bars
format.progressBar(75, 100)                 // ████████████████████░░░░░░░░░░ 75%

// Boxes
format.box('Content in a box')

// Text manipulation
format.indent('Indented text', 4)
format.truncate('Long text...', 20)
```

### Output Helpers

Semantic console output:

```typescript
output.success('Operation completed successfully')
output.error('An error occurred')
output.warning('This action cannot be undone')
output.info('Processing files...')
output.debug('Variable value: 42')
output.step(1, 5, 'Installing dependencies')
output.highlight('Version', '1.0.0')
```

## Best Practices

1. **Use semantic styles**: Prefer `style.success()` over `style.green()` for success messages
2. **Be consistent**: Use the same icons and styles for similar states across commands
3. **Keep it readable**: Don't overuse colors or styles
4. **Respect user preferences**: The formatter respects NO_COLOR and TERM environment variables
5. **Use proper output methods**: Use `output.error()` for errors, not `console.log(style.red())`

## Examples

### Command Output

```typescript
import formatter from '@cli/utils/formatting.js';
const { style, icons, format, output } = formatter;

// Command header
console.log(format.title('Module Validator', icons.search));
console.log(format.keyValue('Path', style.path('/src/modules')));
console.log(format.divider());

// Progress
output.step(1, 3, 'Scanning modules...');

// Results
if (valid) {
  output.success('All modules are valid!');
} else {
  output.error('Validation failed!');
}

// Summary table
console.log(format.section('Summary'));
console.log(format.table(
  ['Module', 'Status', 'Errors'],
  [
    ['auth', style.success('Valid'), '0'],
    ['database', style.error('Invalid'), '2']
  ]
));
```

### Error Handling

```typescript
try {
  // Command logic
} catch (error) {
  output.error(`Command failed: ${error.message}`);
  if (process.env.DEBUG) {
    console.error(style.muted(error.stack));
  }
  process.exit(1);
}
```

### Interactive Prompts

```typescript
console.log(format.title('Setup Wizard', icons.gear));
console.log();
output.info('This wizard will guide you through the setup process.');
console.log();

console.log(format.keyValue('Database', style.code('PostgreSQL')));
console.log(format.keyValue('Port', style.code('5432')));
console.log();

output.warning('This will overwrite existing configuration.');
```

## Contributing

When adding new CLI commands, always use these formatting utilities instead of hardcoding ANSI codes or console methods directly. This ensures a consistent user experience across the entire CLI.