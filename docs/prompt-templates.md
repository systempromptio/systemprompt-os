# Prompt Templates

## Overview

Prompt Templates provide pre-built, reusable instruction sets for common coding tasks. They enable consistent, high-quality AI agent outputs by standardizing instructions for frequently performed operations like bug fixes, component creation, and testing.

## Architecture

```
Template System
      │
      ├── Template Registry
      │   └── Pre-built Templates
      │
      ├── Variable Interpolation
      │   └── Dynamic Value Injection
      │
      └── Template Execution
          └── Task Creation with Instructions
```

## Template Structure

### Basic Template Format

```json
{
  "id": "bug_fix",
  "name": "Bug Fix Template",
  "description": "Template for fixing bugs with proper investigation and testing",
  "variables": {
    "bug_description": {
      "type": "string",
      "required": true,
      "description": "Description of the bug to fix"
    },
    "error_logs": {
      "type": "string",
      "required": false,
      "description": "Error logs or stack traces"
    }
  },
  "instructions": "Investigate and fix the following bug: {{bug_description}}\n\nError logs:\n{{error_logs}}\n\nSteps:\n1. Reproduce the issue\n2. Identify root cause\n3. Implement fix\n4. Add tests\n5. Verify fix works"
}
```

## Pre-Built Templates

### 1. **Bug Fix Template**

**Purpose:** Systematic bug investigation and resolution

```json
{
  "prompt_template": "bug_fix",
  "variables": {
    "bug_description": "Login fails after password reset",
    "error_logs": "401 Unauthorized at auth.js:42",
    "affected_files": ["src/auth.js", "src/middleware/auth.js"],
    "priority": "high"
  }
}
```

**Generated Instructions:**
```
Investigate and fix the following bug: Login fails after password reset

Error logs:
401 Unauthorized at auth.js:42

Affected files:
- src/auth.js
- src/middleware/auth.js

Priority: high

Steps to follow:
1. Reproduce the issue by attempting login after password reset
2. Debug the authentication flow
3. Identify the root cause
4. Implement a fix
5. Add unit tests for the scenario
6. Verify the fix resolves the issue
7. Run all existing tests to ensure no regression
```

### 2. **React Component Template**

**Purpose:** Create React components with best practices

```json
{
  "prompt_template": "react_component",
  "variables": {
    "component_name": "UserDashboard",
    "features": [
      "data visualization",
      "real-time updates",
      "export functionality"
    ],
    "props": {
      "userId": "string",
      "theme": "light | dark"
    },
    "state_management": "hooks"
  }
}
```

**Generated Instructions:**
```
Create a React component named UserDashboard with the following specifications:

Features:
- data visualization
- real-time updates
- export functionality

Props interface:
- userId: string
- theme: 'light' | 'dark'

State management: React hooks

Requirements:
1. Use functional component with TypeScript
2. Implement proper prop validation
3. Add loading and error states
4. Make it responsive
5. Follow accessibility best practices
6. Include unit tests with React Testing Library
7. Add Storybook stories for different states
```

### 3. **Unit Test Template**

**Purpose:** Generate comprehensive test suites

```json
{
  "prompt_template": "unit_test",
  "variables": {
    "target_files": ["src/auth/*.js"],
    "framework": "jest",
    "coverage_target": 85,
    "test_types": ["unit", "integration"]
  }
}
```

**Generated Instructions:**
```
Create comprehensive tests for files matching: src/auth/*.js

Testing framework: jest
Coverage target: 85%
Test types: unit, integration

Requirements:
1. Analyze existing code to identify test cases
2. Write unit tests for all functions
3. Add integration tests for workflows
4. Mock external dependencies appropriately
5. Test error scenarios and edge cases
6. Achieve at least 85% code coverage
7. Use descriptive test names
8. Group related tests using describe blocks
```

### 4. **API Endpoint Template**

**Purpose:** Create RESTful API endpoints

```json
{
  "prompt_template": "api_endpoint",
  "variables": {
    "endpoint": "/api/users/:id",
    "methods": ["GET", "PUT", "DELETE"],
    "authentication": "JWT",
    "validation": true,
    "documentation": "OpenAPI"
  }
}
```

### 5. **Database Migration Template**

**Purpose:** Create database schema changes

```json
{
  "prompt_template": "database_migration",
  "variables": {
    "operation": "add_column",
    "table": "users",
    "changes": {
      "email_verified": "boolean DEFAULT false",
      "verification_token": "varchar(255)"
    }
  }
}
```

### 6. **Performance Optimization Template**

**Purpose:** Optimize code performance

```json
{
  "prompt_template": "performance_optimization",
  "variables": {
    "target_area": "database queries",
    "current_metrics": {
      "response_time": "2.5s",
      "queries_per_request": 15
    },
    "target_metrics": {
      "response_time": "< 500ms",
      "queries_per_request": "< 5"
    }
  }
}
```

## Using Templates

### Via MCP Tool Call

```json
{
  "tool": "create_task",
  "arguments": {
    "tool": "CLAUDECODE",
    "prompt_template": "bug_fix",
    "variables": {
      "bug_description": "User profile images not loading",
      "error_logs": "404 Not Found - /api/images/profile/*"
    }
  }
}
```

### Direct Template Application

```typescript
const template = getPromptTemplate('react_component');
const instructions = interpolateTemplate(template, {
  component_name: 'SearchBar',
  features: ['autocomplete', 'recent searches']
});

await createTask({
  tool: 'CLAUDECODE',
  instructions: instructions
});
```

## Custom Templates

### Creating Custom Templates

```json
{
  "id": "custom_refactor",
  "name": "Code Refactoring Template",
  "variables": {
    "target_files": {
      "type": "array",
      "required": true
    },
    "refactor_goals": {
      "type": "array",
      "required": true
    },
    "constraints": {
      "type": "string",
      "required": false
    }
  },
  "instructions": "Refactor the following files: {{target_files}}\n\nGoals:\n{{#each refactor_goals}}- {{this}}\n{{/each}}\n\nConstraints: {{constraints}}"
}
```

### Template Registry

Store custom templates in:
```
templates/
├── built-in/
│   ├── bug_fix.json
│   ├── react_component.json
│   └── unit_test.json
└── custom/
    ├── company_standard_api.json
    └── microservice_setup.json
```

## Variable System

### Variable Types

1. **String Variables**
   ```json
   {
     "component_name": {
       "type": "string",
       "required": true,
       "pattern": "^[A-Z][a-zA-Z0-9]*$"
     }
   }
   ```

2. **Array Variables**
   ```json
   {
     "features": {
       "type": "array",
       "items": {"type": "string"},
       "minItems": 1
     }
   }
   ```

3. **Object Variables**
   ```json
   {
     "config": {
       "type": "object",
       "properties": {
         "timeout": {"type": "number"},
         "retries": {"type": "number"}
       }
     }
   }
   ```

4. **Enum Variables**
   ```json
   {
     "framework": {
       "type": "string",
       "enum": ["jest", "mocha", "vitest"]
     }
   }
   ```

### Variable Interpolation

Templates use mustache-style syntax:
- `{{variable_name}}` - Simple substitution
- `{{#if condition}}...{{/if}}` - Conditionals
- `{{#each array}}...{{/each}}` - Iteration

## Advanced Features

### 1. **Conditional Sections**

```
{{#if error_logs}}
Error logs provided:
{{error_logs}}
{{else}}
No error logs provided. Investigate by reproducing the issue.
{{/if}}
```

### 2. **Nested Templates**

```json
{
  "id": "full_feature",
  "includes": ["api_endpoint", "react_component", "unit_test"],
  "variables": {
    "feature_name": "User Authentication"
  }
}
```

### 3. **Template Inheritance**

```json
{
  "id": "custom_bug_fix",
  "extends": "bug_fix",
  "additional_instructions": "\n\nAlso update the changelog and notify the team."
}
```

### 4. **Dynamic Templates**

```typescript
function generateTemplate(context: TaskContext): string {
  if (context.isNewProject) {
    return templates.project_setup;
  } else if (context.hasTests) {
    return templates.add_feature_with_tests;
  } else {
    return templates.add_feature_basic;
  }
}
```

## Best Practices

### 1. **Template Design**
- Keep templates focused on single tasks
- Use clear, descriptive variable names
- Provide sensible defaults
- Include validation rules

### 2. **Instruction Clarity**
- Number steps sequentially
- Include success criteria
- Specify output format
- Add examples where helpful

### 3. **Variable Usage**
- Validate all required variables
- Provide helpful descriptions
- Use type constraints
- Offer example values

### 4. **Template Maintenance**
- Version templates for compatibility
- Document changes
- Test with various inputs
- Gather user feedback

## Integration Examples

### Mobile App Integration

```typescript
// Quick action buttons in mobile app
const quickActions = [
  {
    label: "Fix Bug",
    template: "bug_fix",
    icon: "🐛"
  },
  {
    label: "New Component",
    template: "react_component",
    icon: "⚛️"
  },
  {
    label: "Add Tests",
    template: "unit_test",
    icon: "🧪"
  }
];
```

### Voice Command Integration

```
"Hey SystemPrompt, create a new React component called UserProfile 
with data fetching and error handling"

→ Matches: react_component template
→ Extracts: component_name="UserProfile", 
           features=["data fetching", "error handling"]
```

### CLI Integration

```bash
# Use template from command line
mcp-agent create --template bug_fix \
  --var bug_description="Memory leak in background worker" \
  --var priority=high
```

## Future Enhancements

1. **AI-Powered Template Selection**
   - Analyze task description
   - Suggest best template
   - Auto-fill variables

2. **Template Marketplace**
   - Share community templates
   - Rate and review
   - Version management

3. **Visual Template Builder**
   - Drag-drop interface
   - Live preview
   - Variable wizard

4. **Template Analytics**
   - Usage statistics
   - Success rates
   - Performance metrics