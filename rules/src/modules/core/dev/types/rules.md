# Dev Module Types Rules

## Purpose
The dev module types define comprehensive type definitions for development tools, including auto-generated types from database schemas and service interfaces, plus manual types for development-specific data structures.

## Required Type Structure

### Auto-Generated Types (DO NOT EDIT MANUALLY)

#### database.generated.ts
Generated from `database/schema.sql`:

```typescript
/**
 * AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
 * Generated from: src/modules/core/dev/database/schema.sql
 * Generation timestamp: [TIMESTAMP]
 */

import { z } from 'zod';

// Database row interfaces
export interface IDevProfilesRow {
  id: number;
  name: string;
  description: string | null;
  config_enabled: number;
  config_auto_save: number;
  config_debug_mode: number;
  created_at: string;
  updated_at: string;
}

export interface IDevSessionsRow {
  id: number;
  profile_id: number | null;
  type: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  exit_code: number | null;
  output_lines: number;
  error_count: number;
}

// Enums with validation
export enum DevSessionType {
  REPL = 'repl',
  PROFILE = 'profile',
  TEST = 'test',
  WATCH = 'watch',
  LINT = 'lint',
  TYPECHECK = 'typecheck'
}

export enum DevSessionStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// Zod schemas for runtime validation
export const DevProfilesRowSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  config_enabled: z.number(),
  config_auto_save: z.number(),
  config_debug_mode: z.number(),
  created_at: z.string(),
  updated_at: z.string()
});

export const DevSessionsRowSchema = z.object({
  id: z.number(),
  profile_id: z.number().nullable(),
  type: z.string(),
  status: z.string(),
  started_at: z.string(),
  ended_at: z.string().nullable(),
  exit_code: z.number().nullable(),
  output_lines: z.number(),
  error_count: z.number()
});

export const DevSessionTypeSchema = z.nativeEnum(DevSessionType);
export const DevSessionStatusSchema = z.nativeEnum(DevSessionStatus);

// Type guards
export const isDevProfilesRow = (value: unknown): value is IDevProfilesRow => {
  return DevProfilesRowSchema.safeParse(value).success;
};

export const isDevSessionsRow = (value: unknown): value is IDevSessionsRow => {
  return DevSessionsRowSchema.safeParse(value).success;
};
```

#### dev.service.generated.ts
Generated from service interface analysis:

```typescript
/**
 * AUTO-GENERATED FILE - DO NOT EDIT MANUALLY  
 * Generated from: src/modules/core/dev/services/dev.service.ts
 * Generation timestamp: [TIMESTAMP]
 */

import { z } from 'zod';
import { DevProfilesRowSchema, DevSessionsRowSchema, DevSessionTypeSchema, DevSessionStatusSchema } from './database.generated';

// Service interface
export interface IDevService {
  createProfile(name: string, description?: string, config?: IDevProfileConfig): Promise<IDevProfilesRow>;
  getProfile(name: string): Promise<IDevProfilesRow | null>;
  updateProfile(id: number, updates: Partial<IDevProfilesRow>): Promise<IDevProfilesRow>;
  deleteProfile(id: number): Promise<void>;
  getAllProfiles(): Promise<IDevProfilesRow[]>;
  
  startSession(type: DevSessionType, profileId?: number): Promise<IDevSessionsRow>;
  endSession(sessionId: number, status: DevSessionStatus, metadata?: IDevSessionMetadata): Promise<void>;
  getActiveSessions(profileId?: number): Promise<IDevSessionsRow[]>;
  getAllSessions(profileId?: number): Promise<IDevSessionsRow[]>;
  getSessionStats(profileId?: number): Promise<SessionStatistics>;
  
  generateTypes(options: TypeGenerationOptions): Promise<void>;
  getRulesSyncService(): RulesSyncService;
}

// Method validation schemas
export const CreateProfileArgsSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  config: z.object({
    enabled: z.boolean().optional(),
    autoSave: z.boolean().optional(),
    debugMode: z.boolean().optional()
  }).optional()
});

export const StartSessionArgsSchema = z.object({
  type: DevSessionTypeSchema,
  profileId: z.number().optional()
});

export const EndSessionArgsSchema = z.object({
  sessionId: z.number(),
  status: DevSessionStatusSchema,
  metadata: z.object({
    exitCode: z.number().optional(),
    outputLines: z.number().optional(),
    errorCount: z.number().optional()
  }).optional()
});

export const GenerateTypesArgsSchema = z.object({
  module: z.string().optional(),
  pattern: z.string().optional(),
  types: z.array(z.enum(['database', 'interfaces', 'schemas', 'service-schemas', 'type-guards', 'all'])).optional()
});
```

#### dev.module.generated.ts
Generated module export interface:

```typescript
/**
 * AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
 * Generated from: src/modules/core/dev/index.ts
 * Generation timestamp: [TIMESTAMP]
 */

import { z } from 'zod';
import type { DevService } from '../services/dev.service';

// Module exports interface
export interface IDevModuleExports {
  service(): DevService;
}

// Module exports validation schema
export const DevModuleExportsSchema = z.object({
  service: z.function().returns(z.unknown())
});

// Type guard for module exports
export const isDevModuleExports = (value: unknown): value is IDevModuleExports => {
  return DevModuleExportsSchema.safeParse(value).success;
};
```

### Manual Types (RESTRICTED USE)

#### manual.ts
Manual types for development-specific concepts not covered by auto-generation:

```typescript
/**
 * Manual type definitions for dev module.
 * JUSTIFICATION: These types represent development workflow concepts
 * that cannot be auto-generated from database schemas or service interfaces.
 */

import { z } from 'zod';
import type { DevSessionType, DevSessionStatus } from './database.generated';

// Development profile configuration
export interface IDevProfileConfig {
  enabled?: boolean;
  autoSave?: boolean;
  debugMode?: boolean;
}

export const DevProfileConfigSchema = z.object({
  enabled: z.boolean().optional(),
  autoSave: z.boolean().optional(),
  debugMode: z.boolean().optional()
});

// Development session metadata
export interface IDevSessionMetadata {
  exitCode?: number;
  outputLines?: number;
  errorCount?: number;
  duration?: number;
  memoryUsage?: number;
  errors?: string[];
}

export const DevSessionMetadataSchema = z.object({
  exitCode: z.number().optional(),
  outputLines: z.number().optional(),
  errorCount: z.number().optional(),
  duration: z.number().optional(),
  memoryUsage: z.number().optional(),
  errors: z.array(z.string()).optional()
});

// Type generation options
export interface TypeGenerationOptions {
  module?: string;
  pattern?: string;
  types?: Array<'database' | 'interfaces' | 'schemas' | 'service-schemas' | 'type-guards' | 'all'>;
  force?: boolean;
  verbose?: boolean;
}

export const TypeGenerationOptionsSchema = z.object({
  module: z.string().optional(),
  pattern: z.string().optional(),
  types: z.array(z.enum(['database', 'interfaces', 'schemas', 'service-schemas', 'type-guards', 'all'])).optional(),
  force: z.boolean().optional(),
  verbose: z.boolean().optional()
});

// Validation result types
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  moduleName: string;
  timestamp: string;
}

export interface ValidationError {
  type: 'type' | 'structure' | 'lint' | 'test';
  severity: 'error' | 'warning' | 'info';
  message: string;
  file?: string;
  line?: number;
  column?: number;
  rule?: string;
}

export interface ValidationWarning {
  type: 'performance' | 'maintainability' | 'style';
  message: string;
  file?: string;
  line?: number;
  suggestion?: string;
}

export const ValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.object({
    type: z.enum(['type', 'structure', 'lint', 'test']),
    severity: z.enum(['error', 'warning', 'info']),
    message: z.string(),
    file: z.string().optional(),
    line: z.number().optional(),
    column: z.number().optional(),
    rule: z.string().optional()
  })),
  warnings: z.array(z.object({
    type: z.enum(['performance', 'maintainability', 'style']),
    message: z.string(),
    file: z.string().optional(),
    line: z.number().optional(),
    suggestion: z.string().optional()
  })),
  moduleName: z.string(),
  timestamp: z.string()
});

// Session statistics
export interface SessionStatistics {
  total: number;
  active: number;
  completed: number;
  failed: number;
  averageDuration: number;
  successRate: number;
  errorRate: number;
}

export const SessionStatisticsSchema = z.object({
  total: z.number(),
  active: z.number(),
  completed: z.number(),
  failed: z.number(),
  averageDuration: z.number(),
  successRate: z.number(),
  errorRate: z.number()
});

// Module creation options
export interface ModuleCreationOptions {
  name: string;
  description?: string;
  type?: 'service' | 'utility' | 'integration';
  dependencies?: string[];
  includeDatabase?: boolean;
  includeCLI?: boolean;
  includeTests?: boolean;
  author?: string;
}

export const ModuleCreationOptionsSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  type: z.enum(['service', 'utility', 'integration']).optional(),
  dependencies: z.array(z.string()).optional(),
  includeDatabase: z.boolean().optional(),
  includeCLI: z.boolean().optional(),
  includeTests: z.boolean().optional(),
  author: z.string().optional()
});

// Lint result types
export interface LintResult {
  success: boolean;
  errors: LintError[];
  warnings: LintWarning[];
  fixableErrors: number;
  fixableWarnings: number;
  files: LintFileResult[];
}

export interface LintError {
  ruleId: string;
  severity: 'error' | 'warning';
  message: string;
  file: string;
  line: number;
  column: number;
  fixable: boolean;
}

export interface LintWarning {
  ruleId: string;
  message: string;
  file: string;
  line: number;
  column: number;
  fixable: boolean;
}

export interface LintFileResult {
  filePath: string;
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
  messages: Array<LintError | LintWarning>;
}

// Test result types
export interface TestResult {
  success: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  duration: number;
  coverage?: CoverageReport;
  suites: TestSuiteResult[];
}

export interface TestSuiteResult {
  name: string;
  success: boolean;
  tests: TestCaseResult[];
  duration: number;
}

export interface TestCaseResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}

export interface CoverageReport {
  lines: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
  statements: CoverageMetric;
  files: CoverageFileReport[];
}

export interface CoverageMetric {
  total: number;
  covered: number;
  percentage: number;
}

export interface CoverageFileReport {
  filePath: string;
  lines: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
  statements: CoverageMetric;
}

// Type guards for manual types
export const isDevProfileConfig = (value: unknown): value is IDevProfileConfig => {
  return DevProfileConfigSchema.safeParse(value).success;
};

export const isDevSessionMetadata = (value: unknown): value is IDevSessionMetadata => {
  return DevSessionMetadataSchema.safeParse(value).success;
};

export const isTypeGenerationOptions = (value: unknown): value is TypeGenerationOptions => {
  return TypeGenerationOptionsSchema.safeParse(value).success;
};

export const isValidationResult = (value: unknown): value is ValidationResult => {
  return ValidationResultSchema.safeParse(value).success;
};
```

## Type Generation Requirements

### Database Type Generation Process
1. Parse SQL schema files to extract table definitions
2. Generate TypeScript interfaces for each table row
3. Create enums for constrained text fields
4. Generate Zod schemas for runtime validation
5. Create type guard functions for type checking
6. Include comprehensive JSDoc comments

### Service Interface Generation Process
1. Parse service implementation using TypeScript AST
2. Extract public method signatures and parameters
3. Generate service interface with proper typing
4. Create validation schemas for method parameters
5. Generate type-safe method call wrappers
6. Include method documentation from source

### Module Export Generation Process
1. Analyze module index.ts file structure
2. Extract exported functions and their return types
3. Generate module exports interface
4. Create validation schema for module exports
5. Generate type guards for export validation
6. Ensure type safety for module consumption

## Validation Requirements

### Type Consistency Validation
All generated types MUST be validated for consistency:
- Database types match actual schema structure
- Service interfaces match implementation signatures
- Module exports match actual exported functions
- Zod schemas correctly validate TypeScript types

### Runtime Validation Integration
All types MUST include runtime validation:
- Zod schemas for all interfaces and types
- Type guard functions for runtime type checking
- Validation error handling with detailed messages
- Performance-optimized validation for frequent operations

### Cross-Module Type Safety
Types MUST maintain safety across module boundaries:
- Export types through consistent interfaces
- Validate imported types at module boundaries
- Ensure version compatibility for shared types
- Provide migration paths for type changes

## Manual Type Justification Requirements

### When Manual Types Are Allowed
Manual types are ONLY allowed when:
1. The type represents a concept not present in database or services
2. The type is for configuration or metadata not stored in database
3. The type is for complex business logic structures
4. Auto-generation cannot capture the semantic meaning

### Manual Type Documentation Requirements
Every manual type MUST include:
- Clear justification comment explaining why auto-generation is insufficient
- Comprehensive JSDoc documentation with examples
- Zod schema for runtime validation
- Type guard function for runtime checking
- Version history and change log

### Manual Type Review Process
All manual types MUST be reviewed for:
- Necessity - could this be auto-generated instead?
- Completeness - does it cover all use cases?
- Consistency - does it follow established patterns?
- Documentation - is it properly documented?
- Validation - does it include proper runtime validation?

## Testing Requirements

### Type Generation Testing
- Test database type generation with various schema patterns
- Test service interface generation with different method signatures
- Test module export generation with various export patterns
- Validate generated Zod schemas work correctly
- Test type guard functions with valid and invalid data

### Manual Type Testing
- Validate all manual types with comprehensive test cases
- Test Zod schemas with edge cases and invalid data
- Verify type guards correctly identify valid/invalid data
- Test integration with auto-generated types
- Validate performance of runtime validation

## Performance Requirements

### Generation Performance
- Database type generation: < 2 seconds per module
- Service interface generation: < 3 seconds per module
- Module export generation: < 1 second per module
- Full type regeneration: < 10 seconds for entire project
- Incremental generation: < 1 second for changed files

### Runtime Validation Performance
- Type validation should add < 1ms overhead per operation
- Zod schema validation optimized for common cases
- Type guards should use fast-path checking
- Caching for repeated validations
- Lazy loading for complex validation schemas