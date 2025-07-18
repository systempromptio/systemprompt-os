# E2E Tests

This directory contains end-to-end tests for SystemPrompt OS using a domain-based organization pattern with a shared bootstrap architecture.

## Architecture

### Bootstrap Pattern
All E2E tests run within a single Docker environment that is created once and shared across all test domains. This approach:
- Reduces test execution time by ~80% compared to per-test containers
- Ensures consistent environment across all domains
- Allows tests to build on each other's state when needed
- Simplifies debugging with persistent container logs

### Domain Organization
Tests are organized by functional domain, with numbered prefixes to control execution order:

```
00-tools-cli.e2e.test.ts        # CLI commands and tools
01-server-external.e2e.test.ts  # External API endpoints (health, status, CORS)
02-server-auth.e2e.test.ts      # Authentication and OAuth2 flows
03-server-mcp.e2e.test.ts       # MCP protocol, tools, and resources
04-modules-core.e2e.test.ts     # Core modules functionality
05-google-live-api.e2e.test.ts  # Google Live API integration with config module
```

## Key Files

- **bootstrap.ts** - Sets up and tears down the shared Docker environment
- **index.e2e.test.ts** - Main orchestrator that imports all domain tests
- **XX-domain.e2e.test.ts** - Individual domain test files
- **utils/docker-test-utils.ts** - Docker management utilities

## Running Tests

### Run all E2E tests:
```bash
npm run test:e2e
```

### Run a specific domain:
```bash
npx vitest run tests/e2e/01-server-external.e2e.test.ts
```

### Run with debugging:
```bash
npx vitest --inspect-brk tests/e2e/index.e2e.test.ts
```

## Writing New Domain Tests

### 1. Create a new domain test file
Follow the naming pattern: `XX-domain-name.e2e.test.ts`

### 2. Import it in index.e2e.test.ts
```typescript
import './05-new-domain.e2e.test';
```

### 3. Structure your tests
```typescript
import { describe, it, expect } from 'vitest';
import { execInContainer, TEST_CONFIG } from './bootstrap';
import request from 'supertest';

describe('[05] New Domain', () => {
  const baseUrl = TEST_CONFIG.baseUrl;

  describe('Feature Area', () => {
    it('should test critical functionality', async () => {
      // For HTTP requests
      const response = await request(baseUrl).get('/api/endpoint');
      expect(response.status).toBe(200);

      // For CLI commands
      const { stdout } = await execInContainer('command');
      expect(stdout).toContain('expected output');
    });
  });
});
```

### Available Utilities from bootstrap.ts
- `TEST_CONFIG` - Common configuration (baseUrl, timeouts, env vars)
- `execInContainer()` - Execute commands inside the Docker container
- `getContainerLogs()` - Retrieve container logs for debugging
- `dockerEnv` - Direct access to DockerTestEnvironment instance

## Best Practices

### 1. Domain Focus
Each domain test file should focus on a specific area of functionality. Don't mix unrelated tests.

### 2. Test Critical Paths
Focus on the most important user workflows and integration points rather than exhaustive testing.

### 3. Error Scenarios
Include tests for error handling, invalid inputs, and edge cases.

### 4. Descriptive Names
Use clear test descriptions that explain what is being tested and why.

### 5. Shared State Awareness
Tests share the same container, so:
- Don't assume a clean state between domains
- Use unique identifiers for test data
- Clean up resources that might affect other tests

### 6. Performance Considerations
- Use `execInContainer()` for multiple commands instead of multiple container starts
- Batch related assertions when possible
- Avoid unnecessary waits or sleeps

## Test Structure Examples

### HTTP API Testing
```typescript
describe('API Endpoints', () => {
  it('should return proper response', async () => {
    const response = await request(TEST_CONFIG.baseUrl)
      .post('/api/endpoint')
      .send({ data: 'value' })
      .set('Authorization', 'Bearer token');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('result');
  });
});
```

### CLI Command Testing
```typescript
describe('CLI Commands', () => {
  it('should execute command successfully', async () => {
    const { stdout, stderr } = await execInContainer('/app/bin/systemprompt status');
    expect(stderr).toBe('');
    expect(stdout).toContain('Server: Running');
  });
});
```

### MCP Protocol Testing
```typescript
describe('MCP Protocol', () => {
  it('should handle MCP requests', async () => {
    const mcpRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    };
    
    const { stdout } = await execInContainer(
      `curl -s -X POST http://localhost:3000/mcp -H "Content-Type: application/json" -d '${JSON.stringify(mcpRequest)}'`
    );
    
    const response = JSON.parse(stdout);
    expect(response.result.tools).toBeDefined();
  });
});
```

## Troubleshooting

### Docker Issues
- **Docker not running**: Ensure Docker Desktop is started
- **Port conflicts**: Check that port 3000 is not in use: `lsof -i :3000`
- **Container won't start**: Check Docker logs: `docker logs systemprompt-e2e-test`
- **Out of space**: Clean up Docker: `docker system prune -a`

### Test Failures
- **Timeout errors**: Increase timeout in TEST_CONFIG or specific test
- **Connection refused**: Wait for health check in bootstrap
- **Unexpected output**: Use `getContainerLogs()` to debug
- **State issues**: Check if previous tests are affecting current test

### Debugging Commands
```bash
# View container logs
docker logs systemprompt-e2e-test-mcp-server-1

# Enter container shell
docker exec -it systemprompt-e2e-test-mcp-server-1 /bin/sh

# Check running containers
docker ps -a | grep systemprompt

# Clean up everything
docker-compose -p systemprompt-e2e-test down -v
docker system prune -f
```

### Environment Variables
Test environment variables are defined in `TEST_CONFIG.envVars`. To add new ones:
1. Add to bootstrap.ts TEST_CONFIG
2. Ensure they're passed to DockerTestEnvironment
3. Verify in container with: `execInContainer('env | grep VAR_NAME')`

## CI/CD Integration

The E2E tests are designed to run in CI/CD pipelines:
1. Single Docker build per pipeline run
2. Sequential execution prevents flakiness
3. Automatic cleanup on success or failure
4. Clear error messages and logs for debugging

## Performance Tips

Current setup runs all E2E tests in ~2-3 minutes:
- Bootstrap: ~30 seconds (one time)
- Per domain: ~15-30 seconds
- Cleanup: ~5 seconds (one time)

To maintain performance:
- Keep domains focused and avoid redundant tests
- Use unit tests for detailed logic testing
- Only test integration points in E2E
- Reuse the shared container state when appropriate

## Google Live API Tests

The Google Live API tests (`05-google-live-api.e2e.test.ts`) verify the integration between the config module and Google GenAI SDK:

### What's Tested
- Config module provides correct Google configuration
- Default model configurations are available
- Model presets (coder, creative, analyst) are properly configured
- Google GenAI SDK can be initialized with config values
- Live API sessions can be created (when API key is provided)
- Messages can be sent and received through the SDK

### Running Google Live API Tests

```bash
# Run without API key (config tests only)
npm run test:e2e -- tests/e2e/05-google-live-api.e2e.test.ts

# Run with API key (full integration tests)
GOOGLE_AI_API_KEY=your-api-key npm run test:e2e -- tests/e2e/05-google-live-api.e2e.test.ts
```

### Manual Integration Testing

For interactive testing of the Google Live API:

```bash
# Run the integration test script
GOOGLE_AI_API_KEY=your-api-key npx tsx tests/integration/google-live-api.test.ts
```

This script will:
1. Initialize the config module with defaults
2. Retrieve Google and model configurations
3. Create a Google GenAI client
4. Test simple text generation
5. Test streaming responses
6. Test different model presets (default, coder)

### Configuration Values

The config module provides these values for Google GenAI:

```typescript
// Google client configuration (GoogleGenAIOptions)
{
  apiKey: process.env.GOOGLE_AI_API_KEY,
  vertexai: false,  // Use Gemini API by default
  // project: "...", // For Vertex AI
  // location: "..." // For Vertex AI
}

// Default model configuration
{
  model: "gemini-1.5-flash",
  generationConfig: {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 8192,
    candidateCount: 1
  },
  safetySettings: [...],
  systemInstruction: "You are a helpful AI assistant..."
}
```