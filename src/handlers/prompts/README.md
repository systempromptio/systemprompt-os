# Coding Prompts

Comprehensive collection of prompt templates for AI-assisted coding workflows, providing structured guidance for common development tasks including bug fixing, unit testing, React development, and code refactoring.

## Overview

This directory contains specialized MCP prompts that guide AI assistants through complex coding tasks. Each prompt provides:
- Structured approach to problem-solving
- Clear requirements and arguments
- Best practices for specific domains
- Systematic methodologies

## Available Prompt Categories

### 🐛 Bug Fixing Prompts

#### `fix_bug`
Systematic bug diagnosis and resolution:
```typescript
{
  bug_description: string;      // What's broken
  error_message?: string;       // Error details
  affected_files?: string;      // Related files
  reproduction_steps?: string;  // How to reproduce
}
```

#### `debug_async_issue`
Asynchronous and timing-related debugging:
```typescript
{
  issue_description: string;    // Async problem
  code_section?: string;        // Relevant code
  expected_behavior?: string;   // What should happen
  actual_behavior?: string;     // What happens
}
```

#### `fix_memory_leak`
Memory leak identification and resolution:
```typescript
{
  symptoms: string;             // Memory growth patterns
  suspected_areas?: string;     // Potential leak sources
  profiler_data?: string;       // Memory profiles
}
```

#### `debug_production_issue`
Production-specific debugging:
```typescript
{
  issue_description: string;    // Production problem
  logs?: string;                // Production logs
  monitoring_data?: string;     // Metrics/monitoring
  environment_diff?: string;    // Dev vs prod differences
}
```

#### `fix_performance_issue`
Performance bottleneck resolution:
```typescript
{
  performance_issue: string;    // What's slow
  metrics?: string;             // Performance data
  profiler_output?: string;     // Profiling results
  target_improvement?: string;  // Performance goals
}
```

### 🧪 Unit Testing Prompts

#### `create_unit_tests`
Comprehensive test creation:
```typescript
{
  file_path: string;           // File to test
  test_framework: string;      // Jest, Mocha, etc.
  coverage_target?: string;    // Coverage goal (e.g., "90%")
  existing_tests?: string;     // Current test file
}
```

#### `add_missing_tests`
Gap analysis and test addition:
```typescript
{
  file_path: string;           // Source file
  test_file?: string;          // Existing tests
  coverage_report?: string;    // Coverage data
  critical_paths?: string;     // Important flows
}
```

#### `fix_failing_tests`
Test debugging and repair:
```typescript
{
  test_file: string;           // Failing test file
  error_output: string;        // Test failure output
  recent_changes?: string;     // What changed
}
```

#### `improve_test_coverage`
Coverage improvement:
```typescript
{
  coverage_report: string;     // Current coverage
  target_coverage: string;     // Goal (e.g., "95%")
  focus_areas?: string;        // Priority areas
}
```

### ⚛️ React Component Prompts

#### `create_react_component`
New component creation:
```typescript
{
  component_name: string;      // Component name
  functionality: string;       // What it does
  props_interface?: string;    // TypeScript props
  styling_approach?: string;   // CSS method
  state_requirements?: string; // State needs
}
```

#### `update_react_component`
Component enhancement:
```typescript
{
  component_file: string;      // Existing component
  new_features: string;        // Features to add
  breaking_changes?: string;   // API changes
  performance_reqs?: string;   // Performance needs
}
```

#### `convert_to_hooks`
Class to hooks migration:
```typescript
{
  component_file: string;      // Class component
  preserve_behavior?: string;  // Behavior to keep
  custom_hooks?: string;       // Extract to hooks
}
```

#### `create_custom_hook`
Custom hook extraction:
```typescript
{
  logic_description: string;   // Logic to extract
  source_components?: string;  // Where it's used
  hook_name?: string;          // Suggested name
  dependencies?: string;       // External deps
}
```

#### `optimize_react_performance`
Performance optimization:
```typescript
{
  component_file: string;      // Component to optimize
  performance_issues?: string; // Current problems
  metrics?: string;            // Performance data
  optimization_goals?: string; // Target metrics
}
```

### 🔧 Refactoring Prompts

#### `refactor_code`
General refactoring:
```typescript
{
  file_path: string;           // File to refactor
  refactoring_goals: string;   // What to improve
  constraints?: string;        // What to preserve
  patterns_to_apply?: string;  // Design patterns
}
```

#### `extract_common_code`
DRY principle application:
```typescript
{
  files_with_duplication: string; // Files with duplicates
  duplication_pattern?: string;   // What's duplicated
  target_module?: string;         // Where to extract
}
```

#### `simplify_complex_function`
Function decomposition:
```typescript
{
  function_location: string;   // Complex function
  complexity_metrics?: string; // Cyclomatic complexity
  target_size?: string;        // Goal size
}
```

#### `modernize_legacy_code`
Legacy code updates:
```typescript
{
  legacy_file: string;         // Old code file
  target_version?: string;     // Target JS/TS version
  modern_patterns?: string;    // Patterns to use
  compatibility?: string;      // Browser/Node support
}
```

#### `improve_architecture`
Architectural improvements:
```typescript
{
  current_structure: string;   // Current architecture
  pain_points: string;         // Problems to solve
  architectural_goals?: string; // Target architecture
  constraints?: string;        // Technical limits
}
```

## Prompt Structure

Each prompt follows a consistent structure:

```typescript
interface Prompt {
  name: string;              // Unique identifier
  description: string;       // What it does
  arguments: PromptArgument[]; // Required/optional args
  messages: Message[];       // Prompt template
}
```

## Usage Examples

### Using a Bug Fix Prompt

```json
{
  "method": "prompts/get",
  "params": {
    "name": "fix_bug",
    "arguments": {
      "bug_description": "Users cannot log in after password reset",
      "error_message": "401 Unauthorized - Invalid token",
      "affected_files": "/src/auth/reset-password.js",
      "reproduction_steps": "1. Reset password 2. Try to log in 3. Fails"
    }
  }
}
```

### Using a Test Creation Prompt

```json
{
  "method": "prompts/get",
  "params": {
    "name": "create_unit_tests",
    "arguments": {
      "file_path": "/src/utils/validator.ts",
      "test_framework": "jest",
      "coverage_target": "95%"
    }
  }
}
```

## Prompt Design Principles

### 1. Systematic Approach
Each prompt guides through:
- Problem analysis
- Solution planning
- Implementation
- Verification

### 2. Best Practices
Prompts incorporate:
- Industry standards
- Framework conventions
- Performance considerations
- Security awareness

### 3. Flexibility
Arguments allow:
- Optional parameters
- Context customization
- Framework agnostic approaches
- Progressive enhancement

### 4. Clear Output
Prompts produce:
- Executable code
- Detailed explanations
- Step-by-step guidance
- Verification steps

## Integration with Tools

Prompts work seamlessly with:
- `create_task` tool for execution
- `check_status` for monitoring
- `report_task` for results

Example workflow:
```typescript
// 1. Get prompt
const prompt = await getPrompt('fix_bug', args);

// 2. Create task with prompt
const task = await createTask({
  tool: 'CLAUDECODE',
  instructions: prompt.content,
  branch: 'fix/login-bug'
});

// 3. Monitor progress
const status = await checkStatus(task.id);
```

## Adding New Prompts

To add a new prompt:

1. **Create Prompt File**
   ```typescript
   // prompts/my-prompt.ts
   export const MY_PROMPT: Prompt = {
     name: 'my_prompt',
     description: 'What it does',
     arguments: [...],
     messages: [...]
   };
   ```

2. **Export from Index**
   ```typescript
   // prompts/index.ts
   export { MY_PROMPT } from './my-prompt';
   ```

3. **Add to Registry**
   ```typescript
   // prompt-handlers.ts
   PROMPTS.set('my_prompt', MY_PROMPT);
   ```

## Best Practices

### Prompt Writing
- Be specific about requirements
- Include error handling guidance
- Specify output format
- Add verification steps

### Argument Design
- Required args only for essentials
- Provide sensible defaults
- Use descriptive names
- Include validation hints

### Context Building
- Gather relevant information
- Include constraints
- Specify goals clearly
- Add examples when helpful

## Future Enhancements

Planned additions:
- Database migration prompts
- API design prompts
- Security audit prompts
- Documentation generation
- CI/CD configuration

This prompt collection enables systematic, AI-assisted development across the entire software lifecycle, from debugging to optimization.