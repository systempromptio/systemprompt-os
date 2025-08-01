# Dev Module Repositories Rules

## Purpose
The dev module repositories provide data access layer for development profiles, session tracking, and development operation metadata.

## Required Repository Structure

### DevRepository Requirements
The main repository MUST implement comprehensive data access for development operations:

```typescript
export class DevRepository {
  // Singleton pattern
  private static instance: DevRepository;
  static getInstance(): DevRepository;
  
  // Profile management
  async createProfile(name: string, description?: string, config?: IDevProfileConfig): Promise<IDevProfilesRow>;
  async getProfileByName(name: string): Promise<IDevProfilesRow | null>;
  async getProfileById(id: number): Promise<IDevProfilesRow | null>;
  async updateProfile(id: number, updates: Partial<IDevProfilesRow>): Promise<IDevProfilesRow>;
  async deleteProfile(id: number): Promise<void>;
  async getAllProfiles(): Promise<IDevProfilesRow[]>;
  
  // Session management
  async startSession(type: DevSessionType, profileId?: number): Promise<IDevSessionsRow>;
  async endSession(sessionId: number, status: DevSessionStatus, metadata?: IDevSessionMetadata): Promise<void>;
  async getSessionById(id: number): Promise<IDevSessionsRow | null>;
  async getActiveSessions(profileId?: number): Promise<IDevSessionsRow[]>;
  async getAllSessions(profileId?: number): Promise<IDevSessionsRow[]>;
  async getSessionStats(profileId?: number): Promise<SessionStatistics>;
  
  // Cleanup and maintenance
  async cleanupOldSessions(retentionDays: number): Promise<number>;
  async archiveCompletedSessions(archiveDays: number): Promise<number>;
}
```

## Implementation Standards

### Database Integration
All repository methods MUST:
- Use DatabaseService singleton for database access
- Validate all inputs using Zod schemas
- Validate all outputs using generated database schemas
- Handle database errors gracefully
- Use prepared statements for SQL injection prevention

### Type Safety Requirements
```typescript
import { 
  DevProfilesRowSchema,
  DevSessionsRowSchema,
  DevSessionTypeSchema,
  DevSessionStatusSchema,
  type IDevProfilesRow,
  type IDevSessionsRow,
  type DevSessionType,
  type DevSessionStatus
} from '@/modules/core/dev/types/database.generated';

// Validate inputs
async createProfile(name: string, description?: string, config?: IDevProfileConfig): Promise<IDevProfilesRow> {
  // Validate parameters
  const nameSchema = z.string().min(1).max(255);
  const validatedName = nameSchema.parse(name);
  
  // Database operation
  const result = await this.db.query(
    `INSERT INTO dev_profiles (name, description, config_enabled, config_auto_save, config_debug_mode) 
     VALUES (?, ?, ?, ?, ?) RETURNING *`,
    [validatedName, description || null, config?.enabled ? 1 : 0, config?.autoSave ? 1 : 0, config?.debugMode ? 1 : 0]
  );
  
  // Validate output
  return DevProfilesRowSchema.parse(result.rows[0]);
}
```

### Error Handling
All repository methods MUST implement comprehensive error handling:

```typescript
async getProfileByName(name: string): Promise<IDevProfilesRow | null> {
  try {
    const result = await this.db.query(
      'SELECT * FROM dev_profiles WHERE name = ?',
      [name]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return DevProfilesRowSchema.parse(result.rows[0]);
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw new RepositoryError(`Database error getting profile: ${error.message}`, { name });
    }
    throw new RepositoryError(`Unexpected error getting profile: ${error.message}`, { name });
  }
}
```

## Profile Management Methods

### Create Profile
```typescript
async createProfile(name: string, description?: string, config?: IDevProfileConfig): Promise<IDevProfilesRow> {
  // Validate unique name constraint
  const existing = await this.getProfileByName(name);
  if (existing) {
    throw new RepositoryError('Profile name already exists', { name });
  }
  
  // Insert with validation
  const result = await this.db.query(
    `INSERT INTO dev_profiles (name, description, config_enabled, config_auto_save, config_debug_mode) 
     VALUES (?, ?, ?, ?, ?) RETURNING *`,
    [name, description || null, config?.enabled ? 1 : 0, config?.autoSave ? 1 : 0, config?.debugMode ? 1 : 0]
  );
  
  return DevProfilesRowSchema.parse(result.rows[0]);
}
```

### Update Profile
```typescript
async updateProfile(id: number, updates: Partial<IDevProfilesRow>): Promise<IDevProfilesRow> {
  // Build dynamic update query
  const setClause = [];
  const values = [];
  
  if (updates.name !== undefined) {
    setClause.push('name = ?');
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    setClause.push('description = ?');
    values.push(updates.description);
  }
  // Add other updateable fields...
  
  setClause.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);
  
  const result = await this.db.query(
    `UPDATE dev_profiles SET ${setClause.join(', ')} WHERE id = ? RETURNING *`,
    values
  );
  
  if (result.rows.length === 0) {
    throw new RepositoryError('Profile not found', { id });
  }
  
  return DevProfilesRowSchema.parse(result.rows[0]);
}
```

## Session Management Methods

### Start Session
```typescript
async startSession(type: DevSessionType, profileId?: number): Promise<IDevSessionsRow> {
  // Validate session type
  const validatedType = DevSessionTypeSchema.parse(type);
  
  // Validate profile exists if provided
  if (profileId) {
    const profile = await this.getProfileById(profileId);
    if (!profile) {
      throw new RepositoryError('Profile not found', { profileId });
    }
  }
  
  const result = await this.db.query(
    `INSERT INTO dev_sessions (profile_id, type, status) 
     VALUES (?, ?, 'active') RETURNING *`,
    [profileId || null, validatedType]
  );
  
  return DevSessionsRowSchema.parse(result.rows[0]);
}
```

### End Session
```typescript
async endSession(sessionId: number, status: DevSessionStatus, metadata?: IDevSessionMetadata): Promise<void> {
  // Validate session exists and is active
  const session = await this.getSessionById(sessionId);
  if (!session) {
    throw new RepositoryError('Session not found', { sessionId });
  }
  if (session.status !== 'active') {
    throw new RepositoryError('Session is not active', { sessionId, currentStatus: session.status });
  }
  
  // Validate status
  const validatedStatus = DevSessionStatusSchema.parse(status);
  
  await this.db.query(
    `UPDATE dev_sessions 
     SET status = ?, ended_at = CURRENT_TIMESTAMP, exit_code = ?, output_lines = ?, error_count = ?
     WHERE id = ?`,
    [validatedStatus, metadata?.exitCode || null, metadata?.outputLines || 0, metadata?.errorCount || 0, sessionId]
  );
}
```

### Session Statistics
```typescript
async getSessionStats(profileId?: number): Promise<{
  total: number;
  active: number;
  completed: number;
  failed: number;
  averageDuration: number;
}> {
  const whereClause = profileId ? 'WHERE profile_id = ?' : '';
  const params = profileId ? [profileId] : [];
  
  const result = await this.db.query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      AVG(
        CASE WHEN ended_at IS NOT NULL 
        THEN (julianday(ended_at) - julianday(started_at)) * 24 * 60 * 60 
        ELSE NULL END
      ) as avg_duration_seconds
    FROM dev_sessions ${whereClause}
  `, params);
  
  const stats = result.rows[0];
  return {
    total: Number(stats.total) || 0,
    active: Number(stats.active) || 0,
    completed: Number(stats.completed) || 0,
    failed: Number(stats.failed) || 0,
    averageDuration: Number(stats.avg_duration_seconds) || 0
  };
}
```

## Maintenance Methods

### Cleanup Old Sessions
```typescript
async cleanupOldSessions(retentionDays: number): Promise<number> {
  const result = await this.db.query(`
    DELETE FROM dev_sessions 
    WHERE status IN ('completed', 'failed', 'cancelled') 
    AND datetime(ended_at) < datetime('now', '-' || ? || ' days')
  `, [retentionDays]);
  
  return result.changes || 0;
}
```

### Archive Sessions
```typescript
async archiveCompletedSessions(archiveDays: number): Promise<number> {
  // Implementation would move old sessions to archive table
  // or export to file for long-term storage
  const result = await this.db.query(`
    SELECT COUNT(*) as count FROM dev_sessions 
    WHERE status IN ('completed', 'failed') 
    AND datetime(ended_at) < datetime('now', '-' || ? || ' days')
  `, [archiveDays]);
  
  return Number(result.rows[0].count) || 0;
}
```

## Performance Requirements

### Query Optimization
- Use indexes for frequently queried columns
- Implement pagination for large result sets
- Use prepared statements for repeated queries
- Cache frequently accessed data where appropriate

### Connection Management
- Use connection pooling through DatabaseService
- Handle connection errors gracefully
- Implement retry logic for transient failures
- Monitor connection usage patterns

## Testing Requirements

### Unit Tests
All repository methods MUST have unit tests covering:
- Successful operations with valid data
- Error handling for invalid inputs
- Database constraint violations
- Edge cases (empty results, null values)
- Type validation for inputs and outputs

### Integration Tests
Repository MUST have integration tests covering:
- End-to-end database operations
- Transaction handling
- Concurrent access scenarios
- Performance under load
- Data integrity constraints

## Security Requirements

### Input Validation
- Validate all inputs using Zod schemas
- Sanitize string inputs to prevent injection
- Validate numeric ranges and constraints
- Check foreign key relationships exist

### Access Control
- Implement profile-based access control if needed
- Log administrative operations
- Validate user permissions for operations
- Protect sensitive configuration data

## Monitoring and Logging

### Operation Logging
Log all significant database operations:
- Profile creation, updates, and deletions
- Session start and end events
- Error conditions and failures
- Performance metrics and slow queries

### Metrics Collection
Track repository performance metrics:
- Query execution times
- Connection pool usage
- Error rates by operation type
- Data volume and growth trends