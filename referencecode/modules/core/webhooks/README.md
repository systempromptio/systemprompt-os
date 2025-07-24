# Webhooks Module

The Webhooks module provides event-driven HTTP notifications for SystemPrompt OS. It allows you to configure HTTP endpoints that will be called when specific system events occur.

## Features

- **Event Subscriptions**: Subscribe to various system events
- **Flexible Configuration**: Support for different HTTP methods, headers, and authentication
- **Reliable Delivery**: Built-in retry logic with configurable strategies
- **Authentication Support**: Basic, Bearer, API Key, and HMAC authentication
- **Delivery Tracking**: Complete history of webhook deliveries with statistics
- **Testing Tools**: Test webhooks before events occur
- **Performance Monitoring**: Track response times and success rates

## Architecture

### Services

- **WebhookService**: Main service for webhook management and triggering
- **WebhookDeliveryService**: Handles HTTP delivery, retries, and timeout management

### Repository

- **WebhookRepository**: Database operations for webhooks and delivery records

### Database Schema

The module uses two main tables:
- `webhooks`: Stores webhook configurations
- `webhook_deliveries`: Tracks all delivery attempts and results

## Supported Events

- `agent.started` - Agent has started execution
- `agent.stopped` - Agent has stopped
- `agent.failed` - Agent execution failed
- `workflow.started` - Workflow execution started
- `workflow.completed` - Workflow completed successfully
- `workflow.failed` - Workflow execution failed
- `task.scheduled` - Task has been scheduled
- `task.executed` - Scheduled task executed
- `task.failed` - Scheduled task failed
- `api.key.created` - New API key created
- `api.key.revoked` - API key revoked
- `api.limit.exceeded` - API rate limit exceeded
- `system.health.degraded` - System health degraded
- `system.health.restored` - System health restored
- `custom` - Custom events

## CLI Commands

### Webhook Management

```bash
# List all webhooks
prompt webhooks:list [--status active|inactive] [--event <event>] [--format json]

# Create a new webhook
prompt webhooks:create --name "My Webhook" --url "https://example.com/webhook" \
  --events "agent.started,agent.failed" --method POST \
  --headers '{"X-Custom":"value"}' --auth-type bearer \
  --auth-credentials '{"token":"secret123"}'

# Get webhook details
prompt webhooks:info <webhook-id> [--format json]

# Update webhook configuration
prompt webhooks:update <webhook-id> --name "New Name" --status inactive

# Delete a webhook
prompt webhooks:delete <webhook-id> [--force]
```

### Testing and Monitoring

```bash
# Test a webhook with sample payload
prompt webhooks:test <webhook-id>

# View delivery history
prompt webhooks:deliveries <webhook-id> [--limit 50] [--format json]

# View webhook statistics
prompt webhooks:stats <webhook-id> [--format json]

# Manually trigger an event
prompt webhooks:trigger --event "custom" --data '{"message":"test"}' \
  --metadata '{"source":"cli"}'
```

### Delivery Management

```bash
# Retry a failed delivery
prompt webhooks:retry --webhook <webhook-id> --delivery <delivery-id>

# Pause webhook (set inactive)
prompt webhooks:pause <webhook-id>

# Resume webhook (set active)
prompt webhooks:resume <webhook-id>
```

## Webhook Payload Format

All webhooks receive a standardized JSON payload:

```json
{
  "webhook_id": "wh_123456_abc",
  "event": "agent.started",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "data": {
    // Event-specific data
  },
  "metadata": {
    // Optional metadata
  }
}
```

## Authentication Types

### Basic Authentication
```bash
--auth-type basic --auth-credentials '{"username":"user","password":"pass"}'
```

### Bearer Token
```bash
--auth-type bearer --auth-credentials '{"token":"your-token"}'
```

### API Key
```bash
--auth-type api-key --auth-credentials '{"api_key":"key","header_name":"X-API-Key"}'
```

### HMAC Signature
```bash
--auth-type hmac --auth-credentials '{"secret":"shared-secret"}'
```

HMAC signatures are sent in the `X-Webhook-Signature` header as `sha256=<signature>`.

## Retry Configuration

Webhooks support configurable retry strategies:

- **Exponential Backoff**: Delay doubles with each retry
- **Linear Backoff**: Delay increases linearly
- **Fixed Delay**: Same delay between retries

Default configuration:
- Max attempts: 3
- Initial delay: 1 second
- Strategy: exponential
- Max delay: 60 seconds

## Headers

Each webhook request includes these standard headers:
- `Content-Type: application/json`
- `User-Agent: SystemPrompt-Webhook/1.0`
- `X-Webhook-Event: <event-name>`
- `X-Webhook-Id: <webhook-id>`
- `X-Webhook-Timestamp: <ISO-8601-timestamp>`

## Usage Example

```typescript
// In another module, trigger webhooks for an event
const webhooksModule = moduleLoader.getModule('webhooks');
const { triggerWebhook } = webhooksModule.exports;

// Trigger webhooks for agent started event
await triggerWebhook('agent.started', {
  agent_id: 'agent_123',
  agent_name: 'Data Processor',
  started_at: new Date()
}, {
  triggered_by: 'scheduler'
});
```

## Configuration

The module can be configured through `module.yaml`:

```yaml
name: webhooks
type: service
config:
  defaultTimeout: 30000      # 30 seconds
  cleanup:
    interval: 86400000       # 24 hours
    retentionDays: 30        # Keep delivery records for 30 days
```

## Best Practices

1. **Use appropriate timeouts**: Set reasonable timeouts based on endpoint response times
2. **Implement idempotency**: Webhook endpoints should handle duplicate deliveries
3. **Verify signatures**: When using HMAC, always verify signatures
4. **Monitor delivery stats**: Regularly check webhook statistics for failures
5. **Test before production**: Use the test command to verify webhook configuration
6. **Handle failures gracefully**: Implement proper error handling in webhook endpoints

## Security Considerations

- Webhook URLs are validated before storage
- Credentials are stored securely in the database
- HMAC signatures provide message integrity verification
- Failed webhooks are automatically retried with backoff
- Delivery history is retained for audit purposes