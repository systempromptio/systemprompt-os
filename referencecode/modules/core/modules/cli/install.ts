/**
 * @fileoverview Install module CLI command
 * @module modules/core/modules/cli
 */

import { Command } from '@commander-js/extra-typings';
import type { Logger } from '../../../types.js';
import type { ModuleManagerService } from '../services/module-manager.service.js';

export function createInstallCommand(service: ModuleManagerService, _logger?: Logger): Command {
  return new Command('install')
    .description('Install a module')
    .requiredOption('-n, --name <name>', 'Module name or path')
    .option('-v, --version <version>', 'Specific version to install')
    .option('-f, --force', 'Force installation even if already exists', false)
    .action(async (options) => {
      try {
        console.log(`Installing module '${options.name}'...`);

        await service.installExtension(options.name, {
          ...(options.version && { version: options.version }),
          force: options.force,
        });

        console.log(`✅ Module '${options.name}' installed successfully`);

        if (options.version) {
          console.log(`   Version: ${options.version}`);
        }

        console.log('\nNext steps:');
        console.log(
          `  1. Run 'systemprompt modules:enable -n ${options.name}' to enable the module`,
        );
        console.log(`  2. Run 'systemprompt modules:info -n ${options.name}' for details`);

        process.exit(0);
      } catch (error) {
        console.error(`❌ Error installing module: ${error}`);
        process.exit(1);
      }
    });
}
