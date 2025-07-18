# Unit Tests

This directory contains unit tests for the SystemPrompt OS codebase. All unit tests follow a strict naming convention that mirrors the source file structure.

## Test Organization

The test directory structure exactly mirrors the source code structure:

```
tests/unit/
├── modules/
│   ├── loader.spec.ts         → src/modules/loader.ts
│   └── registry.spec.ts       → src/modules/registry.ts
├── server/
│   ├── config.spec.ts         → src/server/config.ts
│   ├── middleware.spec.ts     → src/server/middleware.ts
│   ├── external/
│   │   ├── auth/
│   │   │   └── jwt.spec.ts    → src/server/external/auth/jwt.ts
│   │   ├── middleware/
│   │   │   └── auth.spec.ts   → src/server/external/middleware/auth.ts
│   │   └── rest/
│   │       ├── health.spec.ts → src/server/external/rest/health.ts
│   │       └── status.spec.ts → src/server/external/rest/status.ts
│   └── mcp/
│       ├── loader.spec.ts     → src/server/mcp/loader.ts
│       └── core/
│           └── server.spec.ts → src/server/mcp/core/server.ts
├── tools/
│   └── generate-key/
│       └── generate-key.spec.ts → src/tools/generate-key/index.ts
└── utils/
    ├── id-validation.spec.ts  → src/utils/id-validation.ts
    └── logger.spec.ts         → src/utils/logger.ts
```

## Naming Convention

- Test files must have the same name as the source file they test, with `.spec.ts` extension
- Test files must be in the same relative path under `tests/unit/` as their source files
- Example: `src/server/config.ts` → `tests/unit/server/config.spec.ts`

## Test Coverage

### Currently Tested Files

1. **Core Modules**
   - `modules/loader.ts` - Module loading and lifecycle management
   - `modules/registry.ts` - Module registration and querying

2. **Server Components**
   - `server/config.ts` - Server configuration validation
   - `server/middleware.ts` - Rate limiting, protocol validation, request size limits
   - `server/external/auth/jwt.ts` - JWT generation, verification, and refresh
   - `server/external/middleware/auth.ts` - Authentication middleware
   - `server/external/rest/health.ts` - Health check endpoint
   - `server/external/rest/status.ts` - Status endpoint
   - `server/mcp/loader.ts` - Custom MCP server loading
   - `server/mcp/core/server.ts` - Core MCP server functionality

3. **Utilities**
   - `utils/logger.ts` - Logging functionality
   - `utils/id-validation.ts` - ID validation utilities
   - `tools/generate-key/index.ts` - JWT key pair generation

### Files Requiring Unit Tests

High priority files that still need unit tests:

1. **Utils**
   - `utils/json-schema-to-zod.ts`
   - `utils/task-helpers.ts`
   - `utils/tool-availability.ts`
   - `utils/log-parser.ts`

2. **Server Components**
   - `server/mcp/registry.ts`
   - `server/external/auth/providers/*.ts` (OAuth providers)
   - `server/external/rest/oauth2/*.ts` (OAuth2 endpoints)

3. **MCP Handlers**
   - `server/mcp/core/handlers/tool-handlers.ts`
   - `server/mcp/core/handlers/resource-handlers.ts`
   - `server/mcp/core/handlers/prompt-handlers.ts`

## Running Tests

### Run all unit tests
```bash
npm run test:unit
```

### Run specific test file
```bash
npx vitest run tests/unit/server/config.spec.ts
```

### Run tests in watch mode
```bash
npx vitest watch --config tests/config/vitest.unit.config.ts
```

### Run with coverage
```bash
npm run test:coverage
```

## Writing New Tests

When adding new unit tests:

1. Create the test file in the exact mirror location of the source file
2. Name it with the same filename but `.spec.ts` extension
3. Import the source file using relative paths from the test location
4. Mock external dependencies using `vi.mock()`
5. Test all exported functions and classes
6. Cover edge cases and error scenarios

Example structure:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { functionToTest } from '../../../src/path/to/file';

// Mock dependencies
vi.mock('../../../src/some/dependency', () => ({
  someDependency: vi.fn()
}));

describe('FunctionToTest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle normal case', () => {
    // Test implementation
  });

  it('should handle error case', () => {
    // Test implementation
  });
});
```

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Mocking**: Mock all external dependencies to ensure true unit testing
3. **Coverage**: Aim for high code coverage but focus on meaningful tests
4. **Clarity**: Use descriptive test names that explain what is being tested
5. **Edge Cases**: Test error conditions, edge cases, and boundary values
6. **Performance**: Keep tests fast by mocking I/O operations