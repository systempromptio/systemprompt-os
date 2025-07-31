# Claude Development Instructions

## Critical Rules

### 1. Check Rules Before Work
**ALWAYS** check `/var/www/html/systemprompt-os/rules` for implementation rules before working on any folder in `src`:
- Rules mirror the entire `src` directory structure
- Rules exist for any nested folder (modules, server, bootstrap, etc.)
- Follow the exact patterns specified in the rules
- Rules contain required file structures, naming conventions, and implementation patterns

**If no rule exists for the folder:**
1. Create the rule in `/var/www/html/systemprompt-os/rules/` mirroring the exact `src` path
2. For modules: Run `./bin/systemprompt dev sync-rules {module}` to sync the rule
3. For other folders: Manually create and maintain the rule
4. Then start work following the new rule

### 2. CLI Usage
**ALWAYS** use the SystemPrompt binary for CLI commands:
```bash
# Correct
./bin/systemprompt {module} {command}

# NEVER use npm
npm run cli  # ❌ WRONG

# NEVER use shell redirection
./bin/systemprompt command 2>&1  # ❌ WRONG
```

### 3. Development Commands
Check available dev commands for development tasks:
```bash
./bin/systemprompt dev --help
```

Available dev commands:
- `sync-rules` - Sync generic rules to modules with placeholder replacement
- `generate-types` - Generate comprehensive types for modules
- `create-module` - Create new module with boilerplate
- `validate` - Validate module type safety
- `lint` - Run linter
- `test` - Run tests
- `typecheck` - Run TypeScript type checking

### 4. Generated Files Rule
**NEVER edit generated files manually**:
- All `*.generated.ts` files are auto-generated
- Use CLI commands to regenerate types: `./bin/systemprompt dev generate-types {module}`
- If types are incorrect, fix the source (schema.sql or service logic), then regenerate
- Generated files include timestamps and warnings - DO NOT ignore them

### 5. Feature Planning
When working on a feature, create a planning document:
- **Location**: `/var/www/html/systemprompt-os/plans/` mirroring the exact `src` path
- **Structure**: Mirror the same directory structure as rules and src
- **Format**: Create `{feature-name}.plan.md` in the appropriate subfolder
- **Content**: Include implementation approach, dependencies, testing strategy
- **Examples**: 
  - `/plans/src/modules/core/auth/oauth-integration.plan.md`
  - `/plans/src/server/middleware/rate-limiting.plan.md`
  - `/plans/src/bootstrap/phases/security-phase.plan.md`

## Quick Reference

- **Rules Location**: `/var/www/html/systemprompt-os/rules/` (mirrors all of `src`)
- **Plans Location**: `/var/www/html/systemprompt-os/plans/` (mirrors all of `src`)
- **CLI Binary Path**: `./bin/systemprompt`
- **Dev Commands**: `./bin/systemprompt dev {command}`
- **Sync Module Rules**: `./bin/systemprompt dev sync-rules {module}`
