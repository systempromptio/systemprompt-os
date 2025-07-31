/**
 * Module Validator
 * Validates module type safety and structure.
 * @module dev/services/validation/validators
 */

import {
 existsSync, readFileSync, readdirSync
} from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { unlinkSync, writeFileSync } from 'fs';
import type { ILogger } from '@/modules/core/logger/types';
import { LogSource } from '@/modules/core/logger/types';
import type {
 IValidator, ModuleValidationResult, ValidationOptions
} from '@/modules/core/dev/services/validation/types';

/**
 * Validator for module type safety and structure.
 */
export class ModuleValidator implements IValidator<string, ModuleValidationResult> {
  constructor(private readonly logger: ILogger) {}

  /**
   * Validate a module.
   * @param moduleName - Name of the module to validate.
   * @param options - Validation options.
   * @param _options
   * @returns Module validation result.
   */
  public async validate(
    moduleName: string,
    _options?: ValidationOptions
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

    const generatedFiles = [
      `types/database.generated.ts`,
      `types/${moduleName}.module.generated.ts`,
      `types/${moduleName}.service.generated.ts`
    ];

    result.checks.generatedTypesExist = generatedFiles.every(file =>
      { return existsSync(join(modulePath, file)) });

    if (!result.checks.generatedTypesExist) {
      result.errors.push(`Generated type files are missing. Run: dev generate-types --module ${moduleName}`);
      result.valid = false;
    }

    const typesDir = join(modulePath, 'types');
    if (existsSync(typesDir)) {
      const files = readdirSync(typesDir);
      const nonGeneratedFiles = files.filter(file =>
        { return !file.endsWith('.generated.ts')
        && file !== 'manual.ts'
        && file !== 'rules.md' });

      result.checks.noManualTypes = nonGeneratedFiles.length === 0;

      if (!result.checks.noManualTypes) {
        result.errors.push(`Found non-generated type files: ${nonGeneratedFiles.join(', ')}. All types should be auto-generated or in manual.ts.`);
        result.valid = false;
      }
    } else {
      result.checks.noManualTypes = true;
    }

    const servicesDir = join(modulePath, 'services');
    const servicePath = join(servicesDir, `${moduleName}.service.ts`);
    result.checks.properServiceNaming = existsSync(servicePath);

    if (!result.checks.properServiceNaming) {
      result.errors.push(`Service file must be named ${moduleName}.service.ts in the services directory`);
      result.valid = false;
    }

    if (existsSync(servicePath)) {
      const serviceContent = readFileSync(servicePath, 'utf-8');

      const usesGeneratedTypes
        = serviceContent.includes(`from '@/modules/core/${moduleName}/types/${moduleName}.module.generated'`)
        || serviceContent.includes(`from '../types/${moduleName}.module.generated'`)
        || serviceContent.includes(`from '@/modules/core/${moduleName}/types/database.generated'`)
        || serviceContent.includes(`from '../types/database.generated'`);

      result.checks.serviceUsesGeneratedTypes = usesGeneratedTypes;

      if (!usesGeneratedTypes) {
        result.warnings.push('Service does not import generated types');
      }

      if (serviceContent.includes(': any')) {
        result.warnings.push('Service contains "any" types - consider using proper types');
      }
    }

    const moduleIndexPath = join(modulePath, 'index.ts');
    if (existsSync(moduleIndexPath)) {
      const moduleContent = readFileSync(moduleIndexPath, 'utf-8');

      const moduleExportInterfaceName = `I${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}ModuleExports`;
      const hasValidExports
        = moduleContent.includes(moduleExportInterfaceName)
        && (moduleContent.includes(`from '@/modules/core/${moduleName}/types/${moduleName}.service.generated'`)
         || moduleContent.includes(`from './types/${moduleName}.service.generated'`));

      result.checks.moduleExportsValid = hasValidExports;
    }

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

    result.valid = result.valid
      && result.checks.generatedTypesExist
      && result.checks.noManualTypes
      && result.checks.properServiceNaming
      && result.errors.length === 0;

    return result;
  }

  /**
   * Validate TypeScript compilation for a module.
   * @param moduleName - Module name.
   * @returns True if compilation succeeds.
   */
  private async validateTypeScriptCompilation(moduleName: string): Promise<boolean> {
    const tempTsConfig = {
      extends: "./tsconfig.json",
      include: [`src/modules/core/${moduleName}/**/*`]
    };

    const tempConfigPath = `tsconfig.${moduleName}.temp.json`;
    writeFileSync(tempConfigPath, JSON.stringify(tempTsConfig, null, 2));

    try {
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
      unlinkSync(tempConfigPath);
    }
  }
}
