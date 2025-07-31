/**
 * Module Validator
 * Validates module type safety and structure
 * @module dev/services/validation/validators
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import type { ILogger } from '@/modules/core/logger/types';
import { LogSource } from '@/modules/core/logger/types';
import type { IValidator, ModuleValidationResult, ValidationOptions } from '../types';

/**
 * Validator for module type safety and structure
 */
export class ModuleValidator implements IValidator<string, ModuleValidationResult> {
  constructor(private readonly logger: ILogger) {}

  /**
   * Validate a module
   * @param moduleName - Name of the module to validate
   * @param options - Validation options
   * @returns Module validation result
   */
  public async validate(
    moduleName: string,
    options?: ValidationOptions
  ): Promise<ModuleValidationResult> {
    const result: ModuleValidationResult = {
      module: moduleName,
      valid: true,
      errors: [],
      warnings: [],
      checks: {
        generatedTypesExist: false,
        serviceUsesGeneratedTypes: false,
        moduleExportsValid: false,
        noManualTypes: false,
        schemasValid: false,
        properServiceNaming: false,
      }
    };
    
    const modulePath = join(process.cwd(), `src/modules/core/${moduleName}`);
    
    // Check 1: Generated types exist
    const generatedFiles = [
      `types/database.generated.ts`,
      `types/${moduleName}.module.generated.ts`,
      `types/${moduleName}.service.generated.ts`
    ];
    
    result.checks.generatedTypesExist = generatedFiles.every(file => 
      existsSync(join(modulePath, file))
    );
    
    if (!result.checks.generatedTypesExist) {
      result.errors.push('Generated type files are missing. Run: dev generate-types --module ' + moduleName);
      result.valid = false;
    }
    
    // Check 2: No manual type definitions (except manual.ts)
    const typesDir = join(modulePath, 'types');
    if (existsSync(typesDir)) {
      const files = readdirSync(typesDir);
      const nonGeneratedFiles = files.filter(file => 
        !file.endsWith('.generated.ts') && 
        file !== 'manual.ts' && 
        file !== 'rules.md'
      );
      
      result.checks.noManualTypes = nonGeneratedFiles.length === 0;
      
      if (!result.checks.noManualTypes) {
        result.errors.push(`Found non-generated type files: ${nonGeneratedFiles.join(', ')}. All types should be auto-generated or in manual.ts.`);
        result.valid = false;
      }
    } else {
      result.checks.noManualTypes = true;
    }
    
    // Check 3: Proper service naming convention
    const servicesDir = join(modulePath, 'services');
    const servicePath = join(servicesDir, `${moduleName}.service.ts`);
    result.checks.properServiceNaming = existsSync(servicePath);
    
    if (!result.checks.properServiceNaming) {
      result.errors.push(`Service file must be named ${moduleName}.service.ts in the services directory`);
      result.valid = false;
    }
    
    // Check 4: Service uses generated types
    if (existsSync(servicePath)) {
      const serviceContent = readFileSync(servicePath, 'utf-8');
      
      // Check for imports from generated files
      const usesGeneratedTypes = 
        serviceContent.includes(`from '@/modules/core/${moduleName}/types/${moduleName}.module.generated'`) ||
        serviceContent.includes(`from '../types/${moduleName}.module.generated'`) ||
        serviceContent.includes(`from '@/modules/core/${moduleName}/types/database.generated'`) ||
        serviceContent.includes(`from '../types/database.generated'`);
      
      result.checks.serviceUsesGeneratedTypes = usesGeneratedTypes;
      
      if (!usesGeneratedTypes) {
        result.warnings.push('Service does not import generated types');
      }
      
      // Check for any type usage
      if (serviceContent.includes(': any')) {
        result.warnings.push('Service contains "any" types - consider using proper types');
      }
    }
    
    // Check 5: Module exports are valid
    const moduleIndexPath = join(modulePath, 'index.ts');
    if (existsSync(moduleIndexPath)) {
      const moduleContent = readFileSync(moduleIndexPath, 'utf-8');
      
      // Check if it imports the correct export interface
      const moduleExportInterfaceName = `I${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}ModuleExports`;
      const hasValidExports = 
        moduleContent.includes(`${moduleExportInterfaceName}`) && 
        (moduleContent.includes(`from '@/modules/core/${moduleName}/types/${moduleName}.service.generated'`) ||
         moduleContent.includes(`from './types/${moduleName}.service.generated'`));
      
      result.checks.moduleExportsValid = hasValidExports;
    }
    
    // Check 6: Validate schemas compile with TypeScript compiler
    if (result.checks.generatedTypesExist) {
      try {
        result.checks.schemasValid = await this.validateTypeScriptCompilation(moduleName);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push(`TypeScript compilation failed: ${errorMessage}`);
        result.checks.schemasValid = false;
        result.valid = false;
      }
    }
    
    // Overall validation
    result.valid = result.valid && 
      result.checks.generatedTypesExist && 
      result.checks.noManualTypes &&
      result.checks.properServiceNaming &&
      result.errors.length === 0;
    
    return result;
  }

  /**
   * Validate TypeScript compilation for a module
   * @param moduleName - Module name
   * @returns True if compilation succeeds
   */
  private async validateTypeScriptCompilation(moduleName: string): Promise<boolean> {
    // Create a temporary tsconfig that extends root but only includes this module
    const tempTsConfig = {
      extends: "./tsconfig.json",
      include: [`src/modules/core/${moduleName}/**/*`]
    };
    
    const tempConfigPath = `tsconfig.${moduleName}.temp.json`;
    writeFileSync(tempConfigPath, JSON.stringify(tempTsConfig, null, 2));
    
    try {
      // Run tsc with the temporary config
      execSync(`npx tsc -p ${tempConfigPath} --noEmit`, {
        cwd: process.cwd(),
        stdio: 'pipe'
      });
      
      return true;
    } catch (tscError: any) {
      const errorOutput = tscError.stdout?.toString() || tscError.stderr?.toString() || tscError.message;
      this.logger.error(LogSource.DEV, `TypeScript validation failed for ${moduleName}:`, { error: errorOutput });
      throw new Error(errorOutput);
    } finally {
      // Clean up temp file
      unlinkSync(tempConfigPath);
    }
  }
}