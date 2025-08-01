# Dev Module Rules

## Purpose
The dev module provides essential development tools and utilities for SystemPrompt OS, including:
- Type generation from database schemas and service interfaces
- Module validation and type checking
- Code linting and formatting
- Test execution and coverage reporting
- Module scaffolding and rule synchronization
- Development lifecycle management

## Module Structure Requirements

### Required Files Structure
- `index.ts` - Module entry point extending BaseModule with full Zod validation
- `module.yaml` - Module configuration with metadata, CLI commands, and exports
- `cli/` - CLI command implementations for development tools
- `database/` - Development profiles and session tracking schema
- `repositories/` - Data access for development operations
- `services/` - Business logic for development tools
- `types/` - Auto-generated type definitions and schemas

### Dev Module Specific Requirements

#### Type Generation Services
The dev module MUST provide comprehensive type generation:
- **Database Types**: Generate interfaces and Zod schemas from schema.sql files
- **Service Interfaces**: Generate service contracts from TypeScript AST analysis
- **Module Exports**: Generate module export interfaces for type safety
- **Zod Schemas**: Generate runtime validation schemas for all types
- **Type Guards**: Generate type guard functions for runtime validation

#### Validation Services
Must provide module validation capabilities:
- **Type Checking**: TypeScript compilation validation
- **Schema Validation**: Database schema integrity checks
- **Service Validation**: Service interface compliance verification
- **Module Structure**: File structure and naming convention validation

#### Development Lifecycle Support
- **Linting**: ESLint integration with custom rules
- **Testing**: Jest integration with coverage reporting
- **Module Creation**: Scaffolding new modules with boilerplate
- **Rules Synchronization**: Sync generic rules to specific modules

## Service Implementation Standards

### DevService Requirements
The main DevService MUST implement:
```typescript
interface IDevService {
  // Profile management for development sessions
  createProfile(name: string, description?: string, config?: IDevProfileConfig): Promise<IDevProfilesRow>;
  getProfile(name: string): Promise<IDevProfilesRow | null>;
  updateProfile(id: number, updates: Partial<IDevProfilesRow>): Promise<IDevProfilesRow>;
  deleteProfile(id: number): Promise<void>;
  
  // Session tracking for development operations
  startSession(type: DevSessionType, profileId?: number): Promise<IDevSessionsRow>;
  endSession(sessionId: number, status: DevSessionStatus, metadata?: IDevSessionMetadata): Promise<void>;
  getActiveSessions(profileId?: number): Promise<IDevSessionsRow[]>;
  
  // Type generation orchestration
  generateTypes(options: TypeGenerationOptions): Promise<void>;
  
  // Rules synchronization
  getRulesSyncService(): RulesSyncService;
}
```

### Supporting Services Requirements

#### TypeGenerationService
Must provide comprehensive type generation:
- Parse SQL schemas and generate TypeScript interfaces
- Analyze service methods and generate interface contracts
- Create Zod validation schemas for all types
- Generate type guard functions for runtime validation
- Support incremental and full regeneration

#### ValidationService
Must validate module compliance:
- Check TypeScript compilation errors
- Validate database schema integrity
- Verify service interface implementations
- Check file structure compliance
- Report validation errors with actionable feedback

#### LintService
Must provide code quality checking:
- ESLint integration with SystemPrompt OS custom rules
- Support for module-specific linting
- Auto-fix capabilities where possible
- Formatted error reporting

#### TestService
Must provide testing capabilities:
- Jest integration for unit and integration tests
- Coverage reporting and thresholds
- Module-specific test execution
- Test result reporting and analysis

## CLI Command Requirements

### generate-types Command
- Generate types for specific modules or all modules
- Support for partial regeneration (database, interfaces, schemas, etc.)
- Validation of generated types
- Clear progress reporting

### validate Command
- Comprehensive module validation
- Type checking integration
- Structure validation
- Clear error reporting with suggestions

### lint Command
- Module-specific or project-wide linting
- Auto-fix support
- Formatted output with file locations
- Integration with CI/CD pipelines

### test Command
- Module-specific or project-wide testing
- Coverage reporting
- Unit and integration test separation
- Detailed result reporting

### create-module Command
- Complete module scaffolding
- Boilerplate generation following rules
- Dependency setup
- Database schema creation

### sync-rules Command
- Synchronize generic rules to specific modules
- Placeholder replacement
- Backup existing rules
- Validation after synchronization

## Database Schema Requirements

### Development Profiles
Track development environment configurations:
```sql
CREATE TABLE dev_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    config_enabled INTEGER DEFAULT 1,
    config_auto_save INTEGER DEFAULT 0,
    config_debug_mode INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Development Sessions
Track development operation sessions:
```sql
CREATE TABLE dev_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER,
    type TEXT NOT NULL, -- 'repl', 'profile', 'test', 'watch', 'lint', 'typecheck'
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'completed', 'failed', 'cancelled'
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    exit_code INTEGER,
    output_lines INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    FOREIGN KEY (profile_id) REFERENCES dev_profiles(id)
);
```

## Type Generation Process

### Database Type Generation
1. Parse schema.sql files in each module
2. Extract table definitions, columns, and constraints
3. Generate TypeScript interfaces for each table
4. Create Zod schemas for runtime validation
5. Generate type guard functions

### Service Interface Generation
1. Analyze service implementations using TypeScript AST
2. Extract method signatures and parameter types
3. Generate interface contracts for services
4. Create validation schemas for service methods
5. Generate module export interfaces

### Validation Integration
1. Validate generated types against actual implementations
2. Check for type compatibility across module boundaries
3. Ensure Zod schemas match TypeScript interfaces
4. Verify type guard function correctness

## Error Handling Requirements

### Type Generation Errors
- Clear error messages for schema parsing failures
- Actionable suggestions for fixing type generation issues
- Rollback capabilities for failed generations
- Detailed logging of generation process

### Validation Errors
- Specific error locations with file and line numbers
- Suggested fixes for common validation failures
- Integration with IDE error reporting
- Batch error reporting for multiple issues

## Integration Requirements

### Logger Integration
- Comprehensive logging of all development operations
- Debug mode support for detailed operation tracing
- Performance metrics for generation and validation operations
- Error tracking and reporting

### Database Integration
- Session and profile management
- Operation history tracking
- Performance metrics storage
- Development statistics

## Performance Requirements

### Type Generation Performance
- Incremental generation to avoid full rebuilds
- Caching of parsed schemas and AST analysis
- Parallel processing for multiple modules
- Progress reporting for long operations

### Validation Performance
- Fast module structure validation
- Efficient TypeScript compilation checking
- Cached validation results
- Parallel validation for multiple modules

## Testing Requirements

### Unit Tests
- Test type generation accuracy
- Test validation logic correctness
- Test CLI command functionality
- Test error handling scenarios

### Integration Tests
- Test end-to-end type generation workflows
- Test module creation and validation
- Test CLI integration with real modules
- Test performance under load

## Critical Success Criteria

The dev module is complete when:
- ✅ All type generation services work correctly
- ✅ Module validation catches all common issues
- ✅ CLI commands provide intuitive development workflow
- ✅ Generated types are accurate and comprehensive
- ✅ Validation provides actionable feedback
- ✅ Integration with other modules is seamless
- ✅ Performance meets requirements for large codebases
- ✅ Error handling provides clear guidance
- ✅ Documentation generation works properly
- ✅ Testing infrastructure supports development workflow