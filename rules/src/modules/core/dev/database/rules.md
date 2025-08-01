# Dev Module Database Rules

## Purpose
The dev module database stores development profiles, session tracking, and operation metadata to support development workflow management.

## Required Schema Structure

### Development Profiles Table
Stores development environment configurations and settings:

```sql
CREATE TABLE IF NOT EXISTS dev_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    config_enabled INTEGER DEFAULT 1,
    config_auto_save INTEGER DEFAULT 0,
    config_debug_mode INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Column Requirements**:
- `id`: Primary key, auto-incrementing
- `name`: Unique profile name, used for CLI identification
- `description`: Optional human-readable description
- `config_enabled`: Boolean flag for profile activation
- `config_auto_save`: Boolean flag for automatic saving
- `config_debug_mode`: Boolean flag for debug logging
- `created_at`: Timestamp of profile creation
- `updated_at`: Timestamp of last modification

### Development Sessions Table
Tracks development operation sessions for monitoring and reporting:

```sql
CREATE TABLE IF NOT EXISTS dev_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER,
    type TEXT NOT NULL, -- 'repl', 'profile', 'test', 'watch', 'lint', 'typecheck'
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'completed', 'failed', 'cancelled'
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    exit_code INTEGER,
    output_lines INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    FOREIGN KEY (profile_id) REFERENCES dev_profiles(id)
);
```

**Column Requirements**:
- `id`: Primary key, auto-incrementing
- `profile_id`: Foreign key to dev_profiles, nullable for system sessions
- `type`: Session type enum (repl, profile, test, watch, lint, typecheck)
- `status`: Session status enum (active, completed, failed, cancelled)
- `started_at`: Session start timestamp
- `ended_at`: Session end timestamp, NULL for active sessions
- `exit_code`: Process exit code, NULL for active sessions
- `output_lines`: Count of output lines generated
- `error_count`: Count of errors encountered

### Required Indexes
Performance optimization for common queries:

```sql
CREATE INDEX IF NOT EXISTS idx_dev_sessions_profile ON dev_sessions(profile_id);
CREATE INDEX IF NOT EXISTS idx_dev_sessions_type ON dev_sessions(type);
CREATE INDEX IF NOT EXISTS idx_dev_sessions_status ON dev_sessions(status);
```

## Schema Design Principles

### Structured Data Storage
- Use structured columns instead of JSON blobs
- Define explicit enums for status and type fields
- Use foreign keys for referential integrity
- Include audit timestamps for all tables

### Performance Considerations
- Index frequently queried columns
- Use appropriate data types for optimization
- Consider query patterns in index design
- Keep session data lean for performance

### Data Integrity
- Use foreign key constraints where appropriate
- Define NOT NULL constraints for required fields
- Use CHECK constraints for enum validation
- Include unique constraints for business keys

## Type Generation Requirements

### Auto-Generated Types
The database schema MUST generate the following types:
- `IDevProfilesRow`: Interface for dev_profiles table rows
- `IDevSessionsRow`: Interface for dev_sessions table rows
- `DevSessionType`: Enum for session types
- `DevSessionStatus`: Enum for session statuses

### Zod Schema Generation
Runtime validation schemas MUST be generated:
- `DevProfilesRowSchema`: Validation for profile rows
- `DevSessionsRowSchema`: Validation for session rows
- `DevSessionTypeSchema`: Validation for session types
- `DevSessionStatusSchema`: Validation for session statuses

## Query Patterns

### Common Queries
The database design MUST support these query patterns efficiently:

#### Profile Management
```sql
-- Get profile by name
SELECT * FROM dev_profiles WHERE name = ?;

-- List all active profiles
SELECT * FROM dev_profiles WHERE config_enabled = 1;

-- Update profile configuration
UPDATE dev_profiles SET config_debug_mode = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;
```

#### Session Tracking
```sql
-- Get active sessions for a profile
SELECT * FROM dev_sessions WHERE profile_id = ? AND status = 'active';

-- Get session statistics
SELECT 
  type,
  COUNT(*) as total,
  AVG(julianday(ended_at) - julianday(started_at)) * 24 * 60 as avg_duration_minutes
FROM dev_sessions 
WHERE ended_at IS NOT NULL
GROUP BY type;

-- Get recent sessions
SELECT * FROM dev_sessions 
ORDER BY started_at DESC 
LIMIT 10;
```

## Migration Requirements

### Schema Evolution
- Support for schema migrations as dev module evolves
- Preserve existing data during schema changes
- Version tracking for database schema
- Rollback capabilities for failed migrations

### Data Migration
- Support for data format changes
- Conversion scripts for enum value changes
- Backup procedures before migrations
- Validation after migration completion

## Testing Requirements

### Schema Validation
- Test that all required tables are created
- Verify foreign key constraints work correctly
- Test index creation and performance
- Validate generated types match schema

### Data Integrity Tests
- Test referential integrity constraints
- Verify enum value validation
- Test timestamp behavior
- Validate unique constraints

## Performance Requirements

### Query Performance
- Profile lookup by name: < 10ms
- Session queries with indexes: < 50ms
- Statistics aggregation: < 100ms
- Large result set handling: Streaming support

### Storage Optimization
- Efficient storage of session metadata
- Automatic cleanup of old sessions
- Compression for large output data
- Archive strategies for historical data

## Security Considerations

### Data Isolation
- Profile data should be isolated per user if applicable
- Session data should not leak between profiles
- Sensitive configuration should be protected
- Audit trail for configuration changes

### Access Control
- Restrict access to development data
- Validate user permissions for profile operations
- Log administrative operations
- Protect against SQL injection

## Monitoring and Reporting

### Metrics Collection
The database should support collection of:
- Development session duration statistics
- Error rate by session type
- Profile usage patterns
- System performance metrics

### Reporting Queries
Support for development productivity reports:
- Session success rates by type
- Development time allocation
- Error frequency analysis
- Profile effectiveness metrics