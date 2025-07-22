/**
 * @fileoverview Module validation service for SystemPrompt OS
 * Validates module structure, manifest, and implementation
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load the module schema
const schemaPath = join(__dirname, '../schemas/module-schema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));

// Required directories for different module types
const REQUIRED_STRUCTURE = {
  service: ['index.ts', 'module.yaml'],
  daemon: ['index.ts', 'module.yaml'],
  plugin: ['index.ts', 'module.yaml'],
  core: ['index.ts', 'module.yaml'],
  extension: ['index.ts', 'module.yaml']
};

// Optional but recommended directories (not currently validated)
// const _RECOMMENDED_STRUCTURE = [
//   'README.md',
//   'cli',
//   'services',
//   'types',
//   'database',
//   'utils',
//   'tests'
// ];

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: 'schema' | 'structure' | 'implementation';
  message: string;
  path?: string;
}

export interface ValidationWarning {
  type: 'structure' | 'documentation' | 'testing';
  message: string;
  recommendation: string;
}

export interface ValidationOptions {
  strict?: boolean;
  fix?: boolean;
}

/**
 * Simple JSON Schema validator
 */
function validateAgainstSchema(data: any, schema: any): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Check required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (!data[field]) {
        errors.push({
          type: 'schema',
          message: `Missing required field: ${field}`
        });
      }
    }
  }
  
  // Check field types and patterns
  if (schema.properties) {
    for (const [key, fieldSchema] of Object.entries(schema.properties)) {
      const value = data[key];
      if (value !== undefined) {
        const fieldDef = fieldSchema as any;
        
        // Check type
        if (fieldDef.type && typeof value !== fieldDef.type) {
          if (!(fieldDef.type === 'array' && Array.isArray(value))) {
            errors.push({
              type: 'schema',
              message: `Field '${key}' must be of type ${fieldDef.type}`
            });
          }
        }
        
        // Check enum
        if (fieldDef.enum && !fieldDef.enum.includes(value)) {
          errors.push({
            type: 'schema',
            message: `Field '${key}' must be one of: ${fieldDef.enum.join(', ')}`
          });
        }
        
        // Check pattern
        if (fieldDef.pattern && typeof value === 'string') {
          const regex = new RegExp(fieldDef.pattern);
          if (!regex.test(value)) {
            errors.push({
              type: 'schema',
              message: `Field '${key}' does not match required pattern: ${fieldDef.pattern}`
            });
          }
        }
        
        // Check minLength
        if (fieldDef.minLength && typeof value === 'string' && value.length < fieldDef.minLength) {
          errors.push({
            type: 'schema',
            message: `Field '${key}' must be at least ${fieldDef.minLength} characters long`
          });
        }
      }
    }
  }
  
  return errors;
}

/**
 * Validates a module directory
 */
export async function validateModule(modulePath: string, options: ValidationOptions = {}): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  // Check if module directory exists
  if (!existsSync(modulePath)) {
    errors.push({
      type: 'structure',
      message: `Module directory does not exist: ${modulePath}`
    });
    return { valid: false, errors, warnings };
  }
  
  // Validate module.yaml exists and is valid
  const manifestPath = join(modulePath, 'module.yaml');
  if (!existsSync(manifestPath)) {
    errors.push({
      type: 'structure',
      message: 'module.yaml is required but not found',
      path: manifestPath
    });
    return { valid: false, errors, warnings };
  }
  
  // Parse and validate module.yaml
  let moduleConfig: any;
  try {
    const manifestContent = readFileSync(manifestPath, 'utf-8');
    moduleConfig = yaml.load(manifestContent);
  } catch (error) {
    errors.push({
      type: 'schema',
      message: `Failed to parse module.yaml: ${error}`,
      path: manifestPath
    });
    return { valid: false, errors, warnings };
  }
  
  // Validate against schema
  const schemaErrors = validateAgainstSchema(moduleConfig, schema);
  errors.push(...schemaErrors);
  
  // Validate module structure
  const moduleType = moduleConfig.type;
  const requiredFiles = REQUIRED_STRUCTURE[moduleType as keyof typeof REQUIRED_STRUCTURE] || REQUIRED_STRUCTURE.service;
  
  for (const required of requiredFiles) {
    const filePath = join(modulePath, required);
    if (!existsSync(filePath)) {
      errors.push({
        type: 'structure',
        message: `Required file missing: ${required}`,
        path: filePath
      });
    }
  }
  
  // Check for recommended structure
  const files = readdirSync(modulePath);
  
  if (!files.includes('README.md')) {
    warnings.push({
      type: 'documentation',
      message: 'README.md is missing',
      recommendation: 'Add a README.md file with module documentation, usage examples, and configuration options'
    });
  }
  
  // Check for tests in both module directory and global tests directory
  const moduleName = basename(modulePath);
  const projectRoot = join(dirname(dirname(dirname(dirname(modulePath)))));
  // Check both /tests/unit/modules/core/{module} and /tests/unit/modules/{module}
  const globalTestPath1 = join(projectRoot, 'tests', 'unit', 'modules', 'core', moduleName);
  const globalTestPath2 = join(projectRoot, 'tests', 'unit', 'modules', moduleName);
  
  if (!files.includes('tests') && !files.includes('test') && !existsSync(globalTestPath1) && !existsSync(globalTestPath2)) {
    warnings.push({
      type: 'testing',
      message: 'No tests directory found',
      recommendation: `Add tests in either ${modulePath}/tests or ${globalTestPath1}`
    });
  }
  
  // Validate CLI commands if defined
  if (moduleConfig.cli?.commands) {
    const cliDir = join(modulePath, 'cli');
    if (!existsSync(cliDir)) {
      errors.push({
        type: 'structure',
        message: 'CLI commands defined but cli/ directory is missing',
        path: cliDir
      });
    } else {
      // Check that CLI command files exist
      for (const command of moduleConfig.cli.commands) {
        const commandFile = join(cliDir, `${command.name}.ts`);
        if (!existsSync(commandFile)) {
          warnings.push({
            type: 'structure',
            message: `CLI command file missing: ${command.name}.ts`,
            recommendation: `Create ${commandFile} to implement the '${command.name}' command`
          });
        }
      }
    }
  }
  
  // Validate module implementation
  if (existsSync(join(modulePath, 'index.ts'))) {
    try {
      // Check if index.ts has expected content patterns
      const indexContent = readFileSync(join(modulePath, 'index.ts'), 'utf-8');
      
      // Check for class-based or function-based implementation
      const hasClassPattern = /export\s+class\s+\w+Module/m.test(indexContent) || 
                            /export\s+default\s+class/m.test(indexContent);
      const hasFunctionPattern = /export\s+(async\s+)?function\s+(initialize|start|stop|healthCheck)/m.test(indexContent);
      
      if (!hasClassPattern && !hasFunctionPattern) {
        warnings.push({
          type: 'structure',
          message: 'Module implementation pattern not detected',
          recommendation: 'Ensure index.ts exports either a Module class or the required functions (initialize, start, stop, healthCheck)'
        });
      }
    } catch (error) {
      warnings.push({
        type: 'structure',
        message: `Could not validate module implementation: ${error}`,
        recommendation: 'Ensure index.ts exports a valid module implementation'
      });
    }
  }
  
  // Check database structure if module has database dependency
  if (moduleConfig.dependencies?.includes('database')) {
    const dbDir = join(modulePath, 'database');
    if (!existsSync(dbDir)) {
      warnings.push({
        type: 'structure',
        message: 'Module depends on database but has no database/ directory',
        recommendation: 'Add database/ directory with schema.sql and migrations/'
      });
    } else {
      const schemaFile = join(dbDir, 'schema.sql');
      if (!existsSync(schemaFile)) {
        warnings.push({
          type: 'structure',
          message: 'database/schema.sql is missing',
          recommendation: 'Add schema.sql to define your database tables'
        });
      }
    }
  }
  
  // Strict mode additional checks
  if (options.strict) {
    // Check for proper TypeScript usage
    const tsFiles = files.filter(f => f.endsWith('.ts'));
    if (tsFiles.length === 0) {
      errors.push({
        type: 'implementation',
        message: 'No TypeScript files found in module (strict mode)'
      });
    }
    
    // Check for services directory if service module
    if (moduleType === 'service' && !files.includes('services')) {
      errors.push({
        type: 'structure',
        message: 'Service modules must have a services/ directory (strict mode)'
      });
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates all modules in a directory
 */
export async function validateAllModules(modulesPath: string): Promise<Map<string, ValidationResult>> {
  const results = new Map<string, ValidationResult>();
  
  if (!existsSync(modulesPath)) {
    return results;
  }
  
  const modules = readdirSync(modulesPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  for (const moduleName of modules) {
    const modulePath = join(modulesPath, moduleName);
    const result = await validateModule(modulePath);
    results.set(moduleName, result);
  }
  
  return results;
}