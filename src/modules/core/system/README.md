# System Module

Core system management module providing comprehensive monitoring, health checks, backups, and system administration capabilities.

## Features

- **System Status Monitoring**: Real-time CPU, memory, disk usage tracking
- **Health Checks**: Automated system health monitoring with configurable thresholds
- **Backup & Restore**: Full system backup with compression and selective restore
- **Metrics Collection**: Historical metrics storage and analysis
- **Log Management**: Centralized log viewing and filtering
- **Event Streaming**: System event tracking and notifications

## Configuration

```yaml
monitoring:
  enabled: true
  interval: 60000  # 1 minute
  metricsFile: ./state/system-metrics.json
health:
  checks:
    - memory
    - cpu
    - disk
    - modules
  thresholds:
    memory: 0.9    # 90% memory usage warning
    cpu: 0.8       # 80% CPU usage warning
    disk: 0.85     # 85% disk usage warning
backup:
  enabled: false
  path: ./backups
  retention: 7   # days
```

## CLI Commands

### system:status
Show comprehensive system status including resource usage and module health.

```bash
systemprompt system:status
systemprompt system:status --format json
systemprompt system:status --detailed
```

### system:health
Run full system health check with diagnostics.

```bash
systemprompt system:health
systemprompt system:health --fix
systemprompt system:health --report health-report.json
```

### system:backup
Create a system backup.

```bash
systemprompt system:backup
systemprompt system:backup --include config,data
systemprompt system:backup --compress false
```

### system:restore
Restore from a backup.

```bash
systemprompt system:restore --file backup-2024-01-01-abc123
systemprompt system:restore --file backup-id --components config
systemprompt system:restore --file backup-id --confirm
```

### system:logs
View and filter system logs.

```bash
systemprompt system:logs
systemprompt system:logs --level error
systemprompt system:logs --module auth
systemprompt system:logs --tail 50
systemprompt system:logs --follow
```

### system:metrics
View system performance metrics.

```bash
systemprompt system:metrics
systemprompt system:metrics --period 24h
systemprompt system:metrics --type cpu
```

## API Methods

### getSystemStatus()
Returns comprehensive system status information.

### getHealthReport()
Returns detailed health check results.

### getMetrics(period)
Returns metrics for the specified time period.

### createBackup(options)
Creates a system backup with specified components.

### restoreBackup(backupId, options)
Restores from a backup.

## Health Checks

The module performs the following health checks:

1. **Memory**: Checks memory usage against threshold
2. **CPU**: Monitors CPU load average
3. **Disk**: Verifies disk space and write permissions
4. **Modules**: Ensures critical modules are present

## Metrics

The following metrics are collected:

- `system.cpu.usage`: CPU usage percentage
- `system.memory.usage`: Memory usage percentage
- `system.disk.usage`: Disk usage percentage
- `system.uptime`: System uptime in seconds

## Backup Components

Backups can include:

- **config**: Configuration files and settings
- **data**: Database and state files
- **modules**: Custom modules and extensions

## Events

The module emits the following events:

- `system.health.warning`: Health check warnings
- `system.health.critical`: Critical health issues
- `system.backup.created`: Backup completion
- `system.restore.completed`: Restore completion

## Security Considerations

- Backups may contain sensitive data - secure storage recommended
- Health checks may expose system information
- Metrics are stored locally in JSON format
- Log access should be restricted to administrators

## Performance Impact

- Minimal overhead from periodic monitoring
- Health checks are lightweight
- Backup/restore operations may be I/O intensive
- Metrics storage grows over time (auto-cleanup available)