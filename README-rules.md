# Rules System Documentation

## Overview

The SystemPrompt OS Rules System provides comprehensive implementation guidelines for all modules using a centralized, template-based approach. Rules are stored in the `rules/` directory and can be copied to individual modules with automatic placeholder replacement.

## Directory Structure

```
rules/
└── src/
    └── modules/
        └── core/
            └── {module}/                    # Generic wildcard templates
                ├── rules.md                 # Module-level rules
                ├── cli/rules.md            # CLI command patterns
                ├── database/rules.md       # Database schema rules
                ├── repositories/rules.md   # Data access layer rules
                ├── services/rules.md       # Business logic rules
                ├── types/rules.md          # Type generation rules
                └── utils/rules.md          # Utility function rules
```

## Rules Sync Service

The rules sync functionality is integrated into the dev module as a service and CLI command:

### Sync Rules to Single Module
```bash
./systemprompt/bin dev sync-rules users
```

### Sync Rules to All Modules
```bash
./systemprompt/bin dev sync-rules
```

### Service Integration
The `RulesSyncService` is available in the dev module at:
- Service: `/src/modules/core/dev/services/rules-sync.service.ts`
- CLI Command: `/src/modules/core/dev/cli/sync-rules.ts`

## Placeholder System

The rules use placeholder variables that are automatically replaced:

- `{module}` → Module name (e.g., `users`, `auth`, `events`)
- `{Module}` → PascalCase module name (e.g., `Users`, `Auth`, `Events`)
- `{MODULE_CONSTANT}` → Constant case (e.g., `USERS`, `AUTH`, `EVENTS`)
- `{entity}` → Primary entity name (e.g., `user`, `session`, `event`)
- `{Entity}` → PascalCase entity name (e.g., `User`, `Session`, `Event`)
- `{service-name}` → Service-specific naming
- `{table_name}` → Database table naming

## Rule Categories

### 1. Module Structure Rules (`rules.md`)
- Required file patterns and naming conventions
- Directory organization standards
- Inter-module dependency patterns
- Integration requirements

### 2. Implementation Layer Rules
- **CLI** (`cli/rules.md`) - Command patterns and CLI integration
- **Database** (`database/rules.md`) - Schema design and type generation
- **Repositories** (`repositories/rules.md`) - Data access patterns
- **Services** (`services/rules.md`) - Business logic and dependency injection
- **Types** (`types/rules.md`) - Auto-generation requirements and manual type restrictions
- **Utils** (`utils/rules.md`) - Pure function utilities and helper patterns

## Usage Workflow

### For New Modules
1. **Create Module Structure** - Following the standard pattern
2. **Sync Rules** - Run `npx tsx scripts/sync-rules.ts module-name`
3. **Follow Templates** - Use rules as implementation guides
4. **Validate Implementation** - Check against rules for compliance

### For Existing Modules
1. **Reference Rules** - Access rules in module directories
2. **Check Compliance** - Validate current implementation against rules
3. **Update Patterns** - Follow rule updates for consistency

### For Rule Updates
1. **Central Changes** - Edit files in `rules/` directory only
2. **Re-sync Modules** - Run sync script to propagate changes
3. **Version Control** - Track rule evolution separately from code

## Key Features

- **Centralized Management** - All rules in one location
- **Automatic Updates** - Easy propagation of rule changes
- **Template System** - Generic rules work for any module
- **Copy-Based Access** - Rules accessible directly in module directories
- **Placeholder Replacement** - Automatic customization per module

## Benefits

- **Consistency** - Standardized patterns across all modules
- **Maintainability** - Single source of truth for rules
- **Developer Experience** - Rules available in context
- **Version Control** - Separate tracking of rules and implementation
- **Scalability** - Easy to add new modules following established patterns

The Rules System ensures consistent, maintainable module implementations across the entire SystemPrompt OS codebase.