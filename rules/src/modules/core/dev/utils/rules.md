# Dev Module Utils Rules

## Purpose
The dev module utils provide pure utility functions for development operations, including file system operations, string manipulation, type conversion, and development workflow helpers.

## Required Utility Structure

### File System Utilities
Pure functions for file system operations used in development:

```typescript
// file-system.utils.ts
export class FileSystemUtils {
  // Path operations
  static resolveModulePath(moduleName: string): string;
  static getModuleTypesPath(moduleName: string): string;
  static getModuleSchemaPath(moduleName: string): string;
  static ensureDirectoryExists(dirPath: string): Promise<void>;
  
  // File operations
  static readFileIfExists(filePath: string): Promise<string | null>;
  static writeFileAtomic(filePath: string, content: string): Promise<void>;
  static copyFileWithBackup(source: string, dest: string): Promise<void>;
  static deleteFileIfExists(filePath: string): Promise<void>;
  
  // Directory operations
  static listFilesRecursively(dirPath: string, pattern?: RegExp): Promise<string[]>;
  static findFilesMatching(basePath: string, glob: string): Promise<string[]>;
  static getDirectorySize(dirPath: string): Promise<number>;
  static cleanupEmptyDirectories(basePath: string): Promise<string[]>;
}
```

### String Manipulation Utilities
String processing functions for code generation and transformation:

```typescript
// string.utils.ts
export class StringUtils {
  // Case conversions
  static toCamelCase(str: string): string;
  static toPascalCase(str: string): string;
  static toKebabCase(str: string): string;
  static toSnakeCase(str: string): string;
  static toConstantCase(str: string): string;
  
  // Code generation helpers
  static indent(text: string, levels: number, indentChar?: string): string;
  static dedent(text: string): string;
  static wrapInComments(text: string, commentStyle?: 'block' | 'line'): string;
  static generateTimestamp(): string;
  static generateFileHeader(filename: string, description?: string): string;
  
  // Template processing
  static replaceTemplateVariables(template: string, variables: Record<string, string>): string;
  static extractTemplateVariables(template: string): string[];
  static validateTemplateVariables(template: string, variables: Record<string, string>): string[];
  
  // Validation helpers
  static isValidModuleName(name: string): boolean;
  static isValidVariableName(name: string): boolean;
  static sanitizeForFilename(str: string): string;
  static escapeForRegex(str: string): string;
}
```

### Type Conversion Utilities
Functions for converting between different type representations:

```typescript
// type-conversion.utils.ts
export class TypeConversionUtils {
  // SQL to TypeScript type conversion
  static sqlTypeToTypeScript(sqlType: string): string;
  static sqlTypeToZodSchema(sqlType: string): string;
  static isNullableSqlType(sqlType: string): boolean;
  static getSqlTypeDefaultValue(sqlType: string): string | null;
  
  // TypeScript to other formats
  static typeScriptTypeToZodSchema(tsType: string): string;
  static typeScriptTypeToJSONSchema(tsType: string): object;
  static extractTypeFromUnion(unionType: string): string[];
  static simplifyComplexType(complexType: string): string;
  
  // Schema conversions
  static zodSchemaToTypeScript(zodSchema: string): string;
  static jsonSchemaToTypeScript(jsonSchema: object): string;
  static extractEnumValues(enumType: string): string[];
  static generateEnumFromValues(values: string[], enumName: string): string;
}
```

### Code Analysis Utilities
Functions for analyzing and processing TypeScript code:

```typescript
// code-analysis.utils.ts
export class CodeAnalysisUtils {
  // AST operations
  static parseTypeScriptFile(filePath: string): Promise<ts.SourceFile>;
  static extractExportedInterfaces(sourceFile: ts.SourceFile): InterfaceInfo[];
  static extractPublicMethods(sourceFile: ts.SourceFile, className: string): MethodInfo[];
  static findImports(sourceFile: ts.SourceFile): ImportInfo[];
  
  // Code extraction
  static extractJSDocComments(node: ts.Node): string[];
  static extractMethodSignature(method: ts.MethodDeclaration): MethodSignature;
  static extractInterfaceProperties(interfaceNode: ts.InterfaceDeclaration): PropertyInfo[];
  static extractClassMethods(classNode: ts.ClassDeclaration): MethodInfo[];
  
  // Code generation
  static generateMethodInterface(methods: MethodInfo[]): string;
  static generateInterfaceFromProperties(name: string, properties: PropertyInfo[]): string;
  static generateZodSchemaFromInterface(interfaceName: string, properties: PropertyInfo[]): string;
  static generateTypeGuard(typeName: string, zodSchemaName: string): string;
}
```

### Development Workflow Utilities
Functions supporting development operations and CLI commands:

```typescript
// dev-workflow.utils.ts
export class DevWorkflowUtils {
  // Module operations
  static validateModuleStructure(moduleName: string): Promise<StructureValidationResult>;
  static getModuleDependencies(moduleName: string): Promise<string[]>;
  static checkModuleExists(moduleName: string): Promise<boolean>;
  static listAllModules(): Promise<string[]>;
  
  // Command execution
  static executeCommand(command: string, args: string[], options?: ExecOptions): Promise<CommandResult>;
  static runTypeScript(filePath: string): Promise<ExecutionResult>;
  static runLinter(target: string, fix?: boolean): Promise<LintResult>;
  static runTests(target?: string, coverage?: boolean): Promise<TestResult>;
  
  // Progress tracking
  static createProgressTracker(total: number): ProgressTracker;
  static formatDuration(milliseconds: number): string;
  static formatFileSize(bytes: number): string;
  static calculateETA(completed: number, total: number, startTime: number): number;
  
  // Error handling
  static formatError(error: unknown): FormattedError;
  static isRetryableError(error: unknown): boolean;
  static extractStackTrace(error: Error): StackFrame[];
  static generateErrorReport(error: unknown, context: ErrorContext): ErrorReport;
}
```

### Template Processing Utilities
Functions for processing code templates and generating boilerplate:

```typescript
// template.utils.ts
export class TemplateUtils {
  // Template loading
  static loadTemplate(templateName: string): Promise<string>;
  static loadTemplateSet(templateSetName: string): Promise<TemplateSet>;
  static validateTemplate(template: string): TemplateValidationResult;
  static listAvailableTemplates(): Promise<string[]>;
  
  // Variable processing
  static processTemplate(template: string, variables: TemplateVariables): string;
  static validateTemplateVariables(template: string, variables: TemplateVariables): ValidationError[];
  static extractRequiredVariables(template: string): string[];
  static generateDefaultVariables(moduleName: string): TemplateVariables;
  
  // Template generation
  static generateModuleTemplate(options: ModuleTemplateOptions): Promise<TemplateSet>;
  static generateServiceTemplate(serviceName: string, options: ServiceTemplateOptions): string;
  static generateRepositoryTemplate(repositoryName: string, options: RepositoryTemplateOptions): string;
  static generateCLITemplate(commandName: string, options: CLITemplateOptions): string;
  
  // Template management
  static saveTemplate(name: string, template: string): Promise<void>;
  static deleteTemplate(name: string): Promise<void>;
  static updateTemplate(name: string, template: string): Promise<void>;
  static backupTemplate(name: string): Promise<string>;
}
```

## Implementation Standards

### Pure Function Requirements
All utility functions MUST be pure functions:
- No side effects (except for I/O operations in file system utils)
- Deterministic output for same inputs
- No global state dependencies
- No mutation of input parameters
- Proper error handling without throwing in pure functions

### Error Handling Pattern
All utilities MUST follow consistent error handling:

```typescript
// For pure functions that can fail
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

export class StringUtils {
  static validateModuleName(name: string): Result<boolean, ValidationError> {
    try {
      if (!name || name.trim().length === 0) {
        return { success: false, error: new ValidationError('Module name cannot be empty') };
      }
      
      if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(name)) {
        return { success: false, error: new ValidationError('Module name must be lowercase with hyphens') };
      }
      
      return { success: true, data: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }
}
```

### Type Safety Requirements
All utilities MUST provide comprehensive type safety:

```typescript
// Input validation with Zod schemas
import { z } from 'zod';

const ModuleNameSchema = z.string().min(1).max(255).regex(/^[a-z][a-z0-9-]*[a-z0-9]$/);
const FilePathSchema = z.string().min(1);

export class FileSystemUtils {
  static async readModuleFile(moduleName: unknown, fileName: unknown): Promise<Result<string, Error>> {
    try {
      const validatedModuleName = ModuleNameSchema.parse(moduleName);
      const validatedFileName = FilePathSchema.parse(fileName);
      
      const filePath = path.join('src/modules/core', validatedModuleName, validatedFileName);
      const content = await fs.readFile(filePath, 'utf8');
      
      return { success: true, data: content };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { success: false, error: new ValidationError('Invalid input parameters', error.errors) };
      }
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }
}
```

### Performance Requirements
Utilities MUST be optimized for performance:

```typescript
// Memoization for expensive operations
const memoize = <T extends (...args: any[]) => any>(fn: T): T => {
  const cache = new Map();
  return ((...args: any[]) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
};

export class TypeConversionUtils {
  // Memoized expensive conversion
  static readonly sqlTypeToTypeScript = memoize((sqlType: string): string => {
    // Expensive conversion logic
    return convertSqlToTypeScript(sqlType);
  });
}
```

## File System Utilities Implementation

### Path Resolution
```typescript
export class FileSystemUtils {
  private static readonly MODULE_BASE_PATH = 'src/modules/core';
  private static readonly TYPES_SUBPATH = 'types';
  private static readonly SCHEMA_SUBPATH = 'database/schema.sql';
  
  static resolveModulePath(moduleName: string): string {
    const validatedName = ModuleNameSchema.parse(moduleName);
    return path.resolve(this.MODULE_BASE_PATH, validatedName);
  }
  
  static getModuleTypesPath(moduleName: string): string {
    return path.join(this.resolveModulePath(moduleName), this.TYPES_SUBPATH);
  }
  
  static getModuleSchemaPath(moduleName: string): string {
    return path.join(this.resolveModulePath(moduleName), this.SCHEMA_SUBPATH);
  }
}
```

### Atomic File Operations
```typescript
export class FileSystemUtils {
  static async writeFileAtomic(filePath: string, content: string): Promise<Result<void, Error>> {
    try {
      const tempPath = `${filePath}.tmp`;
      await fs.writeFile(tempPath, content, 'utf8');
      await fs.rename(tempPath, filePath);
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }
  
  static async copyFileWithBackup(source: string, dest: string): Promise<Result<void, Error>> {
    try {
      // Create backup if destination exists
      if (await fs.pathExists(dest)) {
        const backupPath = `${dest}.backup.${Date.now()}`;
        await fs.copy(dest, backupPath);
      }
      
      await fs.copy(source, dest);
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }
}
```

## String Utilities Implementation

### Case Conversion Functions
```typescript
export class StringUtils {
  static toCamelCase(str: string): string {
    return str
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => 
        index === 0 ? word.toLowerCase() : word.toUpperCase()
      )
      .replace(/\s+/g, '');
  }
  
  static toPascalCase(str: string): string {
    return str
      .replace(/(?:^\w|[A-Z]|\b\w)/g, word => word.toUpperCase())
      .replace(/\s+/g, '');
  }
  
  static toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/\s+/g, '-')
      .toLowerCase();
  }
}
```

### Template Processing
```typescript
export class StringUtils {
  private static readonly TEMPLATE_VARIABLE_REGEX = /\{\{(\w+)\}\}/g;
  
  static replaceTemplateVariables(template: string, variables: Record<string, string>): string {
    return template.replace(this.TEMPLATE_VARIABLE_REGEX, (match, variableName) => {
      return variables[variableName] || match;
    });
  }
  
  static extractTemplateVariables(template: string): string[] {
    const variables = new Set<string>();
    let match;
    
    while ((match = this.TEMPLATE_VARIABLE_REGEX.exec(template)) !== null) {
      variables.add(match[1]);
    }
    
    return Array.from(variables);
  }
}
```

## Testing Requirements

### Unit Tests for Utilities
All utility functions MUST have comprehensive unit tests:

```typescript
describe('StringUtils', () => {
  describe('toCamelCase', () => {
    it('should convert kebab-case to camelCase', () => {
      expect(StringUtils.toCamelCase('hello-world-test')).toBe('helloWorldTest');
    });
    
    it('should handle empty strings', () => {
      expect(StringUtils.toCamelCase('')).toBe('');
    });
    
    it('should handle single words', () => {
      expect(StringUtils.toCamelCase('hello')).toBe('hello');
    });
  });
  
  describe('replaceTemplateVariables', () => {
    it('should replace all template variables', () => {
      const template = 'Hello {{name}}, you have {{count}} messages.';
      const variables = { name: 'John', count: '5' };
      const result = StringUtils.replaceTemplateVariables(template, variables);
      expect(result).toBe('Hello John, you have 5 messages.');
    });
    
    it('should leave unreplaced variables as-is', () => {
      const template = 'Hello {{name}}, you have {{unknown}} messages.';
      const variables = { name: 'John' };
      const result = StringUtils.replaceTemplateVariables(template, variables);
      expect(result).toBe('Hello John, you have {{unknown}} messages.');
    });
  });
});
```

### Integration Tests
Utilities MUST have integration tests for complex operations:

```typescript
describe('FileSystemUtils Integration', () => {
  const testModuleName = 'test-module';
  const testDir = path.join(__dirname, 'temp', testModuleName);
  
  beforeEach(async () => {
    await fs.ensureDir(testDir);
  });
  
  afterEach(async () => {
    await fs.remove(testDir);
  });
  
  it('should create and manage module file structure', async () => {
    // Test complete file system operations
    const modulePath = FileSystemUtils.resolveModulePath(testModuleName);
    await FileSystemUtils.ensureDirectoryExists(modulePath);
    
    const testContent = 'test content';
    const testFile = path.join(modulePath, 'test.ts');
    
    const writeResult = await FileSystemUtils.writeFileAtomic(testFile, testContent);
    expect(writeResult.success).toBe(true);
    
    const readResult = await FileSystemUtils.readFileIfExists(testFile);
    expect(readResult).toBe(testContent);
  });
});
```

## Performance Requirements

### Benchmarking
All utility functions MUST meet performance benchmarks:
- String manipulation: < 1ms for typical inputs
- File system operations: < 100ms for single file operations
- Type conversion: < 10ms for complex type transformations
- Template processing: < 5ms for typical template sizes

### Memory Management
- Efficient memory usage for large file operations
- Proper cleanup of temporary resources
- Streaming for large data processing
- Garbage collection optimization

### Caching Strategy
- Memoization for expensive pure functions
- File system path caching
- Template compilation caching
- Type conversion result caching