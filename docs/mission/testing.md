# Testing Philosophy for systemprompt-os

## Overview

This document outlines the testing strategy and framework choices for systemprompt-os, an operating system for autonomous agents that run locally, remember persistently, and act purposefully.

## Why Vitest?

After careful evaluation of available testing frameworks, we chose **Vitest** for the following reasons:

### 1. Native ESM Support
systemprompt-os is built as an ESM-first project (`"type": "module"`). Vitest provides:
- Zero-configuration ESM support
- No transpilation overhead during testing
- Direct testing of our actual module structure

### 2. TypeScript Integration
- Built-in TypeScript support without additional configuration
- Type checking during tests
- Seamless integration with our TypeScript codebase

### 3. Performance
- Fastest test execution among modern frameworks
- Parallel test execution by default
- Smart watch mode that only re-runs affected tests
- Critical for maintaining developer productivity in an OS project

### 4. Modern Architecture
- Designed for modern JavaScript projects
- Active development and community
- Future-proof choice for a forward-looking OS

### 5. Developer Experience
- Instant feedback with watch mode
- Clear error messages and stack traces
- Jest-compatible API for easy adoption
- Excellent VS Code integration

## Testing Structure

### Three-Layer Testing Strategy

#### 1. Unit Tests (`tests/unit/`)
**Purpose**: Test individual components in isolation

**Characteristics**:
- No external dependencies
- Mock all imports
- Focus on pure business logic
- Sub-millisecond execution time

**Examples**:
```typescript
// server-config.test.ts
it('should load default configuration values', () => {
  const config = loadConfig();
  expect(config.PORT).toBe('3000');
});

// mcp-server.test.ts
it('should register MCP tools correctly', () => {
  const server = new MCPServer();
  expect(server.getTools()).toHaveLength(4);
});
```

**When to Write**: For every new function, class, or module

#### 2. Integration Tests (`tests/integration/`)
**Purpose**: Test component interactions and integrations

**Characteristics**:
- May start actual servers on random ports
- Test database connections (using test databases)
- Verify API contracts between modules
- 10-100ms execution time

**Examples**:
```typescript
// server-startup.test.ts
it('should start server and respond to health checks', async () => {
  const server = await startServer({ port: 0 });
  const response = await fetch('/health');
  expect(response.status).toBe(200);
});

// mcp-integration.test.ts
it('should handle MCP tool execution', async () => {
  const result = await mcpServer.executeTool('system_info');
  expect(result).toHaveProperty('os');
});
```

**When to Write**: When testing interactions between modules or with external services

#### 3. End-to-End Tests (`tests/e2e/`)
**Purpose**: Test complete user workflows

**Characteristics**:
- Test from the user's perspective
- May involve multiple services
- Include timing-sensitive operations
- 1-30 second execution time

**Examples**:
```typescript
// cli-commands.test.ts
it('should execute status command', async () => {
  const { stdout } = await runCommand(['systemprompt', 'status']);
  expect(stdout).toContain('System Status: OK');
});

// oauth-flow.test.ts
it('should complete OAuth2 authorization flow', async () => {
  // 1. Request authorization
  // 2. User approves
  // 3. Exchange code for token
  // 4. Access protected resource
});
```

**When to Write**: For critical user journeys and complex workflows

## Testing MCP Servers

MCP (Model Context Protocol) servers require special testing considerations:

### 1. Transport Testing
```typescript
describe('MCP Transport', () => {
  it('should handle STDIO transport', async () => {
    const transport = new StdioTransport();
    await transport.send({ jsonrpc: '2.0', method: 'test' });
  });
  
  it('should handle HTTP+SSE transport', async () => {
    const transport = new HttpSseTransport();
    await transport.connect();
    // Test server-sent events
  });
});
```

### 2. Protocol Compliance
```typescript
it('should comply with JSON-RPC 2.0', async () => {
  const response = await mcp.request({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list'
  });
  expect(response).toHaveProperty('jsonrpc', '2.0');
  expect(response).toHaveProperty('id', 1);
});
```

### 3. State Management
```typescript
it('should maintain session state', async () => {
  const session1 = await mcp.initialize();
  const session2 = await mcp.initialize();
  expect(session1.id).not.toBe(session2.id);
});
```

## Testing Best Practices

### 1. Test Naming Convention
```typescript
describe('ComponentName', () => {
  describe('methodName', () => {
    it('should [expected behavior] when [condition]', () => {
      // test implementation
    });
  });
});
```

### 2. Arrange-Act-Assert Pattern
```typescript
it('should calculate total price with tax', () => {
  // Arrange
  const items = [{ price: 10 }, { price: 20 }];
  const taxRate = 0.1;
  
  // Act
  const total = calculateTotal(items, taxRate);
  
  // Assert
  expect(total).toBe(33); // 30 + 3 tax
});
```

### 3. Test Data Builders
```typescript
// tests/fixtures/builders.ts
export function buildMockUser(overrides = {}) {
  return {
    id: 'test-user-001',
    email: 'test@example.com',
    ...overrides
  };
}
```

### 4. Async Testing
```typescript
// Always use async/await for clarity
it('should fetch user data', async () => {
  const user = await fetchUser('123');
  expect(user.name).toBe('Test User');
});
```

## Running Tests

### CLI Commands
```bash
# Run all unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run all tests
npm run test:all

# Watch mode for development
npm run test -- --watch

# Run with coverage
npm run test -- --coverage
```

### CI/CD Integration
```yaml
# .github/workflows/test.yml
- name: Unit Tests
  run: npm run test:unit
  
- name: Integration Tests
  run: npm run test:integration
  
- name: E2E Tests
  run: npm run test:e2e
```

## Test Configuration

### Vitest Configurations

**Base Configuration** (`vitest.config.ts`):
```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
});
```

**Integration Configuration** (`vitest.integration.config.ts`):
```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 10000,
  },
});
```

**E2E Configuration** (`vitest.e2e.config.ts`):
```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/e2e/**/*.test.ts'],
    testTimeout: 30000,
  },
});
```

## Coverage Requirements

### Minimum Coverage Thresholds
- Overall: 80%
- Core modules: 90%
- Utility functions: 95%
- MCP protocol handlers: 85%

### Coverage Configuration
```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
```

## Mocking Strategies

### 1. Module Mocking
```typescript
vi.mock('../../src/server/config.js', () => ({
  CONFIG: {
    PORT: '3000',
    JWT_SECRET: 'test-secret',
  },
}));
```

### 2. External Service Mocking
```typescript
// Mock OAuth provider
const mockOAuthProvider = {
  authorize: vi.fn().mockResolvedValue({ code: 'mock-code' }),
  exchangeToken: vi.fn().mockResolvedValue({ 
    access_token: 'mock-token' 
  }),
};
```

### 3. Time-based Testing
```typescript
it('should expire token after timeout', () => {
  vi.useFakeTimers();
  const token = createToken();
  
  vi.advanceTimersByTime(3600000); // 1 hour
  
  expect(isTokenValid(token)).toBe(false);
  vi.useRealTimers();
});
```

## Future Considerations

### 1. Performance Testing
- Add benchmark tests for critical paths
- Monitor test execution time trends
- Set performance budgets

### 2. Snapshot Testing
- Consider for CLI output validation
- Useful for OAuth HTML responses
- Version control considerations

### 3. Property-Based Testing
- Explore fast-check for generative testing
- Particularly useful for protocol compliance
- Edge case discovery

### 4. Visual Regression Testing
- For web-based admin interfaces
- OAuth consent screens
- Error pages

## Conclusion

Our testing strategy ensures systemprompt-os maintains high quality and reliability while supporting rapid development. Vitest provides the modern, fast, and flexible foundation needed for testing an operating system for autonomous agents.

Remember: **Tests are documentation**. Write them clearly, maintain them diligently, and they will serve as the best guide to how systemprompt-os actually works.