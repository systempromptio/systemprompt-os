# E2E Tests for SystemPrompt MCP Server

This directory contains end-to-end tests for the SystemPrompt MCP Server using TypeScript and the MCP SDK.

## Directory Structure

```
e2e-test/typescript/
├── utils/                    # Test utilities and helpers
│   ├── test-utils.ts        # Common test utilities (client creation, logging, etc.)
│   └── test-reporter.ts     # Test reporting with HTML/Markdown output
├── test-prompts.ts          # Tests MCP prompt discovery and retrieval
├── test-tools.ts            # Tests the `create_task` tool functionality
├── test-resources.ts        # Tests MCP resource discovery and reading
├── test-e2e.ts              # Tests the complete flow with notifications
├── test-tunnel.ts           # Tests tunnel connectivity
├── test-all.ts              # Main test runner that executes all test suites
└── test-reports/            # Generated test reports (HTML/Markdown)

## Running Tests

### Prerequisites

1. Install dependencies:
```bash
npm install
```

2. Ensure the MCP server is running (either locally or in Docker)

### Running From Root Directory

From the project root (`/var/www/html/systemprompt-coding-agent`):

```bash
# Run all TypeScript tests
npm run test:typescript

# Run only the E2E test
npm run test:e2e

# Run tests against Docker
npm run test:docker
npm run test:docker:e2e

# Stop Docker after tests
npm run test:docker:down
```

### Running From This Directory

```bash
# Run all tests
npm test

# Run individual test suites
npm run test:prompts
npm run test:tools
npm run test:resources
npm run test:e2e
```

### Running Against Docker Container

1. Start the Docker container:
```bash
docker-compose up -d
```

2. Run tests against the container:
```bash
npm run test:docker
```

Or use the shell script:
```bash
./test-docker.sh
```

## Environment Variables

- `MCP_BASE_URL`: Base URL of the MCP server (default: `http://127.0.0.1:3000`)
- `PORT`: Port number if not using the default

## Test Output

Tests use colored console output:
- 🔍 Debug information
- ✅ Successful tests
- ❌ Failed tests
- ⚠️ Warnings
- ℹ️ Information

Each test suite provides a summary of passed/failed tests at the end.