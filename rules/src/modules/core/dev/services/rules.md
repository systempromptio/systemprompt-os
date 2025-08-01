# Dev Module Services Rules

## Purpose
The dev module services provide business logic for development tools, type generation, validation, testing, and module management operations.

## Required Service Structure

### DevService (Main Service)
The main development service MUST coordinate all development operations:

```typescript
export class DevService implements IDevService {
  // Singleton pattern with proper initialization
  private static instance: DevService;
  private initialized = false;
  
  // Core dependencies
  private logger?: ILogger;
  private repository!: DevRepository;
  private typeGenerator!: TypeGenerationService;
  private rulesSyncService!: RulesSyncService;
  
  // Service orchestration methods
  async initialize(): Promise<void>;
  async generateTypes(options: TypeGenerationOptions): Promise<void>;
  getRulesSyncService(): RulesSyncService;
  
  // Profile and session management
  async createProfile(name: string, description?: string, config?: IDevProfileConfig): Promise<IDevProfilesRow>;
  async getProfile(name: string): Promise<IDevProfilesRow | null>;
  async startSession(type: DevSessionType, profileId?: number): Promise<IDevSessionsRow>;
  async endSession(sessionId: number, status: DevSessionStatus, metadata?: IDevSessionMetadata): Promise<void>;
}
```

### TypeGenerationService Requirements
Comprehensive type generation from multiple sources:

```typescript
export class TypeGenerationService {
  // Core generation methods
  async generateTypes(options: TypeGenerationOptions): Promise<void>;
  async generateDatabaseTypes(moduleName: string): Promise<void>;
  async generateServiceInterfaces(moduleName: string): Promise<void>;
  async generateZodSchemas(moduleName: string): Promise<void>;
  async generateTypeGuards(moduleName: string): Promise<void>;
  
  // Validation and verification
  async validateGeneratedTypes(moduleName: string): Promise<ValidationResult>;
  async verifyTypeIntegrity(moduleName: string): Promise<IntegrityReport>;
  
  // Incremental generation
  async generateIncremental(moduleName: string, changes: FileChanges[]): Promise<void>;
  async detectTypeChanges(moduleName: string): Promise<TypeChanges[]>;
}
```

### ValidationService Requirements
Module and code validation capabilities:

```typescript
export class ValidationService {
  // Module validation
  async validateModule(moduleName: string): Promise<ValidationResult>;
  async validateModuleStructure(moduleName: string): Promise<StructureValidationResult>;
  async validateTypeCompliance(moduleName: string): Promise<TypeValidationResult>;
  
  // Code quality validation
  async validateTypeScript(target: string): Promise<TypeScriptValidationResult>;
  async validateLinting(target: string): Promise<LintValidationResult>;
  async validateTests(target: string): Promise<TestValidationResult>;
  
  // Comprehensive validation
  async validateAll(options: ValidationOptions): Promise<ComprehensiveValidationResult>;
}
```

### LintService Requirements
Code quality and linting operations:

```typescript
export class LintService {
  // Linting operations
  async lint(target: string, options: LintOptions): Promise<LintResult>;
  async lintModule(moduleName: string, options: LintOptions): Promise<LintResult>;
  async lintProject(options: LintOptions): Promise<LintResult>;
  
  // Auto-fixing
  async autoFix(target: string, options: AutoFixOptions): Promise<AutoFixResult>;
  async canAutoFix(issues: LintIssue[]): Promise<AutoFixabilityReport>;
  
  // Custom rules
  async validateCustomRules(): Promise<CustomRulesValidationResult>;
  async loadSystemRules(): Promise<void>;
}
```

### TestService Requirements
Test execution and coverage reporting:

```typescript
export class TestService {
  // Test execution
  async runTests(options: TestOptions): Promise<TestResult>;
  async runModuleTests(moduleName: string, options: TestOptions): Promise<TestResult>;
  async runIntegrationTests(options: TestOptions): Promise<TestResult>;
  
  // Coverage reporting
  async generateCoverage(options: CoverageOptions): Promise<CoverageReport>;
  async validateCoverageThresholds(report: CoverageReport): Promise<CoverageValidationResult>;
  
  // Test analysis
  async analyzeTestPerformance(results: TestResult[]): Promise<TestPerformanceReport>;
  async identifyFlakySests(history: TestResult[]): Promise<FlakyTestReport>;
}
```

### ModuleGeneratorService Requirements
New module creation and scaffolding:

```typescript
export class ModuleGeneratorService {
  // Module creation
  async createModule(options: ModuleCreationOptions): Promise<ModuleCreationResult>;
  async validateModuleName(name: string): Promise<NameValidationResult>;
  async generateModuleBoilerplate(options: BoilerplateOptions): Promise<void>;
  
  // Template management
  async loadModuleTemplates(): Promise<ModuleTemplate[]>;
  async applyTemplate(template: ModuleTemplate, options: TemplateOptions): Promise<void>;
  async customizeTemplate(template: ModuleTemplate, customizations: TemplateCustomization[]): Promise<ModuleTemplate>;
}
```

### RulesSyncService Requirements
Rules synchronization and management:

```typescript
export class RulesSyncService {
  // Rules synchronization
  async syncRules(moduleName: string, options: SyncOptions): Promise<SyncResult>;
  async syncAllRules(options: SyncOptions): Promise<SyncResult[]>;
  async validateRulesSync(moduleName: string): Promise<SyncValidationResult>;
  
  // Template management
  async loadRuleTemplates(): Promise<RuleTemplate[]>;
  async applyRuleTemplate(template: RuleTemplate, moduleName: string): Promise<void>;
  async backupExistingRules(moduleName: string): Promise<BackupResult>;
}
```

## Implementation Standards

### Service Architecture Patterns

#### Singleton Pattern
All services MUST follow singleton pattern with proper initialization:

```typescript
export class ServiceName {
  private static instance: ServiceName;
  private initialized = false;
  private logger?: ILogger;
  
  private constructor() {}
  
  static getInstance(): ServiceName {
    if (!ServiceName.instance) {
      ServiceName.instance = new ServiceName();
    }
    return ServiceName.instance;
  }
  
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Service initialization logic
    this.initialized = true;
  }
  
  setLogger(logger: ILogger): void {
    this.logger = logger;
  }
}
```

#### Error Handling
All service methods MUST implement comprehensive error handling:

```typescript
async performOperation(input: unknown): Promise<OperationResult> {
  try {
    // Validate input
    const validatedInput = InputSchema.parse(input);
    
    // Perform operation
    const result = await this.internalOperation(validatedInput);
    
    // Validate output
    return OperationResultSchema.parse(result);
    
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError('Invalid input', { errors: error.errors });
    }
    if (error instanceof ServiceError) {
      throw error; // Re-throw service errors
    }
    throw new ServiceError(`Operation failed: ${error.message}`, { originalError: error });
  }
}
```

#### Logging Integration
All services MUST integrate comprehensive logging:

```typescript
async performOperation(params: OperationParams): Promise<OperationResult> {
  this.logger?.info(LogSource.DEV, 'Starting operation', { 
    operation: 'performOperation',
    params: { ...params, sensitiveData: '[REDACTED]' }
  });
  
  try {
    const result = await this.internalOperation(params);
    
    this.logger?.info(LogSource.DEV, 'Operation completed successfully', {
      operation: 'performOperation',
      duration: Date.now() - startTime,
      resultSize: JSON.stringify(result).length
    });
    
    return result;
  } catch (error) {
    this.logger?.error(LogSource.DEV, 'Operation failed', {
      operation: 'performOperation',
      error: error.message,
      params: { ...params, sensitiveData: '[REDACTED]' }
    });
    throw error;
  }
}
```

## Type Generation Service Details

### Database Type Generation
Parse SQL schemas and generate TypeScript interfaces:

```typescript
async generateDatabaseTypes(moduleName: string): Promise<void> {
  const schemaPath = `src/modules/core/${moduleName}/database/schema.sql`;
  const outputPath = `src/modules/core/${moduleName}/types/database.generated.ts`;
  
  // Parse SQL schema
  const schema = await this.sqlParser.parseSchema(schemaPath);
  
  // Generate TypeScript interfaces
  const interfaces = this.interfaceGenerator.generateFromSchema(schema);
  
  // Generate Zod schemas
  const zodSchemas = this.zodGenerator.generateFromSchema(schema);
  
  // Generate type guards
  const typeGuards = this.typeGuardGenerator.generateFromSchema(schema);
  
  // Combine and write output
  const output = this.combineGeneratedTypes(interfaces, zodSchemas, typeGuards);
  await this.writeGeneratedFile(outputPath, output);
}
```

### Service Interface Generation
Analyze service implementations and generate interfaces:

```typescript
async generateServiceInterfaces(moduleName: string): Promise<void> {
  const servicePath = `src/modules/core/${moduleName}/services/${moduleName}.service.ts`;
  const outputPath = `src/modules/core/${moduleName}/types/${moduleName}.service.generated.ts`;
  
  // Parse TypeScript AST
  const ast = await this.typescriptParser.parseService(servicePath);
  
  // Extract method signatures
  const methods = this.astAnalyzer.extractPublicMethods(ast);
  
  // Generate service interface
  const serviceInterface = this.interfaceGenerator.generateServiceInterface(methods);
  
  // Generate method validation schemas
  const validationSchemas = this.zodGenerator.generateMethodSchemas(methods);
  
  // Write output
  const output = this.combineServiceTypes(serviceInterface, validationSchemas);
  await this.writeGeneratedFile(outputPath, output);
}
```

## Validation Service Details

### Module Structure Validation
Validate module follows required structure:

```typescript
async validateModuleStructure(moduleName: string): Promise<StructureValidationResult> {
  const moduleBasePath = `src/modules/core/${moduleName}`;
  const requiredFiles = [
    'index.ts',
    'module.yaml',
    'database/schema.sql',
    'services/${moduleName}.service.ts',
    'repositories/${moduleName}.repository.ts'
  ];
  
  const validationResults: StructureValidation[] = [];
  
  for (const requiredFile of requiredFiles) {
    const filePath = path.join(moduleBasePath, requiredFile.replace('${moduleName}', moduleName));
    const exists = await fs.pathExists(filePath);
    
    validationResults.push({
      file: requiredFile,
      path: filePath,
      exists,
      required: true,
      valid: exists
    });
  }
  
  // Additional structure validation logic...
  
  return {
    moduleName,
    valid: validationResults.every(r => r.valid),
    files: validationResults,
    errors: validationResults.filter(r => !r.valid).map(r => `Missing required file: ${r.file}`)
  };
}
```

### Type Compliance Validation
Ensure generated types match implementations:

```typescript
async validateTypeCompliance(moduleName: string): Promise<TypeValidationResult> {
  // Validate database types match schema
  const databaseValidation = await this.validateDatabaseTypes(moduleName);
  
  // Validate service interface matches implementation
  const serviceValidation = await this.validateServiceInterface(moduleName);
  
  // Validate Zod schemas work correctly
  const schemaValidation = await this.validateZodSchemas(moduleName);
  
  return {
    moduleName,
    valid: databaseValidation.valid && serviceValidation.valid && schemaValidation.valid,
    database: databaseValidation,
    service: serviceValidation,
    schemas: schemaValidation,
    errors: [
      ...databaseValidation.errors,
      ...serviceValidation.errors,
      ...schemaValidation.errors
    ]
  };
}
```

## Testing Requirements

### Unit Tests
Each service MUST have comprehensive unit tests:

```typescript
describe('DevService', () => {
  let devService: DevService;
  let mockRepository: jest.Mocked<DevRepository>;
  let mockLogger: jest.Mocked<ILogger>;
  
  beforeEach(() => {
    devService = DevService.getInstance();
    mockRepository = createMockRepository();
    mockLogger = createMockLogger();
    
    devService.setLogger(mockLogger);
    // Mock repository injection
  });
  
  describe('generateTypes', () => {
    it('should generate types for valid module', async () => {
      const options = { module: 'test-module' };
      
      await devService.generateTypes(options);
      
      expect(mockTypeGenerator.generateTypes).toHaveBeenCalledWith(options);
      expect(mockLogger.info).toHaveBeenCalledWith(
        LogSource.DEV,
        expect.stringContaining('Type generation completed')
      );
    });
    
    it('should handle invalid module name', async () => {
      const options = { module: 'invalid-module' };
      
      await expect(devService.generateTypes(options))
        .rejects
        .toThrow('Module not found: invalid-module');
    });
  });
});
```

### Integration Tests
Services MUST have integration tests covering real scenarios:

```typescript
describe('DevService Integration', () => {
  let devService: DevService;
  
  beforeAll(async () => {
    // Set up real database and services
    await setupTestEnvironment();
    devService = DevService.getInstance();
    await devService.initialize();
  });
  
  afterAll(async () => {
    await cleanupTestEnvironment();
  });
  
  it('should complete full type generation workflow', async () => {
    const moduleName = 'test-module';
    
    // Create test module structure
    await createTestModule(moduleName);
    
    // Generate types
    await devService.generateTypes({ module: moduleName });
    
    // Validate generated types exist and are correct
    const generatedFiles = await glob(`src/modules/core/${moduleName}/types/*.generated.ts`);
    expect(generatedFiles).toHaveLength(3); // database, service, module
    
    // Validate types compile correctly
    const validationResult = await devService.validateModule(moduleName);
    expect(validationResult.valid).toBe(true);
  });
});
```

## Performance Requirements

### Service Performance Targets
- Type generation: < 5 seconds per module
- Module validation: < 2 seconds per module
- Linting: < 3 seconds per module  
- Test execution: Variable based on test complexity
- Module creation: < 10 seconds for complete module

### Memory Management
- Efficient memory usage for large codebases
- Proper cleanup of temporary resources
- Stream processing for large files
- Garbage collection optimization

### Caching Strategy
- Cache parsed ASTs for repeated operations
- Cache validated schemas for performance
- Invalidate cache on file changes
- Persistent cache across service restarts

## Error Handling Requirements

### Service-Specific Errors
Each service MUST define custom error types:

```typescript
export class TypeGenerationError extends Error {
  constructor(message: string, public details: TypeGenerationErrorDetails) {
    super(message);
    this.name = 'TypeGenerationError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public validationResults: ValidationResult[]) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

### Error Recovery
Services MUST implement error recovery strategies:
- Retry logic for transient failures
- Graceful degradation for non-critical operations
- Rollback capabilities for failed operations
- Clear error reporting with actionable suggestions

## Integration Requirements

### Service Coordination
Services MUST coordinate effectively:
- Clear service boundaries and responsibilities
- Event-based communication for loose coupling
- Shared data structures through interfaces
- Consistent error handling across services

### Module System Integration
- Use module system for service discovery
- Respect module dependencies and loading order
- Integrate with module lifecycle management
- Support hot reloading during development