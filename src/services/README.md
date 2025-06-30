# Services

This directory contains the core service implementations for the SystemPrompt Coding Agent.

## Overview

Services manage the core functionality of the coding agent orchestrator:
- Agent lifecycle management
- Task execution and tracking
- State persistence
- Process communication

## Service Architecture

### Agent Services

#### `agent-manager/`
Central manager for all coding agents:
- Manages Claude Code sessions via abstraction layer
- Handles agent allocation for tasks
- Monitors agent health and availability
- Provides failover and retry logic
- Implements agent interface for future multi-agent support

#### `claude-code/`
Claude Code CLI integration:
- Spawns and manages Claude Code processes
- Handles command execution via SDK or host proxy
- Parses Claude Code output with progress tracking
- Manages Claude-specific configurations
- Provides session management and query execution

### Task Management


#### `task-store.ts`
In-memory task storage with type safety:
- Stores active tasks with full persistence
- Provides typed task queries and filters
- Manages task state transitions
- Emits typed events for task lifecycle
- Integrates with MCP notifications

### State Management

#### `state-persistence.ts`
Persistent state management:
- Saves task state to disk
- Restores state on restart
- Handles state migrations

## Service Patterns

### Agent Lifecycle
```typescript
1. Agent requested for task
2. AgentManager allocates available agent
3. Agent executes task
4. Agent reports completion
5. Agent returned to pool
```

### Task Execution Flow
```typescript
1. Task created via MCP tool
2. TaskManager assigns to agent
3. Agent executes task
4. Progress reported via notifications
5. Results stored in TaskStore
6. State persisted to disk
```

## Error Handling

Services implement robust error handling:
- Process failures trigger automatic retry
- Failed agents are restarted
- Tasks can be reassigned to healthy agents
- All errors logged with context

## Adding New Services

To add a new service:

1. Create service class in this directory
2. Implement standard lifecycle methods
3. Add to dependency injection
4. Document service patterns
5. Add appropriate tests

## Service Configuration

Services can be configured via environment variables:
- `MAX_CONCURRENT_AGENTS` - Maximum agents to run
- `TASK_TIMEOUT` - Default task timeout
- `STATE_PERSIST_INTERVAL` - State save frequency

## Monitoring

Services expose metrics for monitoring:
- Active agent count
- Task queue length
- Success/failure rates
- Average task duration

## Testing Services

When testing services:
- Mock external processes
- Test error scenarios
- Verify state persistence
- Check resource cleanup
- Monitor memory usage