# Testing Framework

## Overview

The SystemPrompt Coding Agent includes a comprehensive End-to-End (E2E) testing framework built specifically for testing MCP (Model Context Protocol) servers. The framework validates the complete flow of AI agent orchestration, from task creation through completion.

## Architecture

```
Test Runner
    │
    ├── MCP Client
    │   ├── HTTP Transport
    │   └── Notification Handlers
    │
    ├── Test Reporter
    │   ├── HTML Reports
    │   └── Markdown Reports
    │
    └── Test Utils
        ├── Environment Detection
        ├── Logging
        └── Assertions
```

## Core Components

### 1. **Test Runner**
Main test orchestration and execution.

**Features:**
- Sequential test execution
- Error handling and recovery
- Timeout management
- Result aggregation

### 2. **MCP Client Integration**
Full MCP protocol client for testing.

**Capabilities:**
- Tool invocation
- Resource reading
- Notification handling
- Progress tracking

### 3. **Test Reporter**
Comprehensive test reporting system.

**Output Formats:**
- **HTML Reports** - Interactive, styled reports
- **Markdown Reports** - Git-friendly text reports
- **Console Output** - Real-time test progress

### 4. **Test Utilities**
Helper functions and common patterns.

**Includes:**
- Environment configuration
- URL detection (local/tunnel)
- Assertion helpers
- Timing utilities

## Test Structure

### Basic Test Pattern

```typescript
async function testCreateTaskFlow(
  client: Client, 
  reporter: TestReporter
): Promise<void> {
  // 1. Setup
  const timestamp = Date.now();
  const branchName = `e2e-test-${timestamp}`;
  
  // 2. Execute
  const result = await client.callTool({
    name: 'create_task',
    arguments: {
      tool: 'CLAUDECODE',
      branch: branchName,
      instructions: 'Create hello.html'
    }
  });
  
  // 3. Verify
  if (result.content?.[0]?.text?.includes('created')) {
    reporter.addSuccess('Task created successfully');
  } else {
    reporter.addError('Task creation failed');
  }
  
  // 4. Cleanup
  await client.callTool({
    name: 'end_task',
    arguments: { task_id: taskId }
  });
}
```

### Notification Handling

```typescript
// Set up notification handlers
client.setNotificationHandler(
  ResourceUpdatedNotificationSchema,
  async (notification) => {
    const { uri } = notification.params;
    
    // React to task updates
    if (uri.startsWith('task://')) {
      const resource = await client.readResource({ uri });
      const task = JSON.parse(resource.contents[0].text);
      
      // Track progress
      reporter.addLog(
        taskId,
        `Status: ${task.status}, Progress: ${task.progress}%`
      );
    }
  }
);
```

## Running Tests

### Local Testing

```bash
# Run against local server
npm run test:e2e
```

### Tunnel Testing

```bash
# Terminal 1: Start server with tunnel
npm run tunnel

# Terminal 2: Run tests against tunnel
npm run test:tunnel
```

### Environment Variables

```bash
# .env configuration
MCP_BASE_URL=http://localhost:3000  # Override base URL
TUNNEL_MODE=true                     # Enable tunnel detection
TEST_TIMEOUT=120000                  # Test timeout (ms)
```

## Test Reports

### HTML Report Features

- **Summary Dashboard** - Pass/fail statistics
- **Timeline View** - Execution timeline
- **Detailed Logs** - Step-by-step execution
- **Notification History** - All MCP notifications
- **Error Details** - Stack traces and context

### Report Location

```
e2e-test/typescript/test-reports/
├── report-2024-12-20T10-30-45.html
├── report-2024-12-20T10-30-45.md
└── latest.html -> report-2024-12-20T10-30-45.html
```

## Writing New Tests

### 1. Create Test Function

```typescript
async function testNewFeature(
  client: Client,
  reporter: TestReporter
): Promise<void> {
  const test = reporter.startTest('New Feature Test');
  
  try {
    // Your test logic here
    test.pass('Feature works correctly');
  } catch (error) {
    test.fail(`Feature failed: ${error.message}`);
    throw error;
  }
}
```

### 2. Add to Test Suite

```typescript
// In test-e2e.ts
const tests = [
  testCreateTaskFlow,
  testNewFeature,  // Add your test
  // ... other tests
];
```

### 3. Use Test Utilities

```typescript
import { 
  createMCPClient, 
  log, 
  sleep,
  waitForCondition 
} from './utils/test-utils.js';

// Wait for task completion
await waitForCondition(
  async () => {
    const task = await getTask(taskId);
    return task.status === 'completed';
  },
  { timeout: 60000, interval: 2000 }
);
```

## Best Practices

### 1. **Test Isolation**
- Use unique branch names with timestamps
- Clean up resources after tests
- Don't depend on previous test state

### 2. **Timeout Management**
- Set appropriate timeouts for AI operations
- Use shorter timeouts for quick operations
- Implement retry logic for flaky operations

### 3. **Assertion Strategy**
- Verify both success responses and side effects
- Check resource states match expectations
- Validate notification sequences

### 4. **Error Handling**
- Catch and report all errors
- Include context in error messages
- Clean up even on failure

### 5. **Reporting**
- Log all significant events
- Include timing information
- Capture notification data

## Common Test Scenarios

### 1. Task Creation and Completion

```typescript
// Create task
const createResult = await client.callTool({
  name: 'create_task',
  arguments: {
    tool: 'CLAUDECODE',
    instructions: 'Implement authentication'
  }
});

// Wait for completion
await waitForTaskCompletion(client, taskId);

// Verify results
const task = await client.readResource({
  uri: `task://${taskId}`
});
```

### 2. Progress Monitoring

```typescript
// Track progress updates
const progressUpdates: number[] = [];

client.setNotificationHandler(
  ResourceUpdatedNotificationSchema,
  (notif) => {
    if (notif.params.uri === `task://${taskId}`) {
      const task = JSON.parse(/* ... */);
      progressUpdates.push(task.progress);
    }
  }
);

// Verify progress increments
expect(progressUpdates).toEqual([0, 25, 50, 75, 100]);
```

### 3. Error Scenarios

```typescript
// Test invalid inputs
const errorResult = await client.callTool({
  name: 'create_task',
  arguments: {
    tool: 'INVALID_TOOL',
    instructions: 'Test error'
  }
});

expect(errorResult.isError).toBe(true);
expect(errorResult.content[0].text).toContain('error');
```

## Debugging Tests

### Enable Verbose Logging

```typescript
// Set debug level
process.env.LOG_LEVEL = 'debug';

// Add custom logging
log.debug('Task state:', taskState);
log.info('Notification received:', notification);
```

### Inspect MCP Traffic

```typescript
// Log all MCP requests/responses
client.on('request', (req) => {
  console.log('MCP Request:', JSON.stringify(req, null, 2));
});

client.on('response', (res) => {
  console.log('MCP Response:', JSON.stringify(res, null, 2));
});
```

### Save Test Artifacts

```typescript
// Save task details for debugging
const taskDetails = await client.readResource({
  uri: `task://${taskId}`
});

fs.writeFileSync(
  `test-artifacts/task-${taskId}.json`,
  taskDetails.contents[0].text
);
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Start server
        run: |
          docker-compose up -d
          npm run wait-for-ready
      
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      
      - name: Upload reports
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-reports
          path: e2e-test/typescript/test-reports/
```

## Performance Testing

### Measure Operation Times

```typescript
const timer = reporter.startTimer('Task Creation');
const result = await client.callTool({
  name: 'create_task',
  arguments: { /* ... */ }
});
timer.end();

reporter.addMetric('task_creation_time', timer.duration);
```

### Load Testing

```typescript
// Parallel task creation
const tasks = await Promise.all(
  Array(10).fill(0).map((_, i) => 
    client.callTool({
      name: 'create_task',
      arguments: {
        branch: `load-test-${i}`,
        instructions: 'Simple task'
      }
    })
  )
);

// Measure throughput
reporter.addMetric('tasks_per_second', 10 / elapsedSeconds);
```