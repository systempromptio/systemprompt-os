# Agents Module

The Agents module provides a comprehensive system for managing autonomous agents that can execute tasks, monitor systems, and perform scheduled operations.

## Features

- **Agent Lifecycle Management**: Create, start, stop, and delete agents
- **Task Assignment**: Assign tasks to agents with priority levels
- **Monitoring**: Real-time agent health monitoring and heartbeat tracking
- **Logging**: Comprehensive logging for all agent activities
- **Configuration**: Dynamic agent configuration management
- **Task Execution**: Automatic task processing with retry mechanisms

## Agent Types

- `worker`: General-purpose task execution agents
- `scheduler`: Agents that handle scheduled tasks
- `monitor`: System monitoring agents
- `custom`: Custom agent types for specific use cases

## CLI Commands

### List Agents
```bash
systemprompt agents:list [--status <status>] [--format <format>]
```

### Create Agent
```bash
systemprompt agents:create --name <name> --type <type> [--config <json>]
```

### Start Agent
```bash
systemprompt agents:start --id <agent-id>
```

### Stop Agent
```bash
systemprompt agents:stop --id <agent-id> [--force]
```

### Get Agent Status
```bash
systemprompt agents:status --id <agent-id>
```

### View Agent Logs
```bash
systemprompt agents:logs --id <agent-id> [--lines <n>] [--follow]
```

### Configure Agent
```bash
systemprompt agents:config --id <agent-id> --key <key> --value <value>
```

### Assign Task
```bash
systemprompt agents:assign --agent <agent-id> --task <task-name> [--priority <priority>]
```

## API Usage

```typescript
// Get the agent service
const agentsModule = registry.getModule('agents');
const agentService = agentsModule.exports.AgentService;

// Create an agent
const agent = await agentService.createAgent({
  name: 'my-worker',
  type: 'worker',
  config: { maxConcurrentTasks: 5 }
});

// Start the agent
await agentService.startAgent(agent.id);

// Assign a task
const task = await agentService.assignTask({
  agent_id: agent.id,
  name: 'process-data',
  priority: 'high',
  payload: { data: 'example' }
});

// Get agent status
const status = await agentService.getAgent(agent.id);
```

## Configuration

The module can be configured through the module.yaml file:

```yaml
config:
  maxAgents: 100           # Maximum number of agents
  defaultTimeout: 300000   # Default task timeout (5 minutes)
  monitoringInterval: 5000 # Health check interval (5 seconds)
  retryAttempts: 3        # Number of retry attempts for failed tasks
  retryDelay: 1000        # Delay between retries (1 second)
```

## Events

The AgentService emits the following events:

- `agent-event`: Fired for all agent-related events
  - `created`: Agent created
  - `started`: Agent started
  - `stopped`: Agent stopped
  - `task_assigned`: Task assigned to agent
  - `task_completed`: Task completed successfully
  - `task_failed`: Task failed
  - `error`: Agent error occurred
  - `heartbeat`: Agent heartbeat

## Database Schema

The module uses the following tables:

- `agents`: Stores agent information
- `agent_tasks`: Stores task assignments and results
- `agent_logs`: Stores agent activity logs
- `agent_metrics`: Stores performance metrics

## Health Monitoring

The module provides health checks that verify:

- Database connectivity
- Service availability
- Active agent monitoring status

## Error Handling

The module implements comprehensive error handling:

- Task timeouts with automatic failure marking
- Retry mechanisms for failed tasks
- Graceful agent shutdown with task protection
- Transaction rollback on database errors

## Security Considerations

- Agents run in isolated contexts
- Task payloads are validated
- Configuration changes are logged
- Access control through auth module integration