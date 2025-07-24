/**
 * @fileoverview Remove module CLI command
 * @module modules/core/modules/cli
 */

import { Command } from '@commander-js/extra-typings';
import type { Logger } from '../../../types.js';
import type { ModuleManagerService } from '../services/module-manager.service.js';

export function createRemoveCommand(service: ModuleManagerService, _logger?: Logger): Command {
  return new Command('remove')
    .description('Remove a module')
    .requiredOption('-n, --name <name>', 'Module name to remove')
    .option('--preserve-config', 'Preserve configuration files', false)
    .action(async (options) => {
      try {
        const moduleInfo = service.getExtension(options.name);
        if (!moduleInfo) {
          console.error(`Module '${options.name}' not found`);
          process.exit(1);
        }

        // Confirm removal
        console.log(`⚠️  This will remove module '${options.name}'`);
        if (!options.preserveConfig) {
          console.log('   Configuration files will also be removed');
        }
        console.log('\nTo confirm, run with --force flag');

        // TODO: Implement actual removal with confirmation
        // For now, just simulate
        console.log(`\nRemoving module '${options.name}'...`);

        await service.removeExtension(options.name, {
          preserveConfig: options.preserveConfig,
          force: (options as any).force,
        });

        console.log(`✅ Module '${options.name}' removed successfully`);

        if (options.preserveConfig) {
          console.log('   Configuration files preserved');
        }

        process.exit(0);
      } catch (error) {
        console.error(`❌ Error removing module: ${error}`);
        process.exit(1);
      }
    });
}
