# Database Subfolder Rules

## Purpose
Database schemas are managed by the central Database module (`@/modules/core/database`). Each module's database concerns are automatically discovered and integrated during bootstrap.

## Required Files

### schema.sql (MANDATORY)
**CRITICAL**: This is the **ONLY** file that should exist in this directory.

- **MUST** contain SQL schema definition for the module's data model
- **MUST** use standard SQL DDL (CREATE TABLE, CREATE INDEX, etc.)
- **MUST** follow SQL naming conventions (snake_case for tables/columns)
- **MUST** include proper constraints, indexes, and relationships
- **MUST** be idempotent (use IF NOT EXISTS where applicable)

### Schema Requirements

```sql
-- Database module schema
-- Brief description of module's data model

CREATE TABLE IF NOT EXISTS database (
    id TEXT PRIMARY KEY,
    -- Column definitions with proper types and constraints
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Required indexes for performance
CREATE INDEX IF NOT EXISTS idx_database_{field} ON database({field});
```

## Database Integration

The Database module automatically:
1. **Discovers** schema.sql files during bootstrap via `SchemaService.discoverSchemas()`
2. **Parses** SQL using `SQLParserService` to extract table definitions
3. **Generates** TypeScript types from schema using the type generator
4. **Initializes** schemas via `SchemaService.initializeSchemas()`
5. **Creates** module-specific database adapters

## Type Generation Process

From schema.sql, the system **AUTO-GENERATES**:
- `types/database.generated.ts` - Table row interfaces and enums
- Domain interfaces in `types/database.module.generated.ts` 
- Service validation schemas

## Schema Design Guidelines

### Table Naming
- Use singular noun names (e.g., `user`, not `users`)
- Use snake_case for table and column names
- Prefix with module name if needed to avoid conflicts

### Primary Keys
- **ALWAYS** use TEXT PRIMARY KEY for IDs
- Use UUIDs or other string identifiers
- Never use auto-incrementing integers

### Required Columns
- `id TEXT PRIMARY KEY` - Unique identifier
- `created_at DATETIME DEFAULT CURRENT_TIMESTAMP` - Creation timestamp
- `updated_at DATETIME DEFAULT CURRENT_TIMESTAMP` - Last update timestamp

### Status Fields
- Use CHECK constraints for enum-like values
- Define all possible status values in the constraint
- Default to 'active' or appropriate initial state

### JSON Columns
- Use TEXT type for JSON data
- Clearly document JSON structure in comments
- Consider separate tables for complex relationships

### Indexes
- **ALWAYS** create indexes for frequently queried columns
- Use `IF NOT EXISTS` to prevent conflicts
- Name indexes with pattern: `idx_{table}_{column(s)}`

## Forbidden Patterns

**NEVER**:
- Create migration files (handled automatically)
- Create seed data files (use services for initial data)
- Create stored procedures or triggers
- Use database-specific SQL extensions
- Create views (define in queries instead)
- Add manual TypeScript files (all types are generated)

## Schema Validation

The system validates:
- SQL syntax correctness
- Table and column naming conventions
- Required column presence
- Index naming patterns
- Constraint definitions

Invalid schemas will prevent module initialization and must be fixed before the system can start.