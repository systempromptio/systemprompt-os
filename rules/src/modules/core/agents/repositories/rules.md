# Repositories Subfolder Rules

## Purpose
Repositories implement the data access layer, providing a clean interface between services and the database. They encapsulate all SQL operations and database-specific logic.

## Required Files

### {service-name}.repository.ts (MANDATORY)
**MUST** be named exactly as the service name (e.g., `{module}.repository.ts` for `{Module}Service`).

## Repository Implementation Pattern

### Required Structure
```typescript
// MUST import auto-generated database types
import { type I{Module}Row, {Module}Status } from '@/modules/core/{module}/types/database.generated';
import { DatabaseService } from '@/modules/core/database/services/database.service';
import type { IDatabaseConnection } from '@/modules/core/database/types/database.types';

export class {Module}Repository {
  private static instance: {Module}Repository;
  private dbService?: DatabaseService;

  private constructor() {}

  static getInstance(): {Module}Repository {
    {Module}Repository.instance ||= new {Module}Repository();
    return {Module}Repository.instance;
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

#### Create Operations (Using Auto-Generated Types)
```typescript
// Parameter types auto-generated from service method signatures
async create{Entity}({entity}Data: /* Auto-generated type subset */): Promise<I{Module}Row> {
  const database = await this.getDatabase();
  
  const stmt = await database.prepare(
    `INSERT INTO {table_name} (
      id, field1, field2, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)`
  );

  await stmt.run([
    {entity}Data.id,
    {entity}Data.field1,
    {entity}Data.field2,
    {entity}Data.status,
    {entity}Data.created_at,
    {entity}Data.updated_at
  ]);

  await stmt.finalize();
  
  // Return auto-generated database row type
  return {
    id: {entity}Data.id,
    field1: {entity}Data.field1,
    field2: {entity}Data.field2,
    status: {entity}Data.status,
    created_at: {entity}Data.created_at,
    updated_at: {entity}Data.updated_at
  };
}
```

#### Read Operations (Auto-Generated Return Types)
```typescript
async findById(id: string): Promise<I{Module}Row | null> {
  const database = await this.getDatabase();
  const result = await database.query<I{Module}Row>(
    'SELECT * FROM {table_name} WHERE id = ?',
    [id]
  );
  return result.rows[0] || null;
}

async findAll(): Promise<I{Module}Row[]> {
  const database = await this.getDatabase();
  const result = await database.query<I{Module}Row>(
    'SELECT * FROM {table_name} ORDER BY created_at DESC'
  );
  return result.rows;
}
```

#### Update Operations (Auto-Generated Parameter Types)
```typescript
async update{Entity}(id: string, data: /* Auto-generated update type subset */): Promise<I{Module}Row> {
  const database = await this.getDatabase();
  
  const updates = [];
  const values = [];

  // Use exact column names from auto-generated schema
  if (data.field1 !== undefined) {
    updates.push('field1 = ?');
    values.push(data.field1);
  }
  if (data.field2 !== undefined) {
    updates.push('field2 = ?');  
    values.push(data.field2);
  }
  
  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  const stmt = await database.prepare(
    `UPDATE {table_name} SET ${updates.join(', ')} WHERE id = ?`
  );
  await stmt.run(values);
  await stmt.finalize();
  
  const {entity} = await this.findById(id);
  if (!{entity}) {
    throw new Error(`{Entity} not found after update: ${id}`);
  }
  return {entity};
}
```

#### Delete Operations
```typescript
async delete{Entity}(id: string): Promise<void> {
  const database = await this.getDatabase();
  const stmt = await database.prepare('DELETE FROM {table_name} WHERE id = ?');
  await stmt.run([id]);
  await stmt.finalize();
}
```

## Type Safety Requirements

### AUTO-GENERATED TYPES ONLY
**CRITICAL**: Repositories **MUST ONLY** use auto-generated types from the type generation system.

### Database Types (Auto-Generated from schema.sql)
- **MUST** use generated types from `types/database.generated.ts`
- **MUST** import table row interfaces (e.g., `I{Module}Row`)
- **MUST** import enum types for status fields (e.g., `{Module}Status`)
- **MUST** use exact column names matching the SQL schema

### Service Interface Types (Auto-Generated from service exports)
- **MUST** use create/update data interfaces generated from service method signatures
- **MUST** import from `types/{module}.module.generated.ts` (auto-generated from service analysis)
- **MUST** use exact parameter types matching service method definitions

### Return Types (Generated from Service Analysis)
- **MUST** return database row types directly (`Promise<I{Module}Row | null>`)
- **MUST NOT** transform to domain types (services handle transformation)
- **MUST** return `Promise<I{Module}Row[]>` for list operations
- **MUST** return `Promise<I{Module}Row>` for create/update operations
- **MUST** return `Promise<void>` for delete operations

## Auto-Generated Type Integration

### Type Generation Source
Repository parameter and return types are **automatically generated** from:

1. **SQL Schema Analysis** (`database/schema.sql`)
   - Generates `I{Module}Row` interface with exact column types
   - Generates status enums from CHECK constraints
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
- **Enum Validation** - Status fields use generated enum types from CHECK constraints
- **Column Accuracy** - Field names exactly match database column names

Repositories serve as the **type-safe data access layer**, using only auto-generated types to ensure perfect alignment between database schema, service interfaces, and runtime behavior.