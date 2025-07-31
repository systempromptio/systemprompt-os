# Core Modules Rules

## Purpose
This directory contains all core SystemPrompt OS modules. Each module must follow strict architectural patterns for consistency, type safety, and maintainability.

## Module Architecture Standards

### Required Directory Structure
Every core module MUST have this exact structure:
```
src/modules/core/{module}/
├── index.ts                 # Module class and exports interface
├── module.yaml             # Module configuration
├── cli/                    # CLI commands (optional)
├── database/               # Database schema and migrations
│   └── schema.sql          # REQUIRED: Database schema
├── repositories/           # Data access layer  
│   └── {service}.repository.ts
├── services/              # Business logic layer
│   └── {module}.service.ts
├── types/                 # Type definitions
│   ├── database.generated.ts  # AUTO-GENERATED from schema.sql
│   ├── {module}.module.generated.ts  # AUTO-GENERATED from service
│   └── index.ts           # Manual types (minimal, justified only)
└── utils/                 # Pure utility functions (optional)
```

## Critical Module Sanitization Rules

### 1. Auto-Generated Types Only
**CRITICAL**: ALL types MUST be auto-generated from the database schema and service implementations.

- **Database Types**: Generated from `database/schema.sql` using type generation system
- **Service Interfaces**: Generated from service method signatures via TypeScript AST analysis
- **Manual Types**: HIGHLY RESTRICTED - require written justification
- **NO Re-exports**: Use auto-generated types directly, never re-export types

#### Violations to Fix:
```typescript
// ❌ WRONG: Re-exporting types
export type { ITaskRow } from './database.generated';

// ✅ CORRECT: Import auto-generated types directly
import type { ITaskRow } from '@/modules/core/tasks/types/database.generated';
```

### 2. Service Architecture
**MUST** follow singleton service pattern:

- **Index File**: Contains ONLY the module class and standardized methods
- **Services Folder**: Contains ALL business logic implementations
- **NO Services in Index**: Never define services in index.ts - use service folder

#### Correct Pattern:
```typescript
// index.ts - ONLY module class
export class TasksModule implements IModule<ITasksModuleExports> {
  get exports(): ITasksModuleExports {
    return {
      service: () => this.getService(), // Returns service instance
    };
  }
  
  getService(): ITaskService {
    return this.taskService; // Singleton from services/
  }
}
```

### 3. Database Schema Requirements
- **Structured Data**: Prefer structured columns over JSON storage
- **JSON Justification**: JSON in database HIGHLY restricted - must be justified
- **Auto-Generation**: All database types generated from schema.sql
- **No Manual DB Types**: Never manually create database row interfaces

#### Schema Guidelines:
```sql
-- ✅ CORRECT: Structured storage
CREATE TABLE task_metadata (
  task_id INTEGER NOT NULL,
  key VARCHAR(255) NOT NULL,
  value TEXT,
  FOREIGN KEY (task_id) REFERENCES task(id)
);

-- ❌ WRONG: Avoid JSON unless highly justified
CREATE TABLE task (
  metadata TEXT -- JSON blob
);
```

### 4. Type Generation Process
Types are generated via:
1. **Database Types**: `npm run typecheck` → generates from schema.sql
2. **Service Interfaces**: TypeScript AST analysis of service methods
3. **Module Exports**: Generated from service implementations

### 5. Import Patterns
**MUST** use proper import patterns:

```typescript
// ✅ CORRECT: Direct imports from auto-generated types
import type { ITaskRow, TaskStatus } from '@/modules/core/tasks/types/database.generated';
import type { ITaskService } from '@/modules/core/tasks/types/tasks.service.generated';

// ❌ WRONG: Importing from manual type files
import type { ITaskRow } from '@/modules/core/tasks/types/index';
```

## Module Validation Checklist

Before considering a module complete, verify:

- [ ] All types are auto-generated from schema and services
- [ ] No manual type definitions (unless highly justified with comments)
- [ ] No re-exports of types in index.ts
- [ ] Services defined in services/ folder, not index.ts
- [ ] Database uses structured storage (minimal JSON)
- [ ] Schema.sql exists and follows naming conventions
- [ ] Module class follows singleton pattern
- [ ] All imports use auto-generated types directly
- [ ] No TypeScript compilation errors
- [ ] Proper error handling and logging

## Type Error Resolution

If TypeScript errors exist:
1. **Check Auto-Generation**: Ensure types are generated from latest schema
2. **Run Type Generation**: `npm run typecheck` or use dev CLI commands
3. **Verify Imports**: Use auto-generated types, not manual ones
4. **Check Schema**: Ensure database schema matches type usage
5. **Service Analysis**: Verify service methods match generated interfaces

## Forbidden Patterns

**NEVER**:
- Define services in index.ts
- Re-export types from manual files
- Create manual database row interfaces
- Store unstructured JSON without justification
- Skip type generation
- Import from non-generated type files
- Leave TypeScript compilation errors

## Compliance Verification

Run these checks for each module:
```bash
# Generate types
./bin/systemprompt dev generate-types {module}

# Validate module compliance  
./bin/systemprompt dev validate {module}

# Check for type errors
npm run typecheck
```

Every core module MUST pass these checks before being considered complete. The module sanitization process ensures consistency, type safety, and maintainability across the entire SystemPrompt OS codebase.