# Database Module

## Overview
The Database module is the core data persistence layer for SystemPrompt OS. It provides a world-class, scalable plugin system with automatic schema discovery, migration management, and multi-database support. This module enables all other modules to store and retrieve data reliably.

## Features

- **Auto-Discovery**: Automatically discovers and initializes database schemas from all modules
- **Migration System**: Built-in migration tracking and execution
- **Multi-Database Support**: SQLite (default) with PostgreSQL compatibility
- **Transaction Management**: ACID-compliant transaction support
- **Connection Pooling**: Efficient connection management for high-performance
- **Type Safety**: Full TypeScript support with type-safe queries
- **Schema Versioning**: Tracks schema versions and prevents re-initialization

## Architecture

The database module consists of three main services:

1. **DatabaseService**: Core database operations and connection management
2. **SchemaService**: Schema discovery and initialization
3. **MigrationService**: Migration discovery and execution

## Usage

### Basic Operations

```typescript
import { getDatabase } from '@modules/core/database';

const db = getDatabase();

// Execute a query
const users = await db.query('SELECT * FROM users WHERE active = ?', [true]);

// Execute a command
await db.execute('UPDATE users SET last_login = ? WHERE id = ?', [new Date(), userId]);

// Use transactions
await db.transaction(async (conn) => {
  await conn.execute('INSERT INTO orders (user_id, total) VALUES (?, ?)', [userId, total]);
  await conn.execute('UPDATE inventory SET stock = stock - ? WHERE id = ?', [quantity, itemId]);
});
```

### Schema Management

```typescript
import { getSchemaService } from '@modules/core/database';

const schemaService = getSchemaService();

// Get all discovered schemas
const schemas = schemaService.getAllSchemas();

// Get schema for specific module
const authSchema = schemaService.getSchema('core/auth');
```

## Configuration

The database module can be configured through environment variables:

```bash
# Database type (sqlite or postgres)
DATABASE_TYPE=sqlite

# SQLite configuration
DATABASE_FILE=/data/state/systemprompt.db

# PostgreSQL configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=systemprompt
POSTGRES_USER=systemprompt
POSTGRES_PASSWORD=secret
POSTGRES_SSL=true

# Connection pool settings
DB_POOL_MIN=1
DB_POOL_MAX=10
DB_IDLE_TIMEOUT=30000
```

---

# Extension Guide for Module Developers

The following section explains how modules can leverage the database system to manage their schemas.

## Module Database Structure

Every module that requires database tables must follow this structure:

```
/src/modules/{module-name}/
├── database/
│   ├── schema.sql        # Table definitions (REQUIRED)
│   ├── init.sql         # Initial data (OPTIONAL)
│   ├── models/          # TypeScript type definitions
│   │   └── index.ts     # Export all models
│   └── migrations/      # Schema migrations
│       └── *.sql        # Migration files
```

## Schema Files

### schema.sql (Required)
Contains all table definitions for your module. Tables should be prefixed with your module name.

```sql
-- Example: Config Module Schema
CREATE TABLE IF NOT EXISTS config_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key VARCHAR(255) NOT NULL UNIQUE,
  value TEXT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'string',
  description TEXT,
  encrypted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Always include indexes for performance
CREATE INDEX IF NOT EXISTS idx_config_settings_key ON config_settings(key);
CREATE INDEX IF NOT EXISTS idx_config_settings_type ON config_settings(type);
```

### init.sql (Optional)
Contains initial data to populate tables after creation.

```sql
-- Example: Insert default configurations
INSERT OR IGNORE INTO config_settings (key, value, type, description) VALUES
  ('system.name', 'SystemPrompt OS', 'string', 'System display name'),
  ('system.version', '1.0.0', 'string', 'System version'),
  ('system.debug', 'false', 'boolean', 'Debug mode enabled');
```

### models/index.ts
TypeScript type definitions for your tables.

```typescript
export interface ConfigSetting {
  id: number;
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'json' | 'array';
  description?: string;
  encrypted: boolean;
  created_at: Date;
  updated_at: Date;
}

export type CreateConfigInput = Omit<ConfigSetting, 'id' | 'created_at' | 'updated_at'>;
export type UpdateConfigInput = Partial<Omit<ConfigSetting, 'id' | 'key' | 'created_at'>>;
```

## Best Practices

### 1. Table Naming Convention
- Prefix all tables with your module name: `{module}_tablename`
- Use snake_case for table and column names
- Examples: `auth_users`, `config_settings`, `mcp_providers`

### 2. Column Standards
- Always include `created_at` and `updated_at` timestamps
- Use `INTEGER PRIMARY KEY AUTOINCREMENT` for SQLite compatibility
- Define NOT NULL constraints where appropriate
- Add DEFAULT values for optional fields

### 3. Index Strategy
- Index foreign keys
- Index columns used in WHERE clauses
- Index columns used in JOIN conditions
- Use compound indexes for multi-column queries

### 4. Type Safety
- Define TypeScript interfaces for all tables
- Create input types for create/update operations
- Export query interfaces for filtering

## Migration System

The database module supports automatic migrations:

```
database/migrations/
├── 001_add_priority_column.sql
├── 002_create_audit_table.sql
└── 003_add_metadata_field.sql
```

Migration files are executed in alphabetical order and tracked to prevent re-execution.

## Service Integration

To interact with your module's database tables, use the DatabaseService:

```typescript
import { getDatabase } from '@modules/core/database';

export class ConfigService {
  private db = getDatabase();
  
  async getConfig(key: string): Promise<ConfigSetting | null> {
    const results = await this.db.query<ConfigSetting>(
      'SELECT * FROM config_settings WHERE key = ?',
      [key]
    );
    return results[0] || null;
  }
  
  async setConfig(key: string, value: string): Promise<void> {
    await this.db.execute(
      `INSERT INTO config_settings (key, value) 
       VALUES (?, ?) 
       ON CONFLICT(key) DO UPDATE SET 
         value = excluded.value,
         updated_at = CURRENT_TIMESTAMP`,
      [key, value]
    );
  }
}
```

## Auto-Discovery Process

When the database module initializes:

1. Scans all module directories for `/database/schema.sql`
2. Loads schema definitions and optional init.sql files
3. Creates tables in dependency order
4. Executes init.sql to populate initial data
5. Tracks initialized schemas in `_schema_versions` table
6. Discovers and runs pending migrations

## Module Dependencies

If your module depends on another module's tables:
- Declare dependencies in your module.yaml
- The schema service will initialize modules in correct order
- Use foreign key constraints to ensure referential integrity

## Testing Database Schemas

1. Unit test your schema creation:
```typescript
describe('Config Schema', () => {
  it('should create all required tables', async () => {
    const schemas = await schemaService.discoverSchemas();
    const configSchema = schemas.find(s => s.module === 'core/config');
    expect(configSchema).toBeDefined();
  });
});
```

2. Integration test your models:
```typescript
it('should handle CRUD operations', async () => {
  const setting = await configService.create({
    key: 'test.key',
    value: 'test value',
    type: 'string'
  });
  expect(setting.id).toBeDefined();
});
```

## Troubleshooting

### Schema Not Found
- Ensure schema.sql is in the correct location
- Check file permissions
- Verify module directory structure

### Table Already Exists
- The system uses CREATE TABLE IF NOT EXISTS
- Check for naming conflicts with other modules
- Review _schema_versions table for initialization status

### Migration Failures
- Migrations must be idempotent
- Use IF NOT EXISTS for schema changes
- Test migrations on a copy of production data

## Example: Complete Module Database Setup

See the `auth` module for a complete example:
- Complex schema with multiple related tables
- Proper indexing strategy
- TypeScript models with full type safety
- Initial data population
- Migration examples