# Scheduler Module

The Scheduler module provides comprehensive task scheduling capabilities with support for cron expressions, intervals, and one-time executions.

## Features

- **Flexible Scheduling**: Support for cron expressions, intervals, and one-time tasks
- **Task Management**: Create, update, pause, resume, and delete scheduled tasks
- **Execution Control**: Run tasks immediately or on schedule
- **Retry Mechanisms**: Automatic retry with configurable attempts and delays
- **Execution History**: Track all task executions with detailed logs
- **Performance Monitoring**: Task statistics and execution metrics
- **Cleanup**: Automatic cleanup of old execution records

## Task Types

1. **Cron**: Traditional cron expressions (e.g., "0 * * * *" for every hour)
2. **Interval**: Simple intervals (e.g., "5m" for every 5 minutes)
3. **Once**: Single execution tasks
4. **Manual**: Tasks that only run when triggered manually

## Schedule Formats

### Cron Expressions
Standard 5-field cron format:
```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, Sunday = 0 or 7)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

Special values:
- `@yearly` or `@annually` - Run once a year
- `@monthly` - Run once a month
- `@weekly` - Run once a week
- `@daily` or `@midnight` - Run once a day
- `@hourly` - Run once an hour

### Interval Format
Simple intervals with units:
- `30s` - Every 30 seconds
- `5m` - Every 5 minutes
- `2h` - Every 2 hours
- `1d` - Every day

## CLI Commands

### List Tasks
```bash
systemprompt scheduler:list [--status <status>] [--format <format>]
```

### Create Task
```bash
systemprompt scheduler:create --name <name> --command <command> --schedule <schedule> [--data <json>] [--once]
```

### Update Task
```bash
systemprompt scheduler:update --id <task-id> [--name <name>] [--schedule <schedule>] [--command <command>]
```

### Delete Task
```bash
systemprompt scheduler:delete --id <task-id> [--confirm]
```

### Run Task Immediately
```bash
systemprompt scheduler:run --id <task-id> [--wait]
```

### Pause/Resume Tasks
```bash
# Pause specific task or all tasks
systemprompt scheduler:pause [--id <task-id>]

# Resume specific task or all tasks
systemprompt scheduler:resume [--id <task-id>]
```

### View Execution History
```bash
systemprompt scheduler:history [--task <task-id>] [--status <status>] [--limit <n>]
```

### Show Next Runs
```bash
systemprompt scheduler:next [--count <n>] [--task <task-id>]
```

## API Usage

```typescript
// Get the scheduler service
const schedulerModule = moduleLoader.getModule('scheduler');
const schedulerService = schedulerModule.exports.SchedulerService;

// Create a scheduled task
const task = await schedulerService.createTask({
  name: 'backup-database',
  command: 'backup:run',
  schedule: '0 2 * * *', // 2 AM daily
  data: { type: 'full' },
  retries: 3
});

// Run task immediately
const result = await schedulerService.runTaskNow(task.id);

// Get task statistics
const stats = await schedulerService.getTaskStats();
```

## Configuration

The module can be configured through the module.yaml file:

```yaml
config:
  maxConcurrentTasks: 100      # Maximum concurrent task executions
  defaultRetries: 3            # Default retry attempts
  retryDelay: 5000            # Delay between retries (ms)
  tickInterval: 1000          # Engine tick interval (ms)
  taskTimeout: 3600000        # Default task timeout (1 hour)
  cleanupInterval: 3600000    # Cleanup interval (1 hour)
  historyRetentionDays: 30    # Days to retain execution history
```

## Events

The SchedulerService emits the following events:

- `task-created`: New task created
- `task-updated`: Task configuration updated
- `task-deleted`: Task deleted
- `task-paused`: Task paused
- `task-resumed`: Task resumed
- `task-event`: All task execution events
  - `executed`: Task execution started
  - `completed`: Task completed successfully
  - `failed`: Task execution failed

## Database Schema

The module uses the following tables:

- `scheduled_tasks`: Task definitions and schedules
- `task_executions`: Execution history and results
- `task_logs`: Detailed execution logs (optional)

## Error Handling

The module implements comprehensive error handling:

- Retry mechanisms with configurable attempts and delays
- Timeout protection for long-running tasks
- Graceful handling of invalid schedules
- Transaction safety for database operations

## Best Practices

1. **Use Descriptive Names**: Give tasks meaningful names for easy identification
2. **Set Appropriate Timeouts**: Configure timeouts based on expected execution time
3. **Monitor Execution History**: Regularly check task performance and failures
4. **Use Data Field**: Pass configuration through the data field rather than hardcoding
5. **Test Schedules**: Use the validate feature before creating tasks
6. **Cleanup Old Data**: Configure retention period based on your needs

## Examples

### Daily Backup Task
```bash
systemprompt scheduler:create \
  --name "daily-backup" \
  --command "backup:database" \
  --schedule "0 2 * * *" \
  --data '{"type": "incremental"}'
```

### Every 5 Minutes Health Check
```bash
systemprompt scheduler:create \
  --name "health-check" \
  --command "system:health" \
  --schedule "5m"
```

### One-Time Migration
```bash
systemprompt scheduler:create \
  --name "migrate-data" \
  --command "migrate:run" \
  --schedule "now" \
  --once
```

## Security Considerations

- Command validation to prevent injection
- Proper access control through auth module integration
- Audit logging for all task operations
- Sandboxed execution environment