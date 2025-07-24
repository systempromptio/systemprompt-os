# Module Folder Structure Enforcement

This document describes the folder structure rules for modules in the SystemPrompt OS codebase.

## Overview

Each module must follow a consistent folder structure to maintain code organization and architectural integrity. We've created an ESLint plugin (`eslint-plugin-module-structure`) to enforce these conventions.

## Required Module Structure

```
src/modules/
└── <module-name>/
    ├── index.ts              # Module entry point (required)
    ├── module.yaml           # Module configuration (required)
    ├── README.md             # Module documentation (optional)
    ├── cli/                  # Command-line interface commands
    ├── services/             # Business logic layer
    ├── repositories/         # Data access layer
    ├── types/                # TypeScript type definitions
    ├── database/             # Database schemas and migrations
    ├── utils/                # Utility functions
    ├── prompts/              # MCP prompt files
    ├── resources/            # MCP resource files
    ├── tools/                # MCP tool definitions
    ├── executors/            # Task executors
    ├── providers/            # External service providers
    ├── schemas/              # JSON schemas
    ├── models/               # Data models
    ├── interfaces/           # Interface definitions
    ├── adapters/             # Adapter implementations
    └── migrations/           # Database migrations
```

## Folder-Specific Rules

### 1. CLI Commands (`cli/`)
- **Pattern**: `kebab-case.ts` or `kebab-case.command.ts`
- **Purpose**: Command-line interface implementations
- **Can import from**: services, types, utils
- **Cannot import from**: repositories, database

### 2. Services (`services/`)
- **Pattern**: `kebab-case.service.ts`
- **Purpose**: Business logic and orchestration
- **Can import from**: repositories, types, utils
- **Cannot import from**: cli, database

### 3. Repositories (`repositories/`)
- **Pattern**: `kebab-case.repository.ts`
- **Purpose**: Data access abstraction
- **Can import from**: database, types, utils
- **Cannot import from**: cli, services

### 4. Types (`types/`)
- **Pattern**: `index.ts`, `kebab-case.types.ts`, `kebab-case.interface.ts`, or `kebab-case.d.ts`
- **Purpose**: TypeScript type definitions
- **Can import from**: other types only
- **Cannot import from**: any implementation files

### 5. Database (`database/`)
- **Pattern**: `*.sql` or `*.ts`
- **Purpose**: Database schemas, migrations, and models
- **Can import from**: types
- **Cannot import from**: cli, services, repositories, utils

### 6. Utils (`utils/`)
- **Pattern**: `kebab-case.ts`
- **Purpose**: Utility functions and helpers
- **Can import from**: types
- **Cannot import from**: cli, services, repositories, database

### 7. Prompts (`prompts/`)
- **Pattern**: `kebab-case.md` or `kebab-case.json`
- **Purpose**: MCP prompt definitions
- **Cannot import**: Should not contain code imports

### 8. Resources (`resources/`)
- **Pattern**: Any file with kebab-case naming
- **Purpose**: MCP resource files (documentation, configs, etc.)
- **Cannot import**: Should not contain code imports

### 9. Tools (`tools/`)
- **Pattern**: `kebab-case.tool.ts`, `kebab-case.tool.json`, or `kebab-case.ts`
- **Purpose**: MCP tool definitions
- **Can import from**: services, types, utils
- **Cannot import from**: cli, repositories, database

### 10. Executors (`executors/`)
- **Pattern**: `kebab-case.executor.ts`
- **Purpose**: Task execution implementations
- **Can import from**: services, types, utils
- **Cannot import from**: cli, repositories, database

### 11. Providers (`providers/`)
- **Pattern**: `kebab-case.ts`, `kebab-case.yaml`, or `kebab-case.yml`
- **Purpose**: External service provider configurations
- **Can import from**: types, utils
- **Cannot import from**: cli, services, repositories, database

### 12. Schemas (`schemas/`)
- **Pattern**: `kebab-case.json` or `kebab-case.ts`
- **Purpose**: JSON schema definitions
- **Cannot import**: Should be pure data definitions

### 13. Models (`models/`)
- **Pattern**: `index.ts` or `kebab-case.ts`
- **Purpose**: Data model definitions
- **Can import from**: types
- **Cannot import from**: cli, services, repositories, database, utils

### 14. Interfaces (`interfaces/`)
- **Pattern**: `kebab-case.interface.ts`
- **Purpose**: Interface contracts
- **Can import from**: types
- **Cannot import from**: cli, services, repositories, database, utils

### 15. Adapters (`adapters/`)
- **Pattern**: `kebab-case.adapter.ts`
- **Purpose**: Adapter pattern implementations
- **Can import from**: types, utils, interfaces
- **Cannot import from**: cli, services, repositories

### 16. Migrations (`migrations/`)
- **Pattern**: `NNN_snake_case_description.sql` or `NNN_snake_case_description.ts`
- **Purpose**: Database migration files
- **Cannot import**: Should be pure SQL or database operations

## Import Hierarchy

The import hierarchy enforces a clean architecture:

```
CLI → Services → Repositories → Database
 ↓        ↓           ↓            ↓
Types ← Types ← Types ← Types
 ↓        ↓           ↓            
Utils ← Utils ← Utils            
```

## ESLint Configuration

To enable folder structure enforcement, install the local plugin and add these rules to your `.eslintrc.json`:

```json
{
  "plugins": ["./eslint-plugin-module-structure"],
  "rules": {
    "module-structure/enforce-module-structure": "error",
    "module-structure/enforce-file-naming": "error",
    "module-structure/enforce-import-restrictions": "error",
    "module-structure/enforce-required-files": "warn"
  }
}
```

## Benefits

1. **Consistent Structure**: All modules follow the same organizational pattern
2. **Clear Dependencies**: Import restrictions prevent circular dependencies
3. **Maintainable Code**: Easy to navigate and understand module organization
4. **Automated Enforcement**: ESLint catches violations during development
5. **Clean Architecture**: Enforces separation of concerns

## Examples

### Valid File Placements
- ✅ `src/modules/auth/cli/login.ts`
- ✅ `src/modules/auth/services/auth.service.ts`
- ✅ `src/modules/auth/repositories/user.repository.ts`
- ✅ `src/modules/auth/types/auth.types.ts`

### Invalid File Placements
- ❌ `src/modules/auth/login.ts` (should be in cli/)
- ❌ `src/modules/auth/services/AuthService.ts` (wrong naming)
- ❌ `src/modules/auth/database/users.ts` (should be .sql or in models/)
- ❌ `src/modules/auth/types/auth-service.ts` (should end with .types.ts)