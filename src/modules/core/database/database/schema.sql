-- Database module schema
-- Tracks database module metadata and operations

-- Schema versions table
CREATE TABLE IF NOT EXISTS database_schema_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module_name TEXT NOT NULL,
    version TEXT NOT NULL,
    checksum TEXT NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms INTEGER,
    statements_count INTEGER,
    UNIQUE(module_name, version)
);

-- Database migrations table
CREATE TABLE IF NOT EXISTS database_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module_name TEXT NOT NULL,
    version TEXT NOT NULL,
    filename TEXT NOT NULL,
    checksum TEXT NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms INTEGER,
    rollback_sql TEXT,
    UNIQUE(module_name, version)
);

-- Database operations log
CREATE TABLE IF NOT EXISTS database_operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_type TEXT NOT NULL CHECK (operation_type IN ('schema_import', 'migration', 'rebuild', 'clear', 'query')),
    module_name TEXT,
    status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'partial')),
    error_message TEXT,
    affected_rows INTEGER,
    execution_time_ms INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Database health checks
CREATE TABLE IF NOT EXISTS database_health_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    check_type TEXT NOT NULL CHECK (check_type IN ('connection', 'schema_validity', 'integrity', 'performance')),
    status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
    details TEXT,
    response_time_ms INTEGER,
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_schema_versions_module ON database_schema_versions(module_name);
CREATE INDEX IF NOT EXISTS idx_migrations_module ON database_migrations(module_name);
CREATE INDEX IF NOT EXISTS idx_operations_type ON database_operations(operation_type);
CREATE INDEX IF NOT EXISTS idx_operations_created ON database_operations(created_at);
CREATE INDEX IF NOT EXISTS idx_health_checks_type ON database_health_checks(check_type);
CREATE INDEX IF NOT EXISTS idx_health_checks_checked ON database_health_checks(checked_at);