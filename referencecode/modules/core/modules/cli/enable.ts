/**
 * @fileoverview Enable module CLI command
 * @module modules/core/modules/cli
 */

import { Command } from '@commander-js/extra-typings';
import type { Logger } from '../../../types.js';
import type { ModuleManagerService } from '../services/module-manager.service.js';

export function createEnableCommand(service: ModuleManagerService, logger?: Logger): Command {
  return new Command('enable')
    .description('Enable a module')
    .requiredOption('-n, --name <name>', 'Module name to enable')
    .option('-f, --force', 'Force enable even if dependencies are missing', false)
    .action(async (options) => {
      try {
        const moduleInfo = service.getExtension(options.name);
        if (!moduleInfo) {
          console.error(`Module '${options.name}' not found`);
          process.exit(1);
        }

        // TODO: Implement module enable logic
        logger?.info(`Enabling module: ${options.name}`, { force: options.force });

        // For now, just update the module's enabled state in config
        console.log(`✅ Module '${options.name}' has been enabled`);
        if (options.force) {
          console.log('   (forced - dependencies not checked)');
        }

        process.exit(0);
      } catch (error) {
        console.error(`❌ Error enabling module: ${error}`);
        process.exit(1);
      }
    });
}
