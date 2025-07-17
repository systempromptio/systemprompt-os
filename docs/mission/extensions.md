# Extension Development Methodology for systemprompt-os

## Overview

This document defines the **mandatory development methodology** for extending systemprompt-os. All new features, modifications, and extensions MUST follow this test-driven approach to ensure system reliability and maintainability.

## Core Principle: Test-First Development

**No code shall be written without tests that define its behavior.**

## The Extension Methodology

### Phase 1: Define Tests Before Implementation

When tasked with implementing a new feature, an LLM (or human developer) MUST:

1. **Write Unit Tests First**
   - Define the expected behavior of individual components
   - Mock all external dependencies
   - Tests must be comprehensive and cover edge cases

2. **Write Integration Tests**
   - Define how components interact
   - Test database connections, API calls, MCP protocol handling
   - Ensure components work together correctly

3. **Write E2E Tests**
   - Define the complete user workflow
   - Test from the user's perspective (CLI commands, OAuth flows, etc.)
   - Include timing-sensitive operations

### Phase 2: Validate Tests in Clean Environment

Before ANY implementation, use the standardized npm scripts:

1. **Clean Your Environment**
   ```bash
   npm run clean:all
   npm install
   ```

2. **Run Tests in Clean Docker**
   ```bash
   npm run docker:clean
   ```
   - This builds a fresh Docker container with only test files
   - ALL tests should fail with clear error messages
   - Error messages should indicate what needs to be implemented

### Phase 3: Implement to Pass Tests

1. **Write Minimal Code**
   - Implement ONLY what's needed to pass the tests
   - No extra features or "nice-to-haves"
   - Follow existing code patterns

2. **Run Tests Continuously**
   ```bash
   npm run test:watch    # Watch mode for rapid feedback
   npm run test:unit     # Run unit tests only
   npm run test:all      # Run all test suites
   ```

3. **Build and Validate**
   ```bash
   npm run build         # Compile TypeScript
   npm run validate      # Build and run all tests
   ```

### Phase 4: Validate in Clean Docker

Use the standardized validation process:

1. **Run Complete Validation**
   ```bash
   npm run validate:docker
   ```
   This command:
   - Builds a clean test Docker image
   - Runs all tests in the clean environment
   - Builds the production Docker image
   - Validates tests pass in production image

2. **Or Run Individual Docker Commands**
   ```bash
   npm run docker:build  # Build production image
   npm run docker:test   # Run tests in Docker
   npm run docker:run    # Start container
   npm run docker:stop   # Stop and remove container
   ```

## Architecture Requirement

**EVERY feature MUST be part of the architecture.** Before implementing any functionality:

1. **Identify Module Type**:
   - Is it a long-running process? → **Daemon Module**
   - Does it provide core functionality? → **Service Module**  
   - Does it extend capabilities? → **Plugin Module**

2. **Update Architecture**:
   - Add your module to `/ARCHITECTURE.md`
   - Place in `modules/core/` if essential to system
   - Place in `modules/custom/` if optional extension

3. **Create Module Structure**:
   ```
   modules/core/your-module/
   ├── module.yaml    # Module configuration
   ├── index.ts       # Module implementation
   ├── types.ts       # TypeScript types
   ├── cli/           # CLI commands (optional)
   │   ├── status.ts  # your-module:status command
   │   └── reset.ts   # your-module:reset command
   ├── tests/         # Module tests
   │   ├── unit/
   │   ├── integration/
   │   └── e2e/
   └── README.md      # Module documentation
   ```

## Example: Adding a New Module (Heartbeat)

### Step 1: Create Module Structure and Define Tests

First, create the module directory structure:

```
modules/core/heartbeat/
├── module.yaml           # Module configuration
├── tests/
│   ├── unit/            # Unit tests
│   │   └── heartbeat.test.ts
│   ├── integration/     # Integration tests
│   │   └── heartbeat-integration.test.ts
│   └── e2e/            # End-to-end tests
│       └── heartbeat-e2e.test.ts
├── index.ts             # Module implementation
├── types.ts             # TypeScript types
└── README.md            # Module documentation
```

### Step 2: Define Module Configuration

```yaml
# modules/core/heartbeat/module.yaml
name: heartbeat
type: daemon
version: 1.0.0
description: System health monitoring daemon
author: systemprompt-os
config:
  interval: 30s
  outputPath: ./state/heartbeat.json
  autoStart: true
dependencies: []
```

### Step 3: Write Tests Before Implementation

#### Unit Tests
```typescript
// modules/core/heartbeat/tests/unit/heartbeat.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('Memory Store Tool', () => {
  it('should store memory with metadata', async () => {
    const tool = new MemoryStoreTool();
    const result = await tool.execute({
      content: 'User prefers dark mode',
      tags: ['preferences', 'ui'],
      ttl: 86400
    });
    
    expect(result.success).toBe(true);
    expect(result.id).toMatch(/^mem_[a-z0-9]{16}$/);
    expect(result.expiresAt).toBeInstanceOf(Date);
  });

  it('should validate required fields', async () => {
    const tool = new MemoryStoreTool();
    
    await expect(tool.execute({})).rejects.toThrow('content is required');
  });

  it('should enforce maximum content length', async () => {
    const tool = new MemoryStoreTool();
    const longContent = 'x'.repeat(10001);
    
    await expect(tool.execute({ content: longContent }))
      .rejects.toThrow('content exceeds maximum length');
  });
});
```

### Step 2: Define Integration Tests

```typescript
// tests/integration/mcp-tools/memory-integration.test.ts
describe('Memory Tool Integration', () => {
  let server: MCPServer;
  let memoryProvider: MemoryProvider;

  beforeEach(() => {
    memoryProvider = new InMemoryProvider();
    server = new MCPServer({ memoryProvider });
  });

  it('should register memory tools with MCP server', () => {
    const tools = server.getTools();
    const memoryTools = tools.filter(t => t.name.startsWith('memory_'));
    
    expect(memoryTools).toHaveLength(5);
    expect(memoryTools.map(t => t.name)).toContain('memory_store');
  });

  it('should execute memory store through MCP protocol', async () => {
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'memory_store',
        arguments: {
          content: 'Test memory',
          tags: ['test']
        }
      }
    };

    const response = await server.handleRequest(request);
    
    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe(1);
    expect(response.result.success).toBe(true);
  });
});
```

### Step 3: Define E2E Tests

```typescript
// tests/e2e/memory-workflow.test.ts
describe('Memory Storage E2E Workflow', () => {
  it('should complete full memory lifecycle', async () => {
    // 1. Start server
    const server = await startTestServer();
    
    // 2. Store memory via MCP
    const storeResponse = await mcpClient.callTool('memory_store', {
      content: 'User email: test@example.com',
      tags: ['user-data', 'email']
    });
    
    expect(storeResponse.success).toBe(true);
    const memoryId = storeResponse.id;
    
    // 3. Retrieve memory
    const retrieveResponse = await mcpClient.callTool('memory_retrieve', {
      id: memoryId
    });
    
    expect(retrieveResponse.content).toBe('User email: test@example.com');
    expect(retrieveResponse.tags).toContain('email');
    
    // 4. Search memories
    const searchResponse = await mcpClient.callTool('memory_search', {
      query: 'email',
      tags: ['user-data']
    });
    
    expect(searchResponse.results).toHaveLength(1);
    expect(searchResponse.results[0].id).toBe(memoryId);
    
    // 5. Delete memory
    const deleteResponse = await mcpClient.callTool('memory_delete', {
      id: memoryId
    });
    
    expect(deleteResponse.success).toBe(true);
    
    // 6. Verify deletion
    await expect(mcpClient.callTool('memory_retrieve', { id: memoryId }))
      .rejects.toThrow('Memory not found');
  });
});
```

### Step 4: Create Docker Test Environment

```dockerfile
# Dockerfile.test
FROM node:20-alpine

# Install dependencies for testing
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy only necessary files for testing
COPY package*.json ./
COPY tsconfig.json ./
COPY vitest*.config.ts ./
COPY tests/ ./tests/

# Install dependencies
RUN npm ci

# Run tests (should fail)
CMD ["npm", "run", "test:all"]
```

### Step 5: Implement Until Tests Pass

Only NOW do we implement the actual feature:

```typescript
// src/mcp/tools/memory-store.ts
export class MemoryStoreTool implements MCPTool {
  name = 'memory_store';
  description = 'Store information in persistent memory';
  
  async execute(args: MemoryStoreArgs): Promise<MemoryStoreResult> {
    // Implementation that satisfies ALL tests
  }
}
```

## Standardized NPM Scripts

systemprompt-os provides a comprehensive set of npm scripts for consistent development:

### Core Commands
```bash
npm start          # Start the production server
npm stop           # Stop the running server
npm restart        # Stop and restart the server
npm run dev        # Start development server with hot reload
```

### Build & Clean
```bash
npm run build      # Compile TypeScript to JavaScript
npm run clean      # Remove build artifacts and dependencies
npm run clean:all  # Deep clean including package-lock.json
```

### Testing
```bash
npm test                    # Run tests in watch mode
npm run test:unit          # Run unit tests once
npm run test:integration   # Run integration tests
npm run test:e2e          # Run end-to-end tests
npm run test:all          # Run all test suites
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Run tests with coverage report
```

### Docker Operations
```bash
npm run docker:build      # Build production Docker image
npm run docker:clean      # Test in clean Docker environment
npm run docker:test       # Run tests in Docker
npm run docker:run        # Start Docker container
npm run docker:stop       # Stop and remove container
```

### Validation
```bash
npm run validate          # Build and test locally
npm run validate:docker   # Complete Docker validation
```

### Using the Validation Script

For comprehensive validation, use the included script:

```bash
./scripts/validate-extension.sh
```

This script:
1. Cleans previous Docker images
2. Builds and tests in clean environment
3. Builds production image
4. Validates all tests pass
5. Tests application startup
6. Verifies health endpoint

## Common Patterns

### Testing Async Operations

```typescript
it('should handle async memory operations', async () => {
  const results = await Promise.all([
    memoryTool.store({ content: 'Memory 1' }),
    memoryTool.store({ content: 'Memory 2' }),
    memoryTool.store({ content: 'Memory 3' })
  ]);
  
  expect(results).toHaveLength(3);
  expect(new Set(results.map(r => r.id)).size).toBe(3); // All unique IDs
});
```

### Testing Error Conditions

```typescript
it('should handle provider failures gracefully', async () => {
  const failingProvider = {
    store: vi.fn().mockRejectedValue(new Error('Database unavailable'))
  };
  
  const tool = new MemoryStoreTool(failingProvider);
  
  const result = await tool.execute({ content: 'Test' });
  
  expect(result.success).toBe(false);
  expect(result.error).toBe('Failed to store memory: Database unavailable');
});
```

### Testing State Changes

```typescript
it('should update memory state correctly', async () => {
  const memory = await memoryTool.store({ content: 'Initial' });
  
  // Verify initial state
  let current = await memoryTool.retrieve(memory.id);
  expect(current.content).toBe('Initial');
  expect(current.version).toBe(1);
  
  // Update memory
  await memoryTool.update(memory.id, { content: 'Updated' });
  
  // Verify updated state
  current = await memoryTool.retrieve(memory.id);
  expect(current.content).toBe('Updated');
  expect(current.version).toBe(2);
});
```

## Enforcement

### Automated Checks

1. **Pre-commit Hook**
   ```bash
   #!/bin/bash
   # .git/hooks/pre-commit
   npm run test:unit || exit 1
   ```

2. **CI/CD Pipeline**
   ```yaml
   - name: Validate in Docker
     run: ./scripts/validate-extension.sh
   ```

3. **PR Requirements**
   - All tests must pass in Docker
   - Test coverage must not decrease
   - Performance benchmarks must be maintained

## Benefits of This Methodology

1. **Reliability**: Features work as specified
2. **Maintainability**: Tests document behavior
3. **Confidence**: Changes don't break existing features
4. **Consistency**: All code follows same patterns
5. **Quality**: Bugs caught before deployment

## Adding CLI Commands to Modules

Modules can provide their own CLI commands that are automatically discovered and registered by the main CLI.

### CLI Command Structure

```typescript
// modules/core/heartbeat/cli/status.ts
import { Command } from '../../../interfaces/cli.js';
import { HeartbeatModule } from '../index.js';

export const statusCommand: Command = {
  name: 'status',
  description: 'Show current heartbeat status',
  options: [
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format (json, table)',
      default: 'table'
    }
  ],
  async execute(args, context) {
    const heartbeat = context.registry.get('heartbeat') as HeartbeatModule;
    const status = heartbeat.generateStatus();
    
    if (args.format === 'json') {
      console.log(JSON.stringify(status, null, 2));
    } else {
      console.table(status);
    }
  }
};
```

### Module Configuration

Add CLI commands to your module.yaml:

```yaml
name: heartbeat
type: daemon
version: 1.0.0
cli:
  commands:
    - name: status
      description: Show heartbeat status
    - name: reset
      description: Reset heartbeat state
```

### Command Naming

Commands are automatically namespaced by module name:
- Module: `heartbeat` → Commands: `heartbeat:status`, `heartbeat:reset`
- Module: `oauth2` → Commands: `oauth2:token`, `oauth2:authorize`

### Testing CLI Commands

```typescript
// modules/core/heartbeat/tests/unit/cli-status.test.ts
import { describe, it, expect } from 'vitest';
import { statusCommand } from '../../cli/status.js';

describe('Heartbeat CLI Status Command', () => {
  it('should output JSON format', async () => {
    const mockContext = {
      registry: {
        get: () => ({
          generateStatus: () => ({ status: 'healthy' })
        })
      }
    };
    
    const consoleSpy = vi.spyOn(console, 'log');
    await statusCommand.execute({ format: 'json' }, mockContext);
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('"status": "healthy"')
    );
  });
});
```

## Conclusion

This test-first methodology is **non-negotiable** for systemprompt-os development. By defining behavior through tests before implementation, we ensure that:

1. Features work correctly in isolation (unit tests)
2. Components integrate properly (integration tests)
3. Users can complete their workflows (E2E tests)
4. Everything works in a clean environment (Docker validation)

Remember: **If it's not tested, it's broken.**