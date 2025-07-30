/* eslint-disable
  systemprompt-os/no-console-with-help,
  systemprompt-os/no-block-comments,
  systemprompt-os/enforce-constants-imports
*/
/**
 * System config CLI command.
 */

import { Command } from 'commander';
import { SystemService } from '@/modules/core/system/services/system.service';
import type { SystemConfigType } from '@/modules/core/system/types/index';

const ERROR_EXIT_CODE = 1;

/**
 * Creates a command for managing system configuration.
 * @returns The configured Commander command.
 */
export const createConfigCommand = (): Command => {
  return new Command('system:config')
    .description('Manage system configuration')
    .option('-g, --get <key>', 'Get configuration value')
    .option('-s, --set <key>', 'Set configuration value')
    .option('-v, --value <value>', 'Configuration value (with --set)')
    .option('-t, --type <type>', 'Value type (string, number, boolean, json)', 'string')
    .action(async (options): Promise<void> => {
      try {
        const service = SystemService.getInstance();
        await service.initialize();

        if (options.get) {
          const value = await service.getConfig(options.get);
          if (value === null) {
            console.log(`Configuration not found: ${options.get}`);
          } else {
            console.log(value);
          }
        } else if (options.set && options.value) {
          const type = options.type as SystemConfigType;
          await service.setConfig(options.set, options.value, type);
          console.log(`Configuration set: ${options.set} = ${options.value}`);
        } else {
          console.log('Use --get to retrieve or --set with --value to update configuration');
        }
      } catch (error) {
        console.error('Error managing configuration:', error);
        process.exit(ERROR_EXIT_CODE);
      }
    });
};
