-- Events Module Database Schema

-- Core events table
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal',
    data TEXT NOT NULL DEFAULT '{}', -- JSON
    metadata TEXT NOT NULL DEFAULT '{}', -- JSON
    trigger_type TEXT NOT NULL,
    trigger_id TEXT,
    scheduled_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for events
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(priority);
CREATE INDEX IF NOT EXISTS idx_events_trigger ON events(trigger_type, trigger_id);
CREATE INDEX IF NOT EXISTS idx_events_scheduled ON events(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);

-- Event executions table
CREATE TABLE IF NOT EXISTS event_executions (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    duration_ms INTEGER,
    executor_type TEXT NOT NULL,
    executor_id TEXT NOT NULL,
    context TEXT NOT NULL DEFAULT '{}', -- JSON
    result TEXT, -- JSON
    error TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    next_retry_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Indexes for executions
CREATE INDEX IF NOT EXISTS idx_executions_event ON event_executions(event_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON event_executions(status);
CREATE INDEX IF NOT EXISTS idx_executions_executor ON event_executions(executor_type, executor_id);
CREATE INDEX IF NOT EXISTS idx_executions_retry ON event_executions(status, next_retry_at);

-- Event handlers table
CREATE TABLE IF NOT EXISTS event_handlers (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    executor_type TEXT NOT NULL,
    configuration TEXT NOT NULL DEFAULT '{}', -- JSON
    priority INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    conditions TEXT, -- JSON array
    retry_policy TEXT, -- JSON
    timeout_ms INTEGER,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for handlers
CREATE INDEX IF NOT EXISTS idx_handlers_type ON event_handlers(event_type, enabled);
CREATE INDEX IF NOT EXISTS idx_handlers_priority ON event_handlers(priority DESC);

-- Event schedules table
CREATE TABLE IF NOT EXISTS event_schedules (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    event_data TEXT NOT NULL DEFAULT '{}', -- JSON
    schedule_type TEXT NOT NULL, -- 'cron', 'interval', 'once'
    cron_expression TEXT,
    interval_ms INTEGER,
    next_run_at DATETIME NOT NULL,
    last_run_at DATETIME,
    enabled INTEGER NOT NULL DEFAULT 1,
    timezone TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for schedules
CREATE INDEX IF NOT EXISTS idx_schedules_next_run ON event_schedules(enabled, next_run_at);
CREATE INDEX IF NOT EXISTS idx_schedules_type ON event_schedules(event_type);

-- Event listeners table
CREATE TABLE IF NOT EXISTS event_listeners (
    id TEXT PRIMARY KEY,
    event_pattern TEXT NOT NULL, -- supports wildcards
    handler_type TEXT NOT NULL, -- 'webhook', 'function', 'workflow', 'command'
    handler_config TEXT NOT NULL DEFAULT '{}', -- JSON
    filter_conditions TEXT, -- JSON array
    priority INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for listeners
CREATE INDEX IF NOT EXISTS idx_listeners_pattern ON event_listeners(event_pattern, enabled);
CREATE INDEX IF NOT EXISTS idx_listeners_priority ON event_listeners(priority DESC);

-- Event statistics table (materialized view)
CREATE TABLE IF NOT EXISTS event_stats (
    event_type TEXT PRIMARY KEY,
    total_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    pending_count INTEGER NOT NULL DEFAULT 0,
    average_duration_ms INTEGER,
    last_execution_at DATETIME,
    last_success_at DATETIME,
    last_failure_at DATETIME,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Workflow definitions table (migrated from workflows module)
CREATE TABLE IF NOT EXISTS workflow_definitions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    steps TEXT NOT NULL, -- JSON array
    inputs TEXT, -- JSON schema
    outputs TEXT, -- JSON schema
    error_handling TEXT, -- JSON
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Workflow executions table
CREATE TABLE IF NOT EXISTS workflow_executions (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    event_execution_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    context TEXT NOT NULL DEFAULT '{}', -- JSON
    current_step_id TEXT,
    step_results TEXT NOT NULL DEFAULT '{}', -- JSON
    started_at DATETIME,
    completed_at DATETIME,
    error TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflow_definitions(id),
    FOREIGN KEY (event_execution_id) REFERENCES event_executions(id)
);

-- Workflow execution checkpoints
CREATE TABLE IF NOT EXISTS workflow_checkpoints (
    id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL,
    step_id TEXT NOT NULL,
    state TEXT NOT NULL, -- JSON
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (execution_id) REFERENCES workflow_executions(id) ON DELETE CASCADE
);

-- Task configurations table (migrated from scheduler module)
CREATE TABLE IF NOT EXISTS task_configurations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    command TEXT NOT NULL,
    args TEXT, -- JSON array
    env TEXT, -- JSON object
    working_directory TEXT,
    timeout_ms INTEGER,
    retry_policy TEXT, -- JSON
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Event logs table
CREATE TABLE IF NOT EXISTS event_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL,
    execution_id TEXT,
    level TEXT NOT NULL, -- 'debug', 'info', 'warn', 'error'
    message TEXT NOT NULL,
    context TEXT, -- JSON
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (execution_id) REFERENCES event_executions(id) ON DELETE CASCADE
);

-- Indexes for logs
CREATE INDEX IF NOT EXISTS idx_logs_event ON event_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_logs_execution ON event_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_logs_level ON event_logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_created ON event_logs(created_at);

-- Triggers for updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_events_timestamp 
AFTER UPDATE ON events 
BEGIN
    UPDATE events SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_executions_timestamp 
AFTER UPDATE ON event_executions 
BEGIN
    UPDATE event_executions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_handlers_timestamp 
AFTER UPDATE ON event_handlers 
BEGIN
    UPDATE event_handlers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_schedules_timestamp 
AFTER UPDATE ON event_schedules 
BEGIN
    UPDATE event_schedules SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_listeners_timestamp 
AFTER UPDATE ON event_listeners 
BEGIN
    UPDATE event_listeners SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_workflows_timestamp 
AFTER UPDATE ON workflow_definitions 
BEGIN
    UPDATE workflow_definitions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_workflow_executions_timestamp 
AFTER UPDATE ON workflow_executions 
BEGIN
    UPDATE workflow_executions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_tasks_timestamp 
AFTER UPDATE ON task_configurations 
BEGIN
    UPDATE task_configurations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;