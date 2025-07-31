/**
 * CLI command to validate module type safety
 * Checks that a module properly uses generated types and validates against schemas
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types';
import { ValidationService, ModuleValidator, type ModuleValidationResult } from '@/modules/core/dev/services/validation';

export const command: ICLICommand = {
  description: 'Validate that a module is fully type-safe using generated types',
  
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const output = CliOutputService.getInstance();
    const logger = LoggerService.getInstance();
    
    const moduleName = args.module as string;
    
    if (!moduleName) {
      output.error('Module name is required');
      output.info('Usage: dev validate --module <module-name>');
      process.exit(1);
    }
    
    output.section(`Validating ${moduleName} module`);
    
    try {
      // Initialize validation service
      const validationService = ValidationService.getInstance(logger);
      const moduleValidator = new ModuleValidator(logger);
      validationService.registerValidator('module', moduleValidator);
      
      const result = await validationService.validate<string, ModuleValidationResult>('module', moduleName, {
        throwOnError: false,
        logWarnings: false
      });
      
      // Display checks
      output.info('Type Safety Checks:');
      output.keyValue({
        'Generated types exist': result.checks.generatedTypesExist ? '✅' : '❌',
        'Service uses generated types': result.checks.serviceUsesGeneratedTypes ? '✅' : '❌',
        'Module exports valid': result.checks.moduleExportsValid ? '✅' : '❌',
        'No manual type definitions': result.checks.noManualTypes ? '✅' : '❌',
        'Schemas compile correctly': result.checks.schemasValid ? '✅' : '❌',
      });
      
      // Display warnings
      if (result.warnings.length > 0) {
        output.info('\nWarnings:');
        result.warnings.forEach(warning => output.info(`  • ${warning}`));
      }
      
      // Display errors
      if (result.errors.length > 0) {
        output.error('\nErrors:');
        result.errors.forEach(error => output.error(`  • ${error}`));
      }
      
      // Final result
      if (result.valid) {
        output.success(`\n✅ ${moduleName} module is fully type-safe!`);
        process.exit(0);
      } else {
        output.error(`\n❌ ${moduleName} module has type safety issues`);
        process.exit(1);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      output.error(`❌ Validation failed: ${errorMessage}`);
      logger.error(LogSource.DEV, `Module validation failed: ${errorMessage}`);
      process.exit(1);
    }
  }
};