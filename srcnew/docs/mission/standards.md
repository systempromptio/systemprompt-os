# systemprompt-os Coding Standards

## Overview

This document defines the coding standards and naming conventions for the systemprompt-os project. All contributors must follow these standards to ensure consistency, maintainability, and alignment with our architectural principles.

## Naming Conventions

### Files and Directories

1. **TypeScript/JavaScript Files**
   - Use kebab-case for file names: `user-profile.ts`, `oauth-provider.ts`
   - Test files must end with `.test.ts`: `user-profile.test.ts`
   - Interface files should be named after their primary interface: `provider.ts`

2. **Directories**
   - Use lowercase with no separators: `server`, `memory`, `action`
   - Plural for collections: `tools`, `interfaces`, `implementations`
   - Singular for specific features: `auth`, `config`

3. **Configuration Files**
   - Use lowercase with extensions: `vitest.config.ts`, `tsconfig.json`
   - Environment-specific configs: `vitest.unit.config.ts`, `vitest.e2e.config.ts`

### Code Conventions

1. **Classes**
   - Use PascalCase: `MemoryProvider`, `OAuthHandler`
   - End with descriptive suffixes: `Provider`, `Handler`, `Service`, `Endpoint`

2. **Interfaces and Types**
   - Use PascalCase with `I` prefix for interfaces: `IMemoryProvider`, `IActionExecutor`
   - Use PascalCase without prefix for types: `MemoryOperation`, `ActionStatus`

3. **Functions and Methods**
   - Use camelCase: `getMemory()`, `executeAction()`
   - Boolean functions start with `is`, `has`, `can`: `isValid()`, `hasPermission()`
   - Async functions may end with `Async` for clarity when needed

4. **Variables and Constants**
   - Variables use camelCase: `userProfile`, `memoryStore`
   - Constants use UPPER_SNAKE_CASE: `MAX_RETRIES`, `DEFAULT_PORT`
   - Configuration objects use UPPER_CASE: `CONFIG`, `SETTINGS`

5. **MCP Tools**
   - Use snake_case for tool names: `store_memory`, `execute_action`
   - This aligns with MCP protocol standards

## Directory Structure Standards

Based on the architecture document, maintain this structure:

```
src/
├── server/          # Server implementations
├── memory/          # Memory interfaces (no implementation)
├── action/          # Action interfaces (no implementation)
└── utils/           # Shared utilities

tools/               # CLI tools and utilities
├── cli/            # Main CLI implementation
└── generate-key/   # Key generation tool

tests/              # Test suites
├── unit/           # Unit tests
├── integration/    # Integration tests
├── e2e/           # End-to-end tests
└── fixtures/      # Test utilities and data
```

## Import Standards

1. **Import Order**
   - Node.js built-ins first
   - External dependencies second
   - Internal dependencies last
   - Separate groups with blank lines

2. **Import Paths**
   - Use `.js` extension for local imports in TypeScript
   - Use relative paths within the same module
   - Use absolute paths for cross-module imports

Example:
```typescript
import { readFile } from 'fs/promises';
import express from 'express';

import { CONFIG } from '../config.js';
import { logger } from '../../utils/logger.js';
```

## Testing Standards

1. **Test Organization**
   - One test file per source file
   - Mirror source structure in test directories
   - Group related tests using `describe` blocks

2. **Test Naming**
   - Test files: `<source-file>.test.ts`
   - Test descriptions: Start with "should"
   - Be specific about expected behavior

Example:
```typescript
describe('MemoryProvider', () => {
  it('should store memory with unique ID', async () => {
    // test implementation
  });
});
```

## Configuration Standards

1. **Environment Variables**
   - Use UPPER_SNAKE_CASE: `JWT_SECRET`, `DATABASE_URL`
   - Prefix with module name for clarity: `MEMORY_PROVIDER`, `AUTH_PROVIDER`

2. **Configuration Files**
   - YAML for human-edited configs: `providers.yaml`
   - JSON for machine-generated configs: `package.json`
   - TypeScript for type-safe configs: `vitest.config.ts`

## Documentation Standards

1. **File Headers**
   - Include `@fileoverview` and `@module` JSDoc tags
   - Brief description of file purpose

2. **Function Documentation**
   - Document all public APIs with JSDoc
   - Include parameter types and return values
   - Add examples for complex functions

Example:
```typescript
/**
 * @fileoverview Memory provider interface implementation
 * @module memory/interfaces/provider
 */

/**
 * Store a memory entry
 * @param key - Unique identifier for the memory
 * @param value - Memory content to store
 * @returns Promise resolving to stored memory ID
 */
export async function storeMemory(key: string, value: any): Promise<string> {
  // implementation
}
```

## Error Handling Standards

1. **Error Classes**
   - Create specific error classes for different error types
   - Extend from base `Error` class
   - Include error codes and context

2. **Error Messages**
   - Be specific and actionable
   - Include relevant context
   - Use consistent format

Example:
```typescript
export class MemoryNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`Memory with ID '${id}' not found`);
    this.name = 'MemoryNotFoundError';
  }
}
```

## Security Standards

1. **Never commit secrets or keys**
2. **Always validate user input**
3. **Use parameterized queries for databases**
4. **Implement proper authentication checks**
5. **Follow principle of least privilege**

## Git Standards

1. **Branch Names**
   - Feature branches: `feature/add-memory-provider`
   - Bug fixes: `fix/oauth-token-validation`
   - Refactoring: `refactor/cleanup-server-structure`

2. **Commit Messages**
   - Use present tense: "Add memory provider"
   - Be specific about changes
   - Reference issues when applicable

## Enforcement

These standards are enforced through:
1. ESLint configuration for code style
2. TypeScript compiler for type safety
3. Pre-commit hooks for formatting
4. Code review process for architectural adherence

## References

- Architecture Document: `/ARCHITECTURE.md`
- Mission Statement: Project README
- MCP Protocol: Model Context Protocol specification