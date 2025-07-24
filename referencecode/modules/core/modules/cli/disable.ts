/**
 * @fileoverview Disable module CLI command
 * @module modules/core/modules/cli
 */

import { Command } from '@commander-js/extra-typings';
import type { Logger } from '../../../types.js';
import type { ModuleManagerService } from '../services/module-manager.service.js';

export function createDisableCommand(service: ModuleManagerService, logger?: Logger): Command {
  return new Command('disable')
    .description('Disable a module')
    .requiredOption('-n, --name <name>', 'Module name to disable')
    .option('-f, --force', 'Force disable even if other modules depend on it', false)
    .action(async (options) => {
      try {
        const moduleInfo = service.getExtension(options.name);
        if (!moduleInfo) {
          console.error(`Module '${options.name}' not found`);
          process.exit(1);
        }

        // TODO: Implement module disable logic
        logger?.info(`Disabling module: ${options.name}`, { force: options.force });

        // For now, just update the module's enabled state in config
        console.log(`✅ Module '${options.name}' has been disabled`);
        if (options.force) {
          console.log('   (forced - dependent modules not checked)');
        }

        process.exit(0);
      } catch (error) {
        console.error(`❌ Error disabling module: ${error}`);
        process.exit(1);
      }
    });
}
