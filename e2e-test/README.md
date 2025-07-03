# E2E Test Suite for SystemPrompt Coding Agent

Comprehensive end-to-end testing framework for the SystemPrompt Coding Agent MCP Server, validating all functionality including task orchestration, agent integration, and real-time notifications.

## Overview

This test suite provides thorough validation of the MCP server's capabilities, ensuring that all tools, resources, and integrations work correctly together. Tests are written in TypeScript and use the official MCP SDK client for authentic protocol testing.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   Test Suite    │────▶│   MCP Server    │────▶│  Host Daemon     │
│   (TypeScript)  │◀────│   (Docker)      │◀────│  (Port 9876)     │
└─────────────────┘     └─────────────────┘     └──────────────────┘
     MCP Protocol            WebSocket              TCP Socket
```

## Test Categories

### 1. **Core MCP Tests** (`test-tools.ts`)
- Tool discovery and listing
- Tool execution validation
- Error handling and edge cases
- Protocol compliance

### 2. **Task Orchestration Tests** (`test-e2e.ts`)
- Complete task lifecycle (create → monitor → complete)
- Branch-based task execution
- Real-time notifications
- Resource updates
- Agent integration

### 3. **Prompt Management Tests** (`test-prompts.ts`)
- System prompts and resource prompts
- Dynamic prompt generation
- Prompt argument handling
- Completion streaming

### 4. **Resource Tests** (`test-resources.ts`)
- Resource listing and reading
- Resource subscriptions
- Update notifications
- Resource templates

### 5. **Output Capture Tests** (`test-output-capture.ts`)
- Claude tool usage logging
- Output streaming
- Event capture
- Log persistence

### 6. **Claude Event Tests** (`test-claude-events.ts`)
- Strongly-typed event parsing
- Tool start/end events
- Process lifecycle events
- Error event handling

### 7. **Tunnel Tests** (`test-tunnel.ts`)
- Remote connectivity via Cloudflare tunnel
- HTTPS endpoint validation
- Cross-network testing

## Prerequisites

1. **Node.js 18+**: Required for TypeScript and test runner
2. **Docker**: MCP server runs in Docker container
3. **Claude CLI** (optional): For full agent testing
4. **Environment Setup**: Completed via `npm run setup`

## Installation

```bash
# From project root
npm run setup  # Sets up entire project

# Or just test dependencies
cd e2e-test
npm install
```

## Configuration

### Environment Variables

Create `.env` file in the e2e-test directory:

```env
# MCP server endpoint
MCP_BASE_URL=http://localhost:3000

# Optional: Use tunnel for remote testing
TUNNEL_URL=https://your-tunnel.trycloudflare.com

# Optional: Test timeouts
TEST_TIMEOUT=60000
TASK_TIMEOUT=300000

# Optional: Debug output
DEBUG=mcp:*
```

### Test Configuration

The test suite automatically detects:
- Local server on port 3000
- Tunnel URL from `daemon/logs/tunnel-url.txt` file
- Environment variable overrides

## Running Tests

### Quick Start

```bash
# From project root
npm test              # Run all tests
npm run test:e2e      # Run only E2E tests
npm run test:tunnel   # Run tests via tunnel
```

### Detailed Test Commands

```bash
cd e2e-test

# Run all tests
npm test

# Run specific test file
npm test test-tools.ts

# Run with debug output
DEBUG=* npm test

# Run with custom timeout
TEST_TIMEOUT=120000 npm test

# Generate test report
npm run test:report
```

### Tunnel Testing

Test against a public tunnel:

```bash
# Start tunnel and run tests
npm run test:tunnel

# Or manually with tunnel URL
MCP_BASE_URL=https://your-tunnel.trycloudflare.com npm test
```

## Test Structure

### Basic Test Pattern

```typescript
import { createMCPClient, runTest } from './utils/test-utils.js';

runTest('Tool Execution', async (client, reporter) => {
  // Create task
  const result = await client.callTool('create_task', {
    tool: 'SHELL',
    instructions: 'echo "Hello World"'
  });
  
  // Add to report
  reporter.addResult('task_creation', {
    success: true,
    taskId: result.taskId
  });
  
  // Validate result
  if (!result.taskId) {
    throw new Error('Task creation failed');
  }
});
```

### Advanced Test with Notifications

```typescript
// Set up notification handler
client.setNotificationHandler(ResourceUpdatedNotificationSchema, (notif) => {
  console.log('Resource updated:', notif.params.uri);
});

// Create task that triggers notifications
const result = await client.callTool('create_task', {
  tool: 'CLAUDECODE',
  branch: 'test-branch',
  instructions: 'Create a test file'
});

// Wait for completion
await waitForTaskCompletion(client, result.taskId);
```

## Test Reports

### HTML Reports

Beautiful HTML reports are generated after each test run:

```bash
# View latest report
open test-reports/report-*.html
```

Reports include:
- Test results summary
- Detailed logs for each test
- Performance metrics
- Error screenshots (if applicable)
- Notification timeline

### Markdown Reports

Markdown reports for documentation:

```bash
# View latest markdown report
cat test-reports/report-*.md
```

## Writing New Tests

### 1. Create Test File

```typescript
// test-feature.ts
import { runTest } from './utils/test-utils.js';

runTest('Feature Test', async (client, reporter) => {
  // Your test logic here
});
```

### 2. Use Test Utilities

```typescript
import { 
  createMCPClient,
  waitForTaskCompletion,
  validateTaskOutput,
  TestTracker
} from './utils/test-utils.js';

// Track test state
const tracker = new TestTracker('My Test');

// Wait for async operations
await waitForTaskCompletion(client, taskId, {
  timeout: 60000,
  pollInterval: 1000
});
```

### 3. Add Assertions

```typescript
// Simple assertions
if (!result.success) {
  throw new Error('Operation failed');
}

// Detailed validation
validateTaskOutput(output, {
  mustContain: ['Created file'],
  mustNotContain: ['Error', 'Failed']
});
```

## Debugging

### Enable Debug Logging

```bash
# All debug output
DEBUG=* npm test

# MCP protocol only
DEBUG=mcp:* npm test

# Test framework only
DEBUG=test:* npm test
```

### Inspect Server Logs

```bash
# View Docker logs
docker logs systemprompt-coding-agent-mcp-server-1

# View daemon logs
tail -f ../daemon/logs/host-bridge.log

# View task logs
cat ../logs/tasks/*.log
```

### Common Issues

1. **Connection Refused**
   ```bash
   # Check if server is running
   npm run status
   
   # Restart services
   npm run stop && npm run start
   ```

2. **Timeout Errors**
   ```bash
   # Increase timeout
   TEST_TIMEOUT=120000 npm test
   ```

3. **Tool Not Found**
   ```bash
   # Verify Claude is installed
   which claude
   
   # Re-run setup
   npm run setup
   ```

## CI/CD Integration

### GitHub Actions

```yaml
- name: Run E2E Tests
  run: |
    npm run start:ci
    cd e2e-test
    npm test
  env:
    MCP_BASE_URL: http://localhost:3000
```

### Docker Compose

```yaml
test:
  build: ./e2e-test
  depends_on:
    - mcp-server
  environment:
    - MCP_BASE_URL=http://mcp-server:3000
  command: npm test
```

## Performance Testing

### Load Testing

```typescript
// test-load.ts
const CONCURRENT_TASKS = 10;

const promises = Array(CONCURRENT_TASKS).fill(0).map((_, i) => 
  client.callTool('create_task', {
    tool: 'SHELL',
    instructions: `echo "Task ${i}"`
  })
);

const results = await Promise.all(promises);
```

### Benchmarking

```bash
# Run performance benchmarks
npm run test:perf
```

## Test Coverage

```bash
# Generate coverage report
npm run test:coverage

# View coverage
open coverage/index.html
```

## Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up created resources
3. **Timeouts**: Set appropriate timeouts for long operations
4. **Logging**: Use structured logging for debugging
5. **Assertions**: Be specific about expected outcomes
6. **Reporting**: Add meaningful data to test reports

## Contributing

When adding new tests:

1. Follow existing patterns
2. Add comprehensive documentation
3. Include error scenarios
4. Update this README
5. Ensure tests are idempotent
6. Add performance considerations

## Troubleshooting

### Debug Mode Checklist

1. Enable debug logging: `DEBUG=* npm test`
2. Check server status: `npm run status`
3. Verify environment: `cat .env`
4. Inspect Docker logs: `docker logs -f mcp-server`
5. Check daemon logs: `tail -f ../daemon/logs/*.log`

### Support

For issues:
1. Check test reports for detailed errors
2. Review server logs
3. Verify environment configuration
4. Consult AUTHENTICATION.md for auth issues