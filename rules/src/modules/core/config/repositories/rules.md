# Repositories Subfolder Rules

## Purpose
Repositories implement the data access layer, providing a clean interface between services and the database. They encapsulate all SQL operations and database-specific logic.

## Required Files

### config.repository.ts (MANDATORY)
**MUST** be named exactly as the service name (e.g., `config.repository.ts` for `ConfigService`).

## Repository Implementation Pattern

### Required Structure
```typescript
// MUST import auto-generated database types
import { type IConfigRow, ConfigType } from '@/modules/core/config/types/database.generated';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import type { IDatabaseConnection } from '@/modules/core/database/types/database.types';

export class ConfigRepository {
  private static instance: ConfigRepository;
  private dbService?: DatabaseService;

  private constructor() {}

  static getInstance(): ConfigRepository {
    ConfigRepository.instance ||= new ConfigRepository();
    return ConfigRepository.instance;
  }

  async initialize() {
    this.dbService = DatabaseService.getInstance();
  }

  private async getDatabase(): Promise<IDatabaseConnection> {
    if (!this.dbService) {
      throw new Error('Repository not initialized');
    }
    return await this.dbService.getConnection();
  }

  // CRUD operations using ONLY auto-generated types...
}
```

## Required Implementation Details

### Singleton Pattern
- **MUST** use singleton pattern with `getInstance()`
- **MUST** have private constructor
- **MUST** implement `initialize()` method for lazy initialization

### Database Access
- **MUST** use `DatabaseService.getInstance()` for database access
- **MUST** get connection via `await this.dbService.getConnection()`
- **MUST** check initialization state before database operations
- **MUST** use prepared statements for all parameterized queries

### Method Patterns

#### Create/Set Operations (Using Auto-Generated Types)
```typescript
// Parameter types auto-generated from service method signatures
async setConfig(configData: IConfigCreateData): Promise<IConfigRow> {
  const database = await this.getDatabase();
  
  // Check if config exists for upsert
  const existing = await this.getConfig(configData.key);
  
  if (existing) {
    // Update existing config
    const stmt = await database.prepare(
      `UPDATE config SET 
        value = ?, 
        type = ?, 
        description = ?,
        updated_at = ?
      WHERE key = ?`
    );

    await stmt.run([
      configData.value,
      configData.type || 'string',
      configData.description || null,
      new Date().toISOString(),
      configData.key
    ]);

    await stmt.finalize();
    
    // Return updated record
    const updated = await this.getConfig(configData.key);
    if (!updated) {
      throw new Error(`Config not found after update: ${configData.key}`);
    }
    return updated;
  } else {
    // Insert new config
    const stmt = await database.prepare(
      `INSERT INTO config (
        id, key, value, type, description, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    await stmt.run([
      configData.id,
      configData.key,
      configData.value,
      configData.type || 'string',
      configData.description || null,
      configData.created_at,
      configData.updated_at
    ]);

    await stmt.finalize();
    
    // Return auto-generated database row type
    return {
      id: configData.id,
      key: configData.key,
      value: configData.value,
      type: configData.type || 'string',
      description: configData.description || null,
      created_at: configData.created_at,
      updated_at: configData.updated_at
    };
  }
}
```

#### Read Operations (Auto-Generated Return Types)
```typescript
async getConfig(key: string): Promise<IConfigRow | null> {
  const database = await this.getDatabase();
  const result = await database.query<IConfigRow>(
    'SELECT * FROM config WHERE key = ?',
    [key]
  );
  return result.rows[0] || null;
}

async listConfigs(prefix?: string): Promise<IConfigRow[]> {
  const database = await this.getDatabase();
  
  let query = 'SELECT * FROM config';
  const params: string[] = [];
  
  if (prefix) {
    query += ' WHERE key LIKE ?';
    params.push(`${prefix}%`);
  }
  
  query += ' ORDER BY key ASC';
  
  const result = await database.query<IConfigRow>(query, params);
  return result.rows;
}

async findById(id: string): Promise<IConfigRow | null> {
  const database = await this.getDatabase();
  const result = await database.query<IConfigRow>(
    'SELECT * FROM config WHERE id = ?',
    [id]
  );
  return result.rows[0] || null;
}
```

#### Update Operations (Auto-Generated Parameter Types)
```typescript
async updateConfig(key: string, data: IConfigUpdateData): Promise<IConfigRow> {
  const database = await this.getDatabase();
  
  const updates = [];
  const values = [];

  // Use exact column names from auto-generated schema
  if (data.value !== undefined) {
    updates.push('value = ?');
    values.push(data.value);
  }
  if (data.type !== undefined) {
    updates.push('type = ?');  
    values.push(data.type);
  }
  if (data.description !== undefined) {
    updates.push('description = ?');  
    values.push(data.description);
  }
  
  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(key);

  const stmt = await database.prepare(
    `UPDATE config SET ${updates.join(', ')} WHERE key = ?`
  );
  await stmt.run(values);
  await stmt.finalize();
  
  const config = await this.getConfig(key);
  if (!config) {
    throw new Error(`Config not found after update: ${key}`);
  }
  return config;
}
```

#### Delete Operations
```typescript
async deleteConfig(key: string): Promise<void> {
  const database = await this.getDatabase();
  const stmt = await database.prepare('DELETE FROM config WHERE key = ?');
  await stmt.run([key]);
  await stmt.finalize();
}

async deleteById(id: string): Promise<void> {
  const database = await this.getDatabase();
  const stmt = await database.prepare('DELETE FROM config WHERE id = ?');
  await stmt.run([id]);
  await stmt.finalize();
}
```

## Type Safety Requirements

### AUTO-GENERATED TYPES ONLY
**CRITICAL**: Repositories **MUST ONLY** use auto-generated types from the type generation system.

### Database Types (Auto-Generated from schema.sql)
- **MUST** use generated types from `types/database.generated.ts`
- **MUST** import table row interfaces (e.g., `IConfigRow`)
- **MUST** import enum types for status fields (e.g., `ConfigType`)
- **MUST** use exact column names matching the SQL schema

### Service Interface Types (Auto-Generated from service exports)
- **MUST** use create/update data interfaces generated from service method signatures
- **MUST** import from `types/config.module.generated.ts` (auto-generated from service analysis)
- **MUST** use exact parameter types matching service method definitions

### Return Types (Generated from Service Analysis)
- **MUST** return database row types directly (`Promise<IConfigRow | null>`)
- **MUST NOT** transform to domain types (services handle transformation)
- **MUST** return `Promise<IConfigRow[]>` for list operations
- **MUST** return `Promise<IConfigRow>` for create/update operations
- **MUST** return `Promise<void>` for delete operations

## Auto-Generated Type Integration

### Type Generation Source
Repository parameter and return types are **automatically generated** from:

1. **SQL Schema Analysis** (`database/schema.sql`)
   - Generates `IConfigRow` interface with exact column types
   - Generates type enums from CHECK constraints
   - Generates nullable/required field information

2. **Service Method Analysis** (TypeScript AST analysis)
   - Analyzes service method signatures to generate subset types
   - Creates create/update data interfaces based on service parameters
   - Ensures type compatibility between service and repository layers

### Type Safety Enforcement

The type generation system ensures:
- **Schema Consistency** - Repository types match actual database schema
- **Service Compatibility** - Parameter types match service method expectations  
- **Null Safety** - Nullable fields properly typed based on SQL schema
- **Enum Validation** - Type fields use generated enum types from CHECK constraints
- **Column Accuracy** - Field names exactly match database column names

Repositories serve as the **type-safe data access layer**, using only auto-generated types to ensure perfect alignment between database schema, service interfaces, and runtime behavior.