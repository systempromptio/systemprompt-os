# Events Module

The Events module provides a unified event-driven architecture for SystemPrompt OS, consolidating the functionality of the former workflows and scheduler modules into a single, powerful system.

## Overview

The Events module handles:
- Event registration and storage
- Event execution with multiple executor types
- Event scheduling (cron, interval, one-time)
- Complex workflow orchestration
- Integration with webhooks and other system components

## Features

### Event System
- **Event Creation**: Create events with priority, data, and metadata
- **Event Handlers**: Register handlers that respond to specific event types
- **Event Listeners**: Pattern-based listeners for flexible event routing
- **Event Bus**: Internal communication between modules

### Executors
- **Webhook Executor**: Triggers webhooks when events occur
- **Command Executor**: Executes shell commands (migrated from scheduler)
- **Workflow Executor**: Handles complex multi-step workflows

### Scheduling
- **Cron Scheduling**: Schedule events using cron expressions
- **Interval Scheduling**: Run events at fixed intervals
- **One-time Scheduling**: Schedule events for a specific time

### Workflows
- **Multi-step Orchestration**: Define complex workflows with conditions
- **Parallel Execution**: Run multiple steps in parallel
- **Error Handling**: Built-in retry and compensation mechanisms
- **Checkpointing**: Save workflow state for resumability

## Usage

### Creating an Event

```typescript
import { EventService } from '@/modules/core/events';

const eventService = Container.get(EventService);

// Create a simple event
const event = await eventService.createEvent({
  name: 'user.signup',
  type: 'user.action',
  priority: EventPriority.NORMAL,
  data: {
    userId: '123',
    email: 'user@example.com'
  },
  trigger_type: EventTriggerType.API
});

// Schedule an event
const scheduledEvent = await eventService.createEvent({
  name: 'backup.daily',
  type: 'system.maintenance',
  scheduled_at: new Date('2024-01-01T02:00:00Z'),
  trigger_type: EventTriggerType.SCHEDULED
});
```

### Registering Event Handlers

```typescript
// Register a webhook handler
await eventService.registerHandler({
  event_type: 'user.action',
  executor_type: 'webhook',
  configuration: {
    // Webhook executor will use the webhooks module
  },
  retry_policy: {
    strategy: 'exponential',
    max_attempts: 3,
    initial_delay_ms: 1000
  }
});

// Register a command handler
await eventService.registerHandler({
  event_type: 'system.maintenance',
  executor_type: 'command',
  configuration: {
    command: '/usr/local/bin/backup.sh',
    args: ['--full'],
    timeout_ms: 300000 // 5 minutes
  }
});
```

### Creating Workflows

```typescript
import { WorkflowRepository } from '@/modules/core/events';

const workflowRepo = Container.get(WorkflowRepository);

// Define a workflow
const workflow: WorkflowDefinition = {
  id: 'order-processing',
  name: 'Order Processing Workflow',
  version: 1,
  steps: [
    {
      id: 'validate-order',
      name: 'Validate Order',
      type: 'action',
      action: 'order.validate',
      next_steps: ['check-inventory']
    },
    {
      id: 'check-inventory',
      name: 'Check Inventory',
      type: 'condition',
      conditions: [{
        field: 'inventory.available',
        operator: 'gte',
        value: '{{steps.validate-order.quantity}}'
      }],
      next_steps: ['process-payment', 'notify-backorder']
    },
    {
      id: 'process-payment',
      name: 'Process Payment',
      type: 'action',
      action: 'payment.process',
      retry_policy: {
        strategy: 'exponential',
        max_attempts: 3
      }
    }
  ],
  error_handling: {
    on_step_failure: 'retry',
    on_workflow_failure: 'compensate'
  }
};

await workflowRepo.create(workflow);

// Register workflow to run on events
await eventService.registerHandler({
  event_type: 'order.created',
  executor_type: 'workflow',
  configuration: {
    workflow_id: 'order-processing'
  }
});
```

### Event Scheduling

```typescript
// Schedule a recurring task
await eventService.scheduleEvent({
  event_type: 'report.generate',
  event_data: {
    report_type: 'daily_summary'
  },
  schedule_type: 'cron',
  cron_expression: '0 9 * * *', // Daily at 9 AM
  next_run_at: new Date()
});

// Schedule an interval task
await eventService.scheduleEvent({
  event_type: 'health.check',
  schedule_type: 'interval',
  interval_ms: 60000, // Every minute
  next_run_at: new Date()
});
```

## CLI Commands

The Events module provides several CLI commands:

- `sp event:create` - Create a new event
- `sp event:list` - List events
- `sp event:info <id>` - Get event information
- `sp event:cancel <id>` - Cancel an event
- `sp handler:register` - Register an event handler
- `sp handler:list` - List event handlers
- `sp schedule:create` - Create an event schedule
- `sp schedule:list` - List event schedules
- `sp workflow:create` - Create a workflow
- `sp workflow:list` - List workflows
- `sp workflow:execute <id>` - Execute a workflow
- `sp stats` - Show event statistics

## Database Schema

The Events module uses several tables:
- `events` - Core event storage
- `event_executions` - Execution tracking
- `event_handlers` - Handler configurations
- `event_listeners` - Pattern-based listeners
- `event_schedules` - Scheduled events
- `workflow_definitions` - Workflow templates
- `workflow_executions` - Workflow runtime state

## Migration from Workflows/Scheduler

The Events module automatically migrates data from the old workflows and scheduler modules:

1. **Scheduler Tasks** → Event schedules with command executor
2. **Workflows** → Workflow definitions with event handlers
3. **Workflow Triggers** → Event handlers for workflow execution

## Configuration

```yaml
# config/modules.json
{
  "events": {
    "processing": {
      "maxConcurrentEvents": 100,
      "retryDelayMs": 1000,
      "maxRetries": 3
    },
    "scheduling": {
      "checkIntervalMs": 10000,
      "timezone": "UTC"
    },
    "executors": {
      "webhook": {
        "enabled": true,
        "maxConcurrency": 100
      },
      "command": {
        "enabled": true,
        "maxConcurrency": 10,
        "defaultTimeoutMs": 30000
      },
      "workflow": {
        "enabled": true,
        "maxConcurrency": 20,
        "checkpointEnabled": true
      }
    }
  }
}
```

## Integration with Other Modules

### Webhooks Integration
The Events module integrates seamlessly with the webhooks module:
- Webhook events automatically create system events
- Webhook deliveries emit events for tracking
- Event handlers can trigger webhooks

### Future Integrations
- **Auth Module**: User action events
- **API Module**: API request/response events
- **Monitoring Module**: System health events
- **Agents Module**: Agent lifecycle events

## Best Practices

1. **Event Naming**: Use dot-notation (e.g., `user.created`, `order.processed`)
2. **Event Data**: Keep event data minimal and focused
3. **Error Handling**: Always configure retry policies for critical events
4. **Workflow Design**: Break complex processes into smaller, reusable workflows
5. **Performance**: Use appropriate executors and concurrency limits

## Security

- Events are stored with full audit trail
- Executors run with configurable permissions
- Command executor validates and sanitizes inputs
- Workflow checkpoints are encrypted at rest

## Troubleshooting

### Events not processing
1. Check if event handlers are registered: `sp handler:list`
2. Verify executor is enabled in configuration
3. Check event execution status: `sp event:info <id>`

### Scheduled events not running
1. Verify scheduler is running in module logs
2. Check schedule configuration: `sp schedule:list`
3. Ensure `next_run_at` is in the past

### Workflow failures
1. Check workflow execution logs
2. Verify all workflow steps are valid
3. Review checkpoint data for debugging