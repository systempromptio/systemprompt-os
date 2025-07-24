# Monitor Module

## Overview

The Monitor module provides comprehensive system observability through metrics collection, alerting, and distributed tracing capabilities for SystemPrompt OS.

## Features

- **Metrics Collection**: Record and query system and application metrics
- **Alert Management**: Configure alerts based on metric thresholds
- **Distributed Tracing**: Track requests across services
- **System Monitoring**: Automatic CPU, memory, and system metrics
- **Data Export**: Export monitoring data in multiple formats
- **Real-time Events**: Event-driven updates for metrics and alerts

## Installation

The monitor module is a core module and is automatically available in SystemPrompt OS.

## Configuration

```yaml
# module.yaml configuration
config:
  metrics:
    enabled: true
    flushInterval: 10000      # Flush metrics every 10 seconds
    bufferSize: 1000          # Buffer up to 1000 metrics
    collectSystem: true       # Collect system metrics
    systemInterval: 60000     # Collect system metrics every minute
    
  alerts:
    enabled: true
    evaluationInterval: 60000 # Evaluate alerts every minute
    
  traces:
    enabled: true
    sampling: 1.0            # Sample 100% of traces
    
  cleanup:
    interval: 86400000       # Run cleanup daily
    retentionDays: 30        # Keep data for 30 days
```

## Usage

### CLI Commands

#### View Monitoring Status
```bash
systemprompt monitor:status
systemprompt monitor:status --format json
```

#### Manage Alerts
```bash
# List active alerts
systemprompt monitor:alerts:list
systemprompt monitor:alerts:list --severity critical

# Acknowledge an alert
systemprompt monitor:alerts:ack <alert-id> --user john.doe

# Configure alert rules
systemprompt monitor:alerts:config --list
systemprompt monitor:alerts:config --create --name "High CPU" --metric system.cpu.usage --operator ">" --threshold 80 --severity warning
systemprompt monitor:alerts:config --update <config-id> --enabled false
```

#### Query Metrics
```bash
# List available metrics
systemprompt monitor:metrics --list

# Query specific metric
systemprompt monitor:metrics --metric system.cpu.usage
systemprompt monitor:metrics --metric api.requests --start -1h --end now
systemprompt monitor:metrics --metric custom.metric --format csv
```

#### View Traces
```bash
# List recent traces
systemprompt monitor:traces
systemprompt monitor:traces --errors
systemprompt monitor:traces --service api --limit 50

# View specific trace
systemprompt monitor:traces --trace-id abc123
```

#### Export Data
```bash
# Export all data as JSON
systemprompt monitor:export --output monitoring-data.json

# Export specific metrics as CSV
systemprompt monitor:export --format csv --metrics "system.cpu.usage,api.requests" --output metrics.csv

# Export for Prometheus
systemprompt monitor:export --format prometheus --include-alerts
```

### API Usage

```typescript
// Get monitor service
const monitorModule = moduleLoader.getModule('monitor');
const monitorService = monitorModule.exports.MonitorService;

// Record metrics
monitorService.incrementCounter('api.requests', { endpoint: '/users' });
monitorService.setGauge('queue.size', 42, { queue: 'emails' });
monitorService.recordHistogram('api.response_time', 125, { endpoint: '/users' }, 'ms');

// Create traces
const spanId = monitorService.startSpan('process_order', {
  serviceName: 'order-service',
  attributes: { orderId: '12345' }
});

try {
  // Do work...
  monitorService.addEvent(spanId, 'payment_processed');
  await monitorService.endSpan(spanId, 'ok');
} catch (error) {
  await monitorService.endSpan(spanId, 'error', error);
}

// Use traced wrapper
const tracedFunction = monitorService.traced(
  'database_query',
  async (query: string) => {
    return await db.query(query);
  }
);

// Query metrics
const cpuMetrics = await monitorService.queryMetrics({
  metric: 'system.cpu.usage',
  start_time: new Date(Date.now() - 3600000), // Last hour
  aggregation: 'avg'
});

// Configure alerts
await monitorService.configureAlert({
  name: 'High Memory Usage',
  condition: {
    metric: 'system.memory.usage',
    operator: '>',
    threshold: 90
  },
  severity: 'critical',
  channels: ['webhook'],
  enabled: true
});
```

## Architecture

### Components

1. **MetricService**: Handles metric collection and querying
2. **AlertService**: Manages alert evaluation and notifications
3. **TraceService**: Provides distributed tracing capabilities
4. **MonitorRepository**: Database access layer

### Database Schema

- `metrics`: Stores time-series metric data
- `alerts`: Active and historical alerts
- `alert_configs`: Alert rule configurations
- `traces`: Distributed trace spans
- `metric_aggregations`: Pre-computed metric aggregations

### Event System

The module emits the following events:
- `metric:recorded`: When a metric is recorded
- `alert:created`: When a new alert is triggered
- `alert:acknowledged`: When an alert is acknowledged
- `alert:resolved`: When an alert is resolved
- `span:started`: When a trace span starts
- `span:ended`: When a trace span ends

## Dependencies

- `database`: For data persistence
- `logger`: For logging

## Development

### Adding Custom Metrics

```typescript
// In your module
const monitor = deps.monitor;

// Counter for counting events
monitor.incrementCounter('my_module.events', { type: 'user_login' });

// Gauge for current values
monitor.setGauge('my_module.queue_size', queue.length);

// Histogram for distributions
monitor.recordHistogram('my_module.processing_time', duration, {}, 'ms');
```

### Creating Alerts

```typescript
// Configure alert for your metric
await monitor.configureAlert({
  name: 'My Module Queue Full',
  condition: {
    metric: 'my_module.queue_size',
    operator: '>',
    threshold: 1000,
    duration: 300 // 5 minutes
  },
  severity: 'warning',
  channels: ['email', 'slack'],
  enabled: true
});
```

### Adding Traces

```typescript
// Trace async operations
const traced = monitor.traced(
  'my_operation',
  async (input: any) => {
    // Your operation
    return result;
  },
  {
    serviceName: 'my-service',
    extractAttributes: (input) => ({ userId: input.userId })
  }
);
```

## Performance Considerations

- Metrics are buffered and flushed periodically
- System metrics collection can be disabled if not needed
- Trace sampling can be configured to reduce overhead
- Old data is automatically cleaned up based on retention settings

## License

MIT License - SystemPrompt OS Team