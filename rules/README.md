# SystemPrompt OS Rules Directory

This directory contains all module implementation rules and guidelines using a wildcard pattern structure that applies to any module.

## Purpose

The rules directory provides:
- **Centralized Rule Management** - All module rules in one location with wildcard patterns
- **Generic Templates** - Rules that apply to any module via `{module}` placeholders
- **Version Control** - Rules can be tracked separately from source code
- **Documentation** - Clear separation between implementation and guidelines
- **Consistency** - Standardized rule structure across all modules

## Directory Structure

```
rules/
└── src/
    └── modules/
        └── core/
            └── {module}/                    # Wildcard for any module name
                ├── rules.md                 # Module-level rules
                ├── cli/rules.md            # CLI command patterns
                ├── database/rules.md       # Database schema rules
                ├── repositories/rules.md   # Data access layer rules
                ├── services/rules.md       # Business logic rules
                ├── types/rules.md          # Type generation rules
                └── utils/rules.md          # Utility function rules
```

## Wildcard Pattern System

### Template Variables
Rules use placeholder variables that apply to any module:
- `{module}` - Module name (e.g., `users`, `auth`, `events`)
- `{Module}` - PascalCase module name (e.g., `Users`, `Auth`, `Events`)
- `{MODULE_CONSTANT}` - Constant case (e.g., `USERS`, `AUTH`, `EVENTS`)
- `{entity}` - Primary entity name (e.g., `user`, `session`, `event`)
- `{Entity}` - PascalCase entity name (e.g., `User`, `Session`, `Event`)
- `{service-name}` - Service-specific naming
- `{table_name}` - Database table naming

### Example Usage
When implementing a `products` module, these placeholders become:
- `{module}` → `products`
- `{Module}` → `Products`
- `{MODULE_CONSTANT}` → `PRODUCTS`
- `{entity}` → `product`
- `{Entity}` → `Product`

## Symlink Integration

Rules are symlinked into source directories for developer access:
```bash
# Example symlinks for users module
src/modules/core/users/rules.md -> ../../../../../rules/src/modules/core/{module}/rules.md
src/modules/core/users/cli/rules.md -> ../../../../../../rules/src/modules/core/{module}/cli/rules.md
src/modules/core/users/services/rules.md -> ../../../../../../rules/src/modules/core/{module}/services/rules.md
```

### Benefits of Symlinks
- **Direct Access** - Developers can view rules in context within their working directories
- **Single Source** - All rule changes happen in the rules directory
- **IDE Integration** - Rules appear as local files for easy reference
- **No Duplication** - One set of rules serves all modules

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

### 3. Cross-Cutting Concerns
- Auto-generated type system
- Event-driven communication
- Module loading and discovery
- Testing requirements

## Usage Workflow

### For New Modules
1. **Copy Pattern** - Rules automatically apply via symlinks
2. **Replace Placeholders** - Mental mapping of `{module}` to actual module name
3. **Follow Templates** - Use code examples as starting points
4. **Validate Implementation** - Check against rules for compliance

### For Existing Modules
1. **Reference Rules** - Access via symlinked `rules.md` files in directories
2. **Check Compliance** - Validate current implementation against rules
3. **Update Patterns** - Follow rule updates for consistency

### For Rule Updates
1. **Central Changes** - Edit files in `rules/` directory only
2. **Automatic Propagation** - Changes appear in all symlinked locations
3. **Version Control** - Track rule evolution separately from code

## Implementation Examples

### Creating a New Module
```bash
# 1. Create module structure following rules/{module} pattern
mkdir -p src/modules/core/analytics/{cli,database,repositories,services,types,utils}

# 2. Symlink rules for easy access
ln -sf ../../../../../rules/src/modules/core/{module}/rules.md src/modules/core/analytics/rules.md
ln -sf ../../../../../../rules/src/modules/core/{module}/cli/rules.md src/modules/core/analytics/cli/rules.md
# ... continue for all subfolders

# 3. Implement following rule patterns
# Replace {module} with 'analytics', {Entity} with 'Report', etc.
```

### Accessing Rules During Development
```bash
# View module-level rules
cat src/modules/core/users/rules.md

# View service implementation rules
cat src/modules/core/users/services/rules.md

# View CLI command patterns
cat src/modules/core/users/cli/rules.md
```

## Maintenance

- **Rule Source** - Only edit files in `rules/` directory
- **Symlink Integrity** - Verify symlinks point to correct wildcard paths
- **Pattern Consistency** - Ensure all placeholder variables are consistently used
- **Documentation Updates** - Keep README in sync with rule structure changes

## Validation

Rules include patterns for:
- **Required file structures** and naming conventions
- **Auto-generation workflows** and type safety requirements
- **Inter-module communication** patterns and dependency management
- **Testing requirements** and integration patterns
- **Forbidden practices** and anti-patterns

The wildcard rule system ensures consistent, maintainable module implementations across the entire SystemPrompt OS codebase.