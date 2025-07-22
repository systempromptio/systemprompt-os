# SystemPrompt OS CLI Commands

## Current Commands

auth commands:
  auth:db - Database management commands
  auth:generatekey - Generate cryptographic keys for JWT signing
  auth:providers - List configured OAuth2/OIDC providers
  auth:role - Role management commands

cli commands:
  cli:docs - Generate command documentation
  cli:help - Show help information for commands
  cli:list - List all available commands
  cli:mcp:call - Call an MCP tool
  cli:mcp:list - List available MCP tools

config commands:
  config:get - Get configuration value(s)
  config:list - List all configuration values
  config:model - Manage AI models
  config:provider - Manage AI providers
  config:set - Set configuration value
  config:validate - Validate configuration

database commands:
  database:migrate - Run pending database migrations
  database:query - Execute SQL queries safely (admin only)
  database:rollback - Rollback database migrations
  database:schema - Manage database schemas
  database:status - Show database connection status and information

extension commands:
  extension:create - Create a new module with proper structure
  extension:info - Show detailed information about an extension
  extension:install - Install an extension
  extension:list - List installed extensions and modules
  extension:remove - Remove an extension
  extension:validate - Validate module/extension structure and configuration

heartbeat commands:
  heartbeat:reset - Reset heartbeat state
  heartbeat:status - Show heartbeat status

prompts commands:
  prompts:create - Create a new prompt
  prompts:delete - Delete a prompt
  prompts:get - Get a specific prompt
  prompts:list - List all prompts
  prompts:update - Update an existing prompt

resources commands:
  resources:create - Create a new resource
  resources:delete - Delete a resource
  resources:get - Get a specific resource
  resources:list - List all resources
  resources:update - Update an existing resource

tools commands:
  tools:disable - Disable a tool
  tools:enable - Enable a tool
  tools:info - Show detailed information about a tool
  tools:list - List all registered tools
  tools:refresh - Rescan modules for tools and update registry

## Proposed Commands (World-Class Improvement)

### Core System Management

system commands:
  system:status - Show comprehensive system status (memory, CPU, uptime, versions)
  system:health - Run full system health check with diagnostics
  system:restart - Gracefully restart the system
  system:backup - Create system backup (config, data, modules)
  system:update - Git pull to update core code
  system:restore - Restore from backup
  system:logs - View and manage system logs
  system:metrics - View system performance metrics
  system:events - View system event stream

### User & Access Management

users commands:
  users:list - List all users with roles and status
  users:update - Update user information
  users:delete - Delete a user
  users:enable - Enable a user account
  users:disable - Disable a user account
  users:sessions - View active user sessions
  users:revoke-sessions - Revoke user sessions
  users:activity - View user activity logs

permissions commands:
  permissions:list - List all permissions
  permissions:grant - Grant permissions to user/role
  permissions:revoke - Revoke permissions from user/role
  permissions:check - Check user permissions
  permissions:audit - Audit permission usage

### Module & Extension Management

modules commands:
  modules:list - List all modules with status
  modules:enable - Enable a module
  modules:disable - Disable a module
  modules:restart - Restart a module
  modules:logs - View module logs
  modules:config - Configure module settings
  modules:health - Check module health

### MCP (Model Context Protocol) Management

mcp commands:
  mcp:servers:list - List MCP servers
  mcp:tools:list - List all MCP tools
  mcp:tools:search - Search MCP tools
  mcp:tools:test - Test MCP tool
  mcp:prompts:list - List MCP prompts
  mcp:prompts:search - Search MCP prompts
  mcp:resources:list - List MCP resources
  mcp:resources:search - Search MCP resources
  mcp:capabilities - Show MCP capabilities

### Agent & Workflow Management

agents commands:
  agents:list - List all agents
  agents:create - Create new agent
  agents:start - Start an agent
  agents:stop - Stop an agent
  agents:status - Check agent status
  agents:logs - View agent logs
  agents:config - Configure agent
  agents:assign - Assign agent to task

workflows commands:
  workflows:list - List all workflows
  workflows:create - Create workflow
  workflows:execute - Execute workflow
  workflows:schedule - Schedule workflow
  workflows:status - Check workflow status
  workflows:history - View workflow history
  workflows:cancel - Cancel running workflow

### API & Integration Management

webhooks commands:
  webhooks:list - List webhooks
  webhooks:create - Create webhook
  webhooks:update - Update webhook
  webhooks:delete - Delete webhook
  webhooks:test - Test webhook
  webhooks:logs - View webhook logs

### Data Management

data commands:
  data:export - Export data
  data:import - Import data
  data:backup - Create data backup
  data:restore - Restore data
  data:validate - Validate data integrity
  data:clean - Clean old/unused data
  data:migrate - Migrate data between versions

### Monitoring & Observability

monitor commands:
  monitor:status - Overall monitoring status
  monitor:alerts:list - List active alerts
  monitor:alerts:ack - Acknowledge alert
  monitor:alerts:config - Configure alerts
  monitor:metrics - View metrics
  monitor:traces - View traces
  monitor:export - Export monitoring data

### Development & Debugging

dev commands:
  dev:repl - Start interactive REPL
  dev:debug - Enable debug mode
  dev:profile - Profile performance
  dev:test - Run tests
  dev:lint - Run linter
  dev:format - Format code
  dev:watch - Watch for changes

### Configuration Management

config commands (enhanced):
  config:export - Export all configurations
  config:import - Import configurations
  config:diff - Show config differences
  config:history - View config change history
  config:rollback - Rollback configuration
  config:validate:all - Validate all configurations
  config:env - Manage environment variables

### Networking & Connectivity

network commands:
  network:status - Show network status
  network:test - Test network connectivity
  network:routes - Show network routes
  network:firewall - Manage firewall rules
  network:ssl - Manage SSL certificates

### Scheduler & Tasks

scheduler commands:
  scheduler:list - List scheduled tasks
  scheduler:create - Create scheduled task
  scheduler:update - Update scheduled task
  scheduler:delete - Delete scheduled task
  scheduler:run - Run task immediately
  scheduler:pause - Pause scheduler
  scheduler:resume - Resume scheduler
  scheduler:history - View task history

### Standardization Improvements

1. **Consistent Command Structure**: All commands follow pattern: `domain:action` or `domain:subdomain:action`
2. **Standard Actions**: list, create, update, delete, get, status, test, export, import
3. **Common Flags**: --format (json|yaml|table), --output, --quiet, --verbose, --dry-run
4. **Pagination**: All list commands support --page, --limit
5. **Filtering**: All list commands support --filter, --search
6. **Sorting**: All list commands support --sort, --order
7. **Batch Operations**: Support --batch for multiple operations
8. **Interactive Mode**: Support --interactive for guided operations
9. **Confirmation**: Dangerous operations require --confirm or interactive confirmation
10. **Help System**: Every command has detailed help with examples

### Key Additions Rationale

1. **Users Domain**: Essential for any multi-user system
2. **System Domain**: Core system management and monitoring
3. **Permissions**: Fine-grained access control
4. **Agents/Workflows**: For autonomous operations
5. **API/Webhooks**: External integration points
6. **Monitor**: Observability is crucial
7. **Network**: Network management capabilities
8. **Scheduler**: Task automation
9. **Dev Tools**: Developer experience
10. **Enhanced Security**: MFA, audit logs, token management

## Module Mapping & Architecture

### Current Modules (10 total)

1. **logger** - Centralized logging service
2. **database** - Core data persistence layer
3. **heartbeat** - System health monitoring daemon
4. **auth** - Authentication and authorization
5. **config** - Configuration management
6. **cli** - Command-line interface management
7. **extension** - Module lifecycle management
8. **prompts** - AI prompt management (MCP)
9. **resources** - Resource management (MCP)
10. **tools** - Function/tool management (MCP)

### Proposed Module Changes

#### Modules to CREATE:

1. **system** module
   - Absorb heartbeat functionality
   - Add comprehensive system management
   - Maps to: system:* commands
   
2. **users** module  
   - User lifecycle management
   - Session management
   - Activity tracking
   - Maps to: users:* commands
   
3. **permissions** module
   - RBAC implementation
   - Permission auditing
   - Maps to: permissions:* commands
   
4. **agents** module
   - Agent lifecycle management
   - Agent state tracking
   - Maps to: agents:* commands
   
5. **workflows** module
   - Workflow definition and execution
   - Scheduling integration
   - Maps to: workflows:* commands
   
6. **webhooks** module
   - Webhook management
   - Event dispatching
   - Maps to: webhooks:* commands
   
7. **monitor** module
   - Metrics collection
   - Alert management
   - Tracing
   - Maps to: monitor:* commands
   
8. **scheduler** module
   - Cron-like scheduling
   - Task queue management
   - Maps to: scheduler:* commands
   
9. **api** module
   - API key management
   - Rate limiting
   - Usage tracking
   - Maps to: api:* commands

#### Modules to ENHANCE:

1. **auth** module → Enhanced with:
   - MFA support
   - Token management
   - Audit logging
   - OAuth provider management UI
   
2. **database** module → Enhanced with:
   - Backup/restore capabilities
   - Data export/import
   - Migration improvements
   - Maps to: data:* commands
   
3. **extension** module → Rename to **modules**
   - Add health checks
   - Add restart capability
   - Add dependency management
   - Maps to: modules:* commands

#### Modules to CONSOLIDATE:

1. **prompts + resources + tools** → **mcp** module
   - Unified MCP protocol implementation
   - Server management
   - Maps to: mcp:* commands

#### Modules to DEPRECATE:

1. **heartbeat** → Merge into **system** module
   - Functionality absorbed by system module

### Final Proposed Module Structure (15 modules):

1. **logger** - Core logging (unchanged)
2. **database** - Enhanced data layer
3. **system** - System management (new, absorbs heartbeat)
4. **users** - User management (new)
5. **permissions** - Access control (new)
6. **auth** - Enhanced authentication
7. **config** - Configuration (unchanged)
8. **cli** - CLI management (unchanged)
9. **modules** - Module management (renamed from extension)
10. **mcp** - Unified MCP implementation (consolidates prompts/resources/tools)
11. **agents** - Agent management (new)
12. **workflows** - Workflow engine (new)
13. **api** - API management (new)
14. **webhooks** - Webhook management (new)
15. **monitor** - Observability (new)
16. **scheduler** - Task scheduling (new)

### Domain to Module Mapping

| CLI Domain | Module | Status |
|------------|---------|---------|
| system:* | system | New (absorbs heartbeat) |
| users:* | users | New |
| permissions:* | permissions | New |
| auth:* | auth | Enhance existing |
| config:* | config | Existing |
| database:* | database | Existing |
| modules:* | modules | Rename extension |
| mcp:* | mcp | Consolidate 3 modules |
| agents:* | agents | New |
| workflows:* | workflows | New |
| api:* | api | New |
| webhooks:* | webhooks | New |
| monitor:* | monitor | New |
| scheduler:* | scheduler | New |
| data:* | database | Enhance existing |
| cli:* | cli | Existing |

### Implementation Priority

1. **Phase 1** - Core Infrastructure
   - Create system module (absorb heartbeat)
   - Create users module
   - Create permissions module
   - Enhance auth module

2. **Phase 2** - MCP Consolidation
   - Consolidate prompts/resources/tools into mcp module
   - Rename extension to modules

3. **Phase 3** - Agent Platform
   - Create agents module
   - Create workflows module
   - Create scheduler module

4. **Phase 4** - External Integration
   - Create api module
   - Create webhooks module

5. **Phase 5** - Observability
   - Create monitor module
   - Enhance database module with data commands

## Module Implementation Standards

### Critical Requirements

All modules MUST follow the standardized implementation patterns defined in:
- **Module Structure**: `/src/modules/core/MODULES.md`
- **Enforcement Rules**: `/src/modules/core/ENFORCEMENT.md`

### Key Standardization Requirements

1. **Module Interface Compliance**
   ```typescript
   export interface ModuleInterface {
     name: string;
     version: string;
     type: 'service' | 'daemon' | 'plugin' | 'core' | 'extension';
     initialize(context: ModuleContext): Promise<void>;
     start(): Promise<void>;
     stop(): Promise<void>;
     healthCheck(): Promise<{ healthy: boolean; message?: string }>;
   }
   ```

2. **Database Integration**
   - All modules MUST use the standardized database adapter pattern
   - Database schemas in `database/schema.sql`
   - Migrations in `database/migrations/`
   - Repository pattern for data access
   - Example:
     ```typescript
     import { createModuleAdapter } from '../../database/adapters/module-adapter';
     const db = await createModuleAdapter('mymodule');
     ```

3. **Logging Integration**
   - All modules MUST use the centralized logger
   - Proper log levels (debug, info, warn, error)
   - Structured logging with context
   - Example:
     ```typescript
     this.logger?.info('Module action', { module: this.name, action: 'start' });
     ```

4. **CLI Command Standards**
   - Commands follow pattern: `module:action` or `module:subdomain:action`
   - All commands in `cli/` directory
   - Standard options: --format, --output, --quiet, --verbose
   - Proper error handling and exit codes

5. **Module Verification**
   - Every module MUST pass: `systemprompt extension:validate <module-name>`
   - Automated validation in CI/CD pipeline
   - Pre-commit hooks for module validation
   - Runtime validation in module loader

### Module Directory Structure
```
module-name/
├── module.yaml          # Module manifest (REQUIRED)
├── index.ts            # Module entry point (REQUIRED)
├── README.md           # Module documentation
├── cli/                # CLI commands
├── database/           # Database schemas
│   ├── schema.sql      # Schema definition
│   └── migrations/     # Migration scripts
├── services/           # Business logic
├── repositories/       # Data access layer
├── types/              # TypeScript definitions
└── utils/              # Module utilities
```

### Enforcement Mechanisms

1. **Build-Time Validation**
   - TypeScript strict mode for all modules
   - ESLint rules for module structure
   - JSON Schema validation for module.yaml

2. **Runtime Validation**
   - Module loader validates interface implementation
   - Dependency checking before module start
   - Resource usage monitoring

3. **Development Tools**
   - `systemprompt module:create` - Generate compliant module
   - `systemprompt module:validate` - Validate module structure
   - `systemprompt module:test` - Run module tests

4. **Security & Performance**
   - Module sandboxing for security
   - Performance metrics tracking
   - Memory usage limits
   - API call monitoring

### Module Certification Process

All modules must achieve certification through:
1. **Structure Validation** - Correct directory structure and files
2. **Interface Compliance** - Implements required methods
3. **Database Standards** - Proper schema and migration setup
4. **Logging Standards** - Uses centralized logger correctly
5. **CLI Integration** - Commands follow naming standards
6. **Documentation** - Complete README and API docs
7. **Test Coverage** - Minimum 80% test coverage
8. **Security Audit** - No security vulnerabilities
9. **Performance Benchmark** - Meets performance standards

### Non-Compliance Consequences

Modules that don't meet standards will:
- Fail to load at runtime
- Be rejected in CI/CD pipeline
- Not be included in releases
- Trigger alerts in monitoring

This strict standardization ensures:
- Consistent developer experience
- Reliable system behavior
- Easy maintenance and debugging
- Secure and performant operations
- Seamless module interoperability