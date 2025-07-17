# Heartbeat Module

A daemon module that monitors system health and writes status information to a JSON file at regular intervals.

## Type

`daemon` - Long-running background process

## Configuration

```yaml
name: heartbeat
type: daemon
version: 1.0.0
config:
  interval: 30s              # How often to write heartbeat (30s, 5m, 1h)
  outputPath: ./state/heartbeat.json  # Where to write the status file
  autoStart: true           # Start automatically on initialization
  includeMetrics:          # Which metrics to include
    - timestamp
    - status
    - uptime
    - memory
    - cpu
    - version
```

## Output Format

The heartbeat module writes a JSON file with the following structure:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "status": "healthy",
  "uptime": 3600,
  "memory": {
    "used": 1024,
    "total": 8192,
    "percentage": 12
  },
  "cpu": {
    "usage": 15,
    "loadAverage": [0.15, 0.20, 0.18]
  },
  "version": "1.0.0"
}
```

## Usage

### Programmatic

```typescript
import { HeartbeatModule } from './modules/core/heartbeat/index.js';

const heartbeat = new HeartbeatModule({
  interval: '30s',
  outputPath: './state/heartbeat.json',
  autoStart: false,
  includeMetrics: ['timestamp', 'status', 'uptime', 'memory']
});

await heartbeat.initialize();
await heartbeat.start();

// Later...
await heartbeat.stop();
```

### Module Registry

The heartbeat module is automatically registered when the system starts if configured in the system modules.

### CLI Integration

```bash
# Check heartbeat status
systemprompt status

# The status command will show:
# Heartbeat: Running
# Last update: 2024-01-15T10:30:00.000Z
```

## Metrics

### timestamp
ISO 8601 timestamp of when the heartbeat was written.

### status
Current health status. Always "healthy" in this implementation, but can be extended.

### uptime
Time in seconds since the module was started.

### memory
- `used`: Memory used in MB
- `total`: Total memory in MB  
- `percentage`: Percentage of memory used

### cpu
- `usage`: CPU usage percentage (based on load average)
- `loadAverage`: System load average [1min, 5min, 15min]

### version
Module version number.

## Error Handling

The heartbeat module is designed to be resilient:
- Continues running even if file writes fail
- Creates directories automatically if they don't exist
- Logs errors but doesn't crash
- Can recover from file system errors

## Testing

The module includes comprehensive tests:

```bash
# Run unit tests
npm run test:unit -- modules/core/heartbeat

# Run integration tests  
npm run test:integration -- modules/core/heartbeat

# Run E2E tests
npm run test:e2e -- modules/core/heartbeat
```

## Extending

To add new metrics:

1. Add the metric name to `HeartbeatMetric` type
2. Implement metric collection in `generateStatus()`
3. Update tests and documentation

Example:

```typescript
// Add to types.ts
export type HeartbeatMetric = 
  | 'timestamp'
  | 'status'
  | 'uptime'
  | 'memory'
  | 'cpu'
  | 'version'
  | 'disk'; // New metric

// Add to generateStatus()
if (metrics.includes('disk')) {
  status.disk = {
    used: getDiskUsage(),
    total: getDiskTotal(),
    percentage: getDiskPercentage()
  };
}
```