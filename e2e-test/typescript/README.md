# TypeScript E2E Tests for SystemPrompt MCP Server

Modern TypeScript-based end-to-end testing framework using the official MCP SDK client for comprehensive protocol validation and integration testing.

## Overview

This directory contains the core TypeScript test implementation for the SystemPrompt MCP Server. Tests are designed to validate the complete system including MCP protocol compliance, tool execution, resource management, and real-time notifications.

## Architecture

```
┌─────────────────────┐
│   Test Runner       │
│  (test-all.ts)      │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │             │
┌───▼───┐    ┌───▼───┐
│ Tests │    │ Utils │
└───┬───┘    └───┬───┘
    │             │
┌───▼─────────────▼───┐
│   MCP SDK Client    │
└─────────┬───────────┘
          │ WebSocket
┌─────────▼───────────┐
│   MCP Server        │
└─────────────────────┘
```

## Test Suites

### 🔧 **test-tools.ts** - Tool Testing
Validates the `create_task` tool and task management:
- Task creation with different tools (SHELL, CLAUDECODE)
- Task status monitoring
- Task cancellation
- Output retrieval
- Error handling

### 📋 **test-prompts.ts** - Prompt Testing
Tests MCP prompt functionality:
- Prompt discovery via `prompts/list`
- System prompt retrieval
- Resource-based prompts
- Dynamic prompt generation
- Argument handling

### 📦 **test-resources.ts** - Resource Testing
Validates resource management:
- Resource listing
- Resource content reading
- Resource templates
- Subscription handling
- Update notifications

### 🔄 **test-e2e.ts** - End-to-End Flow
Complete integration testing:
- Full task lifecycle
- Real-time notifications
- Resource updates
- Branch-based execution
- Agent integration
- HTML/Markdown reporting

### 🌐 **test-tunnel.ts** - Tunnel Testing
Remote connectivity validation:
- Cloudflare tunnel detection
- HTTPS endpoint testing
- Cross-network validation
- Public URL accessibility

### 📊 **test-output-capture.ts** - Output Capture
Claude tool usage logging:
- Hook integration
- Output streaming
- Event capture
- Log persistence

### 🎯 **test-claude-events.ts** - Event Testing
Strongly-typed Claude event validation:
- Event parsing
- Tool start/end events
- Process lifecycle
- Error events

## Utilities

### 🛠️ **utils/test-utils.ts**
Core testing utilities:
- `createMCPClient()` - Creates configured MCP client
- `runTest()` - Test runner with error handling
- `waitForTaskCompletion()` - Async task monitoring
- `validateTaskOutput()` - Output validation
- `TestTracker` - Test state management
- Colored logging functions

### 📝 **utils/test-reporter.ts**
Advanced test reporting:
- HTML report generation
- Markdown documentation
- Performance metrics
- Notification timeline
- Error screenshots
- Test summaries

## Running Tests

### Quick Start

```bash
# From this directory
npm install
npm test
```

### Individual Test Suites

```bash
# Run specific test suite
npm run test:tools
npm run test:prompts
npm run test:resources
npm run test:e2e
npm run test:tunnel

# Run with specific MCP server
MCP_BASE_URL=http://localhost:3010 npm test
```

### Docker Testing

```bash
# Start Docker and run tests
npm run test:docker

# Run specific test against Docker
npm run test:docker:e2e

# Cleanup
npm run test:docker:down
```

### Tunnel Testing

```bash
# Auto-detect tunnel from parent directory
npm run test:tunnel

# Manual tunnel URL
MCP_BASE_URL=https://your-tunnel.trycloudflare.com npm test
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MCP_BASE_URL` | MCP server endpoint | `http://127.0.0.1:3000` |
| `PORT` | Server port override | `3000` |
| `DEBUG` | Debug output pattern | - |
| `TEST_TIMEOUT` | Test timeout (ms) | `60000` |
| `TASK_TIMEOUT` | Task timeout (ms) | `300000` |

### Test Configuration

Tests automatically detect:
1. Environment variable `MCP_BASE_URL`
2. Tunnel URL from `../../.tunnel-url`
3. Default local server

## Test Reports

### HTML Reports

Beautiful, interactive HTML reports are generated in `test-reports/`:

```bash
# View latest report
open test-reports/report-*.html
```

Features:
- Test summary dashboard
- Detailed logs per test
- Performance metrics
- Notification timeline
- Error details
- Screenshots (when applicable)

### Markdown Reports

Documentation-friendly reports:

```bash
# View latest markdown
cat test-reports/report-*.md
```

## Writing Tests

### Basic Test Pattern

```typescript
import { runTest } from './utils/test-utils.js';

runTest('My Test', async (client, reporter) => {
  // Your test logic
  const result = await client.callTool('create_task', {
    tool: 'SHELL',
    instructions: 'echo "Hello"'
  });
  
  // Add to report
  reporter.addResult('task_created', {
    success: true,
    taskId: result.taskId
  });
  
  // Validate
  if (!result.taskId) {
    throw new Error('No task ID returned');
  }
});
```

### Advanced Test with Notifications

```typescript
import { 
  createMCPClient, 
  waitForTaskCompletion 
} from './utils/test-utils.js';
import { 
  ResourceUpdatedNotificationSchema 
} from '@modelcontextprotocol/sdk/types.js';

const client = await createMCPClient();

// Set up notification handler
client.setNotificationHandler(
  ResourceUpdatedNotificationSchema, 
  (notification) => {
    console.log('Resource updated:', notification);
  }
);

// Execute test
const result = await client.callTool('create_task', {
  tool: 'CLAUDECODE',
  branch: 'test-branch',
  instructions: 'Create README.md'
});

// Wait for completion with notifications
await waitForTaskCompletion(client, result.taskId);
```

## Debugging

### Enable Debug Output

```bash
# All debug output
DEBUG=* npm test

# MCP protocol only
DEBUG=mcp:* npm test

# Test framework only
DEBUG=test:* npm test
```

### Common Issues

1. **Connection Failed**
   - Check server is running: `npm run status`
   - Verify URL: `echo $MCP_BASE_URL`
   - Check firewall/ports

2. **Timeout Errors**
   - Increase timeout: `TEST_TIMEOUT=120000 npm test`
   - Check server logs
   - Verify Claude is installed

3. **Tool Not Found**
   - Run setup: `npm run setup`
   - Check daemon status
   - Verify tool paths

## Best Practices

1. **Use Test Utilities**: Leverage provided helpers for consistency
2. **Add to Reporter**: Include all significant events in reports
3. **Handle Timeouts**: Set appropriate timeouts for long operations
4. **Clean Up**: Ensure tests clean up created resources
5. **Validate Thoroughly**: Check both success and error cases
6. **Document Well**: Add clear descriptions to tests

## Contributing

When adding tests:

1. Follow existing patterns
2. Use TypeScript strictly
3. Add comprehensive error handling
4. Update test documentation
5. Ensure tests are deterministic
6. Add performance considerations

## Performance

### Benchmarking

```bash
# Run performance tests
npm run test:perf
```

### Load Testing

See `test-load.ts` for concurrent task testing patterns.

## CI/CD Integration

Tests are designed for CI/CD:
- Exit codes indicate success/failure
- JSON output available for parsing
- Docker-friendly execution
- Configurable timeouts
- Detailed error reporting