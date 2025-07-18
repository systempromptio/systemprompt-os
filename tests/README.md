# SystemPrompt OS Test Suite

This directory contains the comprehensive test suite for SystemPrompt OS, organized into unit and end-to-end tests.

## Test Structure

Tests are organized to mirror the source code structure for easy navigation and maintenance:

```
tests/
├── unit/                    # Unit tests (mirrors src/ structure)
│   ├── core/
│   │   └── modules/
│   │       └── loader.spec.ts    # Tests for src/core/modules/loader.ts
│   ├── server/
│   │   ├── config.spec.ts        # Tests for src/server/config.ts
│   │   └── mcp/
│   │       └── ...
│   └── utils/
│       └── ...
├── e2e/                     # End-to-end tests (domain-based)
│   ├── bootstrap.ts         # Docker environment setup
│   ├── index.e2e.test.ts    # Main test orchestrator
│   ├── 00-tools-cli.e2e.test.ts        # CLI tools domain
│   ├── 01-server-external.e2e.test.ts  # External endpoints
│   ├── 02-server-auth.e2e.test.ts      # Authentication domain
│   ├── 03-server-mcp.e2e.test.ts       # MCP server domain
│   ├── 04-modules-core.e2e.test.ts     # Core modules domain
│   └── utils/               # E2E test utilities
│       └── docker-test-utils.ts
├── fixtures/                # Test fixtures and data
├── helpers/                 # Test utilities and helpers
├── mocks/                   # Mock implementations
└── config/                  # Test configurations
    ├── vitest.unit.config.ts
    └── vitest.e2e.config.ts
```

## Naming Conventions

- **Unit tests**: Mirror the source file path, replacing `.ts` with `.spec.ts`
  - Source: `src/core/modules/loader.ts`
  - Test: `tests/unit/core/modules/loader.spec.ts`

- **E2E tests**: Organized by domain with numbered prefixes
  - Pattern: `XX-domain-name.e2e.test.ts`
  - Example: `00-tools-cli.e2e.test.ts`, `01-server-external.e2e.test.ts`

## Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run e2e tests only
npm run test:e2e

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run specific test file
npx vitest run tests/unit/core/modules/loader.spec.ts
```

## Writing Tests

### Unit Tests

Unit tests should:
- Test individual functions, classes, or modules in isolation
- Mock external dependencies
- Focus on edge cases and error handling
- Achieve high code coverage (>90%)

Example structure:
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('ModuleName', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  describe('methodName', () => {
    it('should handle normal case', () => {
      // Test implementation
    });

    it('should handle edge case', () => {
      // Test implementation
    });

    it('should handle error case', () => {
      // Test implementation
    });
  });
});
```

### E2E Tests

End-to-end tests are organized using a domain-based architecture with a bootstrap pattern:

#### Bootstrap Architecture
- **Bootstrap**: A single Docker environment is created once before all tests
- **Domain Organization**: Tests are grouped by domain (e.g., tools-cli, server-auth)
- **Sequential Execution**: All domain tests run in the same Docker container
- **Shared Context**: Tests can share the container state for efficiency

#### Domain Structure
```
e2e/
├── bootstrap.ts              # Creates and manages Docker environment
├── index.e2e.test.ts        # Main orchestrator that imports all domains
├── 00-tools-cli.e2e.test.ts        # CLI commands and tools
├── 01-server-external.e2e.test.ts  # Health, status, CORS
├── 02-server-auth.e2e.test.ts      # OAuth2, JWT, authentication
├── 03-server-mcp.e2e.test.ts       # MCP protocol, tools, resources
└── 04-modules-core.e2e.test.ts     # Core modules functionality
```

#### Writing E2E Tests
End-to-end tests should:
- Test complete user workflows
- Use the actual application in Docker
- Focus on critical domain functionality
- Import shared utilities from bootstrap
- Follow the numbered naming convention

## Test Coverage

We maintain the following coverage thresholds:

- **Lines**: 90%
- **Functions**: 90%
- **Branches**: 85%
- **Statements**: 90%

Coverage reports are generated in the `coverage/` directory after running tests with coverage enabled.

## Shared Test Resources

**IMPORTANT**: Test utilities, mocks, fixtures, and helpers MUST be placed in their respective shared folders and follow strict naming conventions:

### Directory Structure
- `fixtures/` - Test data and fixtures shared across tests
- `helpers/` - Utility functions and test helpers
- `mocks/` - Mock implementations

### Naming Convention Requirements
All shared test resources MUST follow a one-to-one file mapping with the same path structure as the source files they support:

Examples:
- Source: `src/server/mcp/core/handlers.ts`
- Mock: `tests/mocks/server/mcp/core/handlers.mock.ts`
- Helper: `tests/helpers/server/mcp/core/handlers.helper.ts`
- Fixture: `tests/fixtures/server/mcp/core/handlers.fixture.ts`

This ensures:
- Easy discovery of related test resources
- Consistent organization across the test suite
- Clear relationship between source and test files

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Clarity**: Test names should clearly describe what is being tested
3. **Mocking**: Mock external dependencies to ensure tests are deterministic
4. **Assertions**: Use specific assertions that clearly indicate what is expected
5. **Cleanup**: Always clean up after tests (reset mocks, clear timers, etc.)
6. **Performance**: Keep tests fast by minimizing I/O operations
7. **Documentation**: Add comments for complex test scenarios
8. **Shared Resources**: Always place mocks, fixtures, and helpers in their designated folders with proper naming

## Continuous Integration

Tests are automatically run on:
- Pull requests
- Commits to main branch
- Nightly builds

Failed tests will block merges to ensure code quality is maintained.