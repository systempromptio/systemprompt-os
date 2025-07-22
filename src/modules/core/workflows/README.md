# Workflows Module

The Workflows module provides a powerful workflow definition and execution engine for creating complex, multi-step automation processes.

## Features

- **Workflow Definition**: Define workflows using YAML or JSON with steps, conditions, and dependencies
- **Execution Engine**: Robust execution engine with parallel processing, loops, and conditional logic
- **Error Handling**: Built-in error handling with retry mechanisms and error handlers
- **Checkpointing**: Automatic checkpointing for recovery and resumption
- **Scheduling**: Schedule workflows for one-time or recurring execution
- **Monitoring**: Real-time execution monitoring and status tracking

## Workflow Concepts

### Step Types

1. **Action**: Execute a specific action or task
2. **Condition**: Conditional branching based on expressions
3. **Parallel**: Execute multiple branches in parallel
4. **Loop**: Iterate over collections
5. **Subflow**: Execute another workflow as a step

### Workflow Structure

```yaml
name: example-workflow
version: 1.0.0
description: Example workflow definition

inputs:
  - name: input1
    type: string
    required: true
    description: First input parameter

outputs:
  - name: result
    type: object
    source: process_step

steps:
  - id: validate_step
    name: Validate Input
    type: action
    action: validate_input
    inputs:
      data: ${input1}
    outputs: [validated_data]

  - id: process_step
    name: Process Data
    type: action
    action: process_data
    inputs:
      data: ${validated_data}
    depends_on: [validate_step]
    on_error: retry
    retry:
      attempts: 3
      delay: 1000
      backoff: exponential

  - id: condition_step
    name: Check Result
    type: condition
    condition:
      expression: ${process_result.success}
      then_steps:
        - id: success_action
          name: Handle Success
          type: action
          action: notify_success
      else_steps:
        - id: failure_action
          name: Handle Failure
          type: action
          action: notify_failure
    depends_on: [process_step]

error_handler:
  id: error_handler
  name: Global Error Handler
  type: action
  action: handle_error
```

## CLI Commands

### List Workflows
```bash
systemprompt workflows:list [--status <status>] [--format <format>]
```

### Create Workflow
```bash
systemprompt workflows:create --file <path/to/workflow.yaml> [--name <name>]
```

### Execute Workflow
```bash
systemprompt workflows:execute --id <workflow-id> [--params <json>] [--async]
```

### Schedule Workflow
```bash
# One-time execution
systemprompt workflows:schedule --id <workflow-id> --at "2024-01-01T10:00:00Z"

# Recurring execution
systemprompt workflows:schedule --id <workflow-id> --cron "0 10 * * *"
```

### Check Execution Status
```bash
systemprompt workflows:status --execution <execution-id> [--detailed]
```

### View Execution History
```bash
systemprompt workflows:history [--workflow <workflow-id>] [--status <status>] [--limit <n>]
```

### Cancel Execution
```bash
systemprompt workflows:cancel --execution <execution-id> [--force]
```

### Validate Workflow
```bash
systemprompt workflows:validate --file <path/to/workflow.yaml>
```

### Export Workflow
```bash
systemprompt workflows:export --id <workflow-id> [--output <file>]
```

## API Usage

```typescript
// Get the workflow service
const workflowsModule = moduleLoader.getModule('workflows');
const workflowService = workflowsModule.exports.WorkflowService;

// Create a workflow
const workflow = await workflowService.createWorkflow({
  name: 'data-processing',
  steps: [
    {
      id: 'fetch',
      name: 'Fetch Data',
      type: 'action',
      action: 'fetch_data'
    },
    {
      id: 'process',
      name: 'Process Data',
      type: 'action',
      action: 'process_data',
      depends_on: ['fetch']
    }
  ]
});

// Execute workflow
const execution = await workflowService.executeWorkflow({
  workflow_id: workflow.id,
  inputs: { source: 'api' }
});

// Check status
const status = await workflowService.getExecution(execution.id);
```

## Configuration

The module can be configured through the module.yaml file:

```yaml
config:
  maxConcurrentWorkflows: 50    # Maximum concurrent workflow executions
  defaultTimeout: 3600000        # Default timeout (1 hour)
  retryAttempts: 3              # Default retry attempts
  retryDelay: 5000              # Default retry delay
  checkpointInterval: 30000     # Checkpoint interval (30 seconds)
```

## Events

The WorkflowService emits the following events:

- `workflow-event`: Fired for all workflow-related events
  - `created`: Workflow created
  - `updated`: Workflow updated
  - `executed`: Workflow execution started
  - `completed`: Workflow execution completed
  - `failed`: Workflow execution failed
  - `cancelled`: Workflow execution cancelled
  - `scheduled`: Workflow scheduled

## Database Schema

The module uses the following tables:

- `workflows`: Workflow definitions
- `workflow_executions`: Execution instances
- `execution_checkpoints`: Execution checkpoints for recovery
- `workflow_schedules`: Scheduled workflow configurations
- `workflow_logs`: Execution logs

## Error Handling

The module implements comprehensive error handling:

- Step-level error handling with configurable actions (fail, continue, retry, goto)
- Retry mechanisms with linear or exponential backoff
- Global error handlers for workflow-level failures
- Automatic recovery from checkpoints

## Best Practices

1. **Use Descriptive IDs**: Give steps meaningful IDs for easier debugging
2. **Define Dependencies**: Explicitly define step dependencies
3. **Handle Errors**: Always define error handling strategies
4. **Set Timeouts**: Configure appropriate timeouts for long-running steps
5. **Use Checkpoints**: Enable checkpointing for critical workflows
6. **Validate First**: Always validate workflow definitions before deployment

## Security Considerations

- Input validation for all workflow parameters
- Sandboxed execution environment
- Access control integration with auth module
- Audit logging for all workflow operations