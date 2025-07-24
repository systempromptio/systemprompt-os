/**
 * @fileoverview Validate module structure CLI command
 * @module modules/core/modules/cli
 */

import { Command } from '@commander-js/extra-typings';
import type { Logger } from '../../../types.js';
import type { ModuleManagerService } from '../services/module-manager.service.js';
import { existsSync } from 'fs';
import { resolve } from 'path';

export function createValidateCommand(service: ModuleManagerService, _logger?: Logger): Command {
  return new Command('validate')
    .description('Validate module structure and configuration')
    .option('-p, --path <path>', 'Path to module directory')
    .option('-a, --all', 'Validate all modules in the core directory', false)
    .option('-s, --strict', 'Use strict validation rules', false)
    .option('-f, --fix', 'Attempt to fix common issues', false)
    .action(async (options) => {
      try {
        if (options.all) {
          // Validate all modules
          console.log('Validating all modules...\n');

          const extensions = service.getExtensions();
          let hasErrors = false;

          for (const ext of extensions) {
            console.log(`Validating ${ext.name}...`);
            const result = service.validateExtension(ext.path || ext.name, options.strict);

            if (result.valid) {
              console.log(`✅ ${ext.name} - Valid`);
            } else {
              console.log(`❌ ${ext.name} - Invalid`);
              result.errors.forEach((error) => {
                console.log(`   - ${error}`);
              });
              hasErrors = true;
            }
            console.log();
          }

          if (hasErrors) {
            console.log('❌ Some modules have validation errors');
            process.exit(1);
          } else {
            console.log('✅ All modules are valid');
            process.exit(0);
          }
        } else {
          // Validate specific module
          const modulePath = options.path ? resolve(options.path) : process.cwd();

          if (!existsSync(modulePath)) {
            console.error(`❌ Path does not exist: ${modulePath}`);
            process.exit(1);
          }

          console.log(`Validating module at: ${modulePath}\n`);

          const result = service.validateExtension(modulePath, options.strict);

          if (result.valid) {
            console.log('✅ Module structure is valid');

            if (result.warnings && result.warnings.length > 0) {
              console.log('\n⚠️  Warnings:');
              result.warnings.forEach((warning) => {
                console.log(`   - ${warning}`);
              });
            }

            process.exit(0);
          } else {
            console.log('❌ Module structure is invalid\n');
            console.log('Errors:');
            result.errors.forEach((error) => {
              console.log(`   - ${error}`);
            });

            if (options.fix) {
              console.log('\n🔧 Attempting to fix issues...');
              // TODO: Implement fix logic
              console.log('   (Fix functionality not yet implemented)');
            }

            process.exit(1);
          }
        }
      } catch (error) {
        console.error(`❌ Error validating module: ${error}`);
        process.exit(1);
      }
    });
}
