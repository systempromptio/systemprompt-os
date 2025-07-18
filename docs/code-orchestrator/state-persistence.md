# State Persistence

## Overview

State Persistence is a critical system that ensures all tasks, sessions, and application state survive server restarts, crashes, and updates. It provides reliable filesystem-based storage with automatic backups and recovery mechanisms.

## Architecture

```
                State Persistence
                      │
    ┌─────────────────┼─────────────────┐
    │                 │                 │
Task Files       State File        Backups
    │                 │                 │
 Individual      Application      Historical
JSON Files       Snapshot         Snapshots
```

## Storage Structure

### Directory Layout

```
coding-agent-state/           # Default: ./coding-agent-state
├── state.json               # Main application state
├── state.backup.*.json      # Automatic backups (last 10)
├── tasks/                   # Individual task files
│   ├── task_123.json
│   ├── task_456.json
│   └── ...
├── sessions/                # Session data (future use)
├── logs/                    # Session logs
│   └── session_*.log
└── reports/                 # Generated reports
    └── report_*.json
```

### Configurable Location

```bash
# Set custom state directory
STATE_PATH=/var/lib/coding-agent npm start

# Or in .env
STATE_PATH=/home/user/.coding-agent-state
```

## Core Features

### 1. **Automatic Persistence**
- Tasks saved immediately on creation/update
- State snapshot every 30 seconds
- No data loss on unexpected shutdown

### 2. **Backup Management**
- Automatic backups before each save
- Keeps last 10 backup files
- Timestamp-based naming

### 3. **Atomic Operations**
- Safe file writes with error handling
- Backup creation before overwrites
- Recovery from partial writes

### 4. **Event System**
- `state:saved` - State successfully persisted
- `state:loaded` - State loaded from disk
- `state:save-error` - Persistence failure
- `autosave:triggered` - Auto-save initiated

## Data Structures

### Persisted State

```typescript
interface PersistedState {
  tasks: Task[];                  // All tasks
  sessions: SessionInfo[];        // Active sessions
  metrics: {
    total_tasks: number;
    completed_tasks: number;
    failed_tasks: number;
    average_completion_time: number;
  };
  last_saved: string;            // ISO timestamp
}
```

### Task Storage

Each task is stored as an individual JSON file:

```json
{
  "id": "task_1234567890",
  "description": "Implement authentication",
  "status": "completed",
  "tool": "CLAUDECODE",
  "created_at": "2024-01-01T10:00:00Z",
  "updated_at": "2024-01-01T11:30:00Z",
  "started_at": "2024-01-01T10:05:00Z",
  "completed_at": "2024-01-01T11:30:00Z",
  "logs": [
    {
      "timestamp": "2024-01-01T10:05:00Z",
      "level": "info",
      "type": "system",
      "message": "Task started"
    }
  ],
  "result": {
    "files_created": ["auth.js", "auth.test.js"],
    "tests_passed": true
  }
}
```

## API Methods

### Saving State

```typescript
// Save complete application state
await persistence.saveState({
  tasks: allTasks,
  sessions: activeSessions,
  metrics: currentMetrics,
  last_saved: new Date().toISOString()
});

// Save individual task
await persistence.saveTask(task);

// Save session log
await persistence.saveSessionLog(sessionId, logContent);

// Save report
const reportPath = await persistence.saveReport(reportId, reportData);
```

### Loading State

```typescript
// Load application state
const state = await persistence.loadState();
if (state) {
  // Restore tasks and sessions
  restoreFromState(state);
}

// Load all tasks
const tasks = await persistence.loadTasks();
```

### Cleanup Operations

```typescript
// Delete a task
await persistence.deleteTask(taskId);

// Shutdown gracefully
await persistence.shutdown();
```

## Recovery Mechanisms

### 1. **Startup Recovery**
On startup, the system:
1. Checks for `state.json`
2. Falls back to individual task files
3. Validates data integrity
4. Rebuilds in-memory state

### 2. **Corruption Handling**
If main state is corrupted:
1. Try loading latest backup
2. Reconstruct from task files
3. Log corruption details
4. Continue with partial state

### 3. **Missing Files**
Handles missing files gracefully:
- Creates directories if needed
- Initializes empty state
- Logs missing file warnings
- Continues operation

## Auto-Save System

### Configuration

```typescript
// Default: 30-second intervals
private saveInterval = setInterval(() => {
  this.autoSave();
}, 30000);
```

### Save Triggers

1. **Immediate Save**
   - Task creation
   - Task status change
   - Task completion

2. **Interval Save**
   - Every 30 seconds
   - Full state snapshot
   - Metrics update

3. **Shutdown Save**
   - On graceful shutdown
   - Before process exit
   - Emergency state dump

## File Safety

### ID Validation

```typescript
// Sanitize task IDs for filesystem
const safeId = validateTaskId(taskId);
// Removes: /, \, :, *, ?, ", <, >, |
```

### Write Operations

1. **Prepare** - Create backup if exists
2. **Write** - Atomic write to new file
3. **Replace** - Move new over old
4. **Cleanup** - Remove old backups

### Error Handling

```typescript
try {
  await fs.writeFile(path, data);
} catch (error) {
  // Log error
  // Emit error event
  // Try backup location
  // Maintain service stability
}
```

## Best Practices

### 1. **State Management**
- Keep state files reasonable size
- Archive old completed tasks
- Monitor disk usage
- Regular backup exports

### 2. **Performance**
- Use individual task files
- Batch state updates
- Async I/O operations
- Minimize file locks

### 3. **Reliability**
- Handle all error cases
- Validate before saving
- Test recovery procedures
- Monitor save failures

### 4. **Security**
- Restrict directory permissions
- Validate all inputs
- No sensitive data in logs
- Encrypt if needed

## Monitoring

### Health Checks

```typescript
// Check persistence health
const health = {
  stateDirExists: fs.existsSync(statePath),
  writeable: isWriteable(statePath),
  diskSpace: getDiskSpace(statePath),
  lastSaveTime: getLastSaveTime(),
  backupCount: getBackupCount()
};
```

### Metrics

Track persistence performance:
- Save duration
- Load duration
- Failure rate
- Disk usage
- File counts

### Alerts

Set up monitoring for:
- Save failures
- Disk space low
- Corruption detected
- Backup failures
- Permission errors

## Migration & Upgrades

### Version Compatibility

State files include version info:
```json
{
  "version": "1.0.0",
  "tasks": [...],
  "sessions": [...]
}
```

### Migration Strategy

1. **Detect Version**
   - Check state file version
   - Compare with current

2. **Run Migration**
   - Backup current state
   - Apply transformations
   - Validate result

3. **Update Version**
   - Save migrated state
   - Update version field
   - Log migration

### Rollback Support

Keep pre-migration backups:
```
state.pre-migration.backup.json
state.migration-v1-to-v2.log
```

## Troubleshooting

### Common Issues

1. **Permission Denied**
   ```bash
   # Fix permissions
   chmod -R 755 ./coding-agent-state
   ```

2. **Disk Full**
   ```bash
   # Check disk usage
   du -sh ./coding-agent-state
   
   # Clean old files
   npm run clean-state
   ```

3. **Corrupted State**
   ```bash
   # Restore from backup
   cp state.backup.*.json state.json
   ```

### Debug Mode

Enable detailed logging:
```bash
DEBUG=persistence:* npm start
```

### Manual Recovery

```bash
# List all tasks
ls -la coding-agent-state/tasks/

# Manually edit task
nano coding-agent-state/tasks/task_123.json

# Force state rebuild
rm coding-agent-state/state.json
npm start  # Will rebuild from tasks
```

## Future Enhancements

1. **Database Backend**
   - PostgreSQL support
   - Better querying
   - Transactions
   - Replication

2. **Cloud Storage**
   - S3 integration
   - Google Cloud Storage
   - Azure Blob Storage
   - Automatic sync

3. **Encryption**
   - At-rest encryption
   - Encrypted backups
   - Key management
   - Compliance support

4. **Real-time Sync**
   - Multi-instance support
   - Conflict resolution
   - Event streaming
   - Distributed state