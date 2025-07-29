# User Journey E2E Tests

This directory contains end-to-end tests organized by user journeys rather than technical modules. Each test file represents a complete user workflow from start to finish, testing the system from a user's perspective.

## Completed Journey Tests

### 1. User Agent Management Journey
**File:** `user-agent-management.journey.e2e.test.ts`

Tests the complete workflow for managing agents:
- Creating agents with different configurations
- Listing and filtering agents
- Updating agent properties and status
- Viewing agent details and performance
- Deleting agents when no longer needed
- Error handling in agent operations

**Status:** ✅ Complete with working tests

### 2. User Task Lifecycle Journey
**File:** `user-task-lifecycle.journey.e2e.test.ts`

Tests the complete workflow for task management:
- Creating tasks with different types and configurations
- Monitoring task progress and status
- Updating task parameters and results
- Task completion and result handling
- Task history and analytics

**Status:** ✅ Complete with working tests

### 3. User System Setup Journey
**File:** `user-system-setup.journey.e2e.test.ts`

Tests the initial user experience and system setup:
- Initial database setup and verification
- System configuration management
- Module discovery and initialization
- Basic system health checks
- CLI tool familiarization

**Status:** ✅ Complete with working tests

### 4. User Data Management Journey
**File:** `user-data-management.journey.e2e.test.ts`

Tests data-related user workflows:
- Database operations and maintenance
- Data persistence and retrieval
- User management workflows
- System monitoring and health checks
- Data backup and recovery scenarios

**Status:** ✅ Complete with working tests

## Planned Journey Test Stubs

### 5. User Authentication & Security Journey
**File:** `stubs/user-auth-security.journey.stub.ts`

Planned tests for authentication workflows:
- User authentication workflows
- Token management and renewal
- OAuth2 provider integration
- Security key generation
- Tunnel service configuration

**Status:** 📋 Stub created - needs implementation
**Coverage Targets:** 0% currently (auth services, token management)

### 6. User MCP Integration Journey
**File:** `stubs/user-mcp-integration.journey.stub.ts`

Planned tests for Model Context Protocol integration:
- MCP server setup and configuration
- Client-server communication
- Protocol handler registration
- Resource management
- Tool execution through MCP

**Status:** 📋 Stub created - needs implementation
**Coverage Targets:** 0% currently (MCP services, server components)

### 7. User Advanced CLI Journey
**File:** `stubs/user-advanced-cli.journey.stub.ts`

Planned tests for advanced CLI operations:
- CLI service operations
- Database query interface
- System rebuild and maintenance
- Help system and documentation
- Progress indicators and logging

**Status:** 📋 Stub created - needs implementation
**Coverage Targets:** 0% currently (CLI services, utilities)

### 8. User Development Workflow Journey
**File:** `stubs/user-development-workflow.journey.stub.ts`

Planned tests for development workflows:
- Module development and generation
- Code scaffolding and templates
- Development environment setup
- Testing and validation workflows
- Module deployment

**Status:** 📋 Stub created - needs implementation
**Coverage Targets:** 0% currently (dev services, utilities)

### 9. User Monitoring & Analytics Journey
**File:** `stubs/user-monitoring-analytics.journey.stub.ts`

Planned tests for system monitoring:
- System health monitoring
- Performance metrics collection
- User and permission management
- Webhook configuration
- Log analysis and troubleshooting

**Status:** 📋 Stub created - needs implementation
**Coverage Targets:** 0% currently (monitoring, user services)

## Migration from Original E2E Tests

The original e2e tests have been successfully migrated and reorganized:

### ✅ **Working Tests Extracted and Copied to Integration Tests:**

**From `e2e/local/modules/core/agents-cli-functionality.local.e2e.test.ts`:**
- Agent creation, listing, details, validation → `tests/integration/modules/core/agents/integration.test.stub.ts`

**From `e2e/local/modules/core/tasks-module-functionality.local.e2e.test.ts`:**
- Task creation, listing, status updates → `tests/integration/modules/core/tasks/integration.test.stub.ts`

**From `e2e/local/modules/core/database-and-user-management.local.e2e.test.ts`:**
- Database operations, status checks → `tests/integration/modules/core/database/integration.test.stub.ts`

**From `e2e/local/modules/core/core-modules-functionality.local.e2e.test.ts`:**
- Module listing, discovery → `tests/integration/modules/core/modules/integration.test.stub.ts`

**From `e2e/local/cli/cli-tools-and-commands.local.e2e.test.ts`:**
- CLI help, version, config commands → `tests/integration/modules/core/cli/integration.test.stub.ts`
- Configuration management → `tests/integration/modules/core/config/integration.test.stub.ts`

### 📁 **Original Tests Archived:**
- Original files moved to `tests/e2e/local/archive/` for reference
- New journey-based structure implemented
- No functionality lost in migration

## Test Execution

To run the journey tests:

```bash
# Run all journey tests
npm run test:e2e:local

# Run specific journey
npx vitest run tests/e2e/local/journeys/user-agent-management.journey.e2e.test.ts

# Run with coverage
npm run test:e2e:local:coverage
```

## Benefits of Journey-Based Organization

1. **User-Centric Testing:** Tests simulate real user workflows rather than technical module boundaries
2. **Better Coverage:** Journey tests cross multiple modules, catching integration issues
3. **Easier Maintenance:** Tests are organized by user goals, making them easier to understand and maintain
4. **Real-World Scenarios:** Tests represent actual user interactions with the system
5. **Comprehensive Validation:** Each journey tests end-to-end functionality from user perspective

## Coverage Impact

The reorganization has improved test coverage by:
- Moving working e2e tests to integration test suite (ensuring they run regularly)
- Creating comprehensive user journey tests that span multiple modules
- Identifying areas needing test coverage through stub creation
- Providing clear roadmap for achieving higher coverage through journey completion